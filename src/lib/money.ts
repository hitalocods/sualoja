export function assertCentavos(valor: number, campo = "valor"): number {
  if (!Number.isSafeInteger(valor) || valor < 0) {
    throw new RangeError(
      `Campo "${campo}" deve ser um inteiro em centavos >= 0 (recebido: ${valor}).`,
    );
  }
  return valor;
}

export function formatarCentavos(centavos: number): string {
  assertCentavos(centavos, "centavos");
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(centavos / 100);
}

function formatarCentavosAscii(centavos: number): string {
  return formatarCentavos(centavos).replace(/\u00a0/g, " ");
}

export function percentualParaBasisPoints(
  taxaPercentual: string | number,
): number {
  const texto = String(taxaPercentual).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
    throw new RangeError(`Percentual inválido: "${taxaPercentual}"`);
  }
  const [intPart, decPart = ""] = texto.split(".");
  return Number(intPart) * 100 + Number(decPart.padEnd(2, "0"));
}

export function calcularTaxaServicoCentavos(params: {
  subtotal_centavos: number;
  taxa_fixa_centavos: number;
  taxa_percentual: string | number;
}): number {
  const subtotal = assertCentavos(params.subtotal_centavos, "subtotal_centavos");
  const taxaFixa = assertCentavos(
    params.taxa_fixa_centavos,
    "taxa_fixa_centavos",
  );
  const bps = percentualParaBasisPoints(params.taxa_percentual);
  const taxaVariavel = Math.round((subtotal * bps) / 10000);
  return taxaFixa + taxaVariavel;
}

export type CalculoSplitErrorCode =
  | "PEDIDO_MINIMO_LOJA"
  | "PEDIDO_MINIMO_PLATAFORMA"
  | "VALOR_MUITO_BAIXO"
  | "SPLIT_INVARIANT_VIOLATION";

export class CalculoSplitError extends Error {
  readonly code: CalculoSplitErrorCode;

  constructor(code: CalculoSplitErrorCode, message: string) {
    super(message);
    this.name = "CalculoSplitError";
    this.code = code;
  }
}

export type ItemCalculoServidor = {
  preco_centavos: number;
  qtd: number;
};

export type ResumoPedidoServidor = {
  subtotal_centavos: number;
  frete_centavos: number;
  taxa_servico_centavos: number;
  total_centavos: number;
};

export function calcularResumoPedidoServidor(params: {
  itens: ItemCalculoServidor[];
  tipo: "entrega" | "retirada";
  frete_base_centavos: number;
  frete_gratis_acima_centavos: number | null;
  pedido_minimo_centavos: number;
  taxa_fixa_centavos: number;
  taxa_percentual: string | number;
  taxa_paga_por: "cliente" | "loja";
}): ResumoPedidoServidor {
  if (params.itens.length === 0) {
    throw new Error("O pedido precisa ter pelo menos 1 item.");
  }

  let subtotal_centavos = 0;
  for (const item of params.itens) {
    const preco = assertCentavos(item.preco_centavos, "preco_centavos");
    if (!Number.isSafeInteger(item.qtd) || item.qtd <= 0) {
      throw new RangeError(`Quantidade inválida para item: ${item.qtd}`);
    }
    subtotal_centavos += preco * item.qtd;
  }

  const pedidoMinimo = assertCentavos(
    params.pedido_minimo_centavos,
    "pedido_minimo_centavos",
  );
  if (subtotal_centavos < pedidoMinimo) {
    throw new CalculoSplitError(
      "PEDIDO_MINIMO_LOJA",
      `Pedido mínimo de ${formatarCentavosAscii(pedidoMinimo)}`,
    );
  }

  let frete_centavos = 0;
  if (params.tipo === "entrega") {
    const freteBase = assertCentavos(
      params.frete_base_centavos,
      "frete_base_centavos",
    );
    const gratisAcima =
      params.frete_gratis_acima_centavos === null
        ? null
        : assertCentavos(
            params.frete_gratis_acima_centavos,
            "frete_gratis_acima_centavos",
          );
    frete_centavos =
      gratisAcima !== null && subtotal_centavos >= gratisAcima ? 0 : freteBase;
  }

  const taxa_servico_centavos = calcularTaxaServicoCentavos({
    subtotal_centavos,
    taxa_fixa_centavos: params.taxa_fixa_centavos,
    taxa_percentual: params.taxa_percentual,
  });

  const total_centavos =
    subtotal_centavos +
    frete_centavos +
    (params.taxa_paga_por === "cliente" ? taxa_servico_centavos : 0);

  return {
    subtotal_centavos,
    frete_centavos,
    taxa_servico_centavos,
    total_centavos,
  };
}

export const PEDIDO_MINIMO_PLATAFORMA_PADRAO_CENTAVOS = 1000;
export const TARIFA_GATEWAY_PIX_PADRAO_CENTAVOS = 80;
export const MARGEM_MINIMA_PADRAO_CENTAVOS = 30;
export const PEDIDO_TIPICO_AVISO_PLANO_CENTAVOS = 3000;
export const MINIMO_LOJISTA_CENTAVOS = 1;

export interface CalculoSplitPedidoInput {
  itens: Array<{
    preco_centavos: number;
    qtd: number;
  }>;
  tipo: "entrega" | "retirada";
  frete_base_centavos: number;
  frete_gratis_acima_centavos: number | null;
  pedido_minimo_centavos: number;
  taxa_fixa_centavos: number;
  taxa_percentual: string | number;
  taxa_paga_por: "cliente" | "loja";
  pedido_minimo_plataforma_centavos?: number;
  tarifa_gateway_pix_centavos?: number;
  margem_minima_centavos?: number;
}

export interface CalculoSplitPedidoResult {
  subtotal_centavos: number;
  frete_centavos: number;
  taxa_servico_centavos: number;
  total_centavos: number;
  parte_lojista_centavos: number;
  parte_plataforma_centavos: number;
  taxa_plano_original_centavos: number;
  piso_taxa_aplicado: boolean;
  piso_taxa_centavos: number;
  tarifa_gateway_pix_centavos: number;
}

export function calcularResumoESplitServidor(
  input: CalculoSplitPedidoInput,
): CalculoSplitPedidoResult {
  const resumo = calcularResumoPedidoServidor({
    itens: input.itens,
    tipo: input.tipo,
    frete_base_centavos: input.frete_base_centavos,
    frete_gratis_acima_centavos: input.frete_gratis_acima_centavos,
    pedido_minimo_centavos: input.pedido_minimo_centavos,
    taxa_fixa_centavos: input.taxa_fixa_centavos,
    taxa_percentual: input.taxa_percentual,
    taxa_paga_por: input.taxa_paga_por,
  });

  const pedidoMinimoPlataforma = assertCentavos(
    input.pedido_minimo_plataforma_centavos ??
      PEDIDO_MINIMO_PLATAFORMA_PADRAO_CENTAVOS,
    "pedido_minimo_plataforma_centavos",
  );
  const tarifaGateway = assertCentavos(
    input.tarifa_gateway_pix_centavos ?? TARIFA_GATEWAY_PIX_PADRAO_CENTAVOS,
    "tarifa_gateway_pix_centavos",
  );
  const margemMinima = assertCentavos(
    input.margem_minima_centavos ?? MARGEM_MINIMA_PADRAO_CENTAVOS,
    "margem_minima_centavos",
  );

  const pisoTaxa = tarifaGateway + margemMinima;
  const taxaPlanoOriginal = resumo.taxa_servico_centavos;
  let pisoAplicado = taxaPlanoOriginal < pisoTaxa;
  let taxaEfetiva = pisoAplicado ? pisoTaxa : taxaPlanoOriginal;

  const valorBrutoPedido = resumo.subtotal_centavos + resumo.frete_centavos;
  const montarSplit = (taxaPlataforma: number) => {
    const total =
      input.taxa_paga_por === "cliente"
        ? valorBrutoPedido + taxaPlataforma
        : valorBrutoPedido;
    const parteLojista =
      input.taxa_paga_por === "cliente"
        ? valorBrutoPedido
        : valorBrutoPedido - taxaPlataforma;
    return {
      total,
      parteLojista,
      partePlataforma: taxaPlataforma,
    };
  };

  let split = montarSplit(taxaEfetiva);

  // Garante invariante: soma dos splits enviados ao gateway <= total - tarifa_gateway_pix_centavos
  if (split.parteLojista > split.total - tarifaGateway) {
    taxaEfetiva = Math.max(pisoTaxa, tarifaGateway);
    pisoAplicado = true;
    split = montarSplit(taxaEfetiva);

    if (split.parteLojista > split.total - tarifaGateway) {
      throw new CalculoSplitError(
        "SPLIT_INVARIANT_VIOLATION",
        "Invariante de split violada: soma dos splits excede o valor líquido após tarifa do gateway.",
      );
    }
  }

  if (split.parteLojista < MINIMO_LOJISTA_CENTAVOS) {
    throw new CalculoSplitError(
      "VALOR_MUITO_BAIXO",
      "Valor muito baixo para pagamento via Pix: a taxa do plano excede o valor líquido destinado à loja.",
    );
  }

  if (split.total < pedidoMinimoPlataforma) {
    throw new CalculoSplitError(
      "PEDIDO_MINIMO_PLATAFORMA",
      `Valor abaixo do pedido mínimo da plataforma (${formatarCentavosAscii(pedidoMinimoPlataforma)}).`,
    );
  }

  if (split.parteLojista + split.partePlataforma !== split.total) {
    throw new CalculoSplitError(
      "SPLIT_INVARIANT_VIOLATION",
      "Inconsistência no cálculo do split do pedido.",
    );
  }

  return {
    subtotal_centavos: resumo.subtotal_centavos,
    frete_centavos: resumo.frete_centavos,
    taxa_servico_centavos: taxaEfetiva,
    total_centavos: split.total,
    parte_lojista_centavos: split.parteLojista,
    parte_plataforma_centavos: split.partePlataforma,
    taxa_plano_original_centavos: taxaPlanoOriginal,
    piso_taxa_aplicado: pisoAplicado,
    piso_taxa_centavos: pisoTaxa,
    tarifa_gateway_pix_centavos: tarifaGateway,
  };
}

export interface AvaliacaoTarifaPlanoTipico {
  pedido_tipico_centavos: number;
  taxa_pedido_tipico_centavos: number;
  piso_minimo_centavos: number;
  abaixo_do_piso: boolean;
}

export function avaliarTarifaPlanoPedidoTipico(params: {
  taxa_fixa_centavos: number;
  taxa_percentual: string | number;
  tarifa_gateway_pix_centavos?: number;
  margem_minima_centavos?: number;
  pedido_tipico_centavos?: number;
}): AvaliacaoTarifaPlanoTipico {
  const pedidoTipico = assertCentavos(
    params.pedido_tipico_centavos ?? PEDIDO_TIPICO_AVISO_PLANO_CENTAVOS,
    "pedido_tipico_centavos",
  );
  const tarifaGateway = assertCentavos(
    params.tarifa_gateway_pix_centavos ?? TARIFA_GATEWAY_PIX_PADRAO_CENTAVOS,
    "tarifa_gateway_pix_centavos",
  );
  const margemMinima = assertCentavos(
    params.margem_minima_centavos ?? MARGEM_MINIMA_PADRAO_CENTAVOS,
    "margem_minima_centavos",
  );
  const taxaPedidoTipico = calcularTaxaServicoCentavos({
    subtotal_centavos: pedidoTipico,
    taxa_fixa_centavos: params.taxa_fixa_centavos,
    taxa_percentual: params.taxa_percentual,
  });
  const pisoMinimo = tarifaGateway + margemMinima;

  return {
    pedido_tipico_centavos: pedidoTipico,
    taxa_pedido_tipico_centavos: taxaPedidoTipico,
    piso_minimo_centavos: pisoMinimo,
    abaixo_do_piso: taxaPedidoTipico < pisoMinimo,
  };
}

export interface PedidoParaSplit {
  subtotal_centavos: number;
  frete_centavos: number;
  taxa_servico_centavos: number;
  taxa_paga_por: "cliente" | "loja";
  total_centavos: number;
}

/** Calcula a parte do lojista gravada no pedido após validar a consistência dos centavos. */
export function calcularParteLojistaDoPedido(pedido: PedidoParaSplit): number {
  const subtotal = assertCentavos(pedido.subtotal_centavos, "subtotal_centavos");
  const frete = assertCentavos(pedido.frete_centavos, "frete_centavos");
  const taxa = assertCentavos(
    pedido.taxa_servico_centavos,
    "taxa_servico_centavos",
  );
  const total = assertCentavos(pedido.total_centavos, "total_centavos");

  const expectedTotal =
    subtotal + frete + (pedido.taxa_paga_por === "cliente" ? taxa : 0);
  if (expectedTotal !== total) {
    throw new Error(
      `Total inconsistente no pedido: esperado ${expectedTotal} centavos (${subtotal} + ${frete}${pedido.taxa_paga_por === "cliente" ? ` + ${taxa}` : ""}), gravado ${total} centavos.`,
    );
  }

  const parteLojista = total - taxa;
  if (parteLojista < 0) {
    throw new Error(
      `Parte do lojista negativa (${parteLojista} centavos): total=${total}, taxa_servico_centavos=${taxa}.`,
    );
  }

  return parteLojista;
}

/** Garante que o saldo disponível da subconta aumentou exatamente pelo split esperado do pedido. */
export function validarAumentoSaldoSubconta(params: {
  subAccountId: string;
  codigoPedido: string;
  saldoAntesCentavos: number;
  saldoDepoisCentavos: number;
  splitEsperadoCentavos: number;
}): { deltaCentavos: number } {
  const saldoAntes = assertCentavos(
    params.saldoAntesCentavos,
    "saldoAntesCentavos",
  );
  const saldoDepois = assertCentavos(
    params.saldoDepoisCentavos,
    "saldoDepoisCentavos",
  );
  const splitEsperado = assertCentavos(
    params.splitEsperadoCentavos,
    "splitEsperadoCentavos",
  );

  const deltaCentavos = saldoDepois - saldoAntes;
  if (deltaCentavos !== splitEsperado) {
    throw new Error(
      [
        `Divergência no split da subconta ${params.subAccountId} para o pedido ${params.codigoPedido}:`,
        `- Split esperado (parte do lojista gravada no pedido): ${splitEsperado} centavos (${formatarCentavosAscii(splitEsperado)})`,
        `- Aumento real no saldo disponível da subconta: ${deltaCentavos} centavos (${deltaCentavos >= 0 ? formatarCentavosAscii(deltaCentavos) : `${deltaCentavos} centavos`}) [antes=${saldoAntes}, depois=${saldoDepois}]`,
      ].join("\n"),
    );
  }

  return { deltaCentavos };
}

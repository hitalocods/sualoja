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
    throw new Error(
      `Pedido abaixo do mínimo da loja (${formatarCentavos(pedidoMinimo)}).`,
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
}

export interface CalculoSplitPedidoResult {
  subtotal_centavos: number;
  frete_centavos: number;
  taxa_servico_centavos: number;
  total_centavos: number;
  parte_lojista_centavos: number;
  parte_plataforma_centavos: number;
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

  const valorBrutoPedido = resumo.subtotal_centavos + resumo.frete_centavos;
  const partePlataforma = resumo.taxa_servico_centavos;
  const parteLojista =
    input.taxa_paga_por === "cliente"
      ? valorBrutoPedido
      : valorBrutoPedido - partePlataforma;

  if (parteLojista < MINIMO_LOJISTA_CENTAVOS) {
    throw new Error(
      "A taxa do plano excede o valor líquido destinado à loja neste pedido.",
    );
  }

  if (resumo.total_centavos < pedidoMinimoPlataforma) {
    throw new Error(
      `O valor total do pedido (${formatarCentavos(resumo.total_centavos)}) é inferior ao mínimo da plataforma (${formatarCentavos(pedidoMinimoPlataforma)}).`,
    );
  }

  if (parteLojista + partePlataforma !== resumo.total_centavos) {
    throw new Error("Inconsistência no cálculo do split do pedido.");
  }

  return {
    subtotal_centavos: resumo.subtotal_centavos,
    frete_centavos: resumo.frete_centavos,
    taxa_servico_centavos: resumo.taxa_servico_centavos,
    total_centavos: resumo.total_centavos,
    parte_lojista_centavos: parteLojista,
    parte_plataforma_centavos: partePlataforma,
  };
}

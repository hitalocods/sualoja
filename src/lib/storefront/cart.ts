import {
  assertCentavos,
  calcularTaxaServicoCentavos,
  MARGEM_MINIMA_PADRAO_CENTAVOS,
  PEDIDO_MINIMO_PLATAFORMA_PADRAO_CENTAVOS,
  TARIFA_GATEWAY_PIX_PADRAO_CENTAVOS,
} from "../money";

export const TAXA_SERVICO_PLACEHOLDER_CENTAVOS = 0;

export type CartStorageItem = {
  produtoId: string;
  qtd: number;
};

export type ProdutoPublico = {
  id: string;
  nome: string;
  descricao: string | null;
  preco_centavos: number;
  imagem_url: string | null;
  estoque: number;
  categoria: string;
};

export type BairroPublico = {
  id: string;
  bairro: string;
  valor_centavos: number;
};

export type EntregaPublica = {
  aceita_retirada: boolean;
  aceita_entrega: boolean;
  modo_frete: "fixo" | "bairro";
  frete_fixo_centavos: number;
  frete_gratis_acima_centavos: number | null;
  pedido_minimo_centavos: number;
  tempo_estimado_min: number;
};

export type CartResolvedItem = {
  produto: ProdutoPublico;
  qtd: number;
  subtotal_centavos: number;
};

export type CheckoutPreview = {
  subtotal_centavos: number;
  frete_centavos: number;
  frete_gratis_atingido: boolean;
  bairro_pendente: boolean;
  taxa_servico_centavos: number;
  total_centavos: number;
  pedido_minimo_atingido: boolean;
  falta_pedido_minimo_centavos: number;
  falta_frete_gratis_centavos: number | null;
  pedido_minimo_plataforma_atingido: boolean;
  falta_pedido_minimo_plataforma_centavos: number;
};

export function cartStorageKey(slug: string): string {
  return `minhaloja:cart:${slug.trim().toLowerCase()}`;
}

export function reconciliarCarrinhoComEstoque(
  rawItems: CartStorageItem[],
  produtos: ProdutoPublico[],
): CartStorageItem[] {
  const mapaProdutos = new Map(produtos.map((p) => [p.id, p]));
  const consolidado = new Map<string, number>();

  for (const item of rawItems) {
    if (!item || typeof item.produtoId !== "string") continue;
    const produto = mapaProdutos.get(item.produtoId);
    if (!produto || produto.estoque <= 0) continue;

    const qtdLimpa = Math.floor(Number(item.qtd));
    if (!Number.isFinite(qtdLimpa) || qtdLimpa <= 0) continue;

    const acumulado = (consolidado.get(produto.id) ?? 0) + qtdLimpa;
    consolidado.set(produto.id, Math.min(acumulado, produto.estoque));
  }

  return Array.from(consolidado.entries()).map(([produtoId, qtd]) => ({
    produtoId,
    qtd,
  }));
}

export function definirQuantidadeItem(
  items: CartStorageItem[],
  produtoId: string,
  qtdDesejada: number,
  estoqueDisponivel: number,
): CartStorageItem[] {
  const estoque = Math.max(0, Math.floor(estoqueDisponivel));
  const qtdFinal = Math.min(Math.max(0, Math.floor(qtdDesejada)), estoque);

  if (estoque <= 0 || qtdFinal <= 0) {
    return items.filter((item) => item.produtoId !== produtoId);
  }

  const existe = items.some((item) => item.produtoId === produtoId);
  if (!existe) {
    return [...items, { produtoId, qtd: qtdFinal }];
  }

  return items.map((item) =>
    item.produtoId === produtoId ? { ...item, qtd: qtdFinal } : item,
  );
}

export function alterarQuantidadeItem(
  items: CartStorageItem[],
  produtoId: string,
  delta: number,
  estoqueDisponivel: number,
): CartStorageItem[] {
  const atual = items.find((item) => item.produtoId === produtoId)?.qtd ?? 0;
  return definirQuantidadeItem(items, produtoId, atual + delta, estoqueDisponivel);
}

export function resolverItensCarrinho(
  items: CartStorageItem[],
  produtos: ProdutoPublico[],
): CartResolvedItem[] {
  const mapaProdutos = new Map(produtos.map((p) => [p.id, p]));
  const resolvidos: CartResolvedItem[] = [];

  for (const item of items) {
    const produto = mapaProdutos.get(item.produtoId);
    if (!produto || produto.estoque <= 0) continue;
    const qtd = Math.min(Math.max(0, Math.floor(item.qtd)), produto.estoque);
    if (qtd <= 0) continue;

    const preco = assertCentavos(produto.preco_centavos, "preco_centavos");
    resolvidos.push({
      produto,
      qtd,
      subtotal_centavos: preco * qtd,
    });
  }

  return resolvidos;
}

export interface TaxaCheckoutPreviewConfig {
  taxa_fixa_centavos: number;
  taxa_percentual: string | number;
  taxa_paga_por: "cliente" | "loja";
  tarifa_gateway_pix_centavos?: number;
  margem_minima_centavos?: number;
}

export function calcularCheckoutPreview(params: {
  itens: CartResolvedItem[];
  entrega: EntregaPublica;
  tipo: "entrega" | "retirada";
  bairroSelecionado: BairroPublico | null;
  taxaConfig?: TaxaCheckoutPreviewConfig;
  pedido_minimo_plataforma_centavos?: number;
}): CheckoutPreview {
  let subtotal_centavos = 0;
  for (const item of params.itens) {
    subtotal_centavos += assertCentavos(
      item.subtotal_centavos,
      "item.subtotal_centavos",
    );
  }

  const pedidoMinimo = assertCentavos(
    params.entrega.pedido_minimo_centavos,
    "pedido_minimo_centavos",
  );
  const pedido_minimo_atingido = subtotal_centavos >= pedidoMinimo;
  const falta_pedido_minimo_centavos = pedido_minimo_atingido
    ? 0
    : pedidoMinimo - subtotal_centavos;

  const gratisAcima =
    params.entrega.frete_gratis_acima_centavos === null
      ? null
      : assertCentavos(
          params.entrega.frete_gratis_acima_centavos,
          "frete_gratis_acima_centavos",
        );

  const frete_gratis_atingido =
    params.tipo === "entrega" &&
    gratisAcima !== null &&
    subtotal_centavos >= gratisAcima;

  const falta_frete_gratis_centavos =
    params.tipo === "entrega" && gratisAcima !== null && !frete_gratis_atingido
      ? gratisAcima - subtotal_centavos
      : null;

  const bairro_pendente =
    params.tipo === "entrega" &&
    params.entrega.modo_frete === "bairro" &&
    !params.bairroSelecionado;

  let frete_centavos = 0;
  if (params.tipo === "entrega" && !frete_gratis_atingido) {
    if (params.entrega.modo_frete === "fixo") {
      frete_centavos = assertCentavos(
        params.entrega.frete_fixo_centavos,
        "frete_fixo_centavos",
      );
    } else if (params.bairroSelecionado) {
      frete_centavos = assertCentavos(
        params.bairroSelecionado.valor_centavos,
        "bairro.valor_centavos",
      );
    }
  }

  let taxa_servico_centavos = TAXA_SERVICO_PLACEHOLDER_CENTAVOS;
  if (params.taxaConfig) {
    const taxaBruta = calcularTaxaServicoCentavos({
      subtotal_centavos,
      taxa_fixa_centavos: params.taxaConfig.taxa_fixa_centavos,
      taxa_percentual: params.taxaConfig.taxa_percentual,
    });
    const pisoMinimo =
      (params.taxaConfig.tarifa_gateway_pix_centavos ??
        TARIFA_GATEWAY_PIX_PADRAO_CENTAVOS) +
      (params.taxaConfig.margem_minima_centavos ??
        MARGEM_MINIMA_PADRAO_CENTAVOS);
    const taxaComPiso = Math.max(taxaBruta, pisoMinimo);
    taxa_servico_centavos =
      params.taxaConfig.taxa_paga_por === "cliente" ? taxaComPiso : 0;
  }

  const total_centavos =
    subtotal_centavos + frete_centavos + taxa_servico_centavos;

  const pedidoMinimoPlataforma = assertCentavos(
    params.pedido_minimo_plataforma_centavos ??
      PEDIDO_MINIMO_PLATAFORMA_PADRAO_CENTAVOS,
    "pedido_minimo_plataforma_centavos",
  );
  const pedido_minimo_plataforma_atingido =
    total_centavos >= pedidoMinimoPlataforma;
  const falta_pedido_minimo_plataforma_centavos =
    pedido_minimo_plataforma_atingido
      ? 0
      : pedidoMinimoPlataforma - total_centavos;

  return {
    subtotal_centavos,
    frete_centavos,
    frete_gratis_atingido,
    bairro_pendente,
    taxa_servico_centavos,
    total_centavos,
    pedido_minimo_atingido,
    falta_pedido_minimo_centavos,
    falta_frete_gratis_centavos,
    pedido_minimo_plataforma_atingido,
    falta_pedido_minimo_plataforma_centavos,
  };
}

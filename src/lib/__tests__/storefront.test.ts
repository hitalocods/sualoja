import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alterarQuantidadeItem,
  calcularCheckoutPreview,
  cartStorageKey,
  reconciliarCarrinhoComEstoque,
  resolverItensCarrinho,
  TAXA_SERVICO_PLACEHOLDER_CENTAVOS,
  type BairroPublico,
  type EntregaPublica,
  type ProdutoPublico,
} from "@/lib/storefront/cart";
import {
  calcularCorTextoContraste,
  FONTES_LOJA,
  normalizarCorHex,
  normalizarFonteLoja,
  resolverTemaLoja,
} from "@/lib/storefront/theme";

describe("Tema da Loja Pública", () => {
  it("aceita exatamente a lista fechada de 8 fontes com fallback para Inter", () => {
    assert.equal(FONTES_LOJA.length, 8);
    for (const fonte of [
      "Inter",
      "Poppins",
      "Playfair Display",
      "Montserrat",
      "DM Sans",
      "Lora",
      "Nunito",
      "Bebas Neue",
    ]) {
      assert.equal(normalizarFonteLoja(fonte.toLowerCase()), fonte);
    }
    assert.equal(normalizarFonteLoja("Comic Sans MS"), "Inter");
    assert.equal(normalizarFonteLoja(null), "Inter");
  });

  it("normaliza cores hex e bloqueia valores inválidos", () => {
    assert.equal(normalizarCorHex("#fff"), "#FFFFFF");
    assert.equal(normalizarCorHex(" #ea1d2c "), "#EA1D2C");
    assert.equal(normalizarCorHex("red; background: url(x)", "#18181B"), "#18181B");
  });

  it("calcula contraste automático branco/preto sobre a cor primária", () => {
    assert.equal(calcularCorTextoContraste("#EA1D2C"), "#FFFFFF");
    assert.equal(calcularCorTextoContraste("#18181B"), "#FFFFFF");
    assert.equal(calcularCorTextoContraste("#FACC15"), "#111827");
    assert.equal(calcularCorTextoContraste("#FFFFFF"), "#111827");
    assert.equal(calcularCorTextoContraste("#22C55E"), "#111827");

    const resolvido = resolverTemaLoja({
      cor_primaria: "#facc15",
      cor_secundaria: "#111",
      fonte: "Bebas Neue",
    });
    assert.equal(resolvido.cor_primaria, "#FACC15");
    assert.equal(resolvido.cor_primaria_texto, "#111827");
    assert.equal(resolvido.cor_secundaria_texto, "#FFFFFF");
    assert.equal(resolvido.fonte, "Bebas Neue");
  });
});

describe("Carrinho e Checkout Preview (centavos inteiros)", () => {
  const produtos: ProdutoPublico[] = [
    {
      id: "prod-1",
      nome: "Bolsa Tote Caramelo",
      descricao: null,
      preco_centavos: 3000,
      imagem_url: null,
      estoque: 2,
      categoria: "Bolsas",
    },
    {
      id: "prod-2",
      nome: "Lenço de Seda",
      descricao: null,
      preco_centavos: 900,
      imagem_url: null,
      estoque: 0,
      categoria: "Acessórios",
    },
  ];

  const bairros: BairroPublico[] = [
    { id: "b-1", bairro: "Fátima", valor_centavos: 500 },
    { id: "b-2", bairro: "Centro", valor_centavos: 900 },
  ];

  const entregaBairro: EntregaPublica = {
    aceita_retirada: true,
    aceita_entrega: true,
    modo_frete: "bairro",
    frete_fixo_centavos: 700,
    frete_gratis_acima_centavos: 5000,
    pedido_minimo_centavos: 2000,
    tempo_estimado_min: 35,
  };

  it("gera chave de localStorage por slug e respeita limite de estoque", () => {
    assert.equal(cartStorageKey("Casa-Atelier"), "minhaloja:cart:casa-atelier");

    let items = alterarQuantidadeItem([], "prod-1", 1, 2);
    items = alterarQuantidadeItem(items, "prod-1", 1, 2);
    items = alterarQuantidadeItem(items, "prod-1", 1, 2);
    assert.deepEqual(items, [{ produtoId: "prod-1", qtd: 2 }]);

    // Produto esgotado (estoque 0) não entra
    items = alterarQuantidadeItem(items, "prod-2", 1, 0);
    assert.deepEqual(items, [{ produtoId: "prod-1", qtd: 2 }]);

    // Reconciliação limpa esgotados/inexistentes e faz clamp
    const reconciliados = reconciliarCarrinhoComEstoque(
      [
        { produtoId: "prod-1", qtd: 9 },
        { produtoId: "prod-2", qtd: 3 },
        { produtoId: "nao-existe", qtd: 1 },
      ],
      produtos,
    );
    assert.deepEqual(reconciliados, [{ produtoId: "prod-1", qtd: 2 }]);
  });

  it("calcula frete por bairro, frete fixo, frete grátis, retirada e pedido mínimo", () => {
    const itens1 = resolverItensCarrinho([{ produtoId: "prod-1", qtd: 1 }], produtos);

    const previewBairroPendente = calcularCheckoutPreview({
      itens: itens1,
      entrega: entregaBairro,
      tipo: "entrega",
      bairroSelecionado: null,
    });
    assert.equal(previewBairroPendente.bairro_pendente, true);
    assert.equal(previewBairroPendente.frete_centavos, 0);
    assert.equal(previewBairroPendente.total_centavos, 3000);

    const previewBairroCentro = calcularCheckoutPreview({
      itens: itens1,
      entrega: entregaBairro,
      tipo: "entrega",
      bairroSelecionado: bairros[1],
    });
    assert.equal(previewBairroCentro.bairro_pendente, false);
    assert.equal(previewBairroCentro.frete_centavos, 900);
    assert.equal(
      previewBairroCentro.taxa_servico_centavos,
      TAXA_SERVICO_PLACEHOLDER_CENTAVOS,
    );
    assert.equal(previewBairroCentro.total_centavos, 3900);

    // 2 unidades = 6000 centavos >= 5000 (frete grátis)
    const itens2 = resolverItensCarrinho([{ produtoId: "prod-1", qtd: 2 }], produtos);
    const previewFreteGratis = calcularCheckoutPreview({
      itens: itens2,
      entrega: entregaBairro,
      tipo: "entrega",
      bairroSelecionado: bairros[1],
    });
    assert.equal(previewFreteGratis.frete_gratis_atingido, true);
    assert.equal(previewFreteGratis.frete_centavos, 0);
    assert.equal(previewFreteGratis.total_centavos, 6000);

    // Retirada sempre frete 0
    const previewRetirada = calcularCheckoutPreview({
      itens: itens1,
      entrega: entregaBairro,
      tipo: "retirada",
      bairroSelecionado: bairros[1],
    });
    assert.equal(previewRetirada.frete_centavos, 0);
    assert.equal(previewRetirada.total_centavos, 3000);

    // Pedido mínimo não atingido (3000 < 4000)
    const entregaMinimoAlto: EntregaPublica = {
      ...entregaBairro,
      modo_frete: "fixo",
      pedido_minimo_centavos: 4000,
    };
    const previewMinimo = calcularCheckoutPreview({
      itens: itens1,
      entrega: entregaMinimoAlto,
      tipo: "entrega",
      bairroSelecionado: null,
    });
    assert.equal(previewMinimo.pedido_minimo_atingido, false);
    assert.equal(previewMinimo.falta_pedido_minimo_centavos, 1000);
    assert.equal(previewMinimo.frete_centavos, 700);
    assert.equal(previewMinimo.total_centavos, 3700);
  });
});

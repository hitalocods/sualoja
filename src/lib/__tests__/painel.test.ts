import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HORARIOS_PADRAO } from "@/db/schema";
import {
  ajustarEstoqueSchema,
  aparenciaSchema,
  bairroEntregaSchema,
  centavosParaInputReais,
  dadosLojaSchema,
  entregaSchema,
  produtoSchema,
  reaisParaCentavos,
} from "@/lib/validators/painel";

describe("Conversão monetária R$ <-> centavos (Painel)", () => {
  it("converte strings em reais para centavos inteiros sem erro de float", () => {
    assert.equal(reaisParaCentavos("29,90"), 2990);
    assert.equal(reaisParaCentavos("R$ 1.250,50"), 125050);
    assert.equal(reaisParaCentavos("15"), 1500);
    assert.equal(reaisParaCentavos("15.9"), 1590);
    assert.equal(reaisParaCentavos("0"), 0);
    assert.equal(reaisParaCentavos(19.99), 1999);
    assert.equal(reaisParaCentavos("-10,00"), null);
    assert.equal(reaisParaCentavos("abc"), null);
    assert.equal(reaisParaCentavos("12,345"), null);

    assert.equal(centavosParaInputReais(2990), "29,90");
    assert.equal(centavosParaInputReais(5), "0,05");
  });
});

describe("Schemas de validação do painel do lojista", () => {
  it("valida produto, estoque e bloqueia URL maliciosa", () => {
    const ok = produtoSchema.safeParse({
      nome: "Vestido Midi Linho",
      descricao: "Linho natural leve",
      preco_centavos: 3490,
      estoque: 15,
      categoria: "Vestuário",
      ativo: true,
      imagem_url: "https://example.public.blob.vercel-storage.com/foto.webp",
    });
    assert.equal(ok.success, true);

    const xss = produtoSchema.safeParse({
      nome: "Produto XSS",
      preco_centavos: 1000,
      estoque: 5,
      imagem_url: "javascript:alert(1)",
    });
    assert.equal(xss.success, false);

    const seedLocal = produtoSchema.safeParse({
      nome: "Vestido Seed",
      preco_centavos: 24990,
      estoque: 8,
      imagem_url: "/seed/produtos/vestido-midi-em-linho-natural.webp",
    });
    assert.equal(seedLocal.success, true);

    const protocolRelative = produtoSchema.safeParse({
      nome: "Imagem Inválida",
      preco_centavos: 1000,
      estoque: 5,
      imagem_url: "//evil.com/foto.webp",
    });
    assert.equal(protocolRelative.success, false);

    const midiaPrivadaLogo = aparenciaSchema.safeParse({
      cor_primaria: "#EA1D2C",
      cor_secundaria: "#18181B",
      fonte: "Inter",
      logo_url:
        "/api/midia/lojas/11111111-1111-4111-8111-111111111111/logo/22222222-2222-4222-8222-222222222222.png",
      banner_url: null,
    });
    assert.equal(midiaPrivadaLogo.success, true);

    const midiaPrivadaTraversal = produtoSchema.safeParse({
      nome: "Traversal",
      preco_centavos: 1000,
      estoque: 5,
      imagem_url: "/api/midia/lojas/../secret.png",
    });
    assert.equal(midiaPrivadaTraversal.success, false);

    const midiaPrivadaOutroPath = produtoSchema.safeParse({
      nome: "Outro Path",
      preco_centavos: 1000,
      estoque: 5,
      imagem_url: "/api/midia/other/file.png",
    });
    assert.equal(midiaPrivadaOutroPath.success, false);

    assert.equal(
      ajustarEstoqueSchema.safeParse({
        produto_id: "11111111-1111-4111-8111-111111111111",
        estoque: -1,
      }).success,
      false,
    );
  });

  it("valida aparência com lista fechada de 8 fontes e hex normalizado", () => {
    const ok = aparenciaSchema.safeParse({
      cor_primaria: "#fff",
      cor_secundaria: "#18181b",
      fonte: "Playfair Display",
      logo_url: "",
      banner_url: null,
    });
    assert.equal(ok.success, true);
    if (ok.success) {
      assert.equal(ok.data.cor_primaria, "#FFFFFF");
      assert.equal(ok.data.cor_secundaria, "#18181B");
      assert.equal(ok.data.logo_url, null);
    }

    const fonteInvalida = aparenciaSchema.safeParse({
      cor_primaria: "#EA1D2C",
      cor_secundaria: "#18181B",
      fonte: "Arial",
    });
    assert.equal(fonteInvalida.success, false);
  });

  it("valida entrega, bairros, horários e dados da loja", () => {
    const semModo = entregaSchema.safeParse({
      aceita_retirada: false,
      aceita_entrega: false,
      modo_frete: "fixo",
      frete_fixo_centavos: 500,
      frete_gratis_acima_centavos: null,
      pedido_minimo_centavos: 0,
      tempo_estimado_min: 30,
      horarios: HORARIOS_PADRAO,
    });
    assert.equal(semModo.success, false);

    const horarioInvertido = entregaSchema.safeParse({
      aceita_retirada: true,
      aceita_entrega: true,
      modo_frete: "bairro",
      frete_fixo_centavos: 500,
      frete_gratis_acima_centavos: 8000,
      pedido_minimo_centavos: 2000,
      tempo_estimado_min: 35,
      horarios: {
        ...HORARIOS_PADRAO,
        seg: { aberto: true, abre: "22:00", fecha: "18:00" },
      },
    });
    assert.equal(horarioInvertido.success, false);

    assert.equal(
      bairroEntregaSchema.safeParse({ bairro: "Fátima", valor_centavos: 500 })
        .success,
      true,
    );

    assert.equal(
      dadosLojaSchema.safeParse({
        nome: "Casa Atelier",
        whatsapp: "(86) 99988-7766",
        categoria: "Moda",
        bairro: "Jóquei",
        taxa_paga_por: "cliente",
      }).success,
      true,
    );
  });
});

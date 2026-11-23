import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import type { DbExecutor } from "@/db";
import { pedidoStatusEnum, produtos } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { calcularResumoPedidoServidor } from "@/lib/money";
import { createTenantDb, TenantScopeError } from "@/lib/tenant";
import {
  CATEGORIAS_LOJA,
  normalizarSlug,
  normalizarWhatsapp,
  SLUGS_RESERVADOS,
  validarCpfCnpj,
  validarSlug,
} from "@/lib/validators/lojista";

describe("Autenticação - Hash de senha", () => {
  it("gera hash scrypt e valida senha correta e incorreta", async () => {
    const hash = await hashPassword("MinhaSenha@2026");
    assert.ok(hash.startsWith("scrypt$"));
    assert.equal(await verifyPassword("MinhaSenha@2026", hash), true);
    assert.equal(await verifyPassword("SenhaErrada", hash), false);
    assert.equal(await verifyPassword("qualquer", "formato-invalido"), false);
  });
});

describe("Validadores de Lojista", () => {
  it("rejeita todos os slugs reservados obrigatórios e inválidos", () => {
    for (const reservado of [
      "admin",
      "api",
      "login",
      "cadastro",
      "painel",
      "app",
      "www",
    ]) {
      assert.ok((SLUGS_RESERVADOS as readonly string[]).includes(reservado));
      const res = validarSlug(reservado);
      assert.equal(res.ok, false, `Deveria bloquear slug "${reservado}"`);
    }

    assert.equal(validarSlug("ab").ok, false);
    assert.equal(validarSlug("loja--teste").ok, false);
    assert.equal(validarSlug("Casa Ateliê").ok, false);

    const valido = validarSlug(normalizarSlug("Casa Ateliê"));
    assert.deepEqual(valido, { ok: true, slug: "casa-atelie" });

    assert.deepEqual(CATEGORIAS_LOJA, [
      "Moda",
      "Beleza",
      "Alimentação",
      "Casa",
      "Eletrônicos",
      "Serviços",
      "Outros",
    ]);

    assert.ok(pedidoStatusEnum.enumValues.includes("em_separacao"));
    assert.equal(
      (pedidoStatusEnum.enumValues as readonly string[]).includes("preparando"),
      false,
    );
  });

  it("valida CPF e CNPJ corretamente", () => {
    assert.equal(validarCpfCnpj("52998224725"), true);
    assert.equal(validarCpfCnpj("11.222.333/0001-81"), true);
    assert.equal(validarCpfCnpj("11111111111"), false);
    assert.equal(validarCpfCnpj("11222333000182"), false);
  });

  it("normaliza WhatsApp brasileiro", () => {
    assert.equal(normalizarWhatsapp("(86) 99988-7766"), "5586999887766");
    assert.equal(normalizarWhatsapp("+55 86 99988-7766"), "5586999887766");
    assert.equal(normalizarWhatsapp("12345"), null);
  });
});

describe("Cálculo financeiro em centavos no servidor", () => {
  it("calcula frete fixo, frete grátis, retirada e taxa por pagador", () => {
    const entregaComFrete = calcularResumoPedidoServidor({
      itens: [{ preco_centavos: 2500, qtd: 2 }],
      tipo: "entrega",
      frete_base_centavos: 700,
      frete_gratis_acima_centavos: 8000,
      pedido_minimo_centavos: 2000,
      taxa_fixa_centavos: 50,
      taxa_percentual: "1.50",
      taxa_paga_por: "loja",
    });

    assert.deepEqual(entregaComFrete, {
      subtotal_centavos: 5000,
      frete_centavos: 700,
      taxa_servico_centavos: 125,
      total_centavos: 5700,
    });

    const entregaFreteGratisTaxaCliente = calcularResumoPedidoServidor({
      itens: [{ preco_centavos: 5000, qtd: 2 }],
      tipo: "entrega",
      frete_base_centavos: 700,
      frete_gratis_acima_centavos: 8000,
      pedido_minimo_centavos: 2000,
      taxa_fixa_centavos: 50,
      taxa_percentual: "1.50",
      taxa_paga_por: "cliente",
    });

    assert.deepEqual(entregaFreteGratisTaxaCliente, {
      subtotal_centavos: 10000,
      frete_centavos: 0,
      taxa_servico_centavos: 200,
      total_centavos: 10200,
    });

    const retirada = calcularResumoPedidoServidor({
      itens: [{ preco_centavos: 3000, qtd: 1 }],
      tipo: "retirada",
      frete_base_centavos: 900,
      frete_gratis_acima_centavos: null,
      pedido_minimo_centavos: 2000,
      taxa_fixa_centavos: 100,
      taxa_percentual: "2.50",
      taxa_paga_por: "loja",
    });

    assert.equal(retirada.frete_centavos, 0);
    assert.equal(retirada.total_centavos, 3000);

    assert.throws(() =>
      calcularResumoPedidoServidor({
        itens: [{ preco_centavos: 1000, qtd: 1 }],
        tipo: "entrega",
        frete_base_centavos: 500,
        frete_gratis_acima_centavos: null,
        pedido_minimo_centavos: 2000,
        taxa_fixa_centavos: 0,
        taxa_percentual: "0.00",
        taxa_paga_por: "loja",
      }),
    );
  });
});

describe("Tenant Helper (createTenantDb)", () => {
  const lojaA = "11111111-1111-4111-8111-111111111111";
  const lojaB = "22222222-2222-4222-8222-222222222222";

  it("bloqueia lojaId inválido ou não-UUID", () => {
    assert.throws(() => createTenantDb(""), TenantScopeError);
    assert.throws(() => createTenantDb("loja-nao-uuid"), TenantScopeError);
  });

  it("injeta e sobrescreve loja_id em insert e remove loja_id em update", async () => {
    let insertedValues: Array<Record<string, unknown>> = [];
    let updatedValues: Record<string, unknown> = {};

    const mockExecutor = {
      insert: () => ({
        values: (vals: Array<Record<string, unknown>>) => {
          insertedValues = vals;
          return {
            returning: async () => vals,
          };
        },
      }),
      update: () => ({
        set: (vals: Record<string, unknown>) => {
          updatedValues = vals;
          return {
            where: () => ({
              returning: async () => [],
            }),
          };
        },
      }),
    } as unknown as DbExecutor;

    const tenantDb = createTenantDb(lojaA, mockExecutor);
    const scopeSql = tenantDb.scope(produtos, eq(produtos.ativo, true));
    assert.ok(scopeSql);

    await tenantDb.insert(produtos, {
      loja_id: lojaB,
      nome: "Vestido Midi Linho",
      preco_centavos: 2500,
    });

    assert.equal(insertedValues.length, 1);
    assert.equal(insertedValues[0].loja_id, lojaA);

    await tenantDb.update(
      produtos,
      {
        loja_id: lojaB,
        id: "33333333-3333-4333-8333-333333333333",
        nome: "Novo Nome",
      } as Record<string, unknown>,
      eq(produtos.ativo, true),
    );

    assert.equal("loja_id" in updatedValues, false);
    assert.equal("id" in updatedValues, false);
    assert.equal(updatedValues.nome, "Novo Nome");
  });
});

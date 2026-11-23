import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AbacatePayError,
  criarCobrancaPixTransparente,
  criarSubcontaAbacatePay,
  sanitizePixDescription,
} from "@/lib/abacatepay";
import { calcularEstoqueDisponivel, mapaEstoqueDisponivelPorLoja } from "@/lib/inventory";
import { calcularResumoESplitServidor } from "@/lib/money";
import {
  consultarStatusPedidoPublico,
  executarCriacaoPedido,
} from "@/lib/payments/orders";
import { executarCorrecaoDocumentoLoja } from "@/lib/payments/documento";
import { ensureSubconta } from "@/lib/payments/subaccount";
import { resetRateLimitForTests } from "@/lib/rate-limit";
import { mascararCpfCnpj } from "@/lib/validators/lojista";
import {
  auditoria_admin,
  bairros_entrega,
  lojas,
  lojas_entrega,
  pedido_itens,
  pedidos,
  produtos,
  reservas_estoque,
} from "@/db/schema";
import type { DbExecutor } from "@/db";

const LOJA_ID = "11111111-1111-4111-8111-111111111111";
const PROD_1 = "22222222-2222-4222-8222-222222222222";
const BAIRRO_1 = "33333333-3333-4333-8333-333333333333";

interface FakeOrderRow {
  id: string;
  loja_id: string;
  codigo: string;
  status:
    | "aguardando_pagamento"
    | "pago"
    | "expirado"
    | "cancelado"
    | "em_separacao"
    | "saiu_entrega"
    | "entregue";
  pix_expira_em: Date | null;
  abacate_cobranca_id: string | null;
  pix_copia_cola: string | null;
  demo: boolean;
  total_centavos: number;
  taxa_paga_por: "cliente" | "loja";
  cliente_nome: string;
  cliente_whatsapp: string;
}

interface FakeSelectChain {
  innerJoin(): FakeSelectChain;
  where(): FakeSelectChain;
  orderBy(): FakeSelectChain;
  limit(): FakeSelectChain;
  groupBy(): FakeSelectChain;
  for(mode: string): Promise<unknown[]>;
  then(
    resolve: (val: unknown[]) => void,
    reject?: (err: unknown) => void,
  ): Promise<unknown>;
  execute(): Promise<unknown[]>;
}

interface FakeDbExecutor {
  select(fields?: Record<string, unknown>): {
    from(table: unknown): FakeSelectChain;
  };
  insert(table: unknown): {
    values(vals: Record<string, unknown> | Array<Record<string, unknown>>): {
      returning(): Promise<Array<{ id: string; codigo: string }>>;
      then(
        resolve: (val: unknown) => void,
        reject?: (err: unknown) => void,
      ): Promise<unknown>;
    };
  };
  update(table: unknown): {
    set(vals: Record<string, unknown>): {
      where(): {
        returning: () => Promise<Array<{ status: FakeOrderRow["status"] }>>;
        then: (
          resolve: (v: unknown) => void,
          reject?: (e: unknown) => void,
        ) => Promise<unknown>;
      };
    };
  };
  transaction<T>(fn: (tx: FakeDbExecutor) => Promise<T>): Promise<T>;
}

interface FakeReservaRow {
  id: string;
  loja_id: string;
  pedido_id: string;
  produto_id: string;
  qtd: number;
  expira_em: Date;
  liberada: boolean;
}

interface FakeProductRow {
  id: string;
  loja_id: string;
  nome: string;
  preco_centavos: number;
  estoque: number;
  ativo: boolean;
}

function createFakeTransactionalDb(options?: {
  estoqueInicial?: number;
  precoCentavos?: number;
  abacateSubcontaId?: string | null;
  abacateSubcontaErro?: string | null;
  taxaPagaPor?: "cliente" | "loja";
  taxaFixaCentavos?: number;
  taxaPercentual?: string;
  agora?: Date;
}) {
  const agora = options?.agora ?? new Date("2026-11-22T14:00:00-03:00");
  const state = {
    loja: {
      id: LOJA_ID,
      nome: "Casa Atelier",
      slug: "casa-atelier",
      cpf_cnpj: "11222333000181",
      status: "ativa" as const,
      aberta: true,
      taxa_paga_por: options?.taxaPagaPor ?? ("loja" as const),
      abacate_subconta_id:
        options?.abacateSubcontaId === undefined
          ? "sacc_test_123"
          : options.abacateSubcontaId,
      subconta_erro: options?.abacateSubcontaErro ?? null,
      abacate_subconta_erro: options?.abacateSubcontaErro ?? null,
      taxa_fixa_centavos: options?.taxaFixaCentavos ?? 100,
      taxa_percentual: options?.taxaPercentual ?? "5.00",
    },
    entrega: {
      loja_id: LOJA_ID,
      aceita_retirada: true,
      aceita_entrega: true,
      modo_frete: "bairro" as const,
      frete_fixo_centavos: 700,
      frete_gratis_acima_centavos: 10000,
      pedido_minimo_centavos: 1000,
      tempo_estimado_min: 45,
      horarios: null,
    },
    bairro: {
      id: BAIRRO_1,
      loja_id: LOJA_ID,
      bairro: "Jóquei",
      valor_centavos: 800,
    },
    produtos: [
      {
        id: PROD_1,
        loja_id: LOJA_ID,
        nome: "Bolsa Tote Caramelo",
        preco_centavos: options?.precoCentavos ?? 5000,
        estoque: options?.estoqueInicial ?? 1,
        ativo: true,
      },
    ] as FakeProductRow[],
    pedidos: [] as FakeOrderRow[],
    pedidoItens: [] as Array<Record<string, unknown>>,
    reservas: [] as FakeReservaRow[],
  };

  let rowLockQueue: Promise<void> = Promise.resolve();
  let orderCounter = 0;

  async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const prev = rowLockQueue;
    rowLockQueue = new Promise<void>((res) => {
      release = res;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  function buildExecutor(inTransactionLocks: {
    acquired: boolean;
  }): FakeDbExecutor {
    const executor: FakeDbExecutor = {
      select(fields?: Record<string, unknown>) {
        return {
          from(table: unknown) {
            let withJoin = false;
            const chain: FakeSelectChain = {
              innerJoin() {
                withJoin = true;
                return chain;
              },
              where() {
                return chain;
              },
              orderBy() {
                return chain;
              },
              limit() {
                return chain;
              },
              groupBy() {
                return chain;
              },
              async for(mode: string) {
                if (table === produtos && mode === "update") {
                  inTransactionLocks.acquired = true;
                }
                return chain.execute();
              },
              then(
                resolve: (val: unknown[]) => void,
                reject?: (err: unknown) => void,
              ) {
                return chain.execute().then(resolve, reject);
              },
              async execute(): Promise<unknown[]> {
                await Promise.resolve();
                if (table === lojas && withJoin) {
                  return [state.loja];
                }
                if (table === lojas) {
                  // Consulta em subaccount.ts: campos selecionados diferenciam loja atual vs outra loja
                  if (fields && Object.keys(fields).length === 1) {
                    return state.loja.abacate_subconta_id
                      ? [{ abacate_subconta_id: state.loja.abacate_subconta_id }]
                      : [];
                  }
                  return [state.loja];
                }
                if (table === lojas_entrega) {
                  return [state.entrega];
                }
                if (table === bairros_entrega) {
                  return [state.bairro];
                }
                if (table === produtos) {
                  return state.produtos.map((p) => ({ ...p }));
                }
                if (table === reservas_estoque) {
                  const porProduto = new Map<string, number>();
                  for (const r of state.reservas) {
                    if (!r.liberada && r.expira_em.getTime() > agora.getTime()) {
                      porProduto.set(
                        r.produto_id,
                        (porProduto.get(r.produto_id) ?? 0) + r.qtd,
                      );
                    }
                  }
                  return Array.from(porProduto.entries()).map(
                    ([produto_id, reservado]) => ({
                      produto_id,
                      reservado,
                    }),
                  );
                }
                if (table === pedidos) {
                  return state.pedidos.map((p) => ({ ...p }));
                }
                return [];
              },
            };
            return chain;
          },
        };
      },
      insert(table: unknown) {
        return {
          values(vals: Record<string, unknown> | Array<Record<string, unknown>>) {
            const list = Array.isArray(vals) ? vals : [vals];
            return {
              async returning() {
                await Promise.resolve();
                if (table === pedidos) {
                  return list.map((v) => {
                    orderCounter += 1;
                    const created: FakeOrderRow = {
                      id: `ped-${orderCounter}`,
                      loja_id: String(v.loja_id),
                      codigo: String(v.codigo),
                      status: (v.status as FakeOrderRow["status"]) ?? "aguardando_pagamento",
                      pix_expira_em: (v.pix_expira_em as Date | null) ?? null,
                      abacate_cobranca_id: null,
                      pix_copia_cola: null,
                      demo: Boolean(v.demo),
                      total_centavos: Number(v.total_centavos),
                      taxa_paga_por:
                        (v.taxa_paga_por as "cliente" | "loja") ?? "loja",
                      cliente_nome: String(v.cliente_nome),
                      cliente_whatsapp: String(v.cliente_whatsapp),
                    };
                    state.pedidos.push(created);
                    return { id: created.id, codigo: created.codigo };
                  });
                }
                return [];
              },
              then(
                resolve: (val: unknown) => void,
                reject?: (err: unknown) => void,
              ) {
                const run = async () => {
                  await Promise.resolve();
                  if (table === pedido_itens) {
                    state.pedidoItens.push(...list);
                  } else if (table === reservas_estoque) {
                    for (const v of list) {
                      state.reservas.push({
                        id: `res-${state.reservas.length + 1}`,
                        loja_id: String(v.loja_id),
                        pedido_id: String(v.pedido_id),
                        produto_id: String(v.produto_id),
                        qtd: Number(v.qtd),
                        expira_em: v.expira_em as Date,
                        liberada: Boolean(v.liberada),
                      });
                    }
                  }
                  return undefined;
                };
                return run().then(resolve, reject);
              },
            };
          },
        };
      },
      update(table: unknown) {
        return {
          set(vals: Record<string, unknown>) {
            return {
              where() {
                const apply = async () => {
                  await Promise.resolve();
                  if (table === lojas) {
                    Object.assign(state.loja, vals);
                  } else if (table === pedidos) {
                    for (const p of state.pedidos) {
                      Object.assign(p, vals);
                    }
                    return state.pedidos.map((p) => ({ status: p.status }));
                  } else if (table === reservas_estoque) {
                    for (const r of state.reservas) {
                      Object.assign(r, vals);
                    }
                  }
                  return [];
                };
                return {
                  returning: () => apply(),
                  then: (
                    resolve: (v: unknown) => void,
                    reject?: (e: unknown) => void,
                  ) => apply().then(resolve, reject),
                };
              },
            };
          },
        };
      },
      async transaction<T>(
        fn: (tx: typeof executor) => Promise<T>,
      ): Promise<T> {
        return withLock(async () => {
          const txExec = buildExecutor({ acquired: true });
          return fn(txExec);
        });
      },
    };
    return executor;
  }

  return {
    state,
    db: buildExecutor({ acquired: false }) as unknown as Parameters<
      typeof executarCriacaoPedido
    >[2] extends { dbClient?: infer D }
      ? NonNullable<D>
      : never,
  };
}

describe("Parte 4A - Pagamento Pix com Split e Estoque", () => {
  beforeEach(() => {
    resetRateLimitForTests();
  });

  describe("1. Cálculo de split em money.ts (centavos inteiros)", () => {
    it("calcula split corretamente quando taxa_paga_por = 'cliente'", () => {
      // Subtotal: R$ 100,00 (10000) + Frete: R$ 8,00 (800)
      // Taxa: R$ 1,00 (100) + 5% de 10000 (500) = 600 centavos
      const res = calcularResumoESplitServidor({
        itens: [{ preco_centavos: 5000, qtd: 2 }],
        tipo: "entrega",
        frete_base_centavos: 800,
        frete_gratis_acima_centavos: 20000,
        pedido_minimo_centavos: 1000,
        taxa_fixa_centavos: 100,
        taxa_percentual: "5.00",
        taxa_paga_por: "cliente",
      });

      expect(res.subtotal_centavos).toBe(10000);
      expect(res.frete_centavos).toBe(800);
      expect(res.taxa_servico_centavos).toBe(600);
      expect(res.total_centavos).toBe(11400);
      expect(res.parte_lojista_centavos).toBe(10800);
      expect(res.parte_plataforma_centavos).toBe(600);
      expect(res.parte_lojista_centavos + res.parte_plataforma_centavos).toBe(
        res.total_centavos,
      );
    });

    it("calcula split corretamente quando taxa_paga_por = 'loja'", () => {
      const res = calcularResumoESplitServidor({
        itens: [{ preco_centavos: 5000, qtd: 2 }],
        tipo: "entrega",
        frete_base_centavos: 800,
        frete_gratis_acima_centavos: 20000,
        pedido_minimo_centavos: 1000,
        taxa_fixa_centavos: 100,
        taxa_percentual: "5.00",
        taxa_paga_por: "loja",
      });

      expect(res.total_centavos).toBe(10800);
      expect(res.taxa_servico_centavos).toBe(600);
      expect(res.parte_lojista_centavos).toBe(10200);
      expect(res.parte_plataforma_centavos).toBe(600);
      expect(res.parte_lojista_centavos + res.parte_plataforma_centavos).toBe(
        res.total_centavos,
      );
    });

    it("rejeita pedido se total ficar abaixo do mínimo da plataforma (R$ 10,00)", () => {
      expect(() =>
        calcularResumoESplitServidor({
          itens: [{ preco_centavos: 900, qtd: 1 }],
          tipo: "retirada",
          frete_base_centavos: 0,
          frete_gratis_acima_centavos: null,
          pedido_minimo_centavos: 0,
          taxa_fixa_centavos: 50,
          taxa_percentual: "0.00",
          taxa_paga_por: "loja",
          pedido_minimo_plataforma_centavos: 1000,
        }),
      ).toThrow(/mínimo da plataforma/i);
    });

    it("rejeita pedido se a taxa deixar a parte do lojista menor que 1 centavo", () => {
      expect(() =>
        calcularResumoESplitServidor({
          itens: [{ preco_centavos: 1000, qtd: 1 }],
          tipo: "retirada",
          frete_base_centavos: 0,
          frete_gratis_acima_centavos: null,
          pedido_minimo_centavos: 0,
          taxa_fixa_centavos: 1000,
          taxa_percentual: "0.00",
          taxa_paga_por: "loja",
          pedido_minimo_plataforma_centavos: 1000,
        }),
      ).toThrow(/taxa do plano excede o valor líquido/i);
    });
  });

  describe("2. Estoque disponível e reservas", () => {
    it("calcula estoqueDisponivel descontando apenas reservas ativas e ignorando expiradas/liberadas", async () => {
      expect(calcularEstoqueDisponivel(10, 3)).toBe(7);
      expect(calcularEstoqueDisponivel(2, 5)).toBe(0);

      const agora = new Date("2026-11-22T15:00:00Z");
      const mockExecutor = {
        select() {
          return {
            from() {
              const allRows: FakeReservaRow[] = [
                // Ativa (não liberada e expira no futuro): conta 2
                {
                  id: "r1",
                  loja_id: LOJA_ID,
                  pedido_id: "p1",
                  produto_id: PROD_1,
                  qtd: 2,
                  expira_em: new Date("2026-11-22T15:10:00Z"),
                  liberada: false,
                },
                // Expirada (expira_em <= agora): ignorar
                {
                  id: "r2",
                  loja_id: LOJA_ID,
                  pedido_id: "p2",
                  produto_id: PROD_1,
                  qtd: 4,
                  expira_em: new Date("2026-11-22T14:55:00Z"),
                  liberada: false,
                },
                // Liberada manualmente/cancelada: ignorar
                {
                  id: "r3",
                  loja_id: LOJA_ID,
                  pedido_id: "p3",
                  produto_id: PROD_1,
                  qtd: 3,
                  expira_em: new Date("2026-11-22T15:12:00Z"),
                  liberada: true,
                },
              ];
              return {
                where() {
                  return {
                    async groupBy() {
                      const sumAtivas = allRows
                        .filter(
                          (r) =>
                            !r.liberada && r.expira_em.getTime() > agora.getTime(),
                        )
                        .reduce((acc, r) => acc + r.qtd, 0);
                      return [{ produto_id: PROD_1, reservado: sumAtivas }];
                    },
                  };
                },
              };
            },
          };
        },
      } as unknown as DbExecutor;

      const dispMap = await mapaEstoqueDisponivelPorLoja(
        LOJA_ID,
        [{ id: PROD_1, estoque: 5 }],
        agora,
        mockExecutor,
      );

      // 5 - 2 ativas = 3 (ignorou 4 expiradas e 3 liberadas)
      expect(dispMap.get(PROD_1)).toBe(3);
    });

    it("concorrência: 2 buyers disputando o último item (1 ganha, 1 falha sem oversell)", async () => {
      const fake = createFakeTransactionalDb({
        estoqueInicial: 1,
        precoCentavos: 3500,
      });

      const payloadBase = {
        tipo: "retirada" as const,
        cliente_nome: "Cliente Teste",
        cliente_whatsapp: "(86) 99999-8888",
        itens: [{ produtoId: PROD_1, qtd: 1 }],
      };

      const criarPixMock = vi.fn(async (input) => ({
        id: `pix_char_${input.externalId}`,
        amount: input.amount,
        status: "PENDING",
        brCode: "00020126580014br.gov.bcb.pix...",
        expiresAt: new Date("2026-11-22T14:15:00-03:00").toISOString(),
      }));

      const [res1, res2] = await Promise.all([
        executarCriacaoPedido(
          "casa-atelier",
          { ...payloadBase, cliente_nome: "Compradora 1" },
          {
            dbClient: fake.db,
            criarPixFn: criarPixMock,
            agora: () => new Date("2026-11-22T14:00:00-03:00"),
            pularHorarioCheck: true,
            ip: "10.0.0.1",
          },
        ),
        executarCriacaoPedido(
          "casa-atelier",
          { ...payloadBase, cliente_nome: "Compradora 2" },
          {
            dbClient: fake.db,
            criarPixFn: criarPixMock,
            agora: () => new Date("2026-11-22T14:00:00-03:00"),
            pularHorarioCheck: true,
            ip: "10.0.0.2",
          },
        ),
      ]);

      const sucessos = [res1, res2].filter((r) => r.ok);
      const falhas = [res1, res2].filter((r) => !r.ok);

      expect(sucessos).toHaveLength(1);
      expect(falhas).toHaveLength(1);
      if (!falhas[0].ok) {
        expect(falhas[0].error).toMatch(/esgotado/i);
      }
      expect(criarPixMock).toHaveBeenCalledTimes(1);
      // Subtotal 3500 - taxa (100 fixo + 5% de 3500 = 175 -> 275) = 3225 para o lojista
      expect(criarPixMock).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 3500,
          splits: [{ subAccountId: "sacc_test_123", amount: 3225 }],
        }),
        undefined,
      );
      expect(fake.state.reservas.filter((r) => !r.liberada)).toHaveLength(1);
    });
  });

  describe("3. AbacatePay erros, compensação e segurança", () => {
    it("erro da AbacatePay mockado cancela pedido e libera reserva de estoque", async () => {
      const fake = createFakeTransactionalDb({
        estoqueInicial: 3,
        precoCentavos: 4000,
      });

      const criarPixFalha = vi.fn(async () => {
        throw new AbacatePayError({
          code: "SPLIT_DISABLED",
          status: 400,
          message: "Split para subcontas não está habilitado para esta loja",
        });
      });

      const res = await executarCriacaoPedido(
        "casa-atelier",
        {
          tipo: "entrega",
          cliente_nome: "Maria Oliveira",
          cliente_whatsapp: "86999887766",
          bairro_id: BAIRRO_1,
          rua: "Av. Dom Severino",
          numero: "123",
          itens: [{ produtoId: PROD_1, qtd: 2 }],
        },
        {
          dbClient: fake.db,
          criarPixFn: criarPixFalha,
          agora: () => new Date("2026-11-22T14:00:00-03:00"),
          pularHorarioCheck: true,
          ip: "10.0.0.9",
        },
      );

      expect(res.ok).toBe(false);
      expect(fake.state.pedidos).toHaveLength(1);
      expect(fake.state.pedidos[0].status).toBe("cancelado");
      expect(fake.state.reservas).toHaveLength(1);
      expect(fake.state.reservas[0].liberada).toBe(true);
    });

    it("classifica erros oficiais da AbacatePay, omite customer e sanitiza emojis", async () => {
      expect(sanitizePixDescription("Pedido #1 🎉 Atelier ❤️")).toBe(
        "Pedido #1 Atelier",
      );

      const secret = "abc_live_super_secret_token_do_not_leak";
      const fetchMock = vi.fn(async (_url, init) => {
        const parsedBody = JSON.parse(String(init?.body ?? "{}")) as Record<
          string,
          unknown
        >;
        // Garante que customer NÃO é enviado no PIX transparente sem CPF/e-mail
        expect((parsedBody.data as Record<string, unknown>)?.customer).toBeUndefined();
        return new Response(
          JSON.stringify({
            success: false,
            data: null,
            error: "A soma dos splits passa do valor líquido da cobrança",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      });

      await expect(
        criarCobrancaPixTransparente(
          {
            amount: 5000,
            description: "Pedido Teste 🚀",
            expiresIn: 900,
            splits: [{ subAccountId: "sacc_123", amount: 4990 }],
          },
          { apiKey: secret, fetchFn: fetchMock },
        ),
      ).rejects.toMatchObject({
        name: "AbacatePayError",
        code: "SPLIT_EXCEEDS_NET",
      });

      // Nunca vazar chave na mensagem de erro
      try {
        await criarSubcontaAbacatePay(
          { name: "Casa Atelier", taxId: "11222333000181" },
          {
            apiKey: secret,
            fetchFn: async () =>
              new Response(
                JSON.stringify({ error: "Função não habilitada" }),
                { status: 403 },
              ),
          },
        );
      } catch (err) {
        expect(err).toBeInstanceOf(AbacatePayError);
        expect((err as AbacatePayError).code).toBe("FEATURE_DISABLED");
        expect((err as Error).message).not.toContain(secret);
      }
    });

    it("ensureSubconta bloqueia mesmo CNPJ da plataforma e grava abacate_subconta_erro", async () => {
      const fake = createFakeTransactionalDb({
        abacateSubcontaId: null,
      });

      const res = await ensureSubconta(
        {
          id: LOJA_ID,
          nome: "Casa Atelier",
          slug: "casa-atelier",
          cpf_cnpj: "11.222.333/0001-81",
          abacate_subconta_id: null,
        },
        {
          dbExecutor: fake.db as unknown as DbExecutor,
          platformTaxId: "11222333000181",
        },
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.code).toBe("SAME_PLATFORM_TAX_ID");
      }
      expect(fake.state.loja.subconta_erro).toMatch(
        /mesmo CPF ou CNPJ da plataforma/i,
      );
      expect(fake.state.loja.abacate_subconta_erro).toMatch(
        /mesmo CPF ou CNPJ da plataforma/i,
      );
    });

    it("ensureSubconta sem ABACATEPAY_API_KEY retorna 'Chave do AbacatePay não configurada' sem chamar API e grava subconta_erro", async () => {
      const fake = createFakeTransactionalDb({
        abacateSubcontaId: null,
      });
      const prevKey = process.env.ABACATEPAY_API_KEY;
      process.env.ABACATEPAY_API_KEY = "";
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      try {
        const res = await ensureSubconta(
          {
            id: LOJA_ID,
            nome: "Casa Atelier",
            slug: "casa-atelier",
            cpf_cnpj: "11222333000181",
            abacate_subconta_id: null,
          },
          {
            dbExecutor: fake.db as unknown as DbExecutor,
            abacateOptions: { apiKey: "" },
          },
        );

        expect(res).toEqual({
          ok: false,
          error: "Chave do AbacatePay não configurada",
          code: "MISSING_API_KEY",
        });
        expect(fake.state.loja.subconta_erro).toBe(
          "Chave do AbacatePay não configurada",
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          "[subconta]",
          expect.any(String),
          expect.objectContaining({ lojaId: LOJA_ID }),
        );
      } finally {
        process.env.ABACATEPAY_API_KEY = prevKey;
        consoleSpy.mockRestore();
      }
    });

    it("ensureSubconta trata erro de rede/API sem lançar exceção e sem vazar API key no log", async () => {
      const fake = createFakeTransactionalDb({
        abacateSubcontaId: null,
      });
      const secret = "abc_live_secret_never_log_me";
      const prevKey = process.env.ABACATEPAY_API_KEY;
      process.env.ABACATEPAY_API_KEY = secret;
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      try {
        const res = await ensureSubconta(
          {
            id: LOJA_ID,
            nome: "Casa Atelier",
            slug: "casa-atelier",
            cpf_cnpj: "11222333000181",
            abacate_subconta_id: null,
          },
          {
            dbExecutor: fake.db as unknown as DbExecutor,
            abacateOptions: {
              apiKey: secret,
              fetchFn: async () => {
                throw new Error(`network fail with Bearer ${secret}`);
              },
            },
          },
        );

        expect(res).toEqual({
          ok: false,
          error: "Falha de rede ao conectar com a AbacatePay. Tente novamente.",
          code: "NETWORK_ERROR",
        });
        expect(fake.state.loja.subconta_erro).toBe(
          "Falha de rede ao conectar com a AbacatePay. Tente novamente.",
        );
        const loggedText = JSON.stringify(consoleSpy.mock.calls);
        expect(loggedText).toContain("[subconta]");
        expect(loggedText).not.toContain(secret);
      } finally {
        process.env.ABACATEPAY_API_KEY = prevKey;
        consoleSpy.mockRestore();
      }
    });

    it("log diagnóstico [abacatepay] mascara chave e taxId (só 4 últimos dígitos) e preserva HTTP + corpo no erro", async () => {
      const fake = createFakeTransactionalDb({
        abacateSubcontaId: null,
      });
      const secret = "abc_dev_1234567890_secret_token";
      const prevKey = process.env.ABACATEPAY_API_KEY;
      process.env.ABACATEPAY_API_KEY = secret;
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      try {
        const rawBody = JSON.stringify({
          success: false,
          data: null,
          error: "an internal server error occurred",
        });
        const res = await ensureSubconta(
          {
            id: LOJA_ID,
            nome: "Casa Atelier",
            slug: "casa-atelier",
            cpf_cnpj: "11222333000181",
            abacate_subconta_id: null,
          },
          {
            dbExecutor: fake.db as unknown as DbExecutor,
            abacateOptions: {
              apiKey: secret,
              fetchFn: async () =>
                new Response(rawBody, {
                  status: 500,
                  headers: { "Content-Type": "application/json" },
                }),
            },
          },
        );

        expect(res).toEqual({
          ok: false,
          error: "HTTP 500: an internal server error occurred",
          code: "API_ERROR",
        });
        expect(fake.state.loja.subconta_erro).toBe(
          "HTTP 500: an internal server error occurred",
        );

        const abacateLogs = consoleSpy.mock.calls.filter(
          (call) => call[0] === "[abacatepay]",
        );
        expect(abacateLogs.length).toBe(1);
        const logPayload = JSON.stringify(abacateLogs[0][1]);
        expect(logPayload).toContain('"method":"POST"');
        expect(logPayload).toContain("https://api.abacatepay.com/v2/sub-accounts/create");
        expect(logPayload).toContain('"status":500');
        expect(logPayload).toContain("**********0181");
        expect(logPayload).toContain("an internal server error occurred");
        expect(logPayload).not.toContain("11222333000181");
        expect(logPayload).not.toContain(secret);
      } finally {
        process.env.ABACATEPAY_API_KEY = prevKey;
        consoleSpy.mockRestore();
      }
    });

    it("polling público expira pedido vencido, libera reserva e não vaza PII", async () => {
      const fake = createFakeTransactionalDb();
      fake.state.pedidos.push({
        id: "ped-exp-1",
        loja_id: LOJA_ID,
        codigo: "PED-ABCD1234EFGH",
        status: "aguardando_pagamento",
        pix_expira_em: new Date("2026-11-22T14:15:00-03:00"),
        abacate_cobranca_id: "pix_char_1",
        pix_copia_cola: "000201...",
        demo: false,
        total_centavos: 5000,
        taxa_paga_por: "loja",
        cliente_nome: "Nome Privado PII",
        cliente_whatsapp: "5586999999999",
      });
      fake.state.reservas.push({
        id: "res-exp-1",
        loja_id: LOJA_ID,
        pedido_id: "ped-exp-1",
        produto_id: PROD_1,
        qtd: 1,
        expira_em: new Date("2026-11-22T14:15:00-03:00"),
        liberada: false,
      });

      const res = await consultarStatusPedidoPublico("PED-ABCD1234EFGH", {
        dbClient: fake.db,
        agora: () => new Date("2026-11-22T14:16:00-03:00"),
      });

      expect(res).toEqual({
        codigo: "PED-ABCD1234EFGH",
        status: "expirado",
        segundos_restantes: 0,
        pix_expira_em: new Date("2026-11-22T14:15:00-03:00").toISOString(),
      });
      expect(fake.state.pedidos[0].status).toBe("expirado");
      expect(fake.state.reservas[0].liberada).toBe(true);
      expect(res).not.toHaveProperty("cliente_nome");
      expect(res).not.toHaveProperty("cliente_whatsapp");
    });
  });

  describe("4. Recebimento mascarado e correção auditada de documento", () => {
    it("mascara CPF e CNPJ mantendo apenas o trecho esperado sem expor dígitos sensíveis", () => {
      expect(mascararCpfCnpj("123.456.789-01")).toBe("***.456.789-**");
      expect(mascararCpfCnpj("11222333000181")).toBe("**.***.***/0001-81");
    });

    it("executarCorrecaoDocumentoLoja valida dígitos, bloqueia com subconta/duplicidade/plataforma, limpa erro e audita", async () => {
      const adminId = "99999999-9999-4999-8999-999999999999";

      const criarMockDocDb = (cfg: {
        subcontaId: string | null;
        subcontaErro?: string | null;
        duplicada?: boolean;
      }) => {
        const lojaRow = {
          id: LOJA_ID,
          cpf_cnpj: "11222333000181",
          abacate_subconta_id: cfg.subcontaId,
          subconta_erro: cfg.subcontaErro ?? "HTTP 500: erro anterior",
          abacate_subconta_erro: cfg.subcontaErro ?? "HTTP 500: erro anterior",
        };
        const auditoriaRows: Array<Record<string, unknown>> = [];
        let selectCalls = 0;

        const tx = {
          select() {
            selectCalls += 1;
            const currentCall = selectCalls;
            return {
              from() {
                return {
                  where() {
                    return {
                      for: async () => [lojaRow],
                      limit: async () =>
                        currentCall === 2 && cfg.duplicada ? [{ id: "outra" }] : [],
                    };
                  },
                };
              },
            };
          },
          update(tbl: unknown) {
            return {
              set(vals: Record<string, unknown>) {
                return {
                  where: async () => {
                    if (tbl === lojas) Object.assign(lojaRow, vals);
                    return [];
                  },
                };
              },
            };
          },
          insert(tbl: unknown) {
            return {
              values: async (vals: Record<string, unknown>) => {
                if (tbl === auditoria_admin) auditoriaRows.push(vals);
                return [];
              },
            };
          },
        };

        return {
          lojaRow,
          auditoriaRows,
          db: {
            transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
          } as unknown as Parameters<typeof executarCorrecaoDocumentoLoja>[1] extends {
            dbClient?: infer D;
          }
            ? NonNullable<D>
            : never,
        };
      };

      // 1. Documento inválido (dígitos verificadores errados)
      const inv = await executarCorrecaoDocumentoLoja(
        { adminId, lojaId: LOJA_ID, cpfCnpj: "11222333000100" },
        { dbClient: criarMockDocDb({ subcontaId: null }).db },
      );
      expect(inv.ok).toBe(false);

      // 2. Documento igual ao da plataforma
      const plat = await executarCorrecaoDocumentoLoja(
        { adminId, lojaId: LOJA_ID, cpfCnpj: "22.333.444/0001-81" },
        {
          dbClient: criarMockDocDb({ subcontaId: null }).db,
          platformTaxId: "22333444000181",
        },
      );
      expect(plat.ok).toBe(false);
      expect(plat.mensagem).toMatch(/plataforma/i);

      // 3. Bloqueia se subconta já criada
      const comSubconta = await executarCorrecaoDocumentoLoja(
        { adminId, lojaId: LOJA_ID, cpfCnpj: "22333444000181" },
        { dbClient: criarMockDocDb({ subcontaId: "sacc_123" }).db },
      );
      expect(comSubconta.ok).toBe(false);
      expect(comSubconta.mensagem).toMatch(/já possui subconta/i);

      // 4. Bloqueia duplicidade com outra loja
      const dup = await executarCorrecaoDocumentoLoja(
        { adminId, lojaId: LOJA_ID, cpfCnpj: "22333444000181" },
        { dbClient: criarMockDocDb({ subcontaId: null, duplicada: true }).db },
      );
      expect(dup.ok).toBe(false);
      expect(dup.mensagem).toMatch(/outra loja/i);

      // 5. Sucesso: grava dígitos limpos, limpa erro e registra auditoria mascarada
      const mockOk = criarMockDocDb({ subcontaId: null });
      const okRes = await executarCorrecaoDocumentoLoja(
        { adminId, lojaId: LOJA_ID, cpfCnpj: "22.333.444/0001-81" },
        { dbClient: mockOk.db, platformTaxId: "99888777000100" },
      );
      expect(okRes.ok).toBe(true);
      expect(mockOk.lojaRow.cpf_cnpj).toBe("22333444000181");
      expect(mockOk.lojaRow.subconta_erro).toBeNull();
      expect(mockOk.lojaRow.abacate_subconta_erro).toBeNull();
      expect(mockOk.auditoriaRows).toEqual([
        {
          admin_id: adminId,
          loja_id: LOJA_ID,
          acao: "corrigir_documento",
          valor_antigo_mascarado: "**.***.***/0001-81",
          valor_novo_mascarado: "**.***.***/0001-81",
        },
      ]);
    });
  });
});

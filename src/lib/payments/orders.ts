import crypto from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  bairros_entrega,
  type EnderecoEntrega,
  lojas,
  lojas_entrega,
  pedido_itens,
  pedidos,
  type Pedido,
  planos,
  produtos,
  reservas_estoque,
} from "@/db/schema";
import {
  AbacatePayError,
  type AbacatePayClientOptions,
  criarCobrancaPixTransparente,
} from "@/lib/abacatepay";
import { mapaEstoqueDisponivelPorLoja } from "@/lib/inventory";
import {
  CalculoSplitError,
  calcularResumoESplitServidor,
} from "@/lib/money";
import { getPlatformConfig } from "@/lib/platform-config";
import { verificarRateLimitPedido } from "@/lib/rate-limit";
import { verificarHorarioFuncionamento } from "@/lib/storefront/schedule";
import {
  consolidarItensCheckout,
  criarPedidoPayloadSchema,
} from "@/lib/validators/checkout";
import { extrairErrosZod } from "@/lib/validators/lojista";

const RESERVA_ESTOQUE_MINUTOS = 15;
const CODIGO_ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function gerarCodigoPedido(): string {
  const bytes = crypto.randomBytes(12);
  let suffix = "";
  for (let i = 0; i < 12; i++) {
    suffix += CODIGO_ALFABETO[bytes[i] % CODIGO_ALFABETO.length];
  }
  return `PED-${suffix}`;
}

export class PedidoCheckoutError extends Error {
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    message: string,
    code = "CHECKOUT_ERROR",
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "PedidoCheckoutError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export interface PedidoPixCriadoResumo {
  pedidoId: string;
  codigo: string;
  status: "aguardando_pagamento";
  pix_copia_cola: string;
  pix_expira_em: string;
  subtotal_centavos: number;
  frete_centavos: number;
  taxa_servico_centavos: number;
  total_centavos: number;
  taxa_paga_por: "cliente" | "loja";
}

export type CriarPedidoResult =
  | { ok: true; data: PedidoPixCriadoResumo }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export interface CriarPedidoDeps {
  dbClient?: typeof db;
  criarPixFn?: typeof criarCobrancaPixTransparente;
  abacateOptions?: AbacatePayClientOptions;
  agora?: () => Date;
  ip?: string;
  pedidoMinimoPlataformaCentavos?: number;
  tarifaGatewayPixCentavos?: number;
  margemMinimaCentavos?: number;
  pularRateLimit?: boolean;
  pularHorarioCheck?: boolean;
  gerarCodigoFn?: () => string;
}

function formatarErroPixParaComprador(err: unknown): string {
  if (err instanceof AbacatePayError) {
    switch (err.code) {
      case "MISSING_API_KEY":
      case "UNAUTHORIZED":
        return "Pagamento Pix indisponível no momento (configuração da plataforma pendente).";
      case "SPLIT_DISABLED":
      case "FEATURE_DISABLED":
      case "SUBACCOUNT_NOT_FOUND":
      case "PIX_UNAVAILABLE":
        return "Esta loja ainda não está configurada para receber pagamentos via Pix.";
      case "SPLIT_EXCEEDS_NET":
        return "Valor muito baixo para pagamento via Pix. Adicione mais itens ao pedido.";
      case "TIMEOUT":
      case "NETWORK_ERROR":
        return "O provedor de pagamentos Pix não respondeu a tempo. Tente novamente.";
      default:
        return err.message || "Não foi possível gerar o Pix para este pedido.";
    }
  }
  return "Não foi possível gerar a cobrança Pix no momento. Tente novamente.";
}

export async function executarCriacaoPedido(
  rawSlug: string,
  rawPayload: unknown,
  deps: CriarPedidoDeps = {},
): Promise<CriarPedidoResult> {
  const slug = rawSlug.trim().toLowerCase();
  if (!slug) {
    return { ok: false, error: "Loja não identificada." };
  }

  const parsed = criarPedidoPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revise os dados informados no checkout.",
      fieldErrors: extrairErrosZod(parsed.error),
    };
  }

  const payload = parsed.data;
  const dbClient = deps.dbClient ?? db;
  const agora = (deps.agora ?? (() => new Date()))();

  const [lojaRow] = await dbClient
    .select({
      id: lojas.id,
      nome: lojas.nome,
      slug: lojas.slug,
      status: lojas.status,
      aberta: lojas.aberta,
      taxa_paga_por: lojas.taxa_paga_por,
      abacate_subconta_id: lojas.abacate_subconta_id,
      taxa_fixa_centavos: planos.taxa_fixa_centavos,
      taxa_percentual: planos.taxa_percentual,
    })
    .from(lojas)
    .innerJoin(planos, eq(lojas.plano_id, planos.id))
    .where(and(eq(lojas.slug, slug), isNull(lojas.deletada_em)))
    .limit(1);

  if (!lojaRow || lojaRow.status === "bloqueada") {
    return { ok: false, error: "Loja não encontrada ou indisponível." };
  }

  if (lojaRow.status !== "ativa") {
    return {
      ok: false,
      error: "Esta loja ainda está em aprovação e não aceita pedidos.",
    };
  }

  if (!lojaRow.abacate_subconta_id?.trim()) {
    return {
      ok: false,
      error: "Esta loja ainda não está configurada para receber pagamentos via Pix.",
    };
  }

  if (!lojaRow.aberta) {
    return { ok: false, error: "A loja está fechada no momento." };
  }

  if (!deps.pularRateLimit) {
    const rl = verificarRateLimitPedido({
      ip: deps.ip ?? "127.0.0.1",
      lojaId: lojaRow.id,
      nowMs: agora.getTime(),
    });
    if (!rl.ok) {
      return {
        ok: false,
        error: `Muitas tentativas de pedido em sequência. Aguarde ${rl.retryAfterSeconds}s e tente novamente.`,
      };
    }
  }

  const [entregaRow] = await dbClient
    .select()
    .from(lojas_entrega)
    .where(eq(lojas_entrega.loja_id, lojaRow.id))
    .limit(1);

  if (!entregaRow) {
    return {
      ok: false,
      error: "Configurações de entrega desta loja não foram concluídas.",
    };
  }

  if (!deps.pularHorarioCheck) {
    const horarioStatus = verificarHorarioFuncionamento(
      entregaRow.horarios,
      agora,
    );
    if (!horarioStatus.dentroDoHorario) {
      return {
        ok: false,
        error:
          horarioStatus.motivo ??
          "A loja está fora do horário de funcionamento no momento.",
      };
    }
  }

  if (payload.tipo === "entrega" && !entregaRow.aceita_entrega) {
    return { ok: false, error: "Esta loja não realiza entregas no momento." };
  }
  if (payload.tipo === "retirada" && !entregaRow.aceita_retirada) {
    return {
      ok: false,
      error: "Esta loja não aceita retirada no local no momento.",
    };
  }

  let freteBaseCentavos = 0;
  let enderecoEntrega: EnderecoEntrega | null = null;

  if (payload.tipo === "entrega") {
    const rua = payload.rua?.trim() ?? "";
    const numero = payload.numero?.trim() ?? "";
    const fieldErrors: Record<string, string> = {};

    if (rua.length < 2) {
      fieldErrors.rua = "Informe a rua para entrega.";
    }
    if (!numero) {
      fieldErrors.numero = "Informe o número do endereço.";
    }

    let bairroFinal = payload.bairro_nome?.trim() ?? "";
    if (entregaRow.modo_frete === "bairro") {
      if (!payload.bairro_id) {
        fieldErrors.bairro_id = "Selecione um bairro atendido.";
      } else {
        const [bairroRow] = await dbClient
          .select({
            id: bairros_entrega.id,
            bairro: bairros_entrega.bairro,
            valor_centavos: bairros_entrega.valor_centavos,
          })
          .from(bairros_entrega)
          .where(
            and(
              eq(bairros_entrega.loja_id, lojaRow.id),
              eq(bairros_entrega.id, payload.bairro_id),
            ),
          )
          .limit(1);

        if (!bairroRow) {
          fieldErrors.bairro_id = "Bairro não atendido por esta loja.";
        } else {
          freteBaseCentavos = bairroRow.valor_centavos;
          bairroFinal = bairroRow.bairro;
        }
      }
    } else {
      freteBaseCentavos = entregaRow.frete_fixo_centavos;
      if (bairroFinal.length < 2) {
        fieldErrors.bairro_nome = "Informe o bairro para entrega.";
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      const primeiraMsg = Object.values(fieldErrors)[0];
      return {
        ok: false,
        error: primeiraMsg ?? "Revise o endereço de entrega.",
        fieldErrors,
      };
    }

    enderecoEntrega = {
      rua,
      numero,
      complemento: payload.complemento?.trim() || undefined,
      bairro: bairroFinal,
      referencia: payload.referencia?.trim() || undefined,
      cidade: "Teresina",
      uf: "PI",
    };
  }

  const precisaConfigPlataforma =
    deps.pedidoMinimoPlataformaCentavos === undefined ||
    deps.tarifaGatewayPixCentavos === undefined ||
    deps.margemMinimaCentavos === undefined;
  const platformConfig = precisaConfigPlataforma
    ? await getPlatformConfig()
    : null;

  const pedidoMinimoPlataforma =
    deps.pedidoMinimoPlataformaCentavos ??
    platformConfig!.pedido_minimo_plataforma_centavos;
  const tarifaGatewayPix =
    deps.tarifaGatewayPixCentavos ??
    platformConfig!.tarifa_gateway_pix_centavos;
  const margemMinima =
    deps.margemMinimaCentavos ?? platformConfig!.margem_minima_centavos;

  const itensConsolidados = consolidarItensCheckout(payload.itens);
  const produtoIds = itensConsolidados.map((i) => i.produtoId);
  const codigoPedido = (deps.gerarCodigoFn ?? gerarCodigoPedido)();
  const expiraEmPadrao = new Date(
    agora.getTime() + RESERVA_ESTOQUE_MINUTOS * 60 * 1000,
  );

  let committedOrder: {
    pedidoId: string;
    codigo: string;
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
  };

  try {
    committedOrder = await dbClient.transaction(async (tx) => {
      // Lock de linha em ordem determinística (id ASC) para evitar deadlock e oversell
      const produtosLocked = await tx
        .select({
          id: produtos.id,
          nome: produtos.nome,
          preco_centavos: produtos.preco_centavos,
          estoque: produtos.estoque,
          ativo: produtos.ativo,
        })
        .from(produtos)
        .where(
          and(
            eq(produtos.loja_id, lojaRow.id),
            inArray(produtos.id, produtoIds),
          ),
        )
        .orderBy(asc(produtos.id))
        .for("update");

      const produtoMap = new Map(produtosLocked.map((p) => [p.id, p]));
      const disponibilidadeMap = await mapaEstoqueDisponivelPorLoja(
        lojaRow.id,
        produtosLocked,
        agora,
        tx,
      );

      const itensParaCalculo: Array<{ preco_centavos: number; qtd: number }> =
        [];
      const snapshotsParaInserir: Array<{
        produto_id: string;
        nome_snapshot: string;
        preco_snapshot_centavos: number;
        qtd: number;
      }> = [];

      for (const reqItem of itensConsolidados) {
        const prod = produtoMap.get(reqItem.produtoId);
        if (!prod || !prod.ativo) {
          throw new PedidoCheckoutError(
            "Um ou mais produtos do carrinho não estão mais disponíveis.",
            "PRODUCT_UNAVAILABLE",
          );
        }

        const disponivel = disponibilidadeMap.get(prod.id) ?? 0;
        if (disponivel <= 0) {
          throw new PedidoCheckoutError(
            `O produto "${prod.nome}" está esgotado no momento.`,
            "OUT_OF_STOCK",
          );
        }
        if (reqItem.qtd > disponivel) {
          throw new PedidoCheckoutError(
            `Estoque insuficiente para "${prod.nome}". Disponível agora: ${disponivel}.`,
            "INSUFFICIENT_STOCK",
          );
        }

        itensParaCalculo.push({
          preco_centavos: prod.preco_centavos,
          qtd: reqItem.qtd,
        });
        snapshotsParaInserir.push({
          produto_id: prod.id,
          nome_snapshot: prod.nome,
          preco_snapshot_centavos: prod.preco_centavos,
          qtd: reqItem.qtd,
        });
      }

      const calculo = calcularResumoESplitServidor({
        itens: itensParaCalculo,
        tipo: payload.tipo,
        frete_base_centavos: freteBaseCentavos,
        frete_gratis_acima_centavos: entregaRow.frete_gratis_acima_centavos,
        pedido_minimo_centavos: entregaRow.pedido_minimo_centavos,
        taxa_fixa_centavos: lojaRow.taxa_fixa_centavos,
        taxa_percentual: lojaRow.taxa_percentual,
        taxa_paga_por: lojaRow.taxa_paga_por,
        pedido_minimo_plataforma_centavos: pedidoMinimoPlataforma,
        tarifa_gateway_pix_centavos: tarifaGatewayPix,
        margem_minima_centavos: margemMinima,
      });

      if (calculo.piso_taxa_aplicado) {
        console.warn("[split] Piso mínimo de taxa aplicado ao pedido", {
          lojaId: lojaRow.id,
          slug: lojaRow.slug,
          codigoPedido,
          taxaPlanoCentavos: calculo.taxa_plano_original_centavos,
          taxaAplicadaCentavos: calculo.taxa_servico_centavos,
          tarifaGatewayCentavos: tarifaGatewayPix,
          margemMinimaCentavos: margemMinima,
        });
      }

      const [pedidoInserido] = await tx
        .insert(pedidos)
        .values({
          loja_id: lojaRow.id,
          codigo: codigoPedido,
          cliente_nome: payload.cliente_nome,
          cliente_whatsapp: payload.cliente_whatsapp,
          endereco: enderecoEntrega,
          tipo: payload.tipo,
          subtotal_centavos: calculo.subtotal_centavos,
          frete_centavos: calculo.frete_centavos,
          taxa_servico_centavos: calculo.taxa_servico_centavos,
          taxa_paga_por: lojaRow.taxa_paga_por,
          total_centavos: calculo.total_centavos,
          status: "aguardando_pagamento",
          pix_expira_em: expiraEmPadrao,
          demo: false,
        })
        .returning({
          id: pedidos.id,
          codigo: pedidos.codigo,
        });

      await tx.insert(pedido_itens).values(
        snapshotsParaInserir.map((item) => ({
          loja_id: lojaRow.id,
          pedido_id: pedidoInserido.id,
          produto_id: item.produto_id,
          nome_snapshot: item.nome_snapshot,
          preco_snapshot_centavos: item.preco_snapshot_centavos,
          qtd: item.qtd,
        })),
      );

      await tx.insert(reservas_estoque).values(
        snapshotsParaInserir.map((item) => ({
          loja_id: lojaRow.id,
          pedido_id: pedidoInserido.id,
          produto_id: item.produto_id,
          qtd: item.qtd,
          expira_em: expiraEmPadrao,
          liberada: false,
        })),
      );

      return {
        pedidoId: pedidoInserido.id,
        codigo: pedidoInserido.codigo,
        ...calculo,
      };
    });
  } catch (err) {
    if (err instanceof CalculoSplitError) {
      if (err.code === "PEDIDO_MINIMO_LOJA" || err.code === "PEDIDO_MINIMO_PLATAFORMA") {
        return { ok: false, error: err.message };
      }
      if (err.code === "SPLIT_INVARIANT_VIOLATION") {
        console.error("[split] Recusa por violação de invariante de split", {
          lojaId: lojaRow.id,
          codigoPedido,
          erro: err.message,
        });
      }
      return {
        ok: false,
        error: "Valor muito baixo para pagamento via Pix. Adicione mais itens ao pedido.",
      };
    }
    if (err instanceof PedidoCheckoutError) {
      return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    }
    if (err instanceof Error) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "Não foi possível validar os itens do pedido." };
  }

  const cancelarReservaPedidoPorSplit = async () => {
    try {
      await dbClient.transaction(async (tx) => {
        await tx
          .update(pedidos)
          .set({ status: "cancelado" })
          .where(
            and(
              eq(pedidos.id, committedOrder.pedidoId),
              eq(pedidos.loja_id, lojaRow.id),
            ),
          );

        await tx
          .update(reservas_estoque)
          .set({ liberada: true })
          .where(
            and(
              eq(reservas_estoque.pedido_id, committedOrder.pedidoId),
              eq(reservas_estoque.loja_id, lojaRow.id),
            ),
          );
      });
    } catch {
      // Silencia erro secundário na compensação
    }
  };

  // Invariante pré-gateway: soma dos splits <= total - tarifa_gateway_pix_centavos
  const limiteLiquidoGateway =
    committedOrder.total_centavos - committedOrder.tarifa_gateway_pix_centavos;
  let splitLojistaFinal = committedOrder.parte_lojista_centavos;
  let totalCobrancaFinal = committedOrder.total_centavos;

  if (splitLojistaFinal > limiteLiquidoGateway) {
    const piso = Math.max(
      committedOrder.piso_taxa_centavos,
      committedOrder.tarifa_gateway_pix_centavos,
    );
    const bruto = committedOrder.subtotal_centavos + committedOrder.frete_centavos;
    totalCobrancaFinal =
      lojaRow.taxa_paga_por === "cliente" ? bruto + piso : bruto;
    splitLojistaFinal =
      lojaRow.taxa_paga_por === "cliente" ? bruto : bruto - piso;

    const novoLimiteLiquido =
      totalCobrancaFinal - committedOrder.tarifa_gateway_pix_centavos;

    if (splitLojistaFinal > novoLimiteLiquido || splitLojistaFinal < 1) {
      console.error("[split] Invariante violada mesmo após recálculo com piso", {
        lojaId: lojaRow.id,
        codigoPedido: committedOrder.codigo,
        totalCobrancaFinal,
        splitLojistaFinal,
        novoLimiteLiquido,
      });
      await cancelarReservaPedidoPorSplit();
      return {
        ok: false,
        error:
          "Erro interno ao calcular a divisão do pagamento. Tente novamente com outro valor.",
      };
    }

    console.warn("[split] Split ajustado para o piso antes do envio ao gateway", {
      lojaId: lojaRow.id,
      codigoPedido: committedOrder.codigo,
      pisoCentavos: piso,
      splitLojistaFinal,
      totalCobrancaFinal,
    });
  }

  // Fora da transação: gerar cobrança Pix transparente com split na AbacatePay
  try {
    const criarPixFn = deps.criarPixFn ?? criarCobrancaPixTransparente;
    const cobranca = await criarPixFn(
      {
        amount: totalCobrancaFinal,
        description: `Pedido ${committedOrder.codigo} - ${lojaRow.nome}`,
        expiresIn: RESERVA_ESTOQUE_MINUTOS * 60,
        externalId: committedOrder.codigo,
        metadata: {
          pedidoId: committedOrder.pedidoId,
          lojaId: lojaRow.id,
          codigo: committedOrder.codigo,
        },
        splits: [
          {
            subAccountId: lojaRow.abacate_subconta_id.trim(),
            amount: splitLojistaFinal,
          },
        ],
      },
      deps.abacateOptions,
    );

    const pixExpiraParsed = cobranca.expiresAt
      ? new Date(cobranca.expiresAt)
      : expiraEmPadrao;
    const pixExpiraFinal = Number.isNaN(pixExpiraParsed.getTime())
      ? expiraEmPadrao
      : pixExpiraParsed;

    await dbClient.transaction(async (tx) => {
      await tx
        .update(pedidos)
        .set({
          abacate_cobranca_id: cobranca.id,
          pix_copia_cola: cobranca.brCode,
          pix_expira_em: pixExpiraFinal,
        })
        .where(
          and(
            eq(pedidos.id, committedOrder.pedidoId),
            eq(pedidos.loja_id, lojaRow.id),
          ),
        );

      await tx
        .update(reservas_estoque)
        .set({ expira_em: pixExpiraFinal })
        .where(
          and(
            eq(reservas_estoque.pedido_id, committedOrder.pedidoId),
            eq(reservas_estoque.loja_id, lojaRow.id),
          ),
        );
    });

    return {
      ok: true,
      data: {
        pedidoId: committedOrder.pedidoId,
        codigo: committedOrder.codigo,
        status: "aguardando_pagamento",
        pix_copia_cola: cobranca.brCode,
        pix_expira_em: pixExpiraFinal.toISOString(),
        subtotal_centavos: committedOrder.subtotal_centavos,
        frete_centavos: committedOrder.frete_centavos,
        taxa_servico_centavos: committedOrder.taxa_servico_centavos,
        total_centavos: committedOrder.total_centavos,
        taxa_paga_por: lojaRow.taxa_paga_por,
      },
    };
  } catch (err) {
    // Compensação obrigatória se AbacatePay falhar: cancelar pedido e liberar reserva
    try {
      await dbClient.transaction(async (tx) => {
        await tx
          .update(pedidos)
          .set({ status: "cancelado" })
          .where(
            and(
              eq(pedidos.id, committedOrder.pedidoId),
              eq(pedidos.loja_id, lojaRow.id),
            ),
          );

        await tx
          .update(reservas_estoque)
          .set({ liberada: true })
          .where(
            and(
              eq(reservas_estoque.pedido_id, committedOrder.pedidoId),
              eq(reservas_estoque.loja_id, lojaRow.id),
            ),
          );
      });
    } catch {
      // Silencia erro secundário na compensação para não vazar detalhes internos
    }

    return {
      ok: false,
      error: formatarErroPixParaComprador(err),
    };
  }
}

export interface StatusPedidoPublico {
  codigo: string;
  status: Pedido["status"];
  segundos_restantes: number;
  pix_expira_em: string | null;
}

export async function consultarStatusPedidoPublico(
  rawCodigo: string,
  deps: { dbClient?: typeof db; agora?: () => Date } = {},
): Promise<StatusPedidoPublico | null> {
  const codigo = rawCodigo.trim().toUpperCase();
  if (!/^[A-Z0-9-]{10,32}$/.test(codigo)) {
    return null;
  }

  const dbClient = deps.dbClient ?? db;
  const agora = (deps.agora ?? (() => new Date()))();

  const [pedido] = await dbClient
    .select({
      id: pedidos.id,
      loja_id: pedidos.loja_id,
      codigo: pedidos.codigo,
      status: pedidos.status,
      pix_expira_em: pedidos.pix_expira_em,
      demo: pedidos.demo,
    })
    .from(pedidos)
    .where(and(eq(pedidos.codigo, codigo), eq(pedidos.demo, false)))
    .limit(1);

  if (!pedido) {
    return null;
  }

  let statusAtual = pedido.status;

  if (
    statusAtual === "aguardando_pagamento" &&
    pedido.pix_expira_em &&
    pedido.pix_expira_em.getTime() <= agora.getTime()
  ) {
    await dbClient.transaction(async (tx) => {
      const updated = await tx
        .update(pedidos)
        .set({ status: "expirado" })
        .where(
          and(
            eq(pedidos.id, pedido.id),
            eq(pedidos.loja_id, pedido.loja_id),
            eq(pedidos.status, "aguardando_pagamento"),
          ),
        )
        .returning({ status: pedidos.status });

      if (updated.length > 0) {
        statusAtual = updated[0].status;
        await tx
          .update(reservas_estoque)
          .set({ liberada: true })
          .where(
            and(
              eq(reservas_estoque.pedido_id, pedido.id),
              eq(reservas_estoque.loja_id, pedido.loja_id),
            ),
          );
      } else {
        const [fresco] = await tx
          .select({ status: pedidos.status })
          .from(pedidos)
          .where(
            and(
              eq(pedidos.id, pedido.id),
              eq(pedidos.loja_id, pedido.loja_id),
            ),
          )
          .limit(1);
        if (fresco) statusAtual = fresco.status;
      }
    });
  }

  const segundosRestantes =
    statusAtual === "aguardando_pagamento" && pedido.pix_expira_em
      ? Math.max(
          0,
          Math.floor((pedido.pix_expira_em.getTime() - agora.getTime()) / 1000),
        )
      : 0;

  return {
    codigo: pedido.codigo,
    status: statusAtual,
    segundos_restantes: segundosRestantes,
    pix_expira_em: pedido.pix_expira_em
      ? pedido.pix_expira_em.toISOString()
      : null,
  };
}

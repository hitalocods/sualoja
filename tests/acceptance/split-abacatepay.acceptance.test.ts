import "dotenv/config";
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { closeDb, db } from "@/db";
import {
  bairros_entrega,
  lojas,
  lojas_entrega,
  pedidos,
  produtos,
} from "@/db/schema";
import {
  buscarSubcontaAbacatePay,
  simularPagamentoPixTransparente,
} from "@/lib/abacatepay";
import { mapaEstoqueDisponivelPorLoja } from "@/lib/inventory";
import {
  calcularParteLojistaDoPedido,
  formatarCentavos,
  validarAumentoSaldoSubconta,
} from "@/lib/money";
import { executarCriacaoPedido } from "@/lib/payments/orders";

const SLUG_ALVO = "casa-atelier";
const MAX_TENTATIVAS_SALDO = 5;
const INTERVALO_POLL_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

after(async () => {
  await closeDb();
});

test("Aceitação split AbacatePay (Modo Teste): saldo da subconta casa-atelier sobe exatamente pelo split do pedido", async () => {
  const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
  assert.ok(
    databaseUrl.length > 0,
    "DATABASE_URL não configurada no ambiente (.env).",
  );

  const apiKey = (process.env.ABACATEPAY_API_KEY ?? "").trim();
  assert.ok(
    apiKey.length > 0,
    "ABACATEPAY_API_KEY não configurada no ambiente (.env).",
  );
  assert.ok(
    apiKey.startsWith("abc_dev_"),
    "Este teste de aceitação exige uma chave do Modo Teste da AbacatePay (prefixo abc_dev_).",
  );

  // 1. Carregar loja casa-atelier e configurações de entrega (tenant scoped)
  const [lojaRow] = await db
    .select({
      id: lojas.id,
      slug: lojas.slug,
      nome: lojas.nome,
      status: lojas.status,
      aberta: lojas.aberta,
      abacate_subconta_id: lojas.abacate_subconta_id,
      aceita_retirada: lojas_entrega.aceita_retirada,
      aceita_entrega: lojas_entrega.aceita_entrega,
      modo_frete: lojas_entrega.modo_frete,
      pedido_minimo_centavos: lojas_entrega.pedido_minimo_centavos,
    })
    .from(lojas)
    .innerJoin(lojas_entrega, eq(lojas_entrega.loja_id, lojas.id))
    .where(and(eq(lojas.slug, SLUG_ALVO), isNull(lojas.deletada_em)))
    .limit(1);

  assert.ok(lojaRow, `Loja "${SLUG_ALVO}" não encontrada no banco.`);
  assert.equal(
    lojaRow.status,
    "ativa",
    `Loja "${SLUG_ALVO}" precisa estar ativa (atual: ${lojaRow.status}).`,
  );
  assert.equal(
    lojaRow.aberta,
    true,
    `Loja "${SLUG_ALVO}" precisa estar aberta para aceitar pedidos.`,
  );

  const subAccountId = lojaRow.abacate_subconta_id?.trim() ?? "";
  assert.ok(
    subAccountId.length > 0,
    `Loja "${SLUG_ALVO}" não possui abacate_subconta_id configurada.`,
  );

  // 2. Consultar saldo disponível da subconta ANTES da simulação
  const subcontaAntes = await buscarSubcontaAbacatePay(subAccountId);
  const saldoAntesCentavos = subcontaAntes.balance?.available;
  assert.ok(
    typeof saldoAntesCentavos === "number" &&
      Number.isSafeInteger(saldoAntesCentavos) &&
      saldoAntesCentavos >= 0,
    `Saldo inicial inválido retornado para subconta ${subAccountId}: ${String(saldoAntesCentavos)}`,
  );

  // 3. Obter pedido pendente (via ACCEPTANCE_PEDIDO_CODIGO ou criando um novo pedido real)
  const codigoSolicitado = process.env.ACCEPTANCE_PEDIDO_CODIGO?.trim().toUpperCase();
  let codigoPedido: string;

  if (codigoSolicitado) {
    const [pedidoExistente] = await db
      .select({
        codigo: pedidos.codigo,
        status: pedidos.status,
        abacate_cobranca_id: pedidos.abacate_cobranca_id,
        pix_expira_em: pedidos.pix_expira_em,
      })
      .from(pedidos)
      .where(
        and(
          eq(pedidos.loja_id, lojaRow.id),
          eq(pedidos.codigo, codigoSolicitado),
        ),
      )
      .limit(1);

    assert.ok(
      pedidoExistente,
      `Pedido "${codigoSolicitado}" não encontrado na loja "${SLUG_ALVO}".`,
    );
    assert.equal(
      pedidoExistente.status,
      "aguardando_pagamento",
      `Pedido "${codigoSolicitado}" não está aguardando_pagamento (atual: ${pedidoExistente.status}).`,
    );
    assert.ok(
      pedidoExistente.abacate_cobranca_id?.trim(),
      `Pedido "${codigoSolicitado}" não possui abacate_cobranca_id.`,
    );
    if (pedidoExistente.pix_expira_em) {
      assert.ok(
        pedidoExistente.pix_expira_em.getTime() > Date.now(),
        `QR Code Pix do pedido "${codigoSolicitado}" já expirou em ${pedidoExistente.pix_expira_em.toISOString()}.`,
      );
    }
    codigoPedido = pedidoExistente.codigo;
  } else {
    const agora = new Date();
    const produtosAtivos = await db
      .select({
        id: produtos.id,
        nome: produtos.nome,
        preco_centavos: produtos.preco_centavos,
        estoque: produtos.estoque,
      })
      .from(produtos)
      .where(
        and(
          eq(produtos.loja_id, lojaRow.id),
          eq(produtos.ativo, true),
          gt(produtos.estoque, 0),
        ),
      )
      .orderBy(desc(produtos.estoque), desc(produtos.preco_centavos));

    assert.ok(
      produtosAtivos.length > 0,
      `Nenhum produto ativo com estoque > 0 encontrado em "${SLUG_ALVO}".`,
    );

    const disponibilidadeMap = await mapaEstoqueDisponivelPorLoja(
      lojaRow.id,
      produtosAtivos,
      agora,
    );

    const minimoAceitoCentavos = Math.max(lojaRow.pedido_minimo_centavos, 1000);
    let itemEscolhido: { produtoId: string; qtd: number } | null = null;

    for (const prod of produtosAtivos) {
      const disp = disponibilidadeMap.get(prod.id) ?? 0;
      if (disp >= 1 && prod.preco_centavos >= minimoAceitoCentavos) {
        itemEscolhido = { produtoId: prod.id, qtd: 1 };
        break;
      }
    }

    if (!itemEscolhido) {
      for (const prod of produtosAtivos) {
        const disp = disponibilidadeMap.get(prod.id) ?? 0;
        if (disp >= 1 && prod.preco_centavos > 0) {
          const qtdNecessaria = Math.ceil(
            minimoAceitoCentavos / prod.preco_centavos,
          );
          if (qtdNecessaria <= disp) {
            itemEscolhido = { produtoId: prod.id, qtd: qtdNecessaria };
            break;
          }
        }
      }
    }

    assert.ok(
      itemEscolhido,
      `Não há produto com estoque disponível suficiente em "${SLUG_ALVO}" para atingir o mínimo de ${formatarCentavos(minimoAceitoCentavos)}.`,
    );

    let payloadCheckout: Record<string, unknown>;
    if (lojaRow.aceita_retirada) {
      payloadCheckout = {
        tipo: "retirada",
        cliente_nome: "Teste Aceitação Split",
        cliente_whatsapp: "86999990000",
        itens: [itemEscolhido],
      };
    } else {
      assert.equal(
        lojaRow.aceita_entrega,
        true,
        `Loja "${SLUG_ALVO}" não aceita retirada nem entrega.`,
      );
      if (lojaRow.modo_frete === "bairro") {
        const [bairroRow] = await db
          .select({ id: bairros_entrega.id, bairro: bairros_entrega.bairro })
          .from(bairros_entrega)
          .where(eq(bairros_entrega.loja_id, lojaRow.id))
          .limit(1);
        assert.ok(
          bairroRow,
          `Loja "${SLUG_ALVO}" usa modo_frete=bairro mas não possui bairros cadastrados.`,
        );
        payloadCheckout = {
          tipo: "entrega",
          cliente_nome: "Teste Aceitação Split",
          cliente_whatsapp: "86999990000",
          rua: "Av. Frei Serafim",
          numero: "1000",
          bairro_id: bairroRow.id,
          bairro_nome: bairroRow.bairro,
          itens: [itemEscolhido],
        };
      } else {
        payloadCheckout = {
          tipo: "entrega",
          cliente_nome: "Teste Aceitação Split",
          cliente_whatsapp: "86999990000",
          rua: "Av. Frei Serafim",
          numero: "1000",
          bairro_nome: "Centro",
          itens: [itemEscolhido],
        };
      }
    }

    const criado = await executarCriacaoPedido(SLUG_ALVO, payloadCheckout, {
      pularRateLimit: true,
      pularHorarioCheck: true,
    });
    assert.equal(
      criado.ok,
      true,
      `Falha ao criar pedido de aceitação em "${SLUG_ALVO}": ${criado.ok ? "" : criado.error}`,
    );
    codigoPedido = criado.data.codigo;
  }

  // 4. Re-ler o pedido persistido no banco (sempre filtrado por loja_id)
  const [pedidoDb] = await db
    .select({
      id: pedidos.id,
      codigo: pedidos.codigo,
      abacate_cobranca_id: pedidos.abacate_cobranca_id,
      subtotal_centavos: pedidos.subtotal_centavos,
      frete_centavos: pedidos.frete_centavos,
      taxa_servico_centavos: pedidos.taxa_servico_centavos,
      taxa_paga_por: pedidos.taxa_paga_por,
      total_centavos: pedidos.total_centavos,
      status: pedidos.status,
    })
    .from(pedidos)
    .where(
      and(eq(pedidos.loja_id, lojaRow.id), eq(pedidos.codigo, codigoPedido)),
    )
    .limit(1);

  assert.ok(
    pedidoDb,
    `Pedido "${codigoPedido}" não encontrado após persistência.`,
  );
  const cobrancaId = pedidoDb.abacate_cobranca_id?.trim() ?? "";
  assert.ok(
    cobrancaId.length > 0,
    `Pedido "${codigoPedido}" sem abacate_cobranca_id gravado.`,
  );

  const splitEsperadoCentavos = calcularParteLojistaDoPedido({
    subtotal_centavos: pedidoDb.subtotal_centavos,
    frete_centavos: pedidoDb.frete_centavos,
    taxa_servico_centavos: pedidoDb.taxa_servico_centavos,
    taxa_paga_por: pedidoDb.taxa_paga_por,
    total_centavos: pedidoDb.total_centavos,
  });

  // 5. Simular pagamento no endpoint de Modo Teste da AbacatePay
  const simulacao = await simularPagamentoPixTransparente(cobrancaId);
  assert.equal(
    simulacao.status,
    "PAID",
    `Status após simulação deveria ser PAID (recebido: ${simulacao.status}).`,
  );
  assert.equal(
    simulacao.devMode,
    true,
    "Simulação deve ocorrer em ambiente devMode=true.",
  );

  // 6. Consultar GET /v2/sub-accounts/get para verificar o crédito na subconta
  let subcontaDepois = await buscarSubcontaAbacatePay(subAccountId);
  let saldoDepoisCentavos = subcontaDepois.balance?.available ?? 0;

  for (
    let tentativa = 0;
    tentativa < MAX_TENTATIVAS_SALDO &&
    saldoDepoisCentavos === saldoAntesCentavos;
    tentativa++
  ) {
    await sleep(INTERVALO_POLL_MS);
    subcontaDepois = await buscarSubcontaAbacatePay(subAccountId);
    saldoDepoisCentavos = subcontaDepois.balance?.available ?? 0;
  }

  assert.ok(
    typeof subcontaDepois.balance?.available === "number" &&
      Number.isSafeInteger(saldoDepoisCentavos) &&
      saldoDepoisCentavos >= 0,
    `Saldo final inválido retornado para subconta ${subAccountId}: ${String(subcontaDepois.balance?.available)}`,
  );

  // 7. Garantir que o aumento foi EXATAMENTE igual ao split gravado no pedido
  const { deltaCentavos } = validarAumentoSaldoSubconta({
    subAccountId,
    codigoPedido: pedidoDb.codigo,
    saldoAntesCentavos,
    saldoDepoisCentavos,
    splitEsperadoCentavos,
  });

  console.info("[acceptance:split] Verificação concluída com sucesso:", {
    loja: SLUG_ALVO,
    subAccountId,
    codigoPedido: pedidoDb.codigo,
    abacateCobrancaId: cobrancaId,
    totalCentavos: pedidoDb.total_centavos,
    taxaServicoCentavos: pedidoDb.taxa_servico_centavos,
    taxaPagaPor: pedidoDb.taxa_paga_por,
    splitEsperadoCentavos,
    saldoAntesCentavos,
    saldoDepoisCentavos,
    deltaCentavos,
  });
});

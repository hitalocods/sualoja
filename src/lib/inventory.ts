import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { reservas_estoque } from "@/db/schema";

export function calcularEstoqueDisponivel(
  estoqueTotal: number,
  qtdReservadaAtiva: number,
): number {
  const total = Number.isFinite(estoqueTotal) ? Math.trunc(estoqueTotal) : 0;
  const reservado = Number.isFinite(qtdReservadaAtiva)
    ? Math.max(0, Math.trunc(qtdReservadaAtiva))
    : 0;
  return Math.max(0, total - reservado);
}

export async function buscarReservasAtivasPorProdutos(
  lojaId: string,
  produtoIds?: readonly string[],
  agora: Date = new Date(),
  executor: DbExecutor = db,
): Promise<Map<string, number>> {
  if (produtoIds && produtoIds.length === 0) {
    return new Map();
  }

  const conditions = [
    eq(reservas_estoque.loja_id, lojaId),
    eq(reservas_estoque.liberada, false),
    gt(reservas_estoque.expira_em, agora),
  ];

  if (produtoIds && produtoIds.length > 0) {
    conditions.push(inArray(reservas_estoque.produto_id, [...produtoIds]));
  }

  const rows = await executor
    .select({
      produto_id: reservas_estoque.produto_id,
      reservado: sql<number>`COALESCE(SUM(${reservas_estoque.qtd}), 0)::int`,
    })
    .from(reservas_estoque)
    .where(and(...conditions))
    .groupBy(reservas_estoque.produto_id);

  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.produto_id, Math.max(0, Number(row.reservado) || 0));
  }
  return map;
}

export async function mapaEstoqueDisponivelPorLoja(
  lojaId: string,
  itens: ReadonlyArray<{ id: string; estoque: number }>,
  agora: Date = new Date(),
  executor: DbExecutor = db,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (itens.length === 0) {
    return result;
  }

  const ids = itens.map((item) => item.id);
  const reservas = await buscarReservasAtivasPorProdutos(
    lojaId,
    ids,
    agora,
    executor,
  );

  for (const item of itens) {
    const reservado = reservas.get(item.id) ?? 0;
    result.set(item.id, calcularEstoqueDisponivel(item.estoque, reservado));
  }

  return result;
}

export async function obterEstoqueDisponivelProduto(
  lojaId: string,
  produtoId: string,
  estoqueTotal: number,
  agora: Date = new Date(),
  executor: DbExecutor = db,
): Promise<number> {
  const reservas = await buscarReservasAtivasPorProdutos(
    lojaId,
    [produtoId],
    agora,
    executor,
  );
  return calcularEstoqueDisponivel(produtoId ? (estoqueTotal) : 0, reservas.get(produtoId) ?? 0);
}

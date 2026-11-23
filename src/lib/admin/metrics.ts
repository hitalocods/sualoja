import { and, desc, eq, gte, inArray, isNull, count } from "drizzle-orm";
import { db } from "@/db";
import {
  assinaturas,
  impersonacoes_auditoria,
  lojas,
  lojas_tema,
  pedidos,
  planos,
  produtos,
  usuarios,
  type Assinatura,
} from "@/db/schema";

export type AdminPeriodDays = 7 | 30 | 90;

export const PAID_ORDER_STATUSES = [
  "pago",
  "em_separacao",
  "saiu_entrega",
  "entregue",
] as const;

export function resolveAdminQueryParams(
  params: { periodo?: string | string[]; demo?: string | string[] },
  isProduction = process.env.NODE_ENV === "production",
): { dias: AdminPeriodDays; includeDemo: boolean; isProduction: boolean } {
  const periodoRaw = Array.isArray(params.periodo)
    ? params.periodo[0]
    : params.periodo;
  const demoRaw = Array.isArray(params.demo) ? params.demo[0] : params.demo;

  let dias: AdminPeriodDays = 30;
  if (periodoRaw === "7") dias = 7;
  else if (periodoRaw === "90") dias = 90;

  // Em produção, dados demo são SEMPRE excluídos.
  const includeDemo = isProduction
    ? false
    : demoRaw !== "0" && demoRaw !== "false";

  return { dias, includeDemo, isProduction };
}

export function calcularVariacaoPercentual(
  atual: number,
  anterior: number,
): number {
  if (anterior === 0 && atual === 0) return 0;
  if (anterior === 0 && atual > 0) return 100;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

export function calcularDiasRestantesTrial(
  trialAte: Date | null,
  now = new Date(),
): number | null {
  if (!trialAte) return null;
  const diffMs = trialAte.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / 86_400_000));
}

const BRT_DATE_KEY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const BRT_DATE_SHORT_FMT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const BRT_DATETIME_FMT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function toBrDateKey(data: Date): string {
  return BRT_DATE_KEY_FMT.format(data);
}

function buildDayKeyWindow(
  totalDays: number,
  now = new Date(),
): { currentKeys: string[]; prevKeys: string[] } {
  // Usa meio-dia UTC do dia atual BRT para iterar dias civis sem deriva DST
  const todayKey = toBrDateKey(now);
  const [y, m, d] = todayKey.split("-").map(Number);
  const anchorUtc = Date.UTC(y, m - 1, d, 15, 0, 0);

  const prevKeys: string[] = [];
  for (let i = totalDays * 2 - 1; i >= totalDays; i--) {
    prevKeys.push(toBrDateKey(new Date(anchorUtc - i * 86_400_000)));
  }

  const currentKeys: string[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    currentKeys.push(toBrDateKey(new Date(anchorUtc - i * 86_400_000)));
  }

  return { currentKeys, prevKeys };
}

function formatDayLabel(dateKey: string): string {
  const [, mm, dd] = dateKey.split("-");
  return `${dd}/${mm}`;
}

export interface AdminSerieDiariaItem {
  dataKey: string;
  label: string;
  faturamentoCentavos: number;
  comissaoCentavos: number;
  faturamentoReais: number;
  comissaoReais: number;
  pedidos: number;
  ticketMedioCentavos: number;
  novasLojas: number;
}

export interface AdminDashboardKpis {
  gmv: {
    valorCentavos: number;
    anteriorCentavos: number;
    variacaoPct: number;
    sparkline: number[];
  };
  comissao: {
    valorCentavos: number;
    anteriorCentavos: number;
    variacaoPct: number;
    sparkline: number[];
  };
  pedidos: {
    total: number;
    anteriorTotal: number;
    variacaoPct: number;
    sparkline: number[];
  };
  ticketMedio: {
    valorCentavos: number;
    anteriorCentavos: number;
    variacaoPct: number;
    sparkline: number[];
  };
}

export interface AdminTopLojaItem {
  id: string;
  nome: string;
  slug: string;
  logoUrl: string | null;
  corPrimaria: string;
  planoNome: string;
  faturamentoCentavos: number;
  pedidos: number;
  percentualDoLider: number;
}

export interface AdminAprovacaoPendenteItem {
  id: string;
  nome: string;
  slug: string;
  categoria: string;
  donoNome: string;
  donoEmail: string;
  logoUrl: string | null;
  corPrimaria: string;
  criadaEmFormatada: string;
}

export interface AdminAtividadeItem {
  id: string;
  tipo: "nova_loja" | "loja_aprovada" | "bloqueio" | "impersonacao";
  titulo: string;
  descricao: string;
  lojaId?: string;
  slug?: string;
  dataIso: string;
  dataFormatada: string;
}

export interface AdminDashboardData {
  periodoDias: AdminPeriodDays;
  includeDemo: boolean;
  isProduction: boolean;
  kpis: AdminDashboardKpis;
  serieDiaria: AdminSerieDiariaItem[];
  topLojas: AdminTopLojaItem[];
  funil: {
    cadastradas: number;
    trial: number;
    ativas: number;
    pendentes: number;
    bloqueadas: number;
  };
  aprovacoesPendentes: AdminAprovacaoPendenteItem[];
  atividadesRecentes: AdminAtividadeItem[];
}

export async function getAdminDashboardData(params: {
  dias: AdminPeriodDays;
  includeDemo: boolean;
  isProduction: boolean;
}): Promise<AdminDashboardData> {
  const agora = new Date();
  const { currentKeys, prevKeys } = buildDayKeyWindow(params.dias, agora);
  const currentSet = new Set(currentKeys);
  const prevSet = new Set(prevKeys);

  // Busca com margem segura de 1 dia além da janela dupla
  const janelaInicio = new Date(
    agora.getTime() - (params.dias * 2 + 1) * 86_400_000,
  );

  const pedidoFilters = [
    inArray(pedidos.status, PAID_ORDER_STATUSES),
    gte(pedidos.criado_em, janelaInicio),
    isNull(lojas.deletada_em),
  ];
  if (!params.includeDemo) {
    pedidoFilters.push(eq(pedidos.demo, false));
  }

  const [lojasRows, pedidosRows, auditoriaRows] = await Promise.all([
    db
      .select({
        id: lojas.id,
        nome: lojas.nome,
        slug: lojas.slug,
        categoria: lojas.categoria,
        status: lojas.status,
        criada_em: lojas.criada_em,
        donoNome: usuarios.nome,
        donoEmail: usuarios.email,
        planoNome: planos.nome,
        assinaturaStatus: assinaturas.status,
        logoUrl: lojas_tema.logo_url,
        corPrimaria: lojas_tema.cor_primaria,
      })
      .from(lojas)
      .innerJoin(usuarios, eq(lojas.dono_id, usuarios.id))
      .innerJoin(planos, eq(lojas.plano_id, planos.id))
      .leftJoin(assinaturas, eq(assinaturas.loja_id, lojas.id))
      .leftJoin(lojas_tema, eq(lojas_tema.loja_id, lojas.id))
      .where(isNull(lojas.deletada_em))
      .orderBy(desc(lojas.criada_em)),
    db
      .select({
        id: pedidos.id,
        loja_id: pedidos.loja_id,
        total_centavos: pedidos.total_centavos,
        taxa_servico_centavos: pedidos.taxa_servico_centavos,
        pago_em: pedidos.pago_em,
        criado_em: pedidos.criado_em,
      })
      .from(pedidos)
      .innerJoin(lojas, eq(pedidos.loja_id, lojas.id))
      .where(and(...pedidoFilters)),
    db
      .select({
        id: impersonacoes_auditoria.id,
        criado_em: impersonacoes_auditoria.criado_em,
        adminNome: usuarios.nome,
        lojaId: lojas.id,
        lojaNome: lojas.nome,
        lojaSlug: lojas.slug,
      })
      .from(impersonacoes_auditoria)
      .innerJoin(usuarios, eq(impersonacoes_auditoria.admin_id, usuarios.id))
      .innerJoin(lojas, eq(impersonacoes_auditoria.loja_id, lojas.id))
      .orderBy(desc(impersonacoes_auditoria.criado_em))
      .limit(10),
  ]);

  const dailyBuckets = new Map<
    string,
    {
      faturamentoCentavos: number;
      comissaoCentavos: number;
      pedidos: number;
      novasLojas: number;
    }
  >();
  for (const key of currentKeys) {
    dailyBuckets.set(key, {
      faturamentoCentavos: 0,
      comissaoCentavos: 0,
      pedidos: 0,
      novasLojas: 0,
    });
  }

  let curGmv = 0;
  let curComissao = 0;
  let curPedidos = 0;
  let prevGmv = 0;
  let prevComissao = 0;
  let prevPedidos = 0;

  const storeSalesMap = new Map<
    string,
    { faturamentoCentavos: number; pedidos: number }
  >();

  for (const row of pedidosRows) {
    const key = toBrDateKey(row.pago_em ?? row.criado_em);
    if (currentSet.has(key)) {
      curGmv += row.total_centavos;
      curComissao += row.taxa_servico_centavos;
      curPedidos += 1;

      const bucket = dailyBuckets.get(key);
      if (bucket) {
        bucket.faturamentoCentavos += row.total_centavos;
        bucket.comissaoCentavos += row.taxa_servico_centavos;
        bucket.pedidos += 1;
      }

      const prevStore = storeSalesMap.get(row.loja_id) ?? {
        faturamentoCentavos: 0,
        pedidos: 0,
      };
      prevStore.faturamentoCentavos += row.total_centavos;
      prevStore.pedidos += 1;
      storeSalesMap.set(row.loja_id, prevStore);
    } else if (prevSet.has(key)) {
      prevGmv += row.total_centavos;
      prevComissao += row.taxa_servico_centavos;
      prevPedidos += 1;
    }
  }

  for (const loja of lojasRows) {
    const key = toBrDateKey(loja.criada_em);
    const bucket = dailyBuckets.get(key);
    if (bucket) {
      bucket.novasLojas += 1;
    }
  }

  const serieDiaria: AdminSerieDiariaItem[] = currentKeys.map((key) => {
    const b = dailyBuckets.get(key)!;
    const ticketMedioCentavos =
      b.pedidos > 0 ? Math.round(b.faturamentoCentavos / b.pedidos) : 0;
    return {
      dataKey: key,
      label: formatDayLabel(key),
      faturamentoCentavos: b.faturamentoCentavos,
      comissaoCentavos: b.comissaoCentavos,
      faturamentoReais: Math.round((b.faturamentoCentavos / 100) * 100) / 100,
      comissaoReais: Math.round((b.comissaoCentavos / 100) * 100) / 100,
      pedidos: b.pedidos,
      ticketMedioCentavos,
      novasLojas: b.novasLojas,
    };
  });

  const curTicketMedio =
    curPedidos > 0 ? Math.round(curGmv / curPedidos) : 0;
  const prevTicketMedio =
    prevPedidos > 0 ? Math.round(prevGmv / prevPedidos) : 0;

  // Sparklines com até 14 pontos agrupados/diretos para cards limpos
  const sparkSource =
    serieDiaria.length > 18 ? serieDiaria.slice(-18) : serieDiaria;

  const kpis: AdminDashboardKpis = {
    gmv: {
      valorCentavos: curGmv,
      anteriorCentavos: prevGmv,
      variacaoPct: calcularVariacaoPercentual(curGmv, prevGmv),
      sparkline: sparkSource.map((d) => d.faturamentoReais),
    },
    comissao: {
      valorCentavos: curComissao,
      anteriorCentavos: prevComissao,
      variacaoPct: calcularVariacaoPercentual(curComissao, prevComissao),
      sparkline: sparkSource.map((d) => d.comissaoReais),
    },
    pedidos: {
      total: curPedidos,
      anteriorTotal: prevPedidos,
      variacaoPct: calcularVariacaoPercentual(curPedidos, prevPedidos),
      sparkline: sparkSource.map((d) => d.pedidos),
    },
    ticketMedio: {
      valorCentavos: curTicketMedio,
      anteriorCentavos: prevTicketMedio,
      variacaoPct: calcularVariacaoPercentual(curTicketMedio, prevTicketMedio),
      sparkline: sparkSource.map((d) =>
        Math.round((d.ticketMedioCentavos / 100) * 100) / 100,
      ),
    },
  };

  // Ranking Top Lojas
  const lojaInfoMap = new Map(lojasRows.map((l) => [l.id, l]));
  const topOrdenadas = Array.from(storeSalesMap.entries())
    .map(([lojaId, stats]) => {
      const info = lojaInfoMap.get(lojaId);
      if (!info) return null;
      return {
        id: info.id,
        nome: info.nome,
        slug: info.slug,
        logoUrl: info.logoUrl ?? null,
        corPrimaria: info.corPrimaria ?? "#EA1D2C",
        planoNome: info.planoNome,
        faturamentoCentavos: stats.faturamentoCentavos,
        pedidos: stats.pedidos,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.faturamentoCentavos - a.faturamentoCentavos)
    .slice(0, 5);

  const liderFaturamento = topOrdenadas[0]?.faturamentoCentavos ?? 0;
  const topLojas: AdminTopLojaItem[] = topOrdenadas.map((item) => ({
    ...item,
    percentualDoLider:
      liderFaturamento > 0
        ? Math.max(8, Math.round((item.faturamentoCentavos / liderFaturamento) * 100))
        : 0,
  }));

  // Funil
  const funil = {
    cadastradas: lojasRows.length,
    trial: lojasRows.filter((l) => l.assinaturaStatus === "trial").length,
    ativas: lojasRows.filter((l) => l.status === "ativa").length,
    pendentes: lojasRows.filter((l) => l.status === "pendente").length,
    bloqueadas: lojasRows.filter((l) => l.status === "bloqueada").length,
  };

  // Aprovações pendentes
  const aprovacoesPendentes: AdminAprovacaoPendenteItem[] = lojasRows
    .filter((l) => l.status === "pendente")
    .map((l) => ({
      id: l.id,
      nome: l.nome,
      slug: l.slug,
      categoria: l.categoria,
      donoNome: l.donoNome,
      donoEmail: l.donoEmail,
      logoUrl: l.logoUrl ?? null,
      corPrimaria: l.corPrimaria ?? "#EA1D2C",
      criadaEmFormatada: BRT_DATE_SHORT_FMT.format(l.criada_em),
    }));

  // Atividade recente combinada
  const rawAtividades: (AdminAtividadeItem & { ts: number })[] = [];

  for (const loja of lojasRows.slice(0, 8)) {
    rawAtividades.push({
      id: `loja-criada-${loja.id}`,
      tipo: "nova_loja",
      titulo: `Nova loja cadastrada: ${loja.nome}`,
      descricao: `/${loja.slug} · ${loja.donoNome}`,
      lojaId: loja.id,
      slug: loja.slug,
      dataIso: loja.criada_em.toISOString(),
      dataFormatada: BRT_DATETIME_FMT.format(loja.criada_em),
      ts: loja.criada_em.getTime(),
    });

    if (loja.status === "ativa") {
      rawAtividades.push({
        id: `loja-ativa-${loja.id}`,
        tipo: "loja_aprovada",
        titulo: `Loja ativa: ${loja.nome}`,
        descricao: `Plano ${loja.planoNome} · /${loja.slug}`,
        lojaId: loja.id,
        slug: loja.slug,
        dataIso: loja.criada_em.toISOString(),
        dataFormatada: BRT_DATETIME_FMT.format(loja.criada_em),
        ts: loja.criada_em.getTime() + 1,
      });
    } else if (loja.status === "bloqueada") {
      rawAtividades.push({
        id: `loja-bloqueio-${loja.id}`,
        tipo: "bloqueio",
        titulo: `Loja bloqueada: ${loja.nome}`,
        descricao: `/${loja.slug} suspensa na plataforma`,
        lojaId: loja.id,
        slug: loja.slug,
        dataIso: loja.criada_em.toISOString(),
        dataFormatada: BRT_DATETIME_FMT.format(loja.criada_em),
        ts: loja.criada_em.getTime() + 2,
      });
    }
  }

  for (const imp of auditoriaRows) {
    rawAtividades.push({
      id: `imp-${imp.id}`,
      tipo: "impersonacao",
      titulo: `${imp.adminNome} acessou como suporte`,
      descricao: `${imp.lojaNome} (/${imp.lojaSlug})`,
      lojaId: imp.lojaId,
      slug: imp.lojaSlug,
      dataIso: imp.criado_em.toISOString(),
      dataFormatada: BRT_DATETIME_FMT.format(imp.criado_em),
      ts: imp.criado_em.getTime(),
    });
  }

  const atividadesRecentes = rawAtividades
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 10)
    .map(({ ts: _ts, ...item }) => item);

  return {
    periodoDias: params.dias,
    includeDemo: params.includeDemo,
    isProduction: params.isProduction,
    kpis,
    serieDiaria,
    topLojas,
    funil,
    aprovacoesPendentes,
    atividadesRecentes,
  };
}

export interface LojaPedidoResumoAdmin {
  id: string;
  codigo: string;
  clienteNome: string;
  totalCentavos: number;
  status: string;
  demo: boolean;
  criadoEmFormatada: string;
}

export interface LojaImpersonacaoResumoAdmin {
  id: string;
  adminNome: string;
  adminEmail: string;
  criadoEmFormatada: string;
}

export interface LojaAdminDetalhadaRow {
  id: string;
  nome: string;
  slug: string;
  categoria: string;
  bairro: string;
  cpfCnpj: string;
  whatsapp: string;
  status: "ativa" | "pendente" | "bloqueada";
  aberta: boolean;
  abacateSubcontaId: string | null;
  subcontaErro: string | null;
  criadaEmIso: string;
  criadaEmFormatada: string;
  donoNome: string;
  donoEmail: string;
  logoUrl: string | null;
  corPrimaria: string;
  planoId: string;
  planoNome: string;
  assinaturaStatus: Assinatura["status"] | null;
  trialAteIso: string | null;
  trialAteFormatado: string | null;
  diasRestantesTrial: number | null;
  totalProdutos: number;
  pedidos30d: number;
  faturamento30dCentavos: number;
  ultimosPedidos: LojaPedidoResumoAdmin[];
  historicoImpersonacoes: LojaImpersonacaoResumoAdmin[];
}

export interface PlanoResumoAdmin {
  id: string;
  nome: string;
  mensalidade_centavos: number;
  ativo: boolean;
}

export async function getAdminLojasData(params: {
  includeDemo: boolean;
}): Promise<{ lojas: LojaAdminDetalhadaRow[]; planos: PlanoResumoAdmin[] }> {
  const agora = new Date();
  const trintaDiasAtras = new Date(agora.getTime() - 30 * 86_400_000);

  const pedidoFilters = [
    inArray(pedidos.status, PAID_ORDER_STATUSES),
    gte(pedidos.criado_em, trintaDiasAtras),
    isNull(lojas.deletada_em),
  ];
  if (!params.includeDemo) {
    pedidoFilters.push(eq(pedidos.demo, false));
  }

  const recentOrderFilters = [isNull(lojas.deletada_em)];
  if (!params.includeDemo) {
    recentOrderFilters.push(eq(pedidos.demo, false));
  }

  const [
    lojasRows,
    planosRows,
    produtosCountRows,
    pedidos30dRows,
    ultimosPedidosRows,
    impersonacoesRows,
  ] = await Promise.all([
    db
      .select({
        id: lojas.id,
        nome: lojas.nome,
        slug: lojas.slug,
        categoria: lojas.categoria,
        bairro: lojas.bairro,
        cpf_cnpj: lojas.cpf_cnpj,
        whatsapp: lojas.whatsapp,
        status: lojas.status,
        aberta: lojas.aberta,
        abacate_subconta_id: lojas.abacate_subconta_id,
        subconta_erro: lojas.subconta_erro,
        abacate_subconta_erro: lojas.abacate_subconta_erro,
        criada_em: lojas.criada_em,
        donoNome: usuarios.nome,
        donoEmail: usuarios.email,
        planoId: planos.id,
        planoNome: planos.nome,
        assinaturaStatus: assinaturas.status,
        trialAte: assinaturas.trial_ate,
        logoUrl: lojas_tema.logo_url,
        corPrimaria: lojas_tema.cor_primaria,
      })
      .from(lojas)
      .innerJoin(usuarios, eq(lojas.dono_id, usuarios.id))
      .innerJoin(planos, eq(lojas.plano_id, planos.id))
      .leftJoin(assinaturas, eq(assinaturas.loja_id, lojas.id))
      .leftJoin(lojas_tema, eq(lojas_tema.loja_id, lojas.id))
      .where(isNull(lojas.deletada_em))
      .orderBy(desc(lojas.criada_em)),
    db
      .select({
        id: planos.id,
        nome: planos.nome,
        mensalidade_centavos: planos.mensalidade_centavos,
        ativo: planos.ativo,
      })
      .from(planos)
      .orderBy(planos.mensalidade_centavos),
    db
      .select({
        lojaId: produtos.loja_id,
        total: count(),
      })
      .from(produtos)
      .innerJoin(lojas, eq(produtos.loja_id, lojas.id))
      .where(isNull(lojas.deletada_em))
      .groupBy(produtos.loja_id),
    db
      .select({
        loja_id: pedidos.loja_id,
        total_centavos: pedidos.total_centavos,
      })
      .from(pedidos)
      .innerJoin(lojas, eq(pedidos.loja_id, lojas.id))
      .where(and(...pedidoFilters)),
    db
      .select({
        id: pedidos.id,
        loja_id: pedidos.loja_id,
        codigo: pedidos.codigo,
        cliente_nome: pedidos.cliente_nome,
        total_centavos: pedidos.total_centavos,
        status: pedidos.status,
        demo: pedidos.demo,
        criado_em: pedidos.criado_em,
      })
      .from(pedidos)
      .innerJoin(lojas, eq(pedidos.loja_id, lojas.id))
      .where(and(...recentOrderFilters))
      .orderBy(desc(pedidos.criado_em))
      .limit(200),
    db
      .select({
        id: impersonacoes_auditoria.id,
        loja_id: impersonacoes_auditoria.loja_id,
        criado_em: impersonacoes_auditoria.criado_em,
        adminNome: usuarios.nome,
        adminEmail: usuarios.email,
      })
      .from(impersonacoes_auditoria)
      .innerJoin(usuarios, eq(impersonacoes_auditoria.admin_id, usuarios.id))
      .orderBy(desc(impersonacoes_auditoria.criado_em))
      .limit(100),
  ]);

  const produtosMap = new Map(
    produtosCountRows.map((p) => [p.lojaId, Number(p.total)]),
  );

  const stats30dMap = new Map<
    string,
    { pedidos30d: number; faturamento30dCentavos: number }
  >();
  for (const row of pedidos30dRows) {
    const cur = stats30dMap.get(row.loja_id) ?? {
      pedidos30d: 0,
      faturamento30dCentavos: 0,
    };
    cur.pedidos30d += 1;
    cur.faturamento30dCentavos += row.total_centavos;
    stats30dMap.set(row.loja_id, cur);
  }

  const recentOrdersMap = new Map<string, LojaPedidoResumoAdmin[]>();
  for (const ord of ultimosPedidosRows) {
    const list = recentOrdersMap.get(ord.loja_id) ?? [];
    if (list.length < 5) {
      list.push({
        id: ord.id,
        codigo: ord.codigo,
        clienteNome: ord.cliente_nome,
        totalCentavos: ord.total_centavos,
        status: ord.status,
        demo: ord.demo,
        criadoEmFormatada: BRT_DATETIME_FMT.format(ord.criado_em),
      });
      recentOrdersMap.set(ord.loja_id, list);
    }
  }

  const impMap = new Map<string, LojaImpersonacaoResumoAdmin[]>();
  for (const imp of impersonacoesRows) {
    const list = impMap.get(imp.loja_id) ?? [];
    if (list.length < 5) {
      list.push({
        id: imp.id,
        adminNome: imp.adminNome,
        adminEmail: imp.adminEmail,
        criadoEmFormatada: BRT_DATETIME_FMT.format(imp.criado_em),
      });
      impMap.set(imp.loja_id, list);
    }
  }

  const lojasSerializadas: LojaAdminDetalhadaRow[] = lojasRows.map((row) => {
    const stats = stats30dMap.get(row.id) ?? {
      pedidos30d: 0,
      faturamento30dCentavos: 0,
    };
    const diasRestantesTrial =
      row.assinaturaStatus === "trial"
        ? calcularDiasRestantesTrial(row.trialAte, agora)
        : null;

    return {
      id: row.id,
      nome: row.nome,
      slug: row.slug,
      categoria: row.categoria,
      bairro: row.bairro,
      cpfCnpj: row.cpf_cnpj,
      whatsapp: row.whatsapp,
      status: row.status,
      aberta: row.aberta,
      abacateSubcontaId: row.abacate_subconta_id ?? null,
      subcontaErro: row.subconta_erro ?? row.abacate_subconta_erro ?? null,
      criadaEmIso: row.criada_em.toISOString(),
      criadaEmFormatada: BRT_DATE_SHORT_FMT.format(row.criada_em),
      donoNome: row.donoNome,
      donoEmail: row.donoEmail,
      logoUrl: row.logoUrl ?? null,
      corPrimaria: row.corPrimaria ?? "#EA1D2C",
      planoId: row.planoId,
      planoNome: row.planoNome,
      assinaturaStatus: row.assinaturaStatus ?? null,
      trialAteIso: row.trialAte ? row.trialAte.toISOString() : null,
      trialAteFormatado: row.trialAte
        ? BRT_DATE_SHORT_FMT.format(row.trialAte)
        : null,
      diasRestantesTrial,
      totalProdutos: produtosMap.get(row.id) ?? 0,
      pedidos30d: stats.pedidos30d,
      faturamento30dCentavos: stats.faturamento30dCentavos,
      ultimosPedidos: recentOrdersMap.get(row.id) ?? [],
      historicoImpersonacoes: impMap.get(row.id) ?? [],
    };
  });

  return { lojas: lojasSerializadas, planos: planosRows };
}

export interface CommandPaletteStoreItem {
  id: string;
  nome: string;
  slug: string;
  status: "ativa" | "pendente" | "bloqueada";
  corPrimaria: string;
  logoUrl: string | null;
}

export async function getAdminCommandPaletteStores(): Promise<
  CommandPaletteStoreItem[]
> {
  const rows = await db
    .select({
      id: lojas.id,
      nome: lojas.nome,
      slug: lojas.slug,
      status: lojas.status,
      corPrimaria: lojas_tema.cor_primaria,
      logoUrl: lojas_tema.logo_url,
    })
    .from(lojas)
    .leftJoin(lojas_tema, eq(lojas_tema.loja_id, lojas.id))
    .where(isNull(lojas.deletada_em))
    .orderBy(desc(lojas.criada_em));

  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    slug: r.slug,
    status: r.status,
    corPrimaria: r.corPrimaria ?? "#EA1D2C",
    logoUrl: r.logoUrl ?? null,
  }));
}

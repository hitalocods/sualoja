"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  Loader2,
  Lock,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { aprovarLojaAdminAction } from "@/app/admin/actions";
import type { AdminDashboardData } from "@/lib/admin/metrics";
import { formatarCentavos } from "@/lib/money";

function formatReaisCompact(value: number): string {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return `R$ ${Math.round(value)}`;
}

function formatReaisFull(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

interface KpiCardProps {
  title: string;
  formattedValue: string;
  previousLabel: string;
  variacaoPct: number;
  sparkline: number[];
  strokeColor: string;
  gradId: string;
  mounted: boolean;
  reducedMotion: boolean;
  isCurrency?: boolean;
}

function KpiSparkCard({
  title,
  formattedValue,
  previousLabel,
  variacaoPct,
  sparkline,
  strokeColor,
  gradId,
  mounted,
  reducedMotion,
}: KpiCardProps) {
  const positivo = variacaoPct >= 0;
  const sparkData = sparkline.map((v, idx) => ({ idx, v }));

  return (
    <div className="admin-surface flex min-w-0 flex-col justify-between overflow-hidden rounded-[20px] p-4 transition sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--admin-text-muted)" }}
        >
          {title}
        </span>
        <span
          className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
          style={{
            backgroundColor: positivo
              ? "var(--admin-positive-soft)"
              : "var(--admin-negative-soft)",
            color: positivo ? "var(--admin-positive)" : "var(--admin-negative)",
          }}
        >
          {positivo ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {variacaoPct > 0 ? `+${variacaoPct}%` : `${variacaoPct}%`}
        </span>
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-2xl font-extrabold tracking-tight tabular-nums sm:text-[26px]">
            {formattedValue}
          </p>
          <p
            className="mt-1 truncate text-[11px]"
            style={{ color: "var(--admin-text-subtle)" }}
          >
            {previousLabel}
          </p>
        </div>

        <div className="h-12 w-24 shrink-0 sm:w-28">
          {mounted && sparkData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sparkData}
                margin={{ top: 4, right: 2, left: 2, bottom: 2 }}
              >
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={strokeColor}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor={strokeColor}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={strokeColor}
                  strokeWidth={2}
                  fill={`url(#${gradId})`}
                  dot={false}
                  isAnimationActive={!reducedMotion}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="admin-skeleton h-full w-full rounded-xl" />
          )}
        </div>
      </div>
    </div>
  );
}

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
  payload?: {
    label?: string;
    pedidos?: number;
    novasLojas?: number;
  };
}

function RevenueTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const first = payload[0]?.payload;
  return (
    <div
      className="rounded-2xl border px-3.5 py-2.5 text-xs shadow-xl"
      style={{
        backgroundColor: "var(--admin-surface)",
        borderColor: "var(--admin-border-strong)",
        color: "var(--admin-text)",
      }}
    >
      <p className="mb-1.5 font-bold">{first?.label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div
            key={String(entry.dataKey)}
            className="flex items-center justify-between gap-4"
          >
            <span
              className="flex items-center gap-1.5"
              style={{ color: "var(--admin-text-muted)" }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-bold tabular-nums">
              {formatReaisFull(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
        {typeof first?.pedidos === "number" && (
          <p
            className="mt-1 border-t pt-1 text-[11px]"
            style={{
              borderColor: "var(--admin-border)",
              color: "var(--admin-text-subtle)",
            }}
          >
            {first.pedidos} pedido(s) pago(s)
          </p>
        )}
      </div>
    </div>
  );
}

function StoresTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const first = payload[0]?.payload;
  return (
    <div
      className="rounded-2xl border px-3.5 py-2 text-xs shadow-xl"
      style={{
        backgroundColor: "var(--admin-surface)",
        borderColor: "var(--admin-border-strong)",
        color: "var(--admin-text)",
      }}
    >
      <p className="font-bold">{first?.label}</p>
      <p style={{ color: "var(--admin-text-muted)" }}>
        Novas lojas:{" "}
        <strong style={{ color: "var(--admin-text)" }}>
          {payload[0]?.value ?? 0}
        </strong>
      </p>
    </div>
  );
}

const EMPTY_SUBSCRIBE = () => () => {};

function subscribeReducedMotion(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AdminDashboardClient({ data }: { data: AdminDashboardData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => true,
    () => false,
  );
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const [failedLogos, setFailedLogos] = useState<Record<string, boolean>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleQuickApprove(lojaId: string, nome: string) {
    setApprovingId(lojaId);
    setFeedback(null);
    startTransition(async () => {
      const res = await aprovarLojaAdminAction({ lojaId });
      setApprovingId(null);
      if (res.ok) {
        setFeedback(`Loja "${nome}" aprovada e ativada.`);
        router.refresh();
      }
    });
  }

  function ativarDemo() {
    const next = new URLSearchParams(searchParams.toString());
    next.set("demo", "1");
    router.push(`/admin?${next.toString()}`);
  }

  const temVendasPeriodo = data.kpis.pedidos.total > 0;
  const totalNovasLojasPeriodo = data.serieDiaria.reduce(
    (acc, item) => acc + item.novasLojas,
    0,
  );
  const totalFunilBase = Math.max(1, data.funil.cadastradas);

  const funilEtapas = [
    {
      label: "Cadastradas",
      count: data.funil.cadastradas,
      color: "var(--admin-info)",
    },
    {
      label: "Em trial",
      count: data.funil.trial,
      color: "var(--admin-chart-gmv)",
    },
    {
      label: "Ativas",
      count: data.funil.ativas,
      color: "var(--admin-positive)",
    },
    {
      label: "Bloqueadas",
      count: data.funil.bloqueadas,
      color: "var(--admin-negative)",
    },
  ];

  const tickInterval =
    data.periodoDias === 90 ? 14 : data.periodoDias === 30 ? 4 : 0;

  return (
    <div className="min-w-0 max-w-full space-y-5">
      {/* Header do Dashboard */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              Dashboard da plataforma
            </h1>
            {!data.isProduction && data.includeDemo && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={{
                  backgroundColor: "var(--admin-info-soft)",
                  color: "var(--admin-info)",
                }}
              >
                <Database className="h-3 w-3" />
                Inclui dados demo
              </span>
            )}
          </div>
          <p
            className="mt-1 text-xs sm:text-sm"
            style={{ color: "var(--admin-text-muted)" }}
          >
            Comparativo dos últimos {data.periodoDias} dias vs.{" "}
            {data.periodoDias} dias anteriores.
          </p>
        </div>

        <Link
          href={`/admin/lojas${!data.isProduction && !data.includeDemo ? "?demo=0" : ""}`}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-2xl px-4 text-xs font-bold text-white transition hover:opacity-90 sm:text-sm"
          style={{ backgroundColor: "var(--admin-accent-strong)" }}
        >
          <Store className="h-4 w-4" />
          Gerenciar lojas
        </Link>
      </div>

      {feedback && (
        <div
          className="rounded-2xl border px-4 py-3 text-sm font-semibold"
          style={{
            backgroundColor: "var(--admin-positive-soft)",
            borderColor: "var(--admin-positive)",
            color: "var(--admin-positive)",
          }}
        >
          {feedback}
        </div>
      )}

      {/* 4 KPI Cards com Sparkline e Variação % */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiSparkCard
          title="Faturamento (GMV)"
          formattedValue={formatarCentavos(data.kpis.gmv.valorCentavos)}
          previousLabel={`Anterior: ${formatarCentavos(data.kpis.gmv.anteriorCentavos)}`}
          variacaoPct={data.kpis.gmv.variacaoPct}
          sparkline={data.kpis.gmv.sparkline}
          strokeColor="var(--admin-chart-gmv)"
          gradId="spark-gmv"
          mounted={mounted}
          reducedMotion={reducedMotion}
        />
        <KpiSparkCard
          title="Comissão da plataforma"
          formattedValue={formatarCentavos(data.kpis.comissao.valorCentavos)}
          previousLabel={`Anterior: ${formatarCentavos(data.kpis.comissao.anteriorCentavos)}`}
          variacaoPct={data.kpis.comissao.variacaoPct}
          sparkline={data.kpis.comissao.sparkline}
          strokeColor="var(--admin-chart-commission)"
          gradId="spark-comissao"
          mounted={mounted}
          reducedMotion={reducedMotion}
        />
        <KpiSparkCard
          title="Pedidos pagos"
          formattedValue={String(data.kpis.pedidos.total)}
          previousLabel={`Anterior: ${data.kpis.pedidos.anteriorTotal}`}
          variacaoPct={data.kpis.pedidos.variacaoPct}
          sparkline={data.kpis.pedidos.sparkline}
          strokeColor="var(--admin-chart-stores)"
          gradId="spark-pedidos"
          mounted={mounted}
          reducedMotion={reducedMotion}
        />
        <KpiSparkCard
          title="Ticket médio"
          formattedValue={formatarCentavos(data.kpis.ticketMedio.valorCentavos)}
          previousLabel={`Anterior: ${formatarCentavos(data.kpis.ticketMedio.anteriorCentavos)}`}
          variacaoPct={data.kpis.ticketMedio.variacaoPct}
          sparkline={data.kpis.ticketMedio.sparkline}
          strokeColor="var(--admin-warning)"
          gradId="spark-ticket"
          mounted={mounted}
          reducedMotion={reducedMotion}
        />
      </section>

      {/* Linha de Gráficos */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Gráfico Grande: Faturamento e Comissão por dia */}
        <div className="admin-surface min-w-0 overflow-hidden rounded-[20px] p-4 sm:p-5 xl:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">
                Faturamento e comissão por dia
              </h2>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--admin-text-muted)" }}
              >
                Evolução diária nos últimos {data.periodoDias} dias
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "var(--admin-chart-gmv)" }}
                />
                Faturamento
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: "var(--admin-chart-commission)" }}
                />
                Comissão
              </span>
            </div>
          </div>

          {!temVendasPeriodo ? (
            <div
              className="flex h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed px-4 text-center"
              style={{ borderColor: "var(--admin-border-strong)" }}
            >
              <ShoppingBag
                className="h-8 w-8 opacity-60"
                style={{ color: "var(--admin-text-muted)" }}
              />
              <p className="mt-3 text-sm font-bold">
                Sem pedidos pagos neste período
              </p>
              <p
                className="mt-1 max-w-sm text-xs"
                style={{ color: "var(--admin-text-muted)" }}
              >
                {data.isProduction
                  ? "Os pedidos pagos aparecerão automaticamente no gráfico assim que forem concluídos."
                  : "Ative os dados de demonstração para visualizar a curva completa de vendas e comissões."}
              </p>
              {!data.isProduction && !data.includeDemo && (
                <button
                  type="button"
                  onClick={ativarDemo}
                  className="mt-4 inline-flex min-h-[38px] items-center gap-1.5 rounded-full px-4 text-xs font-bold text-white"
                  style={{ backgroundColor: "var(--admin-accent-strong)" }}
                >
                  <Database className="h-3.5 w-3.5" />
                  Ativar dados demo
                </button>
              )}
            </div>
          ) : (
            <div className="h-[280px] w-full min-w-0">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.serieDiaria}
                    margin={{ top: 20, right: 6, left: -4, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gradGmv" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="var(--admin-chart-gmv)"
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--admin-chart-gmv)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                      <linearGradient
                        id="gradCommission"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--admin-chart-commission)"
                          stopOpacity={0.28}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--admin-chart-commission)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="var(--admin-grid)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      interval={tickInterval}
                      tick={{ fill: "var(--admin-text-subtle)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="gmv"
                      tickFormatter={formatReaisCompact}
                      tick={{ fill: "var(--admin-text-subtle)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <YAxis
                      yAxisId="comissao"
                      orientation="right"
                      tickFormatter={formatReaisCompact}
                      tick={{
                        fill: "var(--admin-chart-commission)",
                        fontSize: 11,
                      }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                    />
                    <Tooltip content={<RevenueTooltip />} />
                    <Area
                      yAxisId="gmv"
                      type="monotone"
                      dataKey="faturamentoReais"
                      name="Faturamento"
                      stroke="var(--admin-chart-gmv)"
                      strokeWidth={2.4}
                      fill="url(#gradGmv)"
                      isAnimationActive={!reducedMotion}
                    />
                    <Area
                      yAxisId="comissao"
                      type="monotone"
                      dataKey="comissaoReais"
                      name="Comissão"
                      stroke="var(--admin-chart-commission)"
                      strokeWidth={2}
                      fill="url(#gradCommission)"
                      isAnimationActive={!reducedMotion}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="admin-skeleton h-full w-full rounded-2xl" />
              )}
            </div>
          )}
        </div>

        {/* Gráfico Menor: Novas lojas por dia */}
        <div className="admin-surface min-w-0 overflow-hidden rounded-[20px] p-4 sm:p-5 xl:col-span-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Novas lojas por dia</h2>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--admin-text-muted)" }}
              >
                {totalNovasLojasPeriodo} cadastro(s) nos últimos{" "}
                {data.periodoDias} dias
              </p>
            </div>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                backgroundColor: "var(--admin-positive-soft)",
                color: "var(--admin-positive)",
              }}
            >
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>

          <div className="h-[280px] w-full min-w-0">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.serieDiaria}
                  margin={{ top: 20, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="var(--admin-grid)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    interval={tickInterval}
                    tick={{ fill: "var(--admin-text-subtle)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    domain={[
                      0,
                      (dataMax: number) => Math.max(2, Math.ceil(dataMax)),
                    ]}
                    tick={{ fill: "var(--admin-text-subtle)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--admin-grid)" }}
                    content={<StoresTooltip />}
                  />
                  <Bar
                    dataKey="novasLojas"
                    name="Novas lojas"
                    fill="var(--admin-chart-stores)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={24}
                    isAnimationActive={!reducedMotion}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="admin-skeleton h-full w-full rounded-2xl" />
            )}
          </div>
        </div>
      </section>

      {/* Linha Inferior: Top Lojas + Funil + Aprovações Pendentes + Atividade Recente */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Ranking Top Lojas */}
        <div className="admin-surface min-w-0 overflow-hidden rounded-[20px] p-4 sm:p-5 lg:col-span-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Top lojas por faturamento</h2>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--admin-text-muted)" }}
              >
                Desempenho no período selecionado ({data.periodoDias}d)
              </p>
            </div>
            <Link
              href="/admin/lojas"
              className="text-xs font-semibold hover:underline"
              style={{ color: "var(--admin-accent)" }}
            >
              Ver todas
            </Link>
          </div>

          {data.topLojas.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-10 text-center"
              style={{ borderColor: "var(--admin-border-strong)" }}
            >
              <Sparkles
                className="h-6 w-6 opacity-60"
                style={{ color: "var(--admin-text-muted)" }}
              />
              <p
                className="mt-2 text-xs font-semibold"
                style={{ color: "var(--admin-text-muted)" }}
              >
                Sem faturamento registrado neste período.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {data.topLojas.map((loja, index) => (
                <Link
                  key={loja.id}
                  href={`/admin/lojas?loja=${loja.id}`}
                  className="block rounded-2xl p-2.5 transition hover:opacity-95"
                  style={{ backgroundColor: "var(--admin-surface-2)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold"
                        style={{
                          backgroundColor: "var(--admin-surface)",
                          color: "var(--admin-text-muted)",
                        }}
                      >
                        #{index + 1}
                      </span>
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-extrabold text-white"
                        style={{ backgroundColor: loja.corPrimaria }}
                      >
                        {loja.logoUrl && !failedLogos[loja.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={loja.logoUrl}
                            alt={loja.nome}
                            onError={() =>
                              setFailedLogos((prev) => ({
                                ...prev,
                                [loja.id]: true,
                              }))
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          (loja.nome.trim().charAt(0) || "L").toUpperCase()
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{loja.nome}</p>
                        <p
                          className="truncate font-mono text-[11px]"
                          style={{ color: "var(--admin-text-subtle)" }}
                        >
                          /{loja.slug} · {loja.pedidos} pedido(s)
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-extrabold tabular-nums">
                        {formatarCentavos(loja.faturamentoCentavos)}
                      </p>
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--admin-text-subtle)" }}
                      >
                        {loja.planoNome}
                      </span>
                    </div>
                  </div>

                  <div
                    className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: "var(--admin-surface)" }}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${loja.percentualDoLider}%`,
                        backgroundColor: "var(--admin-chart-gmv)",
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Funil de Lojas */}
        <div className="admin-surface min-w-0 overflow-hidden rounded-[20px] p-4 sm:p-5 lg:col-span-6">
          <div className="mb-4">
            <h2 className="text-base font-bold">Funil de lojas</h2>
            <p
              className="mt-0.5 text-xs"
              style={{ color: "var(--admin-text-muted)" }}
            >
              Distribuição da base atual cadastrada → trial → ativas → bloqueadas
            </p>
          </div>

          <div className="space-y-4">
            {funilEtapas.map((etapa) => {
              const pct = Math.round((etapa.count / totalFunilBase) * 100);
              return (
                <div key={etapa.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{etapa.label}</span>
                    <span className="tabular-nums">
                      <strong>{etapa.count}</strong>{" "}
                      <span style={{ color: "var(--admin-text-subtle)" }}>
                        ({pct}%)
                      </span>
                    </span>
                  </div>
                  <div
                    className="h-2.5 w-full overflow-hidden rounded-full"
                    style={{ backgroundColor: "var(--admin-surface-2)" }}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.max(etapa.count > 0 ? 6 : 0, pct)}%`,
                        backgroundColor: etapa.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="mt-5 grid grid-cols-2 gap-2.5 rounded-2xl border p-3.5 text-xs"
            style={{
              backgroundColor: "var(--admin-surface-2)",
              borderColor: "var(--admin-border)",
            }}
          >
            <div>
              <span style={{ color: "var(--admin-text-subtle)" }}>
                Aguardando aprovação
              </span>
              <p className="mt-0.5 text-lg font-extrabold tabular-nums">
                {data.funil.pendentes}
              </p>
            </div>
            <div>
              <span style={{ color: "var(--admin-text-subtle)" }}>
                Taxa de ativação
              </span>
              <p className="mt-0.5 text-lg font-extrabold tabular-nums">
                {Math.round((data.funil.ativas / totalFunilBase) * 100)}%
              </p>
            </div>
          </div>
        </div>

        {/* Aprovações Pendentes */}
        <div className="admin-surface min-w-0 overflow-hidden rounded-[20px] p-4 sm:p-5 lg:col-span-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Aprovações pendentes</h2>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--admin-text-muted)" }}
              >
                Lojas aguardando liberação do administrador
              </p>
            </div>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums"
              style={{
                backgroundColor:
                  data.aprovacoesPendentes.length > 0
                    ? "var(--admin-warning-soft)"
                    : "var(--admin-positive-soft)",
                color:
                  data.aprovacoesPendentes.length > 0
                    ? "var(--admin-warning)"
                    : "var(--admin-positive)",
              }}
            >
              {data.aprovacoesPendentes.length}
            </span>
          </div>

          {data.aprovacoesPendentes.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-10 text-center"
              style={{ borderColor: "var(--admin-border-strong)" }}
            >
              <CheckCircle2
                className="h-7 w-7"
                style={{ color: "var(--admin-positive)" }}
              />
              <p className="mt-2 text-sm font-bold">Tudo em dia!</p>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--admin-text-muted)" }}
              >
                Nenhuma loja aguardando aprovação no momento.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.aprovacoesPendentes.map((loja) => (
                <div
                  key={loja.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-extrabold text-white"
                      style={{ backgroundColor: loja.corPrimaria }}
                    >
                      {loja.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={loja.logoUrl}
                          alt={loja.nome}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        loja.nome.slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{loja.nome}</p>
                      <p
                        className="truncate text-xs"
                        style={{ color: "var(--admin-text-muted)" }}
                      >
                        {loja.donoNome} · /{loja.slug} · {loja.criadaEmFormatada}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/admin/lojas?loja=${loja.id}`}
                      className="inline-flex min-h-[36px] items-center rounded-full border px-3 text-xs font-semibold transition hover:opacity-85"
                      style={{
                        backgroundColor: "var(--admin-surface)",
                        borderColor: "var(--admin-border-strong)",
                      }}
                    >
                      Ver
                    </Link>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleQuickApprove(loja.id, loja.nome)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                      style={{ backgroundColor: "var(--admin-positive)" }}
                    >
                      {approvingId === loja.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Aprovar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feed Atividade Recente */}
        <div className="admin-surface min-w-0 overflow-hidden rounded-[20px] p-4 sm:p-5 lg:col-span-6">
          <div className="mb-4">
            <h2 className="text-base font-bold">Atividade recente</h2>
            <p
              className="mt-0.5 text-xs"
              style={{ color: "var(--admin-text-muted)" }}
            >
              Cadastros, aprovações, bloqueios e acessos de suporte
            </p>
          </div>

          {data.atividadesRecentes.length === 0 ? (
            <p
              className="py-8 text-center text-xs"
              style={{ color: "var(--admin-text-muted)" }}
            >
              Sem eventos recentes registrados.
            </p>
          ) : (
            <div className="space-y-2.5">
              {data.atividadesRecentes.map((ev) => {
                const styleMap = {
                  nova_loja: {
                    bg: "var(--admin-info-soft)",
                    fg: "var(--admin-info)",
                    icon: Clock,
                  },
                  loja_aprovada: {
                    bg: "var(--admin-positive-soft)",
                    fg: "var(--admin-positive)",
                    icon: CheckCircle2,
                  },
                  bloqueio: {
                    bg: "var(--admin-negative-soft)",
                    fg: "var(--admin-negative)",
                    icon: Lock,
                  },
                  impersonacao: {
                    bg: "var(--admin-warning-soft)",
                    fg: "var(--admin-warning)",
                    icon: Eye,
                  },
                }[ev.tipo];
                const Icon = styleMap.icon;

                return (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between gap-3 rounded-2xl p-2.5"
                    style={{ backgroundColor: "var(--admin-surface-2)" }}
                  >
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: styleMap.bg,
                          color: styleMap.fg,
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold sm:text-sm">
                          {ev.titulo}
                        </p>
                        <p
                          className="truncate text-[11px]"
                          style={{ color: "var(--admin-text-muted)" }}
                        >
                          {ev.descricao}
                        </p>
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-[11px] tabular-nums"
                      style={{ color: "var(--admin-text-subtle)" }}
                    >
                      {ev.dataFormatada}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

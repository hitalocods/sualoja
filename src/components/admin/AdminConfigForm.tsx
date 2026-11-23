"use client";

import {
  CalendarClock,
  CheckCircle2,
  Eye,
  Link2,
  Loader2,
  Plus,
  Save,
  Search,
  Settings,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { salvarConfiguracoesPlataformaAction } from "@/app/admin/actions";
import { parseSlugsReservadosText } from "@/lib/validators/admin";

export interface AuditoriaItemAdmin {
  id: string;
  adminNome: string;
  adminEmail: string;
  lojaNome: string;
  lojaSlug: string;
  criadoEmFormatada: string;
}

interface AdminConfigFormProps {
  initialNomePlataforma: string;
  initialEmailSuporte: string;
  initialDiasTrial: number;
  initialPedidoMinimoPlataformaCentavos: number;
  initialTarifaGatewayPixCentavos: number;
  initialMargemMinimaCentavos: number;
  initialSlugsReservados: string[];
  atualizadoEmFormatada: string;
  auditoria: AuditoriaItemAdmin[];
}

type ConfigTab = "geral" | "trial" | "slugs" | "auditoria";

export function AdminConfigForm({
  initialNomePlataforma,
  initialEmailSuporte,
  initialDiasTrial,
  initialPedidoMinimoPlataformaCentavos,
  initialTarifaGatewayPixCentavos,
  initialMargemMinimaCentavos,
  initialSlugsReservados,
  atualizadoEmFormatada,
  auditoria,
}: AdminConfigFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ConfigTab>("geral");
  const [nomePlataforma, setNomePlataforma] = useState(initialNomePlataforma);
  const [emailSuporte, setEmailSuporte] = useState(initialEmailSuporte);
  const [diasTrial, setDiasTrial] = useState(String(initialDiasTrial));
  const [pedidoMinimoCentavos, setPedidoMinimoCentavos] = useState(
    String(initialPedidoMinimoPlataformaCentavos),
  );
  const [tarifaGatewayPixCentavos, setTarifaGatewayPixCentavos] = useState(
    String(initialTarifaGatewayPixCentavos),
  );
  const [margemMinimaCentavos, setMargemMinimaCentavos] = useState(
    String(initialMargemMinimaCentavos),
  );
  const [slugsText, setSlugsText] = useState(
    initialSlugsReservados.join(", "),
  );
  const [novoSlugInput, setNovoSlugInput] = useState("");
  const [buscaAuditoria, setBuscaAuditoria] = useState("");
  const [feedback, setFeedback] = useState<{
    tipo: "erro" | "sucesso";
    mensagem: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const previewSlugs = useMemo(
    () => parseSlugsReservadosText(slugsText),
    [slugsText],
  );

  const auditoriaFiltrada = useMemo(() => {
    const q = buscaAuditoria.trim().toLowerCase();
    if (!q) return auditoria;
    return auditoria.filter(
      (item) =>
        item.adminNome.toLowerCase().includes(q) ||
        item.adminEmail.toLowerCase().includes(q) ||
        item.lojaNome.toLowerCase().includes(q) ||
        item.lojaSlug.toLowerCase().includes(q),
    );
  }, [auditoria, buscaAuditoria]);

  const [agoraMs] = useState(() => Date.now());
  const previewTrialEndDate = useMemo(() => {
    const dias = Math.max(1, Math.min(365, Number(diasTrial) || 14));
    const dt = new Date(agoraMs + dias * 86_400_000);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dt);
  }, [diasTrial, agoraMs]);

  function handleAddSlug() {
    const clean = novoSlugInput.trim().toLowerCase();
    if (!clean) return;
    if (!previewSlugs.includes(clean)) {
      setSlugsText([...previewSlugs, clean].join(", "));
    }
    setNovoSlugInput("");
  }

  function handleRemoveSlug(slugToRemove: string) {
    const next = previewSlugs.filter((s) => s !== slugToRemove);
    setSlugsText(next.join(", "));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const res = await salvarConfiguracoesPlataformaAction({
        nome_plataforma: nomePlataforma,
        email_suporte: emailSuporte,
        dias_trial: Number(diasTrial),
        pedido_minimo_plataforma_centavos: Number(pedidoMinimoCentavos),
        tarifa_gateway_pix_centavos: Number(tarifaGatewayPixCentavos),
        margem_minima_centavos: Number(margemMinimaCentavos),
        slugs_reservados: previewSlugs,
      });

      if (!res.ok) {
        const firstErr = res.fieldErrors
          ? Object.values(res.fieldErrors)[0]
          : undefined;
        setFeedback({ tipo: "erro", mensagem: firstErr ?? res.error });
        return;
      }

      setFeedback({
        tipo: "sucesso",
        mensagem: "Configurações da plataforma atualizadas.",
      });
      router.refresh();
    });
  }

  const tabs: { key: ConfigTab; label: string; icon: typeof Settings }[] = [
    { key: "geral", label: "Geral", icon: Settings },
    { key: "trial", label: "Trial", icon: CalendarClock },
    { key: "slugs", label: "Slugs reservados", icon: Link2 },
    { key: "auditoria", label: "Auditoria de suporte", icon: Eye },
  ];

  return (
    <div className="space-y-4">
      {/* Navegação de Abas */}
      <div className="admin-surface flex flex-wrap items-center justify-between gap-3 rounded-[20px] p-2">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-2xl px-4 text-xs font-bold transition sm:text-sm"
                style={{
                  backgroundColor: active
                    ? "var(--admin-accent-soft)"
                    : "transparent",
                  color: active ? "var(--admin-text)" : "var(--admin-text-muted)",
                  border: active
                    ? "1px solid var(--admin-border-strong)"
                    : "1px solid transparent",
                }}
              >
                <Icon
                  className="h-4 w-4"
                  style={{
                    color: active
                      ? "var(--admin-accent)"
                      : "var(--admin-text-muted)",
                  }}
                />
                {tab.label}
              </button>
            );
          })}
        </div>

        <span
          className="px-2 text-[11px]"
          style={{ color: "var(--admin-text-subtle)" }}
        >
          Atualizado: {atualizadoEmFormatada}
        </span>
      </div>

      {feedback && (
        <div
          className="flex items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold"
          style={{
            backgroundColor:
              feedback.tipo === "erro"
                ? "var(--admin-negative-soft)"
                : "var(--admin-positive-soft)",
            borderColor:
              feedback.tipo === "erro"
                ? "var(--admin-negative)"
                : "var(--admin-positive)",
            color:
              feedback.tipo === "erro"
                ? "var(--admin-negative)"
                : "var(--admin-positive)",
          }}
        >
          <span className="flex items-center gap-2">
            {feedback.tipo === "sucesso" && (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            )}
            {feedback.mensagem}
          </span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="rounded-full p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {activeTab !== "auditoria" ? (
        <form
          onSubmit={handleSubmit}
          className="admin-surface rounded-[20px] p-5 sm:p-6"
        >
          {activeTab === "geral" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold">Identidade da plataforma</h2>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  Nome exibido no painel administrativo e canal oficial de
                  suporte aos lojistas.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="nome_plataforma"
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    Nome da plataforma
                  </label>
                  <input
                    id="nome_plataforma"
                    type="text"
                    required
                    value={nomePlataforma}
                    onChange={(e) => setNomePlataforma(e.target.value)}
                    className="min-h-[44px] w-full rounded-2xl border px-4 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--admin-surface-2)",
                      borderColor: "var(--admin-border)",
                      color: "var(--admin-text)",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="email_suporte"
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    E-mail de suporte
                  </label>
                  <input
                    id="email_suporte"
                    type="email"
                    required
                    value={emailSuporte}
                    onChange={(e) => setEmailSuporte(e.target.value)}
                    className="min-h-[44px] w-full rounded-2xl border px-4 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--admin-surface-2)",
                      borderColor: "var(--admin-border)",
                      color: "var(--admin-text)",
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="pedido_minimo_plataforma_centavos"
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    Pedido mínimo da plataforma (centavos)
                  </label>
                  <input
                    id="pedido_minimo_plataforma_centavos"
                    type="number"
                    min={100}
                    max={1000000}
                    required
                    value={pedidoMinimoCentavos}
                    onChange={(e) => setPedidoMinimoCentavos(e.target.value)}
                    className="min-h-[44px] w-full rounded-2xl border px-4 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--admin-surface-2)",
                      borderColor: "var(--admin-border)",
                      color: "var(--admin-text)",
                    }}
                  />
                  <p
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--admin-text-subtle)" }}
                  >
                    Equivalente a{" "}
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(
                      Math.max(0, Number(pedidoMinimoCentavos) || 0) / 100,
                    )}{" "}
                    (padrão: 1000 centavos = R$ 10,00).
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="tarifa_gateway_pix_centavos"
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    Tarifa gateway Pix (centavos)
                  </label>
                  <input
                    id="tarifa_gateway_pix_centavos"
                    type="number"
                    min={0}
                    max={100000}
                    required
                    value={tarifaGatewayPixCentavos}
                    onChange={(e) =>
                      setTarifaGatewayPixCentavos(e.target.value)
                    }
                    className="min-h-[44px] w-full rounded-2xl border px-4 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--admin-surface-2)",
                      borderColor: "var(--admin-border)",
                      color: "var(--admin-text)",
                    }}
                  />
                  <p
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--admin-text-subtle)" }}
                  >
                    Custo fixo por Pix cobrado pelo gateway (padrão: 80 centavos
                    = R$ 0,80).
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="margem_minima_centavos"
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    Margem mínima da plataforma (centavos)
                  </label>
                  <input
                    id="margem_minima_centavos"
                    type="number"
                    min={0}
                    max={100000}
                    required
                    value={margemMinimaCentavos}
                    onChange={(e) => setMargemMinimaCentavos(e.target.value)}
                    className="min-h-[44px] w-full rounded-2xl border px-4 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--admin-surface-2)",
                      borderColor: "var(--admin-border)",
                      color: "var(--admin-text)",
                    }}
                  />
                  <p
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--admin-text-subtle)" }}
                  >
                    Piso aplicado no split:{" "}
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(
                      (Math.max(0, Number(tarifaGatewayPixCentavos) || 0) +
                        Math.max(0, Number(margemMinimaCentavos) || 0)) /
                        100,
                    )}{" "}
                    (tarifa + margem).
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "trial" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold">Período de teste grátis</h2>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  Duração padrão do trial aplicada automaticamente a novas lojas
                  cadastradas em /cadastro.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="dias_trial"
                    className="mb-1.5 block text-xs font-semibold"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    Dias de trial padrão (1 a 365)
                  </label>
                  <input
                    id="dias_trial"
                    type="number"
                    min={1}
                    max={365}
                    required
                    value={diasTrial}
                    onChange={(e) => setDiasTrial(e.target.value)}
                    className="min-h-[44px] w-full rounded-2xl border px-4 text-sm outline-none"
                    style={{
                      backgroundColor: "var(--admin-surface-2)",
                      borderColor: "var(--admin-border)",
                      color: "var(--admin-text)",
                    }}
                  />
                </div>

                <div className="admin-surface-2 flex flex-col justify-center rounded-2xl p-4">
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--admin-text-subtle)" }}
                  >
                    Simulação para cadastro hoje
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    Trial válido até {previewTrialEndDate}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "slugs" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold">Endereços reservados</h2>
                <p
                  className="mt-0.5 text-xs"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  Slugs bloqueados para impedir conflitos com rotas internas do
                  sistema.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={novoSlugInput}
                  onChange={(e) => setNovoSlugInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSlug();
                    }
                  }}
                  placeholder="Adicionar slug reservado (ex.: suporte)"
                  className="min-h-[44px] min-w-0 flex-1 rounded-2xl border px-4 font-mono text-xs outline-none"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text)",
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddSlug}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl border px-4 text-xs font-bold"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border-strong)",
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {previewSlugs.map((slug) => (
                  <span
                    key={slug}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold"
                    style={{
                      backgroundColor: "var(--admin-surface-2)",
                      borderColor: "var(--admin-border)",
                    }}
                  >
                    /{slug}
                    <button
                      type="button"
                      onClick={() => handleRemoveSlug(slug)}
                      aria-label={`Remover slug ${slug}`}
                      className="rounded-full p-0.5 hover:opacity-75"
                      style={{ color: "var(--admin-text-muted)" }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div>
                <label
                  htmlFor="slugs_reservados"
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  Edição rápida em lote (separados por vírgula ou quebra de
                  linha)
                </label>
                <textarea
                  id="slugs_reservados"
                  rows={3}
                  required
                  value={slugsText}
                  onChange={(e) => setSlugsText(e.target.value)}
                  className="w-full rounded-2xl border p-3.5 font-mono text-xs outline-none"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text)",
                  }}
                />
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-6 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "var(--admin-accent-strong)" }}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar configurações
            </button>
          </div>
        </form>
      ) : (
        <section className="admin-surface space-y-4 rounded-[20px] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">
                Auditoria de acessos de suporte (impersonação)
              </h2>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--admin-text-muted)" }}
              >
                Registro permanente de administradores que entraram como lojista
              </p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-bold tabular-nums"
              style={{
                backgroundColor: "var(--admin-surface-2)",
                color: "var(--admin-text-muted)",
              }}
            >
              {auditoriaFiltrada.length} registro(s)
            </span>
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--admin-text-subtle)" }}
            />
            <input
              type="search"
              value={buscaAuditoria}
              onChange={(e) => setBuscaAuditoria(e.target.value)}
              placeholder="Filtrar por administrador, e-mail, loja ou /slug..."
              className="min-h-[42px] w-full rounded-2xl border pr-4 pl-10 text-xs outline-none sm:text-sm"
              style={{
                backgroundColor: "var(--admin-surface-2)",
                borderColor: "var(--admin-border)",
                color: "var(--admin-text)",
              }}
            />
          </div>

          {auditoriaFiltrada.length === 0 ? (
            <p
              className="rounded-2xl border border-dashed py-8 text-center text-xs"
              style={{
                borderColor: "var(--admin-border-strong)",
                color: "var(--admin-text-muted)",
              }}
            >
              Nenhum acesso de suporte registrado com esse filtro.
            </p>
          ) : (
            <div className="space-y-2">
              {auditoriaFiltrada.map((item) => (
                <div
                  key={item.id}
                  className="admin-surface-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-xs"
                >
                  <p className="min-w-0 break-words">
                    <strong>{item.adminNome}</strong>{" "}
                    <span style={{ color: "var(--admin-text-subtle)" }}>
                      ({item.adminEmail})
                    </span>{" "}
                    entrou como <strong>{item.lojaNome}</strong>{" "}
                    <span
                      className="font-mono"
                      style={{ color: "var(--admin-text-muted)" }}
                    >
                      (/{item.lojaSlug})
                    </span>
                  </p>
                  <span
                    className="tabular-nums"
                    style={{ color: "var(--admin-text-subtle)" }}
                  >
                    {item.criadoEmFormatada}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

"use client";

import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileEdit,
  Layers,
  Loader2,
  Lock,
  MoreHorizontal,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Unlock,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  alterarStatusLojaAdminAction,
  aprovarLojaAdminAction,
  arquivarLojaAdminAction,
  corrigirDocumentoLojaAdminAction,
  impersonarLojaAdminAction,
  tentarCriarSubcontaAdminAction,
  trocarPlanoLojaAdminAction,
} from "@/app/admin/actions";
import type {
  LojaAdminDetalhadaRow,
  PlanoResumoAdmin,
} from "@/lib/admin/metrics";
import { formatarCentavos } from "@/lib/money";

type ConfirmModalState =
  | {
    kind: "status";
    loja: LojaAdminDetalhadaRow;
    novoStatus: "ativa" | "bloqueada";
  }
  | { kind: "arquivar"; loja: LojaAdminDetalhadaRow }
  | { kind: "plano"; loja: LojaAdminDetalhadaRow; planoId: string }
  | {
    kind: "documento";
    loja: LojaAdminDetalhadaRow;
    cpfCnpj: string;
    erro?: string | null;
  }
  | null;

interface OpenMenuState {
  lojaId: string;
  top: number;
  right: number;
}

function getStatusColors(status: "ativa" | "pendente" | "bloqueada") {
  switch (status) {
    case "ativa":
      return {
        label: "Ativa",
        bg: "var(--admin-positive-soft)",
        fg: "var(--admin-positive)",
      };
    case "pendente":
      return {
        label: "Pendente",
        bg: "var(--admin-warning-soft)",
        fg: "var(--admin-warning)",
      };
    case "bloqueada":
      return {
        label: "Bloqueada",
        bg: "var(--admin-negative-soft)",
        fg: "var(--admin-negative)",
      };
  }
}

function formatTrialText(diasRestantes: number | null): string | null {
  if (diasRestantes === null) return null;
  if (diasRestantes === 0) return "Trial expira hoje";
  if (diasRestantes === 1) return "1 dia restante";
  return `${diasRestantes} dias restantes`;
}

function StoreAvatar({
  nome,
  logoUrl,
  corPrimaria,
  size = "md",
}: {
  nome: string;
  logoUrl: string | null;
  corPrimaria: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "lg"
      ? "h-12 w-12 rounded-2xl text-sm"
      : size === "sm"
        ? "h-9 w-9 rounded-xl text-xs"
        : "h-10 w-10 rounded-2xl text-xs";

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden font-extrabold text-white ${dim}`}
      style={{ backgroundColor: corPrimaria }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={nome} className="h-full w-full object-cover" />
      ) : (
        nome.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

export function AdminLojasManager({
  lojas,
  planos,
  initialSelectedLojaId,
}: {
  lojas: LojaAdminDetalhadaRow[];
  planos: PlanoResumoAdmin[];
  initialSelectedLojaId?: string | null;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroPlano, setFiltroPlano] = useState<string>("todos");
  const [drawerLojaId, setDrawerLojaId] = useState<string | null>(
    initialSelectedLojaId ?? null,
  );
  const [planoOverrides, setPlanoOverrides] = useState<Record<string, string>>(
    {},
  );
  const [subcontaErroOverrides, setSubcontaErroOverrides] = useState<
    Record<string, string | null>
  >({});
  const [openMenu, setOpenMenu] = useState<OpenMenuState | null>(null);
  const [modal, setModal] = useState<ConfirmModalState>(null);
  const [feedback, setFeedback] = useState<{
    tipo: "erro" | "sucesso";
    mensagem: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    tipo: "erro" | "sucesso";
    mensagem: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function mostrarFeedback(tipo: "erro" | "sucesso", mensagem: string) {
    setFeedback({ tipo, mensagem });
    setToast({ tipo, mensagem });
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(timer);
  }, [toast]);

  function getSubcontaErro(loja: LojaAdminDetalhadaRow): string | null {
    return Object.prototype.hasOwnProperty.call(subcontaErroOverrides, loja.id)
      ? subcontaErroOverrides[loja.id]
      : loja.subcontaErro;
  }

  const drawerLoja = useMemo(
    () => lojas.find((l) => l.id === drawerLojaId) ?? null,
    [lojas, drawerLojaId],
  );

  const drawerPlanoId = drawerLoja
    ? (planoOverrides[drawerLoja.id] ?? drawerLoja.planoId)
    : "";

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [openMenu]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenMenu(null);
        if (!modal) setDrawerLojaId(null);
      }
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [modal]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lojas.filter((loja) => {
      if (filtroStatus === "trial") {
        if (loja.assinaturaStatus !== "trial") return false;
      } else if (filtroStatus !== "todos" && loja.status !== filtroStatus) {
        return false;
      }

      if (filtroPlano !== "todos" && loja.planoId !== filtroPlano) {
        return false;
      }

      if (!q) return true;
      return (
        loja.nome.toLowerCase().includes(q) ||
        loja.slug.toLowerCase().includes(q) ||
        loja.donoNome.toLowerCase().includes(q) ||
        loja.donoEmail.toLowerCase().includes(q) ||
        loja.categoria.toLowerCase().includes(q)
      );
    });
  }, [lojas, busca, filtroStatus, filtroPlano]);

  function openRowMenu(e: React.MouseEvent<HTMLButtonElement>, lojaId: string) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedMenuHeight = 250;
    const top =
      spaceBelow < estimatedMenuHeight
        ? Math.max(12, rect.top - estimatedMenuHeight)
        : rect.bottom + 6;
    const right = Math.max(12, window.innerWidth - rect.right);
    setOpenMenu((prev) =>
      prev?.lojaId === lojaId ? null : { lojaId, top, right },
    );
  }

  function handleAprovar(loja: LojaAdminDetalhadaRow) {
    setOpenMenu(null);
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await aprovarLojaAdminAction({ lojaId: loja.id });
        if (!res.ok) {
          mostrarFeedback("erro", res.error);
          return;
        }
        const data = res.data as
          | { subcontaOk?: boolean; subcontaErro?: string | null }
          | undefined;
        if (data?.subcontaOk === false) {
          const erroMsg = data.subcontaErro ?? "verifique os dados.";
          setSubcontaErroOverrides((prev) => ({
            ...prev,
            [loja.id]: erroMsg,
          }));
          mostrarFeedback(
            "erro",
            `Loja "${loja.nome}" aprovada, mas subconta AbacatePay falhou: ${erroMsg}`,
          );
        } else {
          setSubcontaErroOverrides((prev) => ({ ...prev, [loja.id]: null }));
          mostrarFeedback(
            "sucesso",
            `Loja "${loja.nome}" aprovada e subconta AbacatePay configurada.`,
          );
        }
        router.refresh();
      } catch {
        mostrarFeedback(
          "erro",
          "Erro inesperado ao aprovar a loja. Tente novamente.",
        );
      }
    });
  }

  function handleTentarSubconta(loja: LojaAdminDetalhadaRow) {
    setOpenMenu(null);
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await tentarCriarSubcontaAdminAction({ lojaId: loja.id });
        if (!res.ok) {
          setSubcontaErroOverrides((prev) => ({
            ...prev,
            [loja.id]: res.mensagem,
          }));
          mostrarFeedback("erro", res.mensagem);
          router.refresh();
          return;
        }
        setSubcontaErroOverrides((prev) => ({ ...prev, [loja.id]: null }));
        mostrarFeedback("sucesso", res.mensagem);
        router.refresh();
      } catch {
        const fallback = "Erro inesperado ao comunicar com o servidor.";
        setSubcontaErroOverrides((prev) => ({
          ...prev,
          [loja.id]: fallback,
        }));
        mostrarFeedback("erro", fallback);
      }
    });
  }

  function handleImpersonar(loja: LojaAdminDetalhadaRow) {
    setOpenMenu(null);
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await impersonarLojaAdminAction({ lojaId: loja.id });
        if (!res.ok) {
          mostrarFeedback("erro", res.error);
          return;
        }
        router.push(res.data?.redirectTo ?? "/painel");
        router.refresh();
      } catch {
        mostrarFeedback("erro", "Erro inesperado ao acessar como lojista.");
      }
    });
  }

  function handleDrawerTrocarPlano() {
    if (!drawerLoja || !drawerPlanoId || drawerPlanoId === drawerLoja.planoId)
      return;
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await trocarPlanoLojaAdminAction({
          lojaId: drawerLoja.id,
          planoId: drawerPlanoId,
        });
        if (!res.ok) {
          mostrarFeedback("erro", res.error);
          return;
        }
        const nomePlano =
          planos.find((p) => p.id === drawerPlanoId)?.nome ?? "selecionado";
        mostrarFeedback(
          "sucesso",
          `Plano da loja "${drawerLoja.nome}" alterado para ${nomePlano}.`,
        );
        router.refresh();
      } catch {
        mostrarFeedback("erro", "Erro inesperado ao trocar o plano da loja.");
      }
    });
  }

  function handleConfirmModal() {
    if (!modal) return;
    setFeedback(null);
    startTransition(async () => {
      try {
        if (modal.kind === "status") {
          const res = await alterarStatusLojaAdminAction({
            lojaId: modal.loja.id,
            status: modal.novoStatus,
          });
          if (!res.ok) {
            mostrarFeedback("erro", res.error);
            return;
          }
          mostrarFeedback(
            "sucesso",
            modal.novoStatus === "bloqueada"
              ? `Loja "${modal.loja.nome}" bloqueada.`
              : `Loja "${modal.loja.nome}" desbloqueada e ativa.`,
          );
        } else if (modal.kind === "arquivar") {
          const res = await arquivarLojaAdminAction({ lojaId: modal.loja.id });
          if (!res.ok) {
            mostrarFeedback("erro", res.error);
            return;
          }
          mostrarFeedback(
            "sucesso",
            `Loja "${modal.loja.nome}" arquivada (soft delete).`,
          );
          if (drawerLojaId === modal.loja.id) {
            setDrawerLojaId(null);
          }
        } else if (modal.kind === "plano") {
          const res = await trocarPlanoLojaAdminAction({
            lojaId: modal.loja.id,
            planoId: modal.planoId,
          });
          if (!res.ok) {
            mostrarFeedback("erro", res.error);
            return;
          }
          const nomePlano =
            planos.find((p) => p.id === modal.planoId)?.nome ?? "selecionado";
          mostrarFeedback(
            "sucesso",
            `Plano da loja "${modal.loja.nome}" alterado para ${nomePlano}.`,
          );
        } else if (modal.kind === "documento") {
          const res = await corrigirDocumentoLojaAdminAction({
            lojaId: modal.loja.id,
            cpf_cnpj: modal.cpfCnpj,
          });
          if (!res.ok) {
            setModal((prev) =>
              prev && prev.kind === "documento"
                ? { ...prev, erro: res.mensagem }
                : prev,
            );
            mostrarFeedback("erro", res.mensagem);
            return;
          }
          setSubcontaErroOverrides((prev) => ({
            ...prev,
            [modal.loja.id]: null,
          }));
          mostrarFeedback("sucesso", res.mensagem);
        }

        setModal(null);
        router.refresh();
      } catch {
        mostrarFeedback("erro", "Erro inesperado ao executar ação.");
      }
    });
  }

  const menuLoja = openMenu
    ? lojas.find((l) => l.id === openMenu.lojaId) ?? null
    : null;

  const statusChips = [
    { key: "todos", label: "Todas" },
    { key: "ativa", label: "Ativas" },
    { key: "pendente", label: "Pendentes" },
    { key: "trial", label: "Em trial" },
    { key: "bloqueada", label: "Bloqueadas" },
  ];

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold"
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
          <span>{feedback.mensagem}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="rounded-full p-1 hover:opacity-80"
            aria-label="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Barra de busca e filtros em chips */}
      <div className="admin-surface space-y-3 rounded-[20px] p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--admin-text-subtle)" }}
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar loja por nome, /slug, dono, e-mail ou categoria..."
            className="min-h-[44px] w-full rounded-2xl border pr-4 pl-10 text-sm outline-none transition"
            style={{
              backgroundColor: "var(--admin-surface-2)",
              borderColor: "var(--admin-border)",
              color: "var(--admin-text)",
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {statusChips.map((chip) => {
            const active = filtroStatus === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFiltroStatus(chip.key)}
                className="min-h-[34px] rounded-full border px-3.5 text-xs font-semibold transition"
                style={{
                  backgroundColor: active
                    ? "var(--admin-accent-soft)"
                    : "var(--admin-surface-2)",
                  borderColor: active
                    ? "var(--admin-accent)"
                    : "var(--admin-border)",
                  color: active ? "var(--admin-text)" : "var(--admin-text-muted)",
                }}
              >
                {chip.label}
              </button>
            );
          })}

          <span
            className="mx-1 hidden h-4 w-px sm:inline-block"
            style={{ backgroundColor: "var(--admin-border-strong)" }}
          />

          <button
            type="button"
            onClick={() => setFiltroPlano("todos")}
            className="min-h-[34px] rounded-full border px-3.5 text-xs font-semibold transition"
            style={{
              backgroundColor:
                filtroPlano === "todos"
                  ? "var(--admin-info-soft)"
                  : "var(--admin-surface-2)",
              borderColor:
                filtroPlano === "todos"
                  ? "var(--admin-info)"
                  : "var(--admin-border)",
              color:
                filtroPlano === "todos"
                  ? "var(--admin-info)"
                  : "var(--admin-text-muted)",
            }}
          >
            Todos planos
          </button>

          {planos.map((plano) => {
            const active = filtroPlano === plano.id;
            return (
              <button
                key={plano.id}
                type="button"
                onClick={() => setFiltroPlano(plano.id)}
                className="min-h-[34px] rounded-full border px-3.5 text-xs font-semibold transition"
                style={{
                  backgroundColor: active
                    ? "var(--admin-info-soft)"
                    : "var(--admin-surface-2)",
                  borderColor: active
                    ? "var(--admin-info)"
                    : "var(--admin-border)",
                  color: active ? "var(--admin-info)" : "var(--admin-text-muted)",
                }}
              >
                {plano.nome}
              </button>
            );
          })}
        </div>
      </div>

      <p
        className="px-1 text-xs font-medium"
        style={{ color: "var(--admin-text-subtle)" }}
      >
        Exibindo {filtradas.length} de {lojas.length} loja(s) · Clique em uma
        loja para ver os detalhes completos
      </p>

      {filtradas.length === 0 ? (
        <div
          className="admin-surface rounded-[20px] border-dashed px-6 py-12 text-center text-sm"
          style={{ color: "var(--admin-text-muted)" }}
        >
          Nenhuma loja corresponde aos filtros aplicados.
        </div>
      ) : (
        <>
          {/* Tabela Compacta Desktop (sem scroll horizontal) */}
          <div className="admin-surface hidden rounded-[20px] md:block">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <thead>
                <tr
                  className="border-b text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text-subtle)",
                  }}
                >
                  <th className="w-[34%] px-4 py-3.5">Loja</th>
                  <th className="w-[14%] px-3 py-3.5">Plano</th>
                  <th className="w-[20%] px-3 py-3.5">Status</th>
                  <th className="w-[15%] px-3 py-3.5">Faturamento 30d</th>
                  <th className="w-[11%] px-3 py-3.5">Criada em</th>
                  <th className="w-[6%] px-3 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody
                className="divide-y"
                style={{ borderColor: "var(--admin-border)" }}
              >
                {filtradas.map((loja) => {
                  const statusTone = getStatusColors(loja.status);
                  const trialLabel = formatTrialText(loja.diasRestantesTrial);
                  const isSelected = drawerLojaId === loja.id;
                  return (
                    <tr
                      key={loja.id}
                      onClick={() => setDrawerLojaId(loja.id)}
                      className="cursor-pointer transition"
                      style={{
                        backgroundColor: isSelected
                          ? "var(--admin-surface-2)"
                          : "transparent",
                      }}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <StoreAvatar
                            nome={loja.nome}
                            logoUrl={loja.logoUrl}
                            corPrimaria={loja.corPrimaria}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-bold">{loja.nome}</p>
                            <p
                              className="truncate font-mono text-xs"
                              style={{ color: "var(--admin-text-muted)" }}
                            >
                              /{loja.slug}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5">
                        <span
                          className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{
                            backgroundColor: "var(--admin-surface-2)",
                            color: "var(--admin-text)",
                          }}
                        >
                          {loja.planoNome}
                        </span>
                      </td>

                      <td className="px-3 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold"
                            style={{
                              backgroundColor: statusTone.bg,
                              color: statusTone.fg,
                            }}
                          >
                            {statusTone.label}
                          </span>
                          {trialLabel && (
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                              style={{
                                backgroundColor: "var(--admin-info-soft)",
                                color: "var(--admin-info)",
                              }}
                            >
                              {trialLabel}
                            </span>
                          )}
                          {!loja.abacateSubcontaId && (() => {
                            const errSub = getSubcontaErro(loja);
                            return (
                              <span
                                title={
                                  errSub ?? "Loja ainda sem subconta AbacatePay"
                                }
                                className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                                style={{
                                  backgroundColor: errSub
                                    ? "var(--admin-negative-soft)"
                                    : "var(--admin-warning-soft)",
                                  color: errSub
                                    ? "var(--admin-negative)"
                                    : "var(--admin-warning)",
                                }}
                              >
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  {errSub ? `Sem subconta · ${errSub}` : "Sem subconta"}
                                </span>
                              </span>
                            );
                          })()}
                        </div>
                        {!loja.abacateSubcontaId && getSubcontaErro(loja) && (
                          <p
                            className="mt-1 line-clamp-2 break-words text-[11px] leading-snug"
                            style={{ color: "var(--admin-negative)" }}
                            title={getSubcontaErro(loja) ?? undefined}
                          >
                            {getSubcontaErro(loja)}
                          </p>
                        )}
                      </td>

                      <td className="px-3 py-3.5 font-bold tabular-nums">
                        {formatarCentavos(loja.faturamento30dCentavos)}
                      </td>

                      <td
                        className="px-3 py-3.5 text-xs tabular-nums"
                        style={{ color: "var(--admin-text-muted)" }}
                      >
                        {loja.criadaEmFormatada}
                      </td>

                      <td className="px-3 py-3.5 text-right">
                        <button
                          type="button"
                          aria-label={`Ações para ${loja.nome}`}
                          onClick={(e) => openRowMenu(e, loja.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition hover:opacity-85"
                          style={{
                            backgroundColor: "var(--admin-surface-2)",
                            borderColor: "var(--admin-border)",
                            color: "var(--admin-text-muted)",
                          }}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Lista de Cards Mobile */}
          <div className="space-y-3 md:hidden">
            {filtradas.map((loja) => {
              const statusTone = getStatusColors(loja.status);
              const trialLabel = formatTrialText(loja.diasRestantesTrial);
              return (
                <div
                  key={loja.id}
                  onClick={() => setDrawerLojaId(loja.id)}
                  className="admin-surface min-w-0 cursor-pointer overflow-hidden rounded-[20px] p-4 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <StoreAvatar
                        nome={loja.nome}
                        logoUrl={loja.logoUrl}
                        corPrimaria={loja.corPrimaria}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold">
                          {loja.nome}
                        </p>
                        <p
                          className="truncate font-mono text-xs"
                          style={{ color: "var(--admin-text-muted)" }}
                        >
                          /{loja.slug} · {loja.planoNome}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label={`Ações para ${loja.nome}`}
                      onClick={(e) => openRowMenu(e, loja.id)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                      style={{
                        backgroundColor: "var(--admin-surface-2)",
                        borderColor: "var(--admin-border)",
                        color: "var(--admin-text-muted)",
                      }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                        style={{
                          backgroundColor: statusTone.bg,
                          color: statusTone.fg,
                        }}
                      >
                        {statusTone.label}
                      </span>
                      {trialLabel && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            backgroundColor: "var(--admin-info-soft)",
                            color: "var(--admin-info)",
                          }}
                        >
                          {trialLabel}
                        </span>
                      )}
                      {!loja.abacateSubcontaId && (() => {
                        const errSub = getSubcontaErro(loja);
                        return (
                          <span
                            title={
                              errSub ?? "Loja ainda sem subconta AbacatePay"
                            }
                            className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
                            style={{
                              backgroundColor: errSub
                                ? "var(--admin-negative-soft)"
                                : "var(--admin-warning-soft)",
                              color: errSub
                                ? "var(--admin-negative)"
                                : "var(--admin-warning)",
                            }}
                          >
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {errSub ? `Sem subconta · ${errSub}` : "Sem subconta"}
                            </span>
                          </span>
                        );
                      })()}
                    </div>

                    <div className="text-right text-xs">
                      <span className="font-extrabold tabular-nums">
                        {formatarCentavos(loja.faturamento30dCentavos)}
                      </span>{" "}
                      <span style={{ color: "var(--admin-text-subtle)" }}>
                        (30d)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Dropdown Flutuante "..." (sempre visível, nunca cortado) */}
      {openMenu && menuLoja && (
        <div
          className="fixed z-40 w-56 rounded-2xl border p-1.5 shadow-2xl"
          style={{
            top: openMenu.top,
            right: openMenu.right,
            backgroundColor: "var(--admin-surface)",
            borderColor: "var(--admin-border-strong)",
            color: "var(--admin-text)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {menuLoja.status === "pendente" && (
            <button
              type="button"
              onClick={() => handleAprovar(menuLoja)}
              className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-semibold transition hover:opacity-85"
              style={{ color: "var(--admin-positive)" }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Aprovar loja
            </button>
          )}

          {!menuLoja.abacateSubcontaId && (
            <button
              type="button"
              onClick={() => handleTentarSubconta(menuLoja)}
              className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-semibold transition hover:opacity-85"
              style={{ color: "var(--admin-warning)" }}
            >
              <RefreshCw className="h-4 w-4" />
              {getSubcontaErro(menuLoja)
                ? "Tentar de novo (subconta)"
                : "Criar subconta Pix"}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleImpersonar(menuLoja)}
            className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-semibold transition hover:opacity-85"
          >
            <Eye className="h-4 w-4" style={{ color: "var(--admin-accent)" }} />
            Entrar como lojista
          </button>

          <button
            type="button"
            onClick={() => {
              setOpenMenu(null);
              setModal({
                kind: "plano",
                loja: menuLoja,
                planoId: menuLoja.planoId,
              });
            }}
            className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-semibold transition hover:opacity-85"
          >
            <Layers className="h-4 w-4" style={{ color: "var(--admin-info)" }} />
            Trocar plano
          </button>

          <a
            href={`/${menuLoja.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpenMenu(null)}
            className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-semibold transition hover:opacity-85"
          >
            <ExternalLink
              className="h-4 w-4"
              style={{ color: "var(--admin-text-muted)" }}
            />
            Abrir loja pública
          </a>

          {menuLoja.status === "bloqueada" ? (
            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                setModal({
                  kind: "status",
                  loja: menuLoja,
                  novoStatus: "ativa",
                });
              }}
              className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-semibold transition hover:opacity-85"
              style={{ color: "var(--admin-positive)" }}
            >
              <Unlock className="h-4 w-4" />
              Desbloquear loja
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                setModal({
                  kind: "status",
                  loja: menuLoja,
                  novoStatus: "bloqueada",
                });
              }}
              className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-semibold transition hover:opacity-85"
              style={{ color: "var(--admin-negative)" }}
            >
              <Lock className="h-4 w-4" />
              Bloquear loja
            </button>
          )}

          <div
            className="my-1 border-t"
            style={{ borderColor: "var(--admin-border)" }}
          />

          <button
            type="button"
            onClick={() => {
              setOpenMenu(null);
              setModal({ kind: "arquivar", loja: menuLoja });
            }}
            className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-semibold transition hover:opacity-85"
            style={{ color: "var(--admin-text-subtle)" }}
          >
            <Archive className="h-4 w-4" />
            Arquivar (soft delete)
          </button>
        </div>
      )}

      {/* Drawer Lateral de Detalhes da Loja */}
      {drawerLoja && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={`Detalhes de ${drawerLoja.nome}`}
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setDrawerLojaId(null)}
          />

          <div
            className="relative z-10 flex h-[100dvh] w-full max-w-lg flex-col border-l shadow-2xl"
            style={{
              backgroundColor: "var(--admin-surface)",
              borderColor: "var(--admin-border-strong)",
              color: "var(--admin-text)",
            }}
          >
            {/* Header Drawer */}
            <div
              className="flex items-start justify-between gap-3 border-b px-5 py-4"
              style={{ borderColor: "var(--admin-border)" }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <StoreAvatar
                  nome={drawerLoja.nome}
                  logoUrl={drawerLoja.logoUrl}
                  corPrimaria={drawerLoja.corPrimaria}
                  size="lg"
                />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-extrabold">
                    {drawerLoja.nome}
                  </h2>
                  <p
                    className="truncate font-mono text-xs"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    /{drawerLoja.slug} · {drawerLoja.categoria}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDrawerLojaId(null)}
                aria-label="Fechar detalhes"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: "var(--admin-surface-2)",
                  borderColor: "var(--admin-border)",
                  color: "var(--admin-text-muted)",
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body Scrollável Drawer */}
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
              {/* Badges + Ações Rápidas */}
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const tone = getStatusColors(drawerLoja.status);
                  return (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-bold"
                      style={{ backgroundColor: tone.bg, color: tone.fg }}
                    >
                      Status: {tone.label}
                    </span>
                  );
                })()}
                {formatTrialText(drawerLoja.diasRestantesTrial) && (
                  <span
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                      backgroundColor: "var(--admin-info-soft)",
                      color: "var(--admin-info)",
                    }}
                  >
                    {formatTrialText(drawerLoja.diasRestantesTrial)}
                  </span>
                )}
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    color: "var(--admin-text-muted)",
                  }}
                >
                  {drawerLoja.aberta ? "Vitrine aberta" : "Vitrine fechada"}
                </span>
                {drawerLoja.abacateSubcontaId ? (
                  <span
                    className="max-w-full break-all rounded-full px-3 py-1 font-mono text-[11px] font-semibold"
                    style={{
                      backgroundColor: "var(--admin-positive-soft)",
                      color: "var(--admin-positive)",
                    }}
                  >
                    Subconta: {drawerLoja.abacateSubcontaId}
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                    style={{
                      backgroundColor: "var(--admin-negative-soft)",
                      color: "var(--admin-negative)",
                    }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Sem subconta
                  </span>
                )}
              </div>

              {!drawerLoja.abacateSubcontaId && (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 text-xs"
                  style={{
                    backgroundColor: "var(--admin-negative-soft)",
                    borderColor: "var(--admin-negative)",
                    color: "var(--admin-negative)",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      Subconta AbacatePay pendente — loja indisponível para
                      pedidos Pix
                    </p>
                    {getSubcontaErro(drawerLoja) && (
                      <p className="mt-1 opacity-90">
                        Erro: {getSubcontaErro(drawerLoja)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleTentarSubconta(drawerLoja)}
                    className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold text-white transition disabled:opacity-50"
                    style={{ backgroundColor: "var(--admin-accent-strong)" }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Tentar de novo
                  </button>
                </div>
              )}

              {/* Mini KPIs */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="admin-surface-2 min-w-0 rounded-2xl p-3">
                  <p
                    className="flex items-center gap-1 text-[11px]"
                    style={{ color: "var(--admin-text-subtle)" }}
                  >
                    <Package className="h-3.5 w-3.5" />
                    Produtos
                  </p>
                  <p className="mt-1 text-lg font-extrabold tabular-nums">
                    {drawerLoja.totalProdutos}
                  </p>
                </div>
                <div className="admin-surface-2 min-w-0 rounded-2xl p-3">
                  <p
                    className="flex items-center gap-1 text-[11px]"
                    style={{ color: "var(--admin-text-subtle)" }}
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Pedidos 30d
                  </p>
                  <p className="mt-1 text-lg font-extrabold tabular-nums">
                    {drawerLoja.pedidos30d}
                  </p>
                </div>
                <div className="admin-surface-2 min-w-0 rounded-2xl p-3">
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--admin-text-subtle)" }}
                  >
                    Faturam. 30d
                  </p>
                  <p className="mt-1 truncate text-base font-extrabold tabular-nums">
                    {formatarCentavos(drawerLoja.faturamento30dCentavos)}
                  </p>
                </div>
              </div>

              {/* Dados do Dono & Loja */}
              <div className="admin-surface-2 space-y-2.5 rounded-2xl p-4 text-xs">
                <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                  Dados do proprietário e assinatura
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <span style={{ color: "var(--admin-text-subtle)" }}>
                      Dono
                    </span>
                    <p className="break-words font-semibold">{drawerLoja.donoNome}</p>
                    <p
                      className="truncate"
                      style={{ color: "var(--admin-text-muted)" }}
                    >
                      {drawerLoja.donoEmail}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <span style={{ color: "var(--admin-text-subtle)" }}>
                      Contato & Doc
                    </span>
                    <p className="break-words font-semibold">{drawerLoja.whatsapp}</p>
                    <p
                      className="break-words"
                      style={{ color: "var(--admin-text-muted)" }}
                    >
                      {drawerLoja.cpfCnpj}
                    </p>
                    {!drawerLoja.abacateSubcontaId && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          setModal({
                            kind: "documento",
                            loja: drawerLoja,
                            cpfCnpj: drawerLoja.cpfCnpj,
                            erro: null,
                          })
                        }
                        className="mt-1.5 inline-flex min-h-[32px] items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold transition hover:opacity-85 disabled:opacity-50"
                        style={{
                          backgroundColor: "var(--admin-surface)",
                          borderColor: "var(--admin-border-strong)",
                          color: "var(--admin-text)",
                        }}
                      >
                        <FileEdit className="h-3.5 w-3.5" />
                        Corrigir documento
                      </button>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span style={{ color: "var(--admin-text-subtle)" }}>
                      Plano & Trial
                    </span>
                    <p className="break-words font-semibold">{drawerLoja.planoNome}</p>
                    <p style={{ color: "var(--admin-text-muted)" }}>
                      {drawerLoja.trialAteFormatado
                        ? `Trial até ${drawerLoja.trialAteFormatado}`
                        : "Assinatura regular"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <span style={{ color: "var(--admin-text-subtle)" }}>
                      Bairro & Cadastro
                    </span>
                    <p className="break-words font-semibold">{drawerLoja.bairro}</p>
                    <p style={{ color: "var(--admin-text-muted)" }}>
                      Criada em {drawerLoja.criadaEmFormatada}
                    </p>
                  </div>
                </div>
              </div>

              {/* Trocar Plano inline */}
              <div className="admin-surface-2 rounded-2xl p-4">
                <p className="mb-2.5 text-xs font-bold">Plano da loja</p>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={drawerPlanoId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setPlanoOverrides((prev) => ({
                        ...prev,
                        [drawerLoja.id]: nextId,
                      }));
                    }}
                    className="min-h-[42px] flex-1 rounded-2xl border px-3 text-xs font-semibold outline-none"
                    style={{
                      backgroundColor: "var(--admin-surface)",
                      borderColor: "var(--admin-border-strong)",
                      color: "var(--admin-text)",
                    }}
                  >
                    {planos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} — {formatarCentavos(p.mensalidade_centavos)}/mês
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={
                      isPending || drawerPlanoId === drawerLoja.planoId
                    }
                    onClick={handleDrawerTrocarPlano}
                    className="min-h-[42px] rounded-2xl px-4 text-xs font-bold text-white transition disabled:opacity-45"
                    style={{ backgroundColor: "var(--admin-accent-strong)" }}
                  >
                    Aplicar plano
                  </button>
                </div>
              </div>

              {/* Todas as Ações */}
              <div className="space-y-2">
                <p className="text-xs font-bold">Ações administrativas</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {drawerLoja.status === "pendente" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleAprovar(drawerLoja)}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl px-4 text-xs font-bold text-white"
                      style={{ backgroundColor: "var(--admin-positive)" }}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Aprovar loja
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleImpersonar(drawerLoja)}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl px-4 text-xs font-bold text-white"
                    style={{ backgroundColor: "var(--admin-accent-strong)" }}
                  >
                    <Eye className="h-4 w-4" />
                    Entrar como lojista
                  </button>

                  <a
                    href={`/${drawerLoja.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-semibold"
                    style={{
                      backgroundColor: "var(--admin-surface-2)",
                      borderColor: "var(--admin-border-strong)",
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ver loja pública
                  </a>

                  {drawerLoja.status === "bloqueada" ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        setModal({
                          kind: "status",
                          loja: drawerLoja,
                          novoStatus: "ativa",
                        })
                      }
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-bold"
                      style={{
                        backgroundColor: "var(--admin-positive-soft)",
                        borderColor: "var(--admin-positive)",
                        color: "var(--admin-positive)",
                      }}
                    >
                      <Unlock className="h-4 w-4" />
                      Desbloquear loja
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        setModal({
                          kind: "status",
                          loja: drawerLoja,
                          novoStatus: "bloqueada",
                        })
                      }
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-bold"
                      style={{
                        backgroundColor: "var(--admin-negative-soft)",
                        borderColor: "var(--admin-negative)",
                        color: "var(--admin-negative)",
                      }}
                    >
                      <Lock className="h-4 w-4" />
                      Bloquear loja
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      setModal({ kind: "arquivar", loja: drawerLoja })
                    }
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-semibold sm:col-span-2"
                    style={{
                      backgroundColor: "var(--admin-surface-2)",
                      borderColor: "var(--admin-border)",
                      color: "var(--admin-text-muted)",
                    }}
                  >
                    <Archive className="h-4 w-4" />
                    Arquivar loja (soft delete)
                  </button>
                </div>
              </div>

              {/* Histórico Recente de Pedidos */}
              <div className="space-y-2">
                <p className="text-xs font-bold">Últimos pedidos</p>
                {drawerLoja.ultimosPedidos.length === 0 ? (
                  <p
                    className="rounded-2xl border border-dashed py-5 text-center text-xs"
                    style={{
                      borderColor: "var(--admin-border)",
                      color: "var(--admin-text-subtle)",
                    }}
                  >
                    Nenhum pedido no filtro atual.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {drawerLoja.ultimosPedidos.map((ord) => (
                      <div
                        key={ord.id}
                        className="admin-surface-2 flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold">
                              {ord.codigo}
                            </span>
                            {ord.demo && (
                              <span
                                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                                style={{
                                  backgroundColor: "var(--admin-info-soft)",
                                  color: "var(--admin-info)",
                                }}
                              >
                                Demo
                              </span>
                            )}
                          </div>
                          <p
                            className="truncate text-[11px]"
                            style={{ color: "var(--admin-text-muted)" }}
                          >
                            {ord.clienteNome} · {ord.criadoEmFormatada}
                          </p>
                        </div>
                        <span className="shrink-0 font-bold tabular-nums">
                          {formatarCentavos(ord.totalCentavos)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Histórico de Impersonação */}
              <div className="space-y-2">
                <p className="text-xs font-bold">
                  Histórico de acessos de suporte
                </p>
                {drawerLoja.historicoImpersonacoes.length === 0 ? (
                  <p
                    className="rounded-2xl border border-dashed py-4 text-center text-xs"
                    style={{
                      borderColor: "var(--admin-border)",
                      color: "var(--admin-text-subtle)",
                    }}
                  >
                    Nenhum acesso de suporte registrado para esta loja.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {drawerLoja.historicoImpersonacoes.map((imp) => (
                      <div
                        key={imp.id}
                        className="admin-surface-2 flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-xs"
                      >
                        <span className="truncate font-medium">
                          {imp.adminNome}
                        </span>
                        <span
                          className="shrink-0 text-[11px]"
                          style={{ color: "var(--admin-text-subtle)" }}
                        >
                          {imp.criadoEmFormatada}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação / troca de plano */}
      {modal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
            style={{
              backgroundColor: "var(--admin-surface)",
              borderColor: "var(--admin-border-strong)",
              color: "var(--admin-text)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-extrabold">
                {modal.kind === "status" &&
                  (modal.novoStatus === "bloqueada"
                    ? "Bloquear loja?"
                    : "Desbloquear loja?")}
                {modal.kind === "arquivar" && "Arquivar loja?"}
                {modal.kind === "plano" && "Trocar plano da loja"}
                {modal.kind === "documento" && "Corrigir documento da loja"}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl p-1.5"
                style={{
                  backgroundColor: "var(--admin-surface-2)",
                  color: "var(--admin-text-muted)",
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modal.kind === "status" && (
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--admin-text-muted)" }}
              >
                {modal.novoStatus === "bloqueada"
                  ? `A loja "${modal.loja.nome}" (/${modal.loja.slug}) ficará indisponível no catálogo público e no painel do lojista até ser desbloqueada.`
                  : `A loja "${modal.loja.nome}" voltará ao status ativa imediatamente.`}
              </p>
            )}

            {modal.kind === "arquivar" && (
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--admin-text-muted)" }}
              >
                Será feito um arquivamento seguro (soft delete) em{" "}
                <strong style={{ color: "var(--admin-text)" }}>
                  {modal.loja.nome}
                </strong>
                . O histórico de pedidos e auditoria permanece preservado no
                banco.
              </p>
            )}

            {modal.kind === "plano" && (
              <div className="mt-3 space-y-3">
                <p
                  className="text-sm"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  Selecione o novo plano para{" "}
                  <strong style={{ color: "var(--admin-text)" }}>
                    {modal.loja.nome}
                  </strong>
                  :
                </p>
                <select
                  value={modal.planoId}
                  onChange={(e) =>
                    setModal({ ...modal, planoId: e.target.value })
                  }
                  className="min-h-[44px] w-full rounded-2xl border px-3.5 text-sm font-medium outline-none"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border-strong)",
                    color: "var(--admin-text)",
                  }}
                >
                  {planos.map((plano) => (
                    <option key={plano.id} value={plano.id}>
                      {plano.nome} —{" "}
                      {formatarCentavos(plano.mensalidade_centavos)}/mês
                      {!plano.ativo ? " (inativo)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {modal.kind === "documento" && (
              <div className="mt-3 space-y-3">
                <p
                  className="text-sm"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  Informe o CPF ou CNPJ válido para{" "}
                  <strong style={{ color: "var(--admin-text)" }}>
                    {modal.loja.nome}
                  </strong>
                  . A alteração é auditada e limpa o erro anterior de subconta.
                </p>
                <input
                  type="text"
                  value={modal.cpfCnpj}
                  onChange={(e) =>
                    setModal({ ...modal, cpfCnpj: e.target.value, erro: null })
                  }
                  placeholder="CPF (11 dígitos) ou CNPJ (14 dígitos)"
                  className="min-h-[44px] w-full rounded-2xl border px-3.5 font-mono text-sm font-medium outline-none"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: modal.erro
                      ? "var(--admin-negative)"
                      : "var(--admin-border-strong)",
                    color: "var(--admin-text)",
                  }}
                />
                {modal.erro && (
                  <p
                    className="text-xs font-semibold"
                    style={{ color: "var(--admin-negative)" }}
                  >
                    {modal.erro}
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setModal(null)}
                className="min-h-[42px] rounded-full border px-4 text-sm font-semibold"
                style={{
                  backgroundColor: "var(--admin-surface-2)",
                  borderColor: "var(--admin-border)",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmModal}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-full px-5 text-sm font-bold text-white disabled:opacity-60"
                style={{
                  backgroundColor:
                    (modal.kind === "status" &&
                      modal.novoStatus === "bloqueada") ||
                      modal.kind === "arquivar"
                      ? "var(--admin-negative)"
                      : "var(--admin-accent-strong)",
                }}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 bottom-4 z-[70] flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl"
          style={{
            backgroundColor: "var(--admin-surface)",
            borderColor:
              toast.tipo === "erro"
                ? "var(--admin-negative)"
                : "var(--admin-positive)",
            color:
              toast.tipo === "erro"
                ? "var(--admin-negative)"
                : "var(--admin-positive)",
          }}
        >
          {toast.tipo === "erro" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1 break-words">{toast.mensagem}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Fechar notificação"
            className="rounded-full p-1 hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

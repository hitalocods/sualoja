"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  Power,
  Sparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import {
  alternarAtivoPlanoAdminAction,
  criarPlanoAdminAction,
  editarPlanoAdminAction,
} from "@/app/admin/actions";
import {
  avaliarTarifaPlanoPedidoTipico,
  formatarCentavos,
  MARGEM_MINIMA_PADRAO_CENTAVOS,
  TARIFA_GATEWAY_PIX_PADRAO_CENTAVOS,
} from "@/lib/money";
import {
  centavosParaInputReais,
  reaisParaCentavos,
} from "@/lib/validators/painel";

export interface PlanoAdminRow {
  id: string;
  nome: string;
  mensalidade_centavos: number;
  limite_produtos: number | null;
  taxa_fixa_centavos: number;
  taxa_percentual: string;
  ativo: boolean;
  lojasCount: number;
}

interface PlanoFormState {
  mode: "create" | "edit";
  planoId?: string;
  nome: string;
  mensalidadeReais: string;
  ilimitado: boolean;
  limiteProdutos: string;
  taxaFixaReais: string;
  taxaPercentual: string;
  ativo: boolean;
}

function criarEstadoInicial(): PlanoFormState {
  return {
    mode: "create",
    nome: "",
    mensalidadeReais: "0,00",
    ilimitado: false,
    limiteProdutos: "50",
    taxaFixaReais: "0,00",
    taxaPercentual: "0.00",
    ativo: true,
  };
}

function formatTaxaPreview(taxaFixaCentavos: number, taxaPercentual: string) {
  const numPct = Number(taxaPercentual.replace(",", "."));
  const pctLabel = Number.isFinite(numPct) ? `${numPct.toFixed(2)}%` : "0.00%";
  if (taxaFixaCentavos <= 0 && numPct <= 0) {
    return "Sem taxa por venda";
  }
  if (taxaFixaCentavos > 0) {
    return `${pctLabel} + ${formatarCentavos(taxaFixaCentavos)} por venda`;
  }
  return `${pctLabel} por venda`;
}

export function AdminPlanosManager({
  planos,
  tarifaGatewayPixCentavos = TARIFA_GATEWAY_PIX_PADRAO_CENTAVOS,
  margemMinimaCentavos = MARGEM_MINIMA_PADRAO_CENTAVOS,
}: {
  planos: PlanoAdminRow[];
  tarifaGatewayPixCentavos?: number;
  margemMinimaCentavos?: number;
}) {
  const router = useRouter();
  const [formModal, setFormModal] = useState<PlanoFormState | null>(null);
  const [feedback, setFeedback] = useState<{
    tipo: "erro" | "sucesso";
    mensagem: string;
  } | null>(null);
  const [formErro, setFormErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function abrirEdicao(plano: PlanoAdminRow) {
    setFormErro(null);
    setFormModal({
      mode: "edit",
      planoId: plano.id,
      nome: plano.nome,
      mensalidadeReais: centavosParaInputReais(plano.mensalidade_centavos),
      ilimitado: plano.limite_produtos === null,
      limiteProdutos: plano.limite_produtos
        ? String(plano.limite_produtos)
        : "",
      taxaFixaReais: centavosParaInputReais(plano.taxa_fixa_centavos),
      taxaPercentual: plano.taxa_percentual,
      ativo: plano.ativo,
    });
  }

  function handleToggleAtivo(plano: PlanoAdminRow) {
    setFeedback(null);
    startTransition(async () => {
      const res = await alternarAtivoPlanoAdminAction({
        planoId: plano.id,
        ativo: !plano.ativo,
      });
      if (!res.ok) {
        setFeedback({ tipo: "erro", mensagem: res.error });
        return;
      }
      setFeedback({
        tipo: "sucesso",
        mensagem: plano.ativo
          ? `Plano "${plano.nome}" desativado para novas assinaturas.`
          : `Plano "${plano.nome}" reativado.`,
      });
      router.refresh();
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formModal) return;
    setFormErro(null);
    setFeedback(null);

    const mensalidadeCentavos = reaisParaCentavos(formModal.mensalidadeReais);
    if (mensalidadeCentavos === null || mensalidadeCentavos < 0) {
      setFormErro("Informe um valor de mensalidade válido (ex.: 49,90).");
      return;
    }

    const taxaFixaCentavos = reaisParaCentavos(formModal.taxaFixaReais);
    if (taxaFixaCentavos === null || taxaFixaCentavos < 0) {
      setFormErro("Informe um valor de taxa fixa válido (ex.: 0,80).");
      return;
    }

    let limiteProdutos: number | null = null;
    if (!formModal.ilimitado) {
      const parsedLimite = Number(formModal.limiteProdutos);
      if (!Number.isInteger(parsedLimite) || parsedLimite <= 0) {
        setFormErro("Informe um limite de produtos inteiro maior que zero.");
        return;
      }
      limiteProdutos = parsedLimite;
    }

    const payload = {
      nome: formModal.nome,
      mensalidade_centavos: mensalidadeCentavos,
      limite_produtos: limiteProdutos,
      taxa_fixa_centavos: taxaFixaCentavos,
      taxa_percentual: formModal.taxaPercentual,
      ativo: formModal.ativo,
    };

    startTransition(async () => {
      const res =
        formModal.mode === "create"
          ? await criarPlanoAdminAction(payload)
          : await editarPlanoAdminAction({
              ...payload,
              planoId: formModal.planoId,
            });

      if (!res.ok) {
        const primeiroCampo = res.fieldErrors
          ? Object.values(res.fieldErrors)[0]
          : undefined;
        setFormErro(primeiroCampo ?? res.error);
        return;
      }

      setFeedback({
        tipo: "sucesso",
        mensagem:
          formModal.mode === "create"
            ? `Plano "${formModal.nome}" criado com sucesso.`
            : `Plano "${formModal.nome}" atualizado.`,
      });
      setFormModal(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium" style={{ color: "var(--admin-text-muted)" }}>
          {planos.filter((p) => p.ativo).length} plano(s) ativo(s) exibido(s) na
          landing e no cadastro
        </p>
        <button
          type="button"
          onClick={() => {
            setFormErro(null);
            setFormModal(criarEstadoInicial());
          }}
          className="inline-flex min-h-[42px] items-center gap-2 rounded-2xl px-4 text-xs font-bold text-white transition hover:opacity-90 sm:text-sm"
          style={{ backgroundColor: "var(--admin-accent-strong)" }}
        >
          <Plus className="h-4 w-4" />
          Novo plano
        </button>
      </div>

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
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {planos.map((plano) => {
          const destaque = plano.nome.toLowerCase() === "pro";
          return (
            <div
              key={plano.id}
              className={`admin-surface flex min-w-0 flex-col justify-between rounded-[20px] p-5 transition ${
                plano.ativo ? "" : "opacity-75"
              }`}
              style={{
                borderColor: destaque
                  ? "var(--admin-accent)"
                  : "var(--admin-border)",
              }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-extrabold">{plano.nome}</h2>
                    {destaque && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{
                          backgroundColor: "var(--admin-accent-soft)",
                          color: "var(--admin-accent)",
                        }}
                      >
                        <Sparkles className="h-3 w-3" />
                        Destaque
                      </span>
                    )}
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{
                      backgroundColor: plano.ativo
                        ? "var(--admin-positive-soft)"
                        : "var(--admin-surface-2)",
                      color: plano.ativo
                        ? "var(--admin-positive)"
                        : "var(--admin-text-subtle)",
                    }}
                  >
                    {plano.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <p className="mt-3 text-3xl font-extrabold tracking-tight tabular-nums">
                  {formatarCentavos(plano.mensalidade_centavos)}
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    /mês
                  </span>
                </p>

                <dl className="admin-surface-2 mt-4 space-y-2 rounded-2xl p-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <dt style={{ color: "var(--admin-text-muted)" }}>
                      Limite de produtos
                    </dt>
                    <dd className="font-bold">
                      {plano.limite_produtos === null
                        ? "Ilimitado"
                        : `${plano.limite_produtos} produtos`}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt style={{ color: "var(--admin-text-muted)" }}>
                      Taxa fixa por venda
                    </dt>
                    <dd className="font-bold tabular-nums">
                      {formatarCentavos(plano.taxa_fixa_centavos)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt style={{ color: "var(--admin-text-muted)" }}>
                      Taxa percentual
                    </dt>
                    <dd className="font-bold tabular-nums">
                      {plano.taxa_percentual}%
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt style={{ color: "var(--admin-text-muted)" }}>
                      Lojas neste plano
                    </dt>
                    <dd className="font-bold tabular-nums">{plano.lojasCount}</dd>
                  </div>
                </dl>

                {/* Preview do Lojista */}
                <div
                  className="mt-3.5 rounded-2xl border border-dashed p-3.5"
                  style={{
                    borderColor: "var(--admin-border-strong)",
                    backgroundColor: "var(--admin-bg)",
                  }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--admin-text-subtle)" }}
                  >
                    Preview do que o lojista vê
                  </p>
                  <p className="mt-1.5 text-sm font-bold">{plano.nome}</p>
                  <ul
                    className="mt-2 space-y-1 text-xs"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    <li className="flex items-center gap-1.5">
                      <Check
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: "var(--admin-positive)" }}
                      />
                      {plano.limite_produtos === null
                        ? "Produtos ilimitados no catálogo"
                        : `Até ${plano.limite_produtos} produtos no catálogo`}
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: "var(--admin-positive)" }}
                      />
                      {formatTaxaPreview(
                        plano.taxa_fixa_centavos,
                        plano.taxa_percentual,
                      )}
                    </li>
                  </ul>
                </div>

                {(() => {
                  const avaliacao = avaliarTarifaPlanoPedidoTipico({
                    taxa_fixa_centavos: plano.taxa_fixa_centavos,
                    taxa_percentual: plano.taxa_percentual,
                    tarifa_gateway_pix_centavos: tarifaGatewayPixCentavos,
                    margem_minima_centavos: margemMinimaCentavos,
                  });
                  if (!avaliacao.abaixo_do_piso) return null;
                  return (
                    <div
                      className="mt-3 flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: "var(--admin-warning-soft)",
                        borderColor: "var(--admin-warning)",
                        color: "var(--admin-warning)",
                      }}
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Em pedido típico de{" "}
                        {formatarCentavos(avaliacao.pedido_tipico_centavos)},
                        esta taxa rende{" "}
                        <strong>
                          {formatarCentavos(
                            avaliacao.taxa_pedido_tipico_centavos,
                          )}
                        </strong>
                        , abaixo da tarifa do gateway + margem (
                        <strong>
                          {formatarCentavos(avaliacao.piso_minimo_centavos)}
                        </strong>
                        ). O piso será aplicado no checkout.
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => abrirEdicao(plano)}
                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-2xl border px-3 text-xs font-semibold transition hover:opacity-85"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border-strong)",
                  }}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Editar
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleToggleAtivo(plano)}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-2xl border px-3.5 text-xs font-bold transition hover:opacity-90"
                  style={
                    plano.ativo
                      ? {
                          backgroundColor: "var(--admin-surface-2)",
                          borderColor: "var(--admin-border)",
                          color: "var(--admin-text-muted)",
                        }
                      : {
                          backgroundColor: "var(--admin-positive-soft)",
                          borderColor: "var(--admin-positive)",
                          color: "var(--admin-positive)",
                        }
                  }
                >
                  {plano.ativo ? (
                    <>
                      <Power className="h-3.5 w-3.5" />
                      Desativar
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Ativar
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Criar/Editar Plano */}
      {formModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-lg rounded-3xl border p-6 shadow-2xl"
            style={{
              backgroundColor: "var(--admin-surface)",
              borderColor: "var(--admin-border-strong)",
              color: "var(--admin-text)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-extrabold">
                {formModal.mode === "create" ? "Novo plano" : "Editar plano"}
              </h3>
              <button
                type="button"
                onClick={() => setFormModal(null)}
                className="rounded-xl p-1.5"
                style={{
                  backgroundColor: "var(--admin-surface-2)",
                  color: "var(--admin-text-muted)",
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formErro && (
              <div
                className="mt-3 rounded-2xl border px-3.5 py-2.5 text-xs font-semibold"
                style={{
                  backgroundColor: "var(--admin-negative-soft)",
                  borderColor: "var(--admin-negative)",
                  color: "var(--admin-negative)",
                }}
              >
                {formErro}
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  Nome do plano
                </label>
                <input
                  type="text"
                  required
                  value={formModal.nome}
                  onChange={(e) =>
                    setFormModal({ ...formModal, nome: e.target.value })
                  }
                  placeholder="Ex.: Pro"
                  className="min-h-[44px] w-full rounded-2xl border px-3.5 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text)",
                  }}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  Mensalidade (R$)
                </label>
                <input
                  type="text"
                  required
                  value={formModal.mensalidadeReais}
                  onChange={(e) =>
                    setFormModal({
                      ...formModal,
                      mensalidadeReais: e.target.value,
                    })
                  }
                  placeholder="49,90"
                  className="min-h-[44px] w-full rounded-2xl border px-3.5 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text)",
                  }}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  Taxa fixa (R$)
                </label>
                <input
                  type="text"
                  required
                  value={formModal.taxaFixaReais}
                  onChange={(e) =>
                    setFormModal({
                      ...formModal,
                      taxaFixaReais: e.target.value,
                    })
                  }
                  placeholder="0,80"
                  className="min-h-[44px] w-full rounded-2xl border px-3.5 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text)",
                  }}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  Taxa percentual (%)
                </label>
                <input
                  type="text"
                  required
                  value={formModal.taxaPercentual}
                  onChange={(e) =>
                    setFormModal({
                      ...formModal,
                      taxaPercentual: e.target.value,
                    })
                  }
                  placeholder="2.50"
                  className="min-h-[44px] w-full rounded-2xl border px-3.5 text-sm outline-none"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text)",
                  }}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  Limite de produtos
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={formModal.ilimitado}
                  value={formModal.ilimitado ? "" : formModal.limiteProdutos}
                  onChange={(e) =>
                    setFormModal({
                      ...formModal,
                      limiteProdutos: e.target.value,
                    })
                  }
                  placeholder={formModal.ilimitado ? "Ilimitado" : "50"}
                  className="min-h-[44px] w-full rounded-2xl border px-3.5 text-sm outline-none disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text)",
                  }}
                />
                <label
                  className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-medium"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  <input
                    type="checkbox"
                    checked={formModal.ilimitado}
                    onChange={(e) =>
                      setFormModal({
                        ...formModal,
                        ilimitado: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded"
                  />
                  Produtos ilimitados
                </label>
              </div>

              <div className="sm:col-span-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={formModal.ativo}
                    onChange={(e) =>
                      setFormModal({ ...formModal, ativo: e.target.checked })
                    }
                    className="h-4 w-4 rounded"
                  />
                  Plano ativo (visível na landing e disponível para novas lojas)
                </label>
              </div>

              {(() => {
                const taxaFixaPreview = reaisParaCentavos(
                  formModal.taxaFixaReais,
                );
                const pctNorm = formModal.taxaPercentual
                  .trim()
                  .replace(",", ".");
                if (
                  taxaFixaPreview === null ||
                  !/^\d+(\.\d{1,2})?$/.test(pctNorm)
                ) {
                  return null;
                }
                const avaliacao = avaliarTarifaPlanoPedidoTipico({
                  taxa_fixa_centavos: taxaFixaPreview,
                  taxa_percentual: pctNorm,
                  tarifa_gateway_pix_centavos: tarifaGatewayPixCentavos,
                  margem_minima_centavos: margemMinimaCentavos,
                });
                if (!avaliacao.abaixo_do_piso) return null;
                return (
                  <div
                    className="sm:col-span-2 flex items-start gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-medium"
                    style={{
                      backgroundColor: "var(--admin-warning-soft)",
                      borderColor: "var(--admin-warning)",
                      color: "var(--admin-warning)",
                    }}
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Aviso: em um pedido típico de{" "}
                      {formatarCentavos(avaliacao.pedido_tipico_centavos)}, esta
                      tarifa resulta em{" "}
                      <strong>
                        {formatarCentavos(
                          avaliacao.taxa_pedido_tipico_centavos,
                        )}
                      </strong>
                      , abaixo do piso gateway + margem (
                      <strong>
                        {formatarCentavos(avaliacao.piso_minimo_centavos)}
                      </strong>
                      ). Você ainda pode salvar; o piso será aplicado
                      automaticamente nos pedidos.
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setFormModal(null)}
                className="min-h-[42px] rounded-full border px-4 text-sm font-semibold"
                style={{
                  backgroundColor: "var(--admin-surface-2)",
                  borderColor: "var(--admin-border)",
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-full px-5 text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundColor: "var(--admin-accent-strong)" }}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {formModal.mode === "create"
                  ? "Criar plano"
                  : "Salvar alterações"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

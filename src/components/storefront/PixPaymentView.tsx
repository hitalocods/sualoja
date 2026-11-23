"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { formatarCentavos } from "@/lib/money";
import type { PedidoPixCriadoResumo } from "@/lib/payments/orders";

function formatarSegundos(segundos: number): string {
  const safe = Math.max(0, Math.floor(segundos));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function PixPaymentView({
  lojaNome,
  lojaSlug,
  pedido,
  onPagamentoConfirmado,
  onGerarNovoPix,
}: {
  lojaNome: string;
  lojaSlug: string;
  pedido: PedidoPixCriadoResumo;
  onPagamentoConfirmado: () => void;
  onGerarNovoPix: () => void;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(pedido.status);
  const [segundosRestantes, setSegundosRestantes] = useState<number>(900);
  const [copiado, setCopiado] = useState(false);

  const expiraMsRef = useRef<number>(
    Number.isFinite(Date.parse(pedido.pix_expira_em))
      ? Date.parse(pedido.pix_expira_em)
      : 0,
  );
  const confirmacaoDisparadaRef = useRef(false);
  const onPagamentoConfirmadoRef = useRef(onPagamentoConfirmado);

  useEffect(() => {
    onPagamentoConfirmadoRef.current = onPagamentoConfirmado;
  }, [onPagamentoConfirmado]);

  useEffect(() => {
    const parsed = Date.parse(pedido.pix_expira_em);
    expiraMsRef.current = Number.isFinite(parsed)
      ? parsed
      : Date.now() + 900_000;
  }, [pedido.pix_expira_em]);

  useEffect(() => {
    let ativo = true;
    QRCode.toDataURL(pedido.pix_copia_cola, {
      width: 240,
      margin: 1,
      color: {
        dark: "#18181b",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (ativo) setQrDataUrl(url);
      })
      .catch(() => {
        if (ativo) setQrDataUrl(null);
      });

    return () => {
      ativo = false;
    };
  }, [pedido.pix_copia_cola]);

  useEffect(() => {
    if (status !== "aguardando_pagamento") return;

    let cancelado = false;

    async function consultarStatus() {
      try {
        const res = await fetch(
          `/api/pedido/${encodeURIComponent(pedido.codigo)}/status`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelado) return;
        const json = (await res.json()) as {
          status?: string;
          segundos_restantes?: number;
          pix_expira_em?: string | null;
        };
        if (cancelado || !json.status) return;

        if (json.pix_expira_em) {
          const ms = new Date(json.pix_expira_em).getTime();
          if (Number.isFinite(ms)) expiraMsRef.current = ms;
        }
        if (typeof json.segundos_restantes === "number") {
          setSegundosRestantes(json.segundos_restantes);
        }

        setStatus(json.status);

        if (
          json.status === "pago" ||
          json.status === "em_separacao" ||
          json.status === "saiu_entrega" ||
          json.status === "entregue"
        ) {
          if (!confirmacaoDisparadaRef.current) {
            confirmacaoDisparadaRef.current = true;
            onPagamentoConfirmadoRef.current();
          }
        }
      } catch {
        // Falha transitória no polling; tentará novamente no próximo ciclo de 4s
      }
    }

    const countdownInterval = setInterval(() => {
      const rest = Math.max(
        0,
        Math.floor((expiraMsRef.current - Date.now()) / 1000),
      );
      setSegundosRestantes(rest);
      if (rest === 0) {
        void consultarStatus();
      }
    }, 1000);

    const pollInterval = setInterval(() => {
      void consultarStatus();
    }, 4000);

    return () => {
      cancelado = true;
      clearInterval(countdownInterval);
      clearInterval(pollInterval);
    };
  }, [pedido.codigo, status]);

  async function handleCopiarPix() {
    try {
      await navigator.clipboard.writeText(pedido.pix_copia_cola);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Fallback silencioso caso o navegador bloqueie clipboard
    }
  }

  const pedidoPago =
    status === "pago" ||
    status === "em_separacao" ||
    status === "saiu_entrega" ||
    status === "entregue";
  const pedidoExpirado = status === "expirado" || status === "cancelado";

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900">
      <div className="mx-auto max-w-lg space-y-5">
        <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
          {pedidoPago ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <div>
                <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  Pedido #{pedido.codigo}
                </span>
                <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-900">
                  Pagamento Pix confirmado!
                </h1>
                <p className="mt-2 text-sm text-zinc-600">
                  Recebemos o pagamento de{" "}
                  <strong>{formatarCentavos(pedido.total_centavos)}</strong>{" "}
                  para <strong>{lojaNome}</strong>. Acompanhe os próximos
                  passos diretamente com a loja.
                </p>
              </div>
              <Link
                href={`/${lojaSlug}`}
                className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-full px-6 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
                style={{
                  backgroundColor: "var(--cor-primaria)",
                  color: "var(--cor-primaria-texto)",
                }}
              >
                Voltar para {lojaNome}
              </Link>
            </div>
          ) : pedidoExpirado ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <AlertCircle className="h-9 w-9" />
              </div>
              <div>
                <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1 font-mono text-xs font-bold text-zinc-700">
                  Pedido #{pedido.codigo}
                </span>
                <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-zinc-900">
                  {status === "cancelado"
                    ? "Pedido cancelado"
                    : "Tempo do Pix expirado"}
                </h1>
                <p className="mt-2 text-sm text-zinc-600">
                  O prazo de 15 minutos encerrou e os itens reservados voltaram ao
                  estoque. Sua sacola foi preservada para você gerar um novo Pix.
                </p>
              </div>
              <button
                type="button"
                onClick={onGerarNovoPix}
                className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-bold shadow-sm transition hover:opacity-95"
                style={{
                  backgroundColor: "var(--cor-primaria)",
                  color: "var(--cor-primaria-texto)",
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Gerar novo Pix
              </button>
              <Link
                href={`/${lojaSlug}`}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-zinc-200 px-6 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Voltar para a vitrine
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-4">
                <div>
                  <span className="font-mono text-xs font-bold text-zinc-500">
                    Pedido #{pedido.codigo}
                  </span>
                  <h1 className="text-xl font-extrabold tracking-tight text-zinc-900">
                    Pague com Pix para confirmar
                  </h1>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold tabular-nums text-amber-800">
                  <Clock className="h-3.5 w-3.5" />
                  Expira em {formatarSegundos(segundosRestantes)}
                </span>
              </div>

              <div className="flex flex-col items-center rounded-2xl border border-zinc-100 bg-zinc-50/80 p-5 text-center">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="QR Code Pix para pagamento do pedido"
                    width={220}
                    height={220}
                    className="h-[220px] w-[220px] rounded-2xl border border-zinc-200 bg-white p-2 shadow-xs"
                  />
                ) : (
                  <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-zinc-200 bg-white text-xs text-zinc-400">
                    Gerando QR Code...
                  </div>
                )}

                <p className="mt-4 text-xs text-zinc-600">
                  Escaneie o QR Code no aplicativo do seu banco ou copie o
                  código abaixo:
                </p>

                <div className="mt-3 w-full">
                  <div className="max-h-20 overflow-y-auto break-all rounded-xl border border-zinc-200 bg-white p-3 text-left font-mono text-[11px] text-zinc-700 select-all">
                    {pedido.pix_copia_cola}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopiarPix}
                    className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-bold shadow-sm transition active:scale-[0.99]"
                    style={{
                      backgroundColor: "var(--cor-primaria)",
                      color: "var(--cor-primaria-texto)",
                    }}
                  >
                    {copiado ? (
                      <>
                        <Check className="h-4 w-4" />
                        Código Pix copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copiar código Pix
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2 rounded-2xl bg-zinc-50 p-4 text-sm">
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-zinc-900">
                    {formatarCentavos(pedido.subtotal_centavos)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-600">
                  <span>Frete</span>
                  <span className="font-semibold text-zinc-900">
                    {pedido.frete_centavos === 0
                      ? "Grátis"
                      : formatarCentavos(pedido.frete_centavos)}
                  </span>
                </div>
                {pedido.taxa_paga_por === "cliente" && (
                  <div className="flex items-center justify-between text-zinc-600">
                    <span>Taxa de serviço</span>
                    <span className="font-semibold text-zinc-900">
                      {formatarCentavos(pedido.taxa_servico_centavos)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-base font-extrabold text-zinc-900">
                  <span>Total a pagar</span>
                  <span>{formatarCentavos(pedido.total_centavos)}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Aguardando confirmação automática do pagamento...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

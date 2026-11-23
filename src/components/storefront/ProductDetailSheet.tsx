"use client";

import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatarCentavos } from "@/lib/money";
import type { ProdutoPublico } from "@/lib/storefront/cart";
import { useCart } from "./CartProvider";
import { StoreImage } from "./StoreImage";

function extrairInicialProduto(nome: string): string {
  return (nome.trim().charAt(0) || "P").toUpperCase();
}

export function ProductDetailSheet({
  produto,
  pedidosDisponiveis = true,
  onClose,
  onAddedToCart,
}: {
  produto: ProdutoPublico | null;
  pedidosDisponiveis?: boolean;
  onClose: () => void;
  onAddedToCart?: () => void;
}) {
  if (!produto) return null;

  return (
    <ProductDetailSheetInner
      key={produto.id}
      produto={produto}
      pedidosDisponiveis={pedidosDisponiveis}
      onClose={onClose}
      onAddedToCart={onAddedToCart}
    />
  );
}

function ProductDetailSheetInner({
  produto,
  pedidosDisponiveis,
  onClose,
  onAddedToCart,
}: {
  produto: ProdutoPublico;
  pedidosDisponiveis: boolean;
  onClose: () => void;
  onAddedToCart?: () => void;
}) {
  const { getQuantidade, incrementar, decrementar, remover } = useCart();
  const qtdAtual = getQuantidade(produto.id);
  const [qtdSelecionada, setQtdSelecionada] = useState(() =>
    qtdAtual > 0 ? Math.min(qtdAtual, Math.max(1, produto.estoque)) : 1,
  );
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{
    y: number;
    time: number;
    fromScrollBody: boolean;
  } | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const esgotado = produto.estoque <= 0;
  const subtotalSelecionado = produto.preco_centavos * qtdSelecionada;

  function handleConfirmar() {
    if (esgotado) return;

    const delta = qtdSelecionada - qtdAtual;
    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        incrementar(produto.id);
      }
      onAddedToCart?.();
    } else if (delta < 0) {
      for (let i = 0; i < Math.abs(delta); i++) {
        decrementar(produto.id);
      }
    }

    onClose();
  }

  function handleRemover() {
    remover(produto.id);
    onClose();
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length !== 1) return;
    const target = e.target as Node;
    const inScrollBody = Boolean(contentScrollRef.current?.contains(target));

    if (
      inScrollBody &&
      contentScrollRef.current &&
      contentScrollRef.current.scrollTop > 2
    ) {
      dragStartRef.current = null;
      return;
    }

    dragStartRef.current = {
      y: e.touches[0].clientY,
      time: Date.now(),
      fromScrollBody: inScrollBody,
    };
  }

  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    const start = dragStartRef.current;
    if (!start || e.touches.length !== 1) return;

    const deltaY = e.touches[0].clientY - start.y;

    if (start.fromScrollBody && deltaY < 0) {
      dragStartRef.current = null;
      setIsDragging(false);
      setDragOffsetY(0);
      return;
    }

    if (deltaY > 4) {
      setIsDragging(true);
      setDragOffsetY(deltaY);
    }
  }

  function handleTouchEnd() {
    const start = dragStartRef.current;
    dragStartRef.current = null;

    if (!start) {
      setIsDragging(false);
      setDragOffsetY(0);
      return;
    }

    const elapsed = Math.max(1, Date.now() - start.time);
    const velocity = dragOffsetY / elapsed;

    if (dragOffsetY >= 90 || (velocity > 0.55 && dragOffsetY >= 36)) {
      setIsDragging(false);
      setDragOffsetY(0);
      onClose();
      return;
    }

    setIsDragging(false);
    setDragOffsetY(0);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={produto.nome}
    >
      <div
        className="store-backdrop-in fixed inset-0 bg-black/50 backdrop-blur-[3px]"
        onClick={onClose}
      />

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="store-sheet-up sm:store-modal-in relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[28px] shadow-2xl sm:grid sm:max-h-[86dvh] sm:max-w-2xl sm:grid-cols-2 sm:rounded-[24px]"
        style={{
          backgroundColor: "var(--store-surface)",
          color: "var(--store-ink)",
          border: "1px solid var(--store-border)",
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
          transition: isDragging
            ? "none"
            : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          aria-hidden="true"
          className="flex min-h-[30px] w-full shrink-0 cursor-grab items-center justify-center sm:hidden"
        >
          <span
            className="h-1.5 w-11 rounded-full"
            style={{ backgroundColor: "var(--store-border-strong)" }}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar detalhes do produto"
          className="absolute right-3.5 top-3.5 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 shadow-sm backdrop-blur transition hover:scale-105"
          style={{
            color: "var(--store-ink)",
            border: "1px solid var(--store-border)",
          }}
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative aspect-[4/3] max-h-[40dvh] w-full shrink-0 overflow-hidden sm:aspect-auto sm:h-full sm:max-h-none">
          <StoreImage
            src={produto.imagem_url}
            alt={produto.nome}
            sizes="(max-width: 639px) 100vw, 336px"
            loading="lazy"
            className={`object-cover ${esgotado ? "grayscale" : ""}`}
            fallback={
              <div
                aria-hidden="true"
                className={`store-font-display flex h-full w-full select-none items-center justify-center ${
                  esgotado ? "grayscale" : ""
                }`}
                style={{
                  backgroundColor: "var(--cor-primaria)",
                  backgroundImage: "var(--store-gradient-placeholder)",
                  color: "var(--cor-primaria-texto)",
                }}
              >
                <span className="text-6xl font-extrabold tracking-tight sm:text-7xl">
                  {extrairInicialProduto(produto.nome)}
                </span>
              </div>
            }
          />

          {esgotado && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[2px]">
              <span
                className="rounded-full px-4 py-2 text-[12px] font-extrabold uppercase tracking-wider shadow-sm"
                style={{
                  backgroundColor: "var(--cor-secundaria)",
                  color: "var(--cor-secundaria-texto)",
                }}
              >
                Esgotado
              </span>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col sm:h-full">
          <div
            ref={contentScrollRef}
            className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7 sm:py-6"
          >
            <div className="flex flex-wrap items-center gap-2 pr-12">
              <span
                className="rounded-full px-3 py-1 text-[13px] font-bold"
                style={{
                  backgroundColor: "var(--store-primary-soft)",
                  color: "var(--store-ink)",
                  border: "1px solid var(--store-primary-ring)",
                }}
              >
                {produto.categoria}
              </span>

              {!esgotado && produto.estoque <= 3 && (
                <span
                  className="rounded-full px-3 py-1 text-[12px] font-bold"
                  style={{
                    backgroundColor: "var(--store-surface-muted)",
                    color: "var(--store-ink-muted)",
                    border: "1px solid var(--store-border)",
                  }}
                >
                  Restam {produto.estoque} un.
                </span>
              )}
            </div>

            <h2
              className="store-font-display mt-3 text-[22px] font-extrabold leading-tight tracking-tight sm:text-2xl"
              style={{ color: "var(--store-ink)" }}
            >
              {produto.nome}
            </h2>

            <p
              className="store-font-display mt-2 text-2xl font-extrabold tracking-tight"
              style={{ color: "var(--store-ink)" }}
            >
              {formatarCentavos(produto.preco_centavos)}
            </p>

            {produto.descricao ? (
              <p
                className="mt-4 text-[14px] leading-relaxed"
                style={{ color: "var(--store-ink-muted)" }}
              >
                {produto.descricao}
              </p>
            ) : (
              <p
                className="mt-4 text-[14px] leading-relaxed"
                style={{ color: "var(--store-ink-soft)" }}
              >
                Produto disponível no catálogo de {produto.categoria}.
              </p>
            )}
          </div>

          <div
            className="shrink-0 space-y-2.5 border-t px-5 pt-3.5 sm:px-7"
            style={{
              backgroundColor: "var(--store-surface)",
              borderColor: "var(--store-border)",
              paddingBottom: "calc(0.875rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {!pedidosDisponiveis ? (
              <button
                type="button"
                disabled
                className="min-h-[48px] w-full cursor-not-allowed rounded-full py-3 text-[14px] font-bold opacity-60"
                style={{
                  backgroundColor: "var(--store-surface-muted)",
                  color: "var(--store-ink-muted)",
                }}
              >
                Loja indisponível para pedidos
              </button>
            ) : esgotado ? (
              <button
                type="button"
                disabled
                className="min-h-[48px] w-full cursor-not-allowed rounded-full py-3 text-[14px] font-bold opacity-60"
                style={{
                  backgroundColor: "var(--store-surface-muted)",
                  color: "var(--store-ink-muted)",
                }}
              >
                Produto esgotado
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <div
                    className="inline-flex shrink-0 items-center gap-1 rounded-full p-1"
                    style={{
                      backgroundColor: "var(--store-surface-muted)",
                      border: "1px solid var(--store-border)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setQtdSelecionada((q) => Math.max(1, q - 1))
                      }
                      disabled={qtdSelecionada <= 1}
                      aria-label="Diminuir quantidade"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-xs transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ color: "var(--store-ink)" }}
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    <span
                      className="min-w-7 text-center text-[14px] font-extrabold"
                      style={{ color: "var(--store-ink)" }}
                    >
                      {qtdSelecionada}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setQtdSelecionada((q) =>
                          Math.min(produto.estoque, q + 1),
                        )
                      }
                      disabled={qtdSelecionada >= produto.estoque}
                      aria-label="Aumentar quantidade"
                      className="flex h-11 w-11 items-center justify-center rounded-full transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        backgroundColor: "var(--cor-primaria)",
                        color: "var(--cor-primaria-texto)",
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmar}
                    className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-[14px] font-bold transition active:scale-[0.98]"
                    style={{
                      backgroundColor: "var(--cor-primaria)",
                      color: "var(--cor-primaria-texto)",
                      boxShadow: "0 12px 26px -10px var(--store-primary-shadow)",
                    }}
                  >
                    <ShoppingBag className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {qtdAtual > 0 ? "Atualizar" : "Adicionar"} ·{" "}
                      {formatarCentavos(subtotalSelecionado)}
                    </span>
                  </button>
                </div>

                {qtdAtual > 0 && (
                  <button
                    type="button"
                    onClick={handleRemover}
                    className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-semibold transition hover:opacity-80"
                    style={{ color: "var(--store-ink-muted)" }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover da sacola
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

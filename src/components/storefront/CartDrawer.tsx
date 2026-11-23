"use client";

import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { formatarCentavos } from "@/lib/money";
import type { BairroPublico, EntregaPublica } from "@/lib/storefront/cart";
import type { LojaPublicaResumo } from "@/lib/storefront/data";
import { useCart } from "./CartProvider";
import { StoreImage } from "./StoreImage";

function extrairInicialProduto(nome: string): string {
  return (nome.trim().charAt(0) || "P").toUpperCase();
}

export function CartDrawer({
  loja,
  entrega,
  bairros,
}: {
  loja: LojaPublicaResumo;
  entrega: EntregaPublica;
  bairros: BairroPublico[];
}) {
  const {
    slug,
    items,
    totalItens,
    subtotalCentavos,
    drawerOpen,
    closeDrawer,
    incrementar,
    decrementar,
    remover,
    limpar,
  } = useCart();

  useEffect(() => {
    if (!drawerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen, closeDrawer]);

  if (!drawerOpen) return null;

  const faltaPedidoMinimo = Math.max(
    0,
    entrega.pedido_minimo_centavos - subtotalCentavos,
  );
  const faltaFreteGratis =
    entrega.aceita_entrega && entrega.frete_gratis_acima_centavos !== null
      ? Math.max(0, entrega.frete_gratis_acima_centavos - subtotalCentavos)
      : null;

  const progressoFrete =
    entrega.aceita_entrega &&
      entrega.frete_gratis_acima_centavos !== null &&
      entrega.frete_gratis_acima_centavos > 0
      ? Math.min(
        100,
        Math.round(
          (subtotalCentavos / entrega.frete_gratis_acima_centavos) * 100,
        ),
      )
      : 0;

  let freteResumoTexto = "Grátis (retirada)";
  let freteValorFixo: number | null = 0;

  if (entrega.aceita_entrega) {
    if (faltaFreteGratis === 0) {
      freteResumoTexto = "Grátis";
      freteValorFixo = 0;
    } else if (entrega.modo_frete === "fixo") {
      freteValorFixo = entrega.frete_fixo_centavos;
      freteResumoTexto =
        entrega.frete_fixo_centavos === 0
          ? "Grátis"
          : formatarCentavos(entrega.frete_fixo_centavos);
    } else if (bairros.length > 0) {
      const minFrete = Math.min(...bairros.map((b) => b.valor_centavos));
      freteResumoTexto = `A partir de ${formatarCentavos(minFrete)}`;
      freteValorFixo = null;
    } else {
      freteResumoTexto = "Por bairro no checkout";
      freteValorFixo = null;
    }
  }

  const totalEstimado =
    freteValorFixo !== null ? subtotalCentavos + freteValorFixo : subtotalCentavos;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Carrinho de compras"
    >
      <div
        className="store-backdrop-in fixed inset-0 bg-black/50 backdrop-blur-[3px]"
        onClick={closeDrawer}
      />

      <div
        className="store-sheet-up sm:store-drawer-in relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[28px] shadow-2xl sm:m-3 sm:h-[calc(100dvh-1.5rem)] sm:max-h-none sm:max-w-md sm:rounded-[28px]"
        style={{
          backgroundColor: "var(--store-surface)",
          color: "var(--store-ink)",
          border: "1px solid var(--store-border)",
        }}
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-3 mb-1 h-1.5 w-11 shrink-0 rounded-full sm:hidden"
          style={{ backgroundColor: "var(--store-border-strong)" }}
        />

        <div
          className="flex items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5 sm:py-4"
          style={{ borderColor: "var(--store-border)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor: "var(--store-primary-soft)",
                color: "var(--cor-primaria)",
              }}
            >
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2
                className="store-font-display truncate text-lg font-extrabold"
                style={{ color: "var(--store-ink)" }}
              >
                Sua sacola
              </h2>
              <p
                className="truncate text-[13px]"
                style={{ color: "var(--store-ink-muted)" }}
              >
                {totalItens} {totalItens === 1 ? "item" : "itens"} em{" "}
                {loja.nome}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {items.length > 0 && (
              <button
                type="button"
                onClick={limpar}
                className="min-h-[44px] rounded-full px-4 text-[13px] font-bold transition hover:opacity-80"
                style={{
                  backgroundColor: "var(--store-surface-muted)",
                  color: "var(--store-ink-muted)",
                }}
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              onClick={closeDrawer}
              aria-label="Fechar sacola"
              className="flex h-11 w-11 items-center justify-center rounded-full transition hover:opacity-80"
              style={{
                backgroundColor: "var(--store-surface-muted)",
                color: "var(--store-ink)",
              }}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {faltaFreteGratis !== null && items.length > 0 && (
            <div
              className="rounded-[20px] p-4"
              style={{
                backgroundColor: "var(--store-primary-soft)",
                border: "1px solid var(--store-primary-ring)",
              }}
            >
              <p
                className="text-[13px] font-semibold"
                style={{ color: "var(--store-ink)" }}
              >
                {faltaFreteGratis === 0
                  ? "Você atingiu o valor para frete grátis na entrega!"
                  : `Faltam ${formatarCentavos(faltaFreteGratis)} para ganhar frete grátis na entrega.`}
              </p>
              <div
                className="mt-2.5 h-2 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--store-surface)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progressoFrete}%`,
                    backgroundColor: "var(--cor-primaria)",
                  }}
                />
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="py-12 text-center">
              <span
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                style={{
                  backgroundColor: "var(--store-surface-muted)",
                  color: "var(--store-ink-soft)",
                }}
              >
                <ShoppingBag className="h-7 w-7" />
              </span>
              <p
                className="mt-3 text-[15px] font-bold"
                style={{ color: "var(--store-ink)" }}
              >
                Sua sacola está vazia
              </p>
              <p
                className="mt-1 text-[13px]"
                style={{ color: "var(--store-ink-muted)" }}
              >
                Adicione itens do catálogo para continuar.
              </p>
            </div>
          ) : (
            <ul
              className="divide-y"
              style={{ borderColor: "var(--store-border)" }}
            >
              {items.map(({ produto, qtd, subtotal_centavos }) => {
                const noLimiteEstoque = qtd >= produto.estoque;
                return (
                  <li
                    key={produto.id}
                    className="flex items-start gap-3 py-3.5"
                    style={{ borderColor: "var(--store-border)" }}
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[16px]">
                      <StoreImage
                        src={produto.imagem_url}
                        alt={produto.nome}
                        sizes="56px"
                        loading="lazy"
                        className="object-cover"
                        fallback={
                          <div
                            aria-hidden="true"
                            className="store-font-display flex h-full w-full items-center justify-center text-lg font-extrabold"
                            style={{
                              backgroundColor: "var(--cor-primaria)",
                              backgroundImage:
                                "var(--store-gradient-placeholder)",
                              color: "var(--cor-primaria-texto)",
                            }}
                          >
                            {extrairInicialProduto(produto.nome)}
                          </div>
                        }
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className="store-font-display truncate text-[14px] font-bold"
                        style={{ color: "var(--store-ink)" }}
                      >
                        {produto.nome}
                      </p>
                      <p
                        className="mt-0.5 text-[13px]"
                        style={{ color: "var(--store-ink-muted)" }}
                      >
                        {formatarCentavos(produto.preco_centavos)} un.
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <div
                          className="inline-flex items-center gap-1 rounded-full p-1"
                          style={{
                            backgroundColor: "var(--store-surface-muted)",
                            border: "1px solid var(--store-border)",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => decrementar(produto.id)}
                            aria-label={`Diminuir ${produto.nome}`}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-xs transition active:scale-90"
                            style={{ color: "var(--store-ink)" }}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span
                            className="min-w-6 text-center text-[14px] font-extrabold"
                            style={{ color: "var(--store-ink)" }}
                          >
                            {qtd}
                          </span>
                          <button
                            type="button"
                            disabled={noLimiteEstoque}
                            onClick={() => incrementar(produto.id)}
                            aria-label={`Aumentar ${produto.nome}`}
                            className="flex h-11 w-11 items-center justify-center rounded-full transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
                            style={{
                              backgroundColor: "var(--cor-primaria)",
                              color: "var(--cor-primaria-texto)",
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        {noLimiteEstoque && (
                          <span
                            className="rounded-full px-3 py-1 text-[12px] font-semibold"
                            style={{
                              backgroundColor: "var(--store-surface-muted)",
                              color: "var(--store-ink-muted)",
                            }}
                          >
                            Máx. estoque
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end justify-between self-stretch">
                      <button
                        type="button"
                        onClick={() => remover(produto.id)}
                        aria-label={`Remover ${produto.nome}`}
                        className="flex h-11 w-11 items-center justify-center rounded-full transition hover:opacity-80"
                        style={{
                          backgroundColor: "var(--store-surface-muted)",
                          color: "var(--store-ink-muted)",
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <span
                        className="store-font-display text-[14px] font-extrabold"
                        style={{ color: "var(--store-ink)" }}
                      >
                        {formatarCentavos(subtotal_centavos)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div
            className="shrink-0 border-t px-4 pt-3.5 sm:px-5"
            style={{
              backgroundColor: "var(--store-surface)",
              borderColor: "var(--store-border)",
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {faltaPedidoMinimo > 0 && (
              <p
                className="mb-3 rounded-[16px] px-3.5 py-2.5 text-[13px] font-semibold"
                style={{
                  backgroundColor: "var(--store-primary-soft)",
                  color: "var(--store-ink)",
                  border: "1px solid var(--store-primary-ring)",
                }}
              >
                Pedido mínimo de{" "}
                {formatarCentavos(entrega.pedido_minimo_centavos)} (faltam{" "}
                {formatarCentavos(faltaPedidoMinimo)}).
              </p>
            )}

            <div
              className="mb-3.5 space-y-2 rounded-[20px] p-4 text-[13px] sm:text-[14px]"
              style={{
                backgroundColor: "var(--store-surface-muted)",
                border: "1px solid var(--store-border)",
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{ color: "var(--store-ink-muted)" }}
              >
                <span>Subtotal dos produtos</span>
                <span
                  className="store-font-display font-bold"
                  style={{ color: "var(--store-ink)" }}
                >
                  {formatarCentavos(subtotalCentavos)}
                </span>
              </div>

              <div
                className="flex items-center justify-between"
                style={{ color: "var(--store-ink-muted)" }}
              >
                <span>Frete estimado</span>
                <span
                  className="font-semibold"
                  style={{ color: "var(--store-ink)" }}
                >
                  {freteResumoTexto}
                </span>
              </div>

              <div
                className="flex items-center justify-between border-t pt-2.5 text-[15px] font-extrabold"
                style={{
                  borderColor: "var(--store-border)",
                  color: "var(--store-ink)",
                }}
              >
                <span>
                  {freteValorFixo !== null ? "Total estimado" : "Subtotal"}
                </span>
                <span className="store-font-display">
                  {formatarCentavos(totalEstimado)}
                </span>
              </div>
            </div>

            {loja.sem_subconta || !loja.pronta_para_pedidos ? (
              <button
                type="button"
                disabled
                className="flex min-h-[48px] w-full cursor-not-allowed items-center justify-center rounded-full py-3 text-center text-[14px] font-bold opacity-60"
                style={{
                  backgroundColor: "var(--store-surface-muted)",
                  color: "var(--store-ink-muted)",
                }}
              >
                Loja indisponível para pedidos
              </button>
            ) : (
              <Link
                href={`/${slug}/checkout`}
                onClick={closeDrawer}
                className="flex min-h-[48px] w-full items-center justify-center rounded-full py-3 text-center text-[14px] font-bold transition active:scale-[0.98]"
                style={{
                  backgroundColor: "var(--cor-primaria)",
                  color: "var(--cor-primaria-texto)",
                  boxShadow: "0 12px 26px -10px var(--store-primary-shadow)",
                }}
              >
                Ir para o checkout
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

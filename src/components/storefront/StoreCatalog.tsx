"use client";

import {
  AlertCircle,
  ChevronRight,
  Plus,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatarCentavos } from "@/lib/money";
import type {
  BairroPublico,
  EntregaPublica,
  ProdutoPublico,
} from "@/lib/storefront/cart";
import type { LojaPublicaResumo } from "@/lib/storefront/data";
import { CartDrawer } from "./CartDrawer";
import { useCart } from "./CartProvider";
import { ProductDetailSheet } from "./ProductDetailSheet";
import { StoreImage } from "./StoreImage";

function extrairInicialProduto(nome: string): string {
  return (nome.trim().charAt(0) || "P").toUpperCase();
}

function resolverEdgeMask(fade: {
  left: boolean;
  right: boolean;
}): string | undefined {
  if (fade.left && fade.right) {
    return "linear-gradient(to right, transparent 0%, black 22px, black calc(100% - 22px), transparent 100%)";
  }
  if (fade.left) {
    return "linear-gradient(to right, transparent 0%, black 22px, black 100%)";
  }
  if (fade.right) {
    return "linear-gradient(to right, black 0%, black calc(100% - 22px), transparent 100%)";
  }
  return undefined;
}

export function StoreCatalog({
  loja,
  entrega,
  produtos,
  bairros,
}: {
  loja: LojaPublicaResumo;
  entrega: EntregaPublica;
  produtos: ProdutoPublico[];
  bairros: BairroPublico[];
}) {
  const {
    totalItens,
    subtotalCentavos,
    getQuantidade,
    incrementar,
    openDrawer,
  } = useCart();

  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("");
  const [produtoSelecionado, setProdutoSelecionado] =
    useState<ProdutoPublico | null>(null);
  const [pulseTick, setPulseTick] = useState(0);
  const [pillsFade, setPillsFade] = useState({ left: false, right: false });

  const stickyBarRef = useRef<HTMLDivElement | null>(null);
  const pillsContainerRef = useRef<HTMLElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollSpyLockedRef = useRef(false);
  const scrollSpyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTotalItensRef = useRef(totalItens);

  const gruposFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = produtos.filter((p) => {
      const cat = p.categoria.trim() || "Geral";
      if (!termo) return true;
      return (
        p.nome.toLowerCase().includes(termo) ||
        (p.descricao ?? "").toLowerCase().includes(termo) ||
        cat.toLowerCase().includes(termo)
      );
    });

    const grupos = new Map<string, ProdutoPublico[]>();
    for (const p of filtrados) {
      const cat = p.categoria.trim() || "Geral";
      const arr = grupos.get(cat) ?? [];
      arr.push(p);
      grupos.set(cat, arr);
    }

    return Array.from(grupos.entries());
  }, [produtos, busca]);

  const categoriasVisiveis = useMemo(
    () => gruposFiltrados.map(([cat]) => cat),
    [gruposFiltrados],
  );

  const categoriaSelecionada =
    categoriasVisiveis.length === 0
      ? ""
      : categoriasVisiveis.includes(categoriaAtiva)
        ? categoriaAtiva
        : categoriasVisiveis[0];

  // Pulso no contador do carrinho ao incrementar itens
  useEffect(() => {
    if (totalItens > prevTotalItensRef.current) {
      setPulseTick((t) => t + 1);
    }
    prevTotalItensRef.current = totalItens;
  }, [totalItens]);

  // Fade nas bordas da barra de pills de categoria
  useEffect(() => {
    const el = pillsContainerRef.current;
    if (!el) return;

    const atualizarFade = () => {
      const left = el.scrollLeft > 4;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setPillsFade((prev) =>
        prev.left === left && prev.right === right ? prev : { left, right },
      );
    };

    atualizarFade();
    el.addEventListener("scroll", atualizarFade, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(atualizarFade)
        : null;
    ro?.observe(el);

    return () => {
      el.removeEventListener("scroll", atualizarFade);
      ro?.disconnect();
    };
  }, [categoriasVisiveis]);

  // Scroll-spy acompanhando a rolagem das seções
  useEffect(() => {
    if (categoriasVisiveis.length === 0) return;

    let rafId = 0;

    const atualizarCategoriaAtiva = () => {
      rafId = 0;
      if (scrollSpyLockedRef.current) return;

      const offset = (stickyBarRef.current?.offsetHeight ?? 124) + 24;
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 24;

      if (nearBottom) {
        const ultima = categoriasVisiveis[categoriasVisiveis.length - 1];
        setCategoriaAtiva((prev) => (prev === ultima ? prev : ultima));
        return;
      }

      let atual = categoriasVisiveis[0];
      for (const cat of categoriasVisiveis) {
        const el = sectionRefs.current[cat];
        if (!el) continue;
        if (el.getBoundingClientRect().top <= offset) {
          atual = cat;
        }
      }

      setCategoriaAtiva((prev) => (prev === atual ? prev : atual));
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(atualizarCategoriaAtiva);
    };

    atualizarCategoriaAtiva();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [categoriasVisiveis]);

  // Mantém a pill ativa visível na barra horizontal
  useEffect(() => {
    if (!categoriaSelecionada) return;
    const pill = pillRefs.current[categoriaSelecionada];
    if (!pill) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    pill.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [categoriaSelecionada]);

  // Reveal sutil dos cards ao rolar (com respeito a prefers-reduced-motion)
  useEffect(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal-card]"),
    );
    if (cards.length === 0) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      for (const card of cards) {
        card.classList.add("is-visible");
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -20px 0px" },
    );

    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (rect.top < window.innerHeight) {
        card.classList.add("is-visible");
      } else {
        observer.observe(card);
      }
    }

    return () => observer.disconnect();
  }, [gruposFiltrados]);

  function handleSelecionarCategoria(cat: string) {
    setCategoriaAtiva(cat);
    const section = sectionRefs.current[cat];
    if (!section) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scrollSpyLockedRef.current = true;
    if (scrollSpyTimerRef.current) {
      clearTimeout(scrollSpyTimerRef.current);
    }
    scrollSpyTimerRef.current = setTimeout(() => {
      scrollSpyLockedRef.current = false;
    }, 650);

    const offset = (stickyBarRef.current?.offsetHeight ?? 124) + 16;
    const targetTop =
      window.scrollY + section.getBoundingClientRect().top - offset;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  const pillsMask = resolverEdgeMask(pillsFade);

  return (
    <>
      <div
        ref={stickyBarRef}
        className="sticky top-0 z-30 mt-3 border-b backdrop-blur-md"
        style={{
          backgroundColor: "color-mix(in srgb, var(--store-bg) 90%, transparent)",
          borderColor: "var(--store-border)",
        }}
      >
        <div className="mx-auto max-w-[1200px] space-y-2 px-3 py-2.5 sm:px-6 sm:py-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: "var(--store-ink-soft)" }}
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar produtos"
              className="min-h-[44px] w-full rounded-full py-2.5 pl-11 pr-12 text-[14px] outline-none transition"
              style={{
                backgroundColor: "var(--store-surface)",
                color: "var(--store-ink)",
                border: "1px solid var(--store-border)",
              }}
            />
            {busca.trim().length > 0 && (
              <button
                type="button"
                onClick={() => setBusca("")}
                aria-label="Limpar busca"
                className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full transition hover:opacity-80"
                style={{ color: "var(--store-ink-muted)" }}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ backgroundColor: "var(--store-surface-muted)" }}
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              </button>
            )}
          </div>

          {categoriasVisiveis.length > 0 && (
            <nav
              ref={pillsContainerRef}
              aria-label="Categorias do catálogo"
              className="no-scrollbar flex flex-nowrap items-center gap-2 overflow-x-auto py-0.5 snap-x snap-mandatory"
              style={
                pillsMask
                  ? {
                    WebkitMaskImage: pillsMask,
                    maskImage: pillsMask,
                  }
                  : undefined
              }
            >
              {categoriasVisiveis.map((cat) => {
                const selecionada = categoriaSelecionada === cat;
                return (
                  <button
                    key={cat}
                    ref={(el) => {
                      pillRefs.current[cat] = el;
                    }}
                    type="button"
                    onClick={() => handleSelecionarCategoria(cat)}
                    className="min-h-[44px] shrink-0 snap-start whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-bold transition sm:text-[14px]"
                    style={
                      selecionada
                        ? {
                          backgroundColor: "var(--cor-primaria)",
                          color: "var(--cor-primaria-texto)",
                          boxShadow:
                            "0 8px 20px -8px var(--store-primary-shadow)",
                        }
                        : {
                          backgroundColor: "var(--store-surface)",
                          color: "var(--store-ink-muted)",
                          border: "1px solid var(--store-border)",
                        }
                    }
                  >
                    {cat}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      </div>

      <main
        className="mx-auto max-w-[1200px] px-3 pt-4 sm:px-6 sm:pt-6"
        style={{
          paddingBottom:
            totalItens > 0
              ? "calc(6.75rem + env(safe-area-inset-bottom, 0px))"
              : "calc(2rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {loja.sem_subconta ? (
          <div
            className="mb-5 flex items-start gap-3 rounded-[20px] px-4 py-3.5 text-[13px] sm:text-[14px]"
            style={{
              backgroundColor: "var(--store-surface)",
              color: "var(--store-ink)",
              border: "1px solid var(--store-border-strong)",
            }}
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: "var(--cor-primaria)" }}
            />
            <p style={{ color: "var(--store-ink-muted)" }}>
              <strong style={{ color: "var(--store-ink)" }}>
                Loja indisponível para pedidos.
              </strong>{" "}
              Esta loja ainda não habilitou o recebimento de pedidos online.
            </p>
          </div>
        ) : !loja.aberta ? (
          <div
            className="mb-5 flex items-start gap-3 rounded-[20px] px-4 py-3.5 text-[13px] sm:text-[14px]"
            style={{
              backgroundColor: "var(--store-surface)",
              color: "var(--store-ink)",
              border: "1px solid var(--store-border-strong)",
            }}
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: "var(--cor-primaria)" }}
            />
            <p style={{ color: "var(--store-ink-muted)" }}>
              <strong style={{ color: "var(--store-ink)" }}>
                Loja fechada no momento.
              </strong>{" "}
              Você pode navegar pelo catálogo e montar sua sacola para quando
              abrirmos.
            </p>
          </div>
        ) : !loja.dentro_do_horario && loja.horario_aviso ? (
          <div
            className="mb-5 flex items-start gap-3 rounded-[20px] px-4 py-3.5 text-[13px] sm:text-[14px]"
            style={{
              backgroundColor: "var(--store-surface)",
              color: "var(--store-ink)",
              border: "1px solid var(--store-border-strong)",
            }}
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ color: "var(--cor-primaria)" }}
            />
            <p style={{ color: "var(--store-ink-muted)" }}>
              <strong style={{ color: "var(--store-ink)" }}>
                Fora do horário de funcionamento.
              </strong>{" "}
              {loja.horario_aviso}
            </p>
          </div>
        ) : null}

        {produtos.length === 0 ? (
          <div
            className="rounded-[24px] p-10 text-center text-[14px]"
            style={{
              backgroundColor: "var(--store-surface)",
              color: "var(--store-ink-muted)",
              border: "1px solid var(--store-border)",
            }}
          >
            Nenhum produto publicado nesta loja ainda.
          </div>
        ) : gruposFiltrados.length === 0 ? (
          <div
            className="rounded-[24px] p-10 text-center text-[14px]"
            style={{
              backgroundColor: "var(--store-surface)",
              color: "var(--store-ink-muted)",
              border: "1px solid var(--store-border)",
            }}
          >
            Nenhum item encontrado para &ldquo;{busca}&rdquo;.
          </div>
        ) : (
          <div className="space-y-8 sm:space-y-10">
            {gruposFiltrados.map(([categoria, itens]) => (
              <section
                key={categoria}
                ref={(el) => {
                  sectionRefs.current[categoria] = el;
                }}
                className="scroll-mt-36"
              >
                <div className="mb-3.5 flex items-center justify-between gap-3">
                  <h2
                    className="store-font-display text-[20px] font-extrabold tracking-tight sm:text-2xl"
                    style={{ color: "var(--store-ink)" }}
                  >
                    {categoria}
                  </h2>
                  <span
                    className="rounded-full px-3 py-1 text-[12px] font-semibold"
                    style={{
                      backgroundColor: "var(--store-surface)",
                      color: "var(--store-ink-muted)",
                      border: "1px solid var(--store-border)",
                    }}
                  >
                    {itens.length} {itens.length === 1 ? "item" : "itens"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 lg:gap-5">
                  {itens.map((produto) => {
                    const esgotado = produto.estoque <= 0;
                    const qtd = getQuantidade(produto.id);
                    const atingiuMax = qtd >= produto.estoque;

                    return (
                      <article
                        key={produto.id}
                        data-reveal-card
                        className={`store-reveal flex flex-col overflow-hidden rounded-[20px] sm:rounded-[22px] ${esgotado ? "opacity-85" : "store-card-hover"
                          }`}
                        style={{
                          backgroundColor: "var(--store-surface)",
                          border: "1px solid var(--store-border)",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setProdutoSelecionado(produto)}
                          className="group flex flex-1 flex-col text-left focus:outline-none"
                        >
                          <div className="relative aspect-[4/5] w-full overflow-hidden">
                            <StoreImage
                              src={produto.imagem_url}
                              alt={produto.nome}
                              sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 285px"
                              loading="lazy"
                              className={`object-cover transition-transform duration-500 motion-reduce:transform-none ${
                                esgotado
                                  ? "grayscale"
                                  : "group-hover:scale-[1.04]"
                              }`}
                              fallback={
                                <div
                                  aria-hidden="true"
                                  className={`store-font-display flex h-full w-full select-none items-center justify-center transition-transform duration-500 motion-reduce:transform-none ${
                                    esgotado
                                      ? "grayscale"
                                      : "group-hover:scale-[1.04]"
                                  }`}
                                  style={{
                                    backgroundColor: "var(--cor-primaria)",
                                    backgroundImage:
                                      "var(--store-gradient-placeholder)",
                                    color: "var(--cor-primaria-texto)",
                                  }}
                                >
                                  <span className="text-5xl font-extrabold tracking-tight sm:text-6xl">
                                    {extrairInicialProduto(produto.nome)}
                                  </span>
                                </div>
                              }
                            />

                            {!esgotado && produto.estoque <= 3 && (
                              <span
                                className="absolute left-2 top-2 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold backdrop-blur-sm"
                                style={{ color: "var(--store-ink)" }}
                              >
                                Restam {produto.estoque} un.
                              </span>
                            )}

                            {!esgotado && qtd > 0 && (
                              <span
                                className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12px] font-extrabold shadow-sm"
                                style={{
                                  backgroundColor: "var(--cor-primaria)",
                                  color: "var(--cor-primaria-texto)",
                                }}
                              >
                                {qtd}
                              </span>
                            )}

                            {esgotado && (
                              <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[2px]">
                                <span
                                  className="rounded-full px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-wider shadow-sm"
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

                          <div className="px-3 pt-3 sm:px-3.5 sm:pt-3.5">
                            <h3
                              className="store-font-display line-clamp-2 text-[14px] font-bold leading-snug sm:text-[15px]"
                              style={{ color: "var(--store-ink)" }}
                            >
                              {produto.nome}
                            </h3>
                          </div>
                        </button>

                        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1.5 sm:px-3.5 sm:pb-3.5">
                          <button
                            type="button"
                            onClick={() => setProdutoSelecionado(produto)}
                            className="flex min-h-[44px] items-center text-left focus:outline-none"
                          >
                            <span
                              className="store-font-display text-[15px] font-extrabold tracking-tight sm:text-[17px]"
                              style={{ color: "var(--store-ink)" }}
                            >
                              {formatarCentavos(produto.preco_centavos)}
                            </span>
                          </button>

                          {esgotado ? (
                            <button
                              type="button"
                              disabled
                              aria-label={`${produto.nome} esgotado`}
                              className="flex h-11 w-11 shrink-0 cursor-not-allowed items-center justify-center rounded-full opacity-35"
                              style={{
                                backgroundColor: "var(--store-surface-muted)",
                                color: "var(--store-ink-muted)",
                              }}
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={atingiuMax || !loja.pronta_para_pedidos}
                              onClick={() => incrementar(produto.id)}
                              aria-label={
                                !loja.pronta_para_pedidos
                                  ? `Pedidos indisponíveis em ${loja.nome}`
                                  : atingiuMax
                                    ? `Limite de estoque atingido para ${produto.nome}`
                                    : `Adicionar ${produto.nome} ao carrinho`
                              }
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 disabled:cursor-not-allowed disabled:opacity-45"
                              style={{
                                backgroundColor: "var(--cor-primaria)",
                                color: "var(--cor-primaria-texto)",
                                boxShadow:
                                  "0 6px 16px -6px var(--store-primary-shadow)",
                              }}
                            >
                              <Plus className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {totalItens > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t px-3 pt-2.5 backdrop-blur-md sm:px-6"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--store-surface) 92%, transparent)",
            borderColor: "var(--store-border)",
            paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="mx-auto max-w-[1200px]">
            <button
              type="button"
              onClick={openDrawer}
              className="flex min-h-[52px] w-full items-center justify-between gap-3 rounded-full px-5 text-[14px] font-bold transition-transform active:scale-[0.99]"
              style={{
                backgroundColor: "var(--cor-primaria)",
                color: "var(--cor-primaria-texto)",
                boxShadow: "0 14px 32px -10px var(--store-primary-shadow)",
              }}
            >
              <span className="flex min-w-0 items-center gap-2.5 truncate">
                <ShoppingBag className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  Ver carrinho ·{" "}
                  <span
                    key={pulseTick}
                    className="store-counter-pulse inline-block"
                  >
                    {totalItens} {totalItens === 1 ? "item" : "itens"}
                  </span>{" "}
                  ·{" "}
                  <span className="store-font-display font-extrabold">
                    {formatarCentavos(subtotalCentavos)}
                  </span>
                </span>
              </span>

              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
      )}

      <ProductDetailSheet
        produto={produtoSelecionado}
        pedidosDisponiveis={loja.pronta_para_pedidos}
        onClose={() => setProdutoSelecionado(null)}
        onAddedToCart={() => setPulseTick((t) => t + 1)}
      />

      <CartDrawer loja={loja} entrega={entrega} bairros={bairros} />
    </>
  );
}

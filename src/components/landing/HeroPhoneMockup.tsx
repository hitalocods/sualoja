"use client";

import { Clock, MapPin, Plus, Search, ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { StoreImage } from "@/components/storefront/StoreImage";
import { formatarCentavos } from "@/lib/money";

export type LojaModeloPreview = {
  slug: string;
  nome: string;
  categoria: string;
  bairro: string;
  cor_primaria: string;
  cor_secundaria: string;
  cor_primaria_texto: string;
  produtos: Array<{
    id: string;
    nome: string;
    preco_centavos: number;
    categoria: string;
    imagem_url: string | null;
  }>;
};

function extrairIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "ML";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function subscribeReducedMotion(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HeroPhoneMockup({
  lojaModelo,
}: {
  lojaModelo: LojaModeloPreview;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => true,
  );

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    let rafId = 0;

    const updateParallax = () => {
      rafId = 0;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const cardCenter = rect.top + rect.height / 2;
      const normalized = (viewportCenter - cardCenter) / window.innerHeight;
      const offset = Math.max(-16, Math.min(18, normalized * 32));
      setScrollOffset(offset);
    };

    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateParallax);
    };

    updateParallax();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [reduceMotion]);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduceMotion || e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rx: Number((-py * 6).toFixed(2)),
      ry: Number((px * 7).toFixed(2)),
    });
  }

  function handlePointerLeave() {
    setTilt({ rx: 0, ry: 0 });
  }

  const categorias = Array.from(
    new Set(lojaModelo.produtos.map((p) => p.categoria).filter(Boolean)),
  ).slice(0, 3);
  const vitrineProdutos = lojaModelo.produtos.slice(0, 4);
  const subtotalExemplo = vitrineProdutos
    .slice(0, 2)
    .reduce((acc, item) => acc + item.preco_centavos, 0);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative mx-auto w-full max-w-[330px] overflow-x-clip sm:max-w-[350px]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[42px] opacity-30 blur-2xl"
        style={{
          background: `radial-gradient(circle at 45% 35%, ${lojaModelo.cor_primaria}, transparent 70%)`,
        }}
      />

      <div
        style={
          reduceMotion
            ? undefined
            : {
                transform: `translate3d(0, ${scrollOffset}px, 0) perspective(1100px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                transition:
                  tilt.rx === 0 && tilt.ry === 0
                    ? "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)"
                    : "transform 120ms ease-out",
              }
        }
        className="relative max-w-full rounded-[42px] border border-white/15 bg-zinc-950 p-2.5 shadow-[0_40px_100px_-24px_rgba(0,0,0,0.9)]"
      >
        <div className="relative overflow-hidden rounded-[34px] bg-[#FAFAFA] text-zinc-950">
          {/* Barra superior simulando navegador mobile */}
          <div className="flex items-center justify-center border-b border-zinc-200/70 bg-white/90 px-4 py-2.5">
            <div className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-[10px] font-semibold text-zinc-600">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: lojaModelo.cor_primaria }}
              />
              <span className="truncate">meudominio.com/{lojaModelo.slug}</span>
            </div>
          </div>

          {/* Banner + Card de identidade */}
          <div className="relative">
            <div
              className="h-20 w-full"
              style={{
                backgroundColor: lojaModelo.cor_primaria,
                backgroundImage: `radial-gradient(circle at 18% 22%, rgba(255,255,255,0.32) 0%, transparent 55%), linear-gradient(135deg, ${lojaModelo.cor_primaria} 0%, ${lojaModelo.cor_secundaria} 100%)`,
              }}
            />

            <div className="px-3">
              <div className="relative -mt-6 rounded-[20px] border border-zinc-200/80 bg-white p-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <div
                    className="-mt-7 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white text-sm font-extrabold shadow-md"
                    style={{
                      backgroundColor: lojaModelo.cor_primaria,
                      color: lojaModelo.cor_primaria_texto,
                    }}
                  >
                    {extrairIniciais(lojaModelo.nome)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-medium text-zinc-500">
                      {lojaModelo.categoria} •{" "}
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="inline h-2.5 w-2.5" />
                        {lojaModelo.bairro}
                      </span>
                    </p>
                    <p className="truncate text-sm font-extrabold tracking-tight text-zinc-950">
                      {lojaModelo.nome}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
                    style={{
                      backgroundColor: lojaModelo.cor_primaria,
                      color: lojaModelo.cor_primaria_texto,
                    }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    Aberta agora
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[9px] font-semibold text-zinc-700">
                    <Clock className="h-2.5 w-2.5" />
                    60 min
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Busca + pills de categoria */}
          <div className="space-y-2 px-3 pt-3">
            <div className="flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white px-3 py-1.5 text-[10px] text-zinc-400">
              <Search className="h-3 w-3" />
              <span>Buscar produtos</span>
            </div>

            <div className="flex gap-1.5 overflow-hidden">
              {(categorias.length > 0
                ? categorias
                : ["Vestuário", "Bolsas", "Acessórios"]
              ).map((cat, idx) => (
                <span
                  key={cat}
                  className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
                  style={
                    idx === 0
                      ? {
                          backgroundColor: lojaModelo.cor_primaria,
                          color: lojaModelo.cor_primaria_texto,
                        }
                      : {
                          backgroundColor: "#ffffff",
                          color: "#52525b",
                          border: "1px solid rgba(24,24,27,0.08)",
                        }
                  }
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>

          {/* Grade 2x2 vertical */}
          <div className="grid grid-cols-2 gap-2.5 px-3 pb-16 pt-3">
            {vitrineProdutos.map((produto) => (
              <div
                key={produto.id}
                className="flex flex-col overflow-hidden rounded-[18px] border border-zinc-200/80 bg-white"
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden">
                  <StoreImage
                    src={produto.imagem_url}
                    alt={produto.nome}
                    sizes="150px"
                    loading="lazy"
                    className="object-cover"
                    fallback={
                      <div
                        className="flex h-full w-full items-center justify-center text-2xl font-extrabold"
                        style={{
                          backgroundColor: lojaModelo.cor_primaria,
                          backgroundImage:
                            "radial-gradient(circle at 22% 18%, rgba(255,255,255,0.28) 0%, transparent 56%)",
                          color: lojaModelo.cor_primaria_texto,
                        }}
                      >
                        {produto.nome.trim().charAt(0).toUpperCase()}
                      </div>
                    }
                  />
                </div>

                <div className="flex flex-1 flex-col justify-between p-2">
                  <p className="line-clamp-1 text-[10px] font-bold text-zinc-900">
                    {produto.nome}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <span className="text-[11px] font-extrabold text-zinc-950">
                      {formatarCentavos(produto.preco_centavos)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="flex h-6 w-6 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: lojaModelo.cor_primaria,
                        color: lojaModelo.cor_primaria_texto,
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Barra flutuante da sacola no preview */}
          <div className="pointer-events-none absolute inset-x-3 bottom-3">
            <div
              className="flex items-center justify-between rounded-full px-3.5 py-2.5 text-[11px] font-bold shadow-lg"
              style={{
                backgroundColor: lojaModelo.cor_primaria,
                color: lojaModelo.cor_primaria_texto,
              }}
            >
              <span className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-extrabold">
                  2
                </span>
                <span>Ver sacola</span>
              </span>
              <span className="flex items-center gap-1 font-extrabold">
                {formatarCentavos(subtotalExemplo)}
                <ShoppingBag className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

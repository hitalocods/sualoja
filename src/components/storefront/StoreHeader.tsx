"use client";

import { Clock, MapPin, ShoppingBag, Sparkles, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatarCentavos } from "@/lib/money";
import type { BairroPublico, EntregaPublica } from "@/lib/storefront/cart";
import type { LojaPublicaResumo } from "@/lib/storefront/data";
import type { TemaResolvido } from "@/lib/storefront/theme";
import { StoreImage } from "./StoreImage";

function extrairIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "ML";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function resolverEdgeMask(fade: {
  left: boolean;
  right: boolean;
}): string | undefined {
  if (fade.left && fade.right) {
    return "linear-gradient(to right, transparent 0%, black 20px, black calc(100% - 20px), transparent 100%)";
  }
  if (fade.left) {
    return "linear-gradient(to right, transparent 0%, black 20px, black 100%)";
  }
  if (fade.right) {
    return "linear-gradient(to right, black 0%, black calc(100% - 20px), transparent 100%)";
  }
  return undefined;
}

export function StoreHeader({
  loja,
  tema,
  entrega,
  bairros,
}: {
  loja: LojaPublicaResumo;
  tema: TemaResolvido;
  entrega: EntregaPublica;
  bairros: BairroPublico[];
}) {
  const chipsScrollRef = useRef<HTMLDivElement | null>(null);
  const [chipsFade, setChipsFade] = useState({ left: false, right: false });

  useEffect(() => {
    const el = chipsScrollRef.current;
    if (!el) return;

    const atualizarFade = () => {
      const left = el.scrollLeft > 4;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
      setChipsFade((prev) =>
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
  }, [loja.aberta, entrega, bairros.length]);

  let textoFrete = "Somente retirada";
  if (entrega.aceita_entrega) {
    if (entrega.modo_frete === "bairro") {
      textoFrete =
        bairros.length > 0
          ? `Entrega em ${bairros.length} bairros`
          : "Entrega por bairro";
    } else if (entrega.frete_fixo_centavos === 0) {
      textoFrete = "Entrega grátis";
    } else {
      textoFrete = `Entrega ${formatarCentavos(entrega.frete_fixo_centavos)}`;
    }
  }

  const maskStyle = resolverEdgeMask(chipsFade);

  return (
    <header className="relative">
      <div className="relative h-[120px] w-full overflow-hidden md:h-[220px]">
        <StoreImage
          src={tema.banner_url}
          alt={`Banner de ${loja.nome}`}
          sizes="100vw"
          loading="eager"
          className="object-cover"
          fallback={
            <div
              className="h-full w-full"
              style={{
                backgroundColor: "var(--cor-primaria)",
                backgroundImage: "var(--store-gradient-banner)",
              }}
            />
          }
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent"
        />
      </div>

      <div className="mx-auto max-w-[1200px] px-3 sm:px-6">
        <div
          className="relative -mt-7 rounded-[22px] p-4 shadow-[0_14px_34px_-22px_rgba(17,24,39,0.22)] sm:-mt-9 sm:rounded-[24px] sm:p-5"
          style={{
            backgroundColor: "var(--store-surface)",
            border: "1px solid var(--store-border)",
          }}
        >
          <div className="flex items-center gap-3.5">
            <div className="relative -mt-10 h-16 w-16 shrink-0 overflow-hidden rounded-full border-[3px] border-white bg-white shadow-md sm:-mt-11 sm:border-4">
              <StoreImage
                src={tema.logo_url}
                alt={`Logo de ${loja.nome}`}
                sizes="64px"
                loading="eager"
                className="object-cover"
                fallback={
                  <div
                    className="store-font-display flex h-full w-full items-center justify-center text-xl font-extrabold tracking-tight"
                    style={{
                      backgroundColor: "var(--cor-primaria)",
                      backgroundImage: "var(--store-gradient-placeholder)",
                      color: "var(--cor-primaria-texto)",
                    }}
                  >
                    {extrairIniciais(loja.nome)}
                  </div>
                }
              />
            </div>

            <div className="min-w-0 flex-1">
              <h1
                className="store-font-display truncate text-[22px] font-extrabold leading-tight tracking-tight sm:text-[24px]"
                style={{ color: "var(--store-ink)" }}
              >
                {loja.nome}
              </h1>

              <p
                className="mt-0.5 flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-medium"
                style={{ color: "var(--store-ink-muted)" }}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {loja.categoria} · {loja.bairro}, Teresina-PI
                </span>
              </p>
            </div>
          </div>

          <div
            ref={chipsScrollRef}
            className="no-scrollbar -mx-4 mt-3.5 flex flex-nowrap items-center gap-2 overflow-x-auto px-4 snap-x snap-mandatory sm:-mx-5 sm:px-5"
            style={
              maskStyle
                ? {
                    WebkitMaskImage: maskStyle,
                    maskImage: maskStyle,
                  }
                : undefined
            }
          >
            <span
              className="inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-bold shadow-xs"
              style={
                loja.aberta
                  ? {
                      backgroundColor: "var(--cor-primaria)",
                      color: "var(--cor-primaria-texto)",
                    }
                  : {
                      backgroundColor: "var(--store-surface-muted)",
                      color: "var(--store-ink-muted)",
                      border: "1px solid var(--store-border)",
                    }
              }
            >
              <span
                className={`h-2 w-2 rounded-full bg-current ${
                  loja.aberta ? "motion-safe:animate-pulse" : "opacity-60"
                }`}
              />
              {loja.aberta ? "Aberta agora" : "Fechada"}
            </span>

            <span
              className="inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold"
              style={{
                backgroundColor: "var(--store-surface-muted)",
                color: "var(--store-ink)",
                border: "1px solid var(--store-border)",
              }}
            >
              <Clock className="h-3.5 w-3.5 opacity-70" />
              {entrega.tempo_estimado_min} min
            </span>

            <span
              className="inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold"
              style={{
                backgroundColor: "var(--store-surface-muted)",
                color: "var(--store-ink)",
                border: "1px solid var(--store-border)",
              }}
            >
              <ShoppingBag className="h-3.5 w-3.5 opacity-70" />
              {entrega.pedido_minimo_centavos > 0
                ? `Mín. ${formatarCentavos(entrega.pedido_minimo_centavos)}`
                : "Sem pedido mínimo"}
            </span>

            <span
              className="inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-semibold"
              style={{
                backgroundColor: "var(--store-surface-muted)",
                color: "var(--store-ink)",
                border: "1px solid var(--store-border)",
              }}
            >
              <Truck className="h-3.5 w-3.5 opacity-70" />
              {textoFrete}
            </span>

            {entrega.aceita_entrega &&
              entrega.frete_gratis_acima_centavos !== null && (
                <span
                  className="inline-flex shrink-0 snap-start items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-bold"
                  style={{
                    backgroundColor: "var(--store-primary-soft)",
                    color: "var(--store-ink)",
                    border: "1px solid var(--store-primary-ring)",
                  }}
                >
                  <Sparkles
                    className="h-3.5 w-3.5"
                    style={{ color: "var(--cor-primaria)" }}
                  />
                  Frete grátis acima de{" "}
                  {formatarCentavos(entrega.frete_gratis_acima_centavos)}
                </span>
              )}
          </div>
        </div>
      </div>
    </header>
  );
}

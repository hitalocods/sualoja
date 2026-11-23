"use client";

import { ExternalLink, Menu, Store, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { PAINEL_NAV_ITEMS, PainelNav } from "./PainelNav";

interface PainelHeaderProps {
  lojaNome: string;
  lojaSlug: string;
  impersonando: boolean;
}

export function PainelHeader({
  lojaNome,
  lojaSlug,
  impersonando,
}: PainelHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <header
        className={`sticky ${impersonando ? "top-[48px] sm:top-[44px]" : "top-0"} z-30 border-b border-zinc-200 bg-white/95 backdrop-blur`}
      >
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex items-center justify-between gap-2 py-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label="Abrir menu"
                aria-expanded={menuOpen}
                aria-controls="painel-mobile-drawer"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-800 transition hover:bg-zinc-100 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                <Store className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold leading-tight text-zinc-950">
                  {lojaNome}
                </p>
                <p className="truncate text-xs text-zinc-500">/{lojaSlug}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/${lojaSlug}`}
                target="_blank"
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
              >
                <span className="hidden sm:inline">Ver vitrine</span>
                <span className="sm:hidden">Loja</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <LogoutButton className="hidden md:inline-flex" />
            </div>
          </div>

          <PainelNav />
        </div>
      </header>

      {menuOpen && (
        <div
          id="painel-mobile-drawer"
          className="fixed inset-0 z-[60] flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu do painel"
        >
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMenuOpen(false)}
          />

          <div className="relative z-10 flex h-[100dvh] w-72 max-w-[84vw] flex-col justify-between border-r border-zinc-200 bg-white p-4 shadow-2xl">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
                    <Store className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold leading-tight text-zinc-950">
                      {lojaNome}
                    </p>
                    <p className="truncate text-xs text-zinc-500">/{lojaSlug}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Fechar menu"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav
                aria-label="Navegação mobile do painel"
                className="flex-1 space-y-1.5 overflow-y-auto"
              >
                {PAINEL_NAV_ITEMS.map((item) => {
                  const ativo = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex min-h-[44px] items-center gap-3 rounded-2xl px-3.5 text-sm font-bold transition ${
                        ativo
                          ? "bg-zinc-950 text-white shadow-xs"
                          : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="space-y-2 border-t border-zinc-200 pt-4">
              <Link
                href={`/${lojaSlug}`}
                target="_blank"
                onClick={() => setMenuOpen(false)}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
              >
                <span>Ver vitrine</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <LogoutButton className="w-full min-h-[44px] justify-center" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

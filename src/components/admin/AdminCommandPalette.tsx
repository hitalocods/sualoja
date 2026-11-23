"use client";

import {
  ArrowRight,
  CreditCard,
  LayoutDashboard,
  Search,
  Settings,
  Store,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CommandPaletteStoreItem } from "@/lib/admin/metrics";

interface CommandItem {
  id: string;
  grupo: "Telas" | "Lojas";
  titulo: string;
  subtitulo: string;
  href: string;
  cor?: string;
  logoUrl?: string | null;
  statusBadge?: string;
}

const TELAS: CommandItem[] = [
  {
    id: "tela-dashboard",
    grupo: "Telas",
    titulo: "Dashboard (Visão geral)",
    subtitulo: "KPIs, gráficos de faturamento e aprovações pendentes",
    href: "/admin",
  },
  {
    id: "tela-lojas",
    grupo: "Telas",
    titulo: "Lojas",
    subtitulo: "Gerenciar cadastros, aprovações, planos e suporte",
    href: "/admin/lojas",
  },
  {
    id: "tela-planos",
    grupo: "Telas",
    titulo: "Planos e tarifas",
    subtitulo: "Editar planos exibidos na landing e cadastro",
    href: "/admin/planos",
  },
  {
    id: "tela-usuarios",
    grupo: "Telas",
    titulo: "Usuários",
    subtitulo: "Contas, redefinição de senha e bloqueios",
    href: "/admin/usuarios",
  },
  {
    id: "tela-configuracoes",
    grupo: "Telas",
    titulo: "Configurações da plataforma",
    subtitulo: "Geral, trial, slugs reservados e auditoria",
    href: "/admin/configuracoes",
  },
];

function renderTelaIcon(id: string) {
  switch (id) {
    case "tela-dashboard":
      return <LayoutDashboard className="h-4 w-4" />;
    case "tela-lojas":
      return <Store className="h-4 w-4" />;
    case "tela-planos":
      return <CreditCard className="h-4 w-4" />;
    case "tela-usuarios":
      return <Users className="h-4 w-4" />;
    default:
      return <Settings className="h-4 w-4" />;
  }
}

export function AdminCommandPalette({
  open,
  onClose,
  stores,
  querySuffix,
}: {
  open: boolean;
  onClose: () => void;
  stores: CommandPaletteStoreItem[];
  querySuffix: string;
}) {
  if (!open) return null;
  return (
    <AdminCommandPaletteInner
      onClose={onClose}
      stores={stores}
      querySuffix={querySuffix}
    />
  );
}

function AdminCommandPaletteInner({
  onClose,
  stores,
  querySuffix,
}: {
  onClose: () => void;
  stores: CommandPaletteStoreItem[];
  querySuffix: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, []);

  const resultados = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();

    const lojasItems: CommandItem[] = stores.map((s) => ({
      id: `loja-${s.id}`,
      grupo: "Lojas",
      titulo: s.nome,
      subtitulo: `/${s.slug}`,
      href: `/admin/lojas?loja=${s.id}`,
      cor: s.corPrimaria,
      logoUrl: s.logoUrl,
      statusBadge: s.status,
    }));

    const todos = [...TELAS, ...lojasItems];
    if (!q) return [...TELAS, ...lojasItems.slice(0, 6)];

    return todos
      .filter(
        (item) =>
          item.titulo.toLowerCase().includes(q) ||
          item.subtitulo.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [query, stores]);

  function navegar(item: CommandItem) {
    onClose();
    let dest = item.href;
    if (querySuffix) {
      const cleanSuffix = querySuffix.startsWith("?")
        ? querySuffix.slice(1)
        : querySuffix;
      if (cleanSuffix) {
        dest += dest.includes("?") ? `&${cleanSuffix}` : `?${cleanSuffix}`;
      }
    }
    router.push(dest);
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) =>
          resultados.length > 0 ? (prev + 1) % resultados.length : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          resultados.length > 0
            ? (prev - 1 + resultados.length) % resultados.length
            : 0,
        );
      } else if (e.key === "Enter" && resultados[activeIndex]) {
        e.preventDefault();
        navegar(resultados[activeIndex]);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const telas = resultados.filter((r) => r.grupo === "Telas");
  const lojasFiltradas = resultados.filter((r) => r.grupo === "Lojas");

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 px-4 pt-16 backdrop-blur-xs sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-3xl border shadow-2xl"
        style={{
          backgroundColor: "var(--admin-surface)",
          borderColor: "var(--admin-border-strong)",
          color: "var(--admin-text)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center gap-3 border-b px-4 py-3.5"
          style={{ borderColor: "var(--admin-border)" }}
        >
          <Search
            className="h-4 w-4 shrink-0"
            style={{ color: "var(--admin-text-muted)" }}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Buscar loja por nome, /slug ou ir para uma tela..."
            className="min-h-[36px] flex-1 bg-transparent text-sm outline-none placeholder:opacity-60"
            style={{ color: "var(--admin-text)" }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar busca"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl transition hover:opacity-80"
            style={{
              backgroundColor: "var(--admin-surface-2)",
              color: "var(--admin-text-muted)",
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-2.5">
          {resultados.length === 0 ? (
            <p
              className="py-10 text-center text-sm"
              style={{ color: "var(--admin-text-muted)" }}
            >
              Nenhum resultado para &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <div className="space-y-3">
              {telas.length > 0 && (
                <div>
                  <p
                    className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--admin-text-subtle)" }}
                  >
                    Telas
                  </p>
                  <div className="space-y-1">
                    {telas.map((item) => {
                      const idx = resultados.indexOf(item);
                      const isActive = idx === activeIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => navegar(item)}
                          className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition"
                          style={{
                            backgroundColor: isActive
                              ? "var(--admin-accent-soft)"
                              : "transparent",
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                              style={{
                                backgroundColor: "var(--admin-surface-2)",
                                color: isActive
                                  ? "var(--admin-accent)"
                                  : "var(--admin-text-muted)",
                              }}
                            >
                              {renderTelaIcon(item.id)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {item.titulo}
                              </p>
                              <p
                                className="truncate text-xs"
                                style={{ color: "var(--admin-text-muted)" }}
                              >
                                {item.subtitulo}
                              </p>
                            </div>
                          </div>
                          <ArrowRight
                            className="h-4 w-4 shrink-0"
                            style={{ color: "var(--admin-text-subtle)" }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {lojasFiltradas.length > 0 && (
                <div>
                  <p
                    className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--admin-text-subtle)" }}
                  >
                    Lojas
                  </p>
                  <div className="space-y-1">
                    {lojasFiltradas.map((item) => {
                      const idx = resultados.indexOf(item);
                      const isActive = idx === activeIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => navegar(item)}
                          className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition"
                          style={{
                            backgroundColor: isActive
                              ? "var(--admin-accent-soft)"
                              : "transparent",
                          }}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xs font-extrabold text-white"
                              style={{
                                backgroundColor: item.cor ?? "#EA1D2C",
                              }}
                            >
                              {item.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.logoUrl}
                                  alt={item.titulo}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                item.titulo.slice(0, 2).toUpperCase()
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {item.titulo}
                              </p>
                              <p
                                className="truncate font-mono text-xs"
                                style={{ color: "var(--admin-text-muted)" }}
                              >
                                {item.subtitulo}
                              </p>
                            </div>
                          </div>
                          {item.statusBadge && (
                            <span
                              className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize"
                              style={{
                                backgroundColor: "var(--admin-surface-2)",
                                color: "var(--admin-text-muted)",
                              }}
                            >
                              {item.statusBadge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between border-t px-4 py-2 text-[11px]"
          style={{
            borderColor: "var(--admin-border)",
            color: "var(--admin-text-subtle)",
          }}
        >
          <span>Use ↑ ↓ para navegar e Enter para abrir</span>
          <span>ESC para fechar</span>
        </div>
      </div>
    </div>
  );
}

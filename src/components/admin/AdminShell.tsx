"use client";

import {
  CreditCard,
  Database,
  ExternalLink,
  Eye,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Sun,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { sairImpersonacaoAction } from "@/app/admin/actions";
import type { CommandPaletteStoreItem } from "@/lib/admin/metrics";
import type { ImpersonationInfo } from "@/lib/auth/session";
import { AdminCommandPalette } from "./AdminCommandPalette";

const NAV_ITEMS = [
  { href: "/admin", label: "Visão geral", shortLabel: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/lojas", label: "Lojas", shortLabel: "Lojas", icon: Store, exact: false },
  { href: "/admin/planos", label: "Planos", shortLabel: "Planos", icon: CreditCard, exact: false },
  { href: "/admin/usuarios", label: "Usuários", shortLabel: "Usuários", icon: Users, exact: false },
  {
    href: "/admin/configuracoes",
    label: "Configurações",
    shortLabel: "Config.",
    icon: Settings,
    exact: false,
  },
];

const BOTTOM_ITEMS = NAV_ITEMS.slice(0, 4);
const PERIODOS = ["7", "30", "90"] as const;

interface AdminShellProps {
  nomePlataforma: string;
  adminNome: string;
  adminEmail: string;
  impersonando: ImpersonationInfo | null;
  initialTheme: "dark" | "light";
  isProduction: boolean;
  commandStores: CommandPaletteStoreItem[];
  children: React.ReactNode;
}

function subscribeSidebarCollapse(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("ml-admin-sidebar-toggle", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("ml-admin-sidebar-toggle", cb);
  };
}

function getSidebarCollapseSnapshot(): boolean {
  try {
    return localStorage.getItem("ml_admin_sidebar_collapsed") === "true";
  } catch {
    return false;
  }
}

function AdminShellInner({
  nomePlataforma,
  adminNome,
  adminEmail,
  impersonando,
  initialTheme,
  isProduction,
  commandStores,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [theme, setTheme] = useState<"dark" | "light">(initialTheme);
  const collapsed = useSyncExternalStore(
    subscribeSidebarCollapse,
    getSidebarCollapseSnapshot,
    () => false,
  );
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [endingImpersonation, startImpersonationTransition] = useTransition();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem("ml_admin_theme", next);
      document.cookie = `ml_admin_theme=${next}; path=/; max-age=31536000; samesite=lax`;
    } catch {
      // noop
    }
  }

  function toggleCollapsed() {
    const next = !collapsed;
    try {
      localStorage.setItem("ml_admin_sidebar_collapsed", String(next));
      window.dispatchEvent(new Event("ml-admin-sidebar-toggle"));
    } catch {
      // noop
    }
  }

  const periodoAtual =
    searchParams.get("periodo") === "7"
      ? "7"
      : searchParams.get("periodo") === "90"
        ? "90"
        : "30";

  const demoParam = searchParams.get("demo");
  const includeDemo = isProduction
    ? false
    : demoParam !== "0" && demoParam !== "false";

  function buildPreservedSuffix(opts?: { periodo?: string; demo?: string }) {
    const next = new URLSearchParams();
    const p = opts?.periodo ?? searchParams.get("periodo");
    const d = opts?.demo ?? searchParams.get("demo");
    if (p === "7" || p === "30" || p === "90") {
      next.set("periodo", p);
    }
    if (!isProduction && (d === "0" || d === "1")) {
      next.set("demo", d);
    }
    const qs = next.toString();
    return qs ? `?${qs}` : "";
  }

  function handleSelectPeriodo(dias: string) {
    const targetBase = "/admin";
    const next = new URLSearchParams(
      pathname === "/admin" ? searchParams.toString() : "",
    );
    next.set("periodo", dias);
    if (!isProduction && demoParam) {
      next.set("demo", demoParam);
    }
    router.push(`${targetBase}?${next.toString()}`);
  }

  function handleToggleDemo() {
    if (isProduction) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("demo", includeDemo ? "0" : "1");
    router.push(`${pathname}?${next.toString()}`);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  function handleEncerrarImpersonacao() {
    startImpersonationTransition(async () => {
      const res = await sairImpersonacaoAction();
      if (res.ok) {
        router.refresh();
      }
    });
  }

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const initials = adminNome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("") || "AD";

  const demoOnlySuffix =
    !isProduction && demoParam ? `?demo=${demoParam}` : "";

  return (
    <div
      data-theme={theme}
      className="admin-app min-h-[100dvh] w-full transition-colors duration-200"
    >
      <div className="flex min-h-[100dvh]">
        {/* Sidebar Fixa & Colapsável Desktop */}
        <aside
          className={`hidden md:sticky md:top-0 md:flex md:h-[100dvh] md:shrink-0 md:flex-col md:border-r md:transition-[width] md:duration-200 ${
            collapsed ? "md:w-[78px]" : "md:w-64"
          }`}
          style={{
            backgroundColor: "var(--admin-surface)",
            borderColor: "var(--admin-border)",
          }}
        >
          {/* Marca + Collapse */}
          <div
            className={`flex items-center border-b px-4 py-4 ${
              collapsed ? "justify-center" : "justify-between"
            }`}
            style={{ borderColor: "var(--admin-border)" }}
          >
            {!collapsed && (
              <Link
                href={`/admin${demoOnlySuffix}`}
                className="flex min-w-0 items-center gap-2.5"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                  style={{ backgroundColor: "var(--admin-accent-strong)" }}
                >
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold leading-tight">
                    {nomePlataforma}
                  </p>
                  <p
                    className="text-[11px] font-medium"
                    style={{ color: "var(--admin-text-subtle)" }}
                  >
                    Admin Console
                  </p>
                </div>
              </Link>
            )}
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
              title={collapsed ? "Expandir menu" : "Recolher menu"}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl transition hover:opacity-85"
              style={{
                backgroundColor: "var(--admin-surface-2)",
                color: "var(--admin-text-muted)",
              }}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Navegação Principal */}
          <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              const suffix = item.href === "/admin" ? buildPreservedSuffix() : demoOnlySuffix;
              return (
                <Link
                  key={item.href}
                  href={`${item.href}${suffix}`}
                  title={collapsed ? item.label : undefined}
                  className={`flex min-h-[44px] items-center rounded-2xl text-sm font-semibold transition ${
                    collapsed ? "justify-center px-2" : "gap-3 px-3.5"
                  }`}
                  style={{
                    backgroundColor: active
                      ? "var(--admin-accent-soft)"
                      : "transparent",
                    color: active ? "var(--admin-text)" : "var(--admin-text-muted)",
                    border: active
                      ? "1px solid var(--admin-border-strong)"
                      : "1px solid transparent",
                  }}
                >
                  <Icon
                    className="h-4 w-4 shrink-0"
                    style={{
                      color: active
                        ? "var(--admin-accent)"
                        : "var(--admin-text-muted)",
                    }}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Seção inferior usuário + sair */}
          <div
            className="border-t p-3"
            style={{ borderColor: "var(--admin-border)" }}
          >
            <div
              className={`flex items-center rounded-2xl p-2 ${
                collapsed ? "justify-center" : "gap-2.5"
              }`}
              style={{ backgroundColor: "var(--admin-surface-2)" }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold text-white"
                style={{ backgroundColor: "var(--admin-accent-strong)" }}
              >
                {initials}
              </span>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{adminNome}</p>
                  <p
                    className="truncate text-[11px]"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    {adminEmail}
                  </p>
                </div>
              )}
            </div>

            <div
              className={`mt-2 flex items-center gap-1.5 ${
                collapsed ? "flex-col" : "justify-between"
              }`}
            >
              {!collapsed && (
                <Link
                  href="/"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition hover:opacity-80"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Vitrine
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                title="Sair da conta"
                className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition hover:opacity-85 disabled:opacity-60 ${
                  collapsed ? "w-full" : ""
                }`}
                style={{
                  backgroundColor: "var(--admin-surface-2)",
                  border: "1px solid var(--admin-border)",
                  color: "var(--admin-text-muted)",
                }}
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                {!collapsed && <span>{loggingOut ? "Saindo..." : "Sair"}</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* Coluna Direita: Topbar + Conteúdo */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar Sticky */}
          <header
            className="sticky top-0 z-20 border-b backdrop-blur-md"
            style={{
              backgroundColor: "var(--admin-surface-glass)",
              borderColor: "var(--admin-border)",
            }}
          >
            <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6">
              {/* Mobile hamburger + Busca Global */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(true)}
                  aria-label="Abrir menu"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border md:hidden"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text)",
                  }}
                >
                  <Menu className="h-5 w-5" />
                </button>

                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  className="flex min-h-[42px] w-full max-w-md items-center justify-between gap-2 rounded-2xl border px-3 text-left text-xs transition sm:px-3.5 sm:text-sm"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text-muted)",
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Search className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      Buscar loja ou ir para tela...
                    </span>
                  </span>
                  <kbd
                    className="hidden shrink-0 rounded-lg border px-1.5 py-0.5 font-mono text-[11px] font-semibold sm:inline-block"
                    style={{
                      backgroundColor: "var(--admin-surface)",
                      borderColor: "var(--admin-border)",
                      color: "var(--admin-text-subtle)",
                    }}
                  >
                    Ctrl K
                  </kbd>
                </button>
              </div>

              {/* Ações Topbar: Período, Demo Toggle, Tema, Avatar */}
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {/* Seletor de Período */}
                <div
                  className="hidden items-center rounded-2xl border p-0.5 sm:flex"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                  }}
                  role="group"
                  aria-label="Período do dashboard"
                >
                  {PERIODOS.map((p) => {
                    const active = periodoAtual === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handleSelectPeriodo(p)}
                        className="min-h-[34px] rounded-xl px-2.5 text-xs font-bold transition"
                        style={{
                          backgroundColor: active
                            ? "var(--admin-accent-strong)"
                            : "transparent",
                          color: active ? "#ffffff" : "var(--admin-text-muted)",
                        }}
                      >
                        {p}d
                      </button>
                    );
                  })}
                </div>

                {/* Toggle Dados Demo (somente fora de produção) */}
                {!isProduction && (
                  <button
                    type="button"
                    onClick={handleToggleDemo}
                    title="Incluir ou ocultar pedidos de demonstração nas métricas"
                    className="hidden min-h-[38px] items-center gap-1.5 rounded-2xl border px-3 text-xs font-semibold transition lg:inline-flex"
                    style={{
                      backgroundColor: includeDemo
                        ? "var(--admin-info-soft)"
                        : "var(--admin-surface-2)",
                      borderColor: includeDemo
                        ? "var(--admin-info)"
                        : "var(--admin-border)",
                      color: includeDemo
                        ? "var(--admin-info)"
                        : "var(--admin-text-muted)",
                    }}
                  >
                    <Database className="h-3.5 w-3.5" />
                    <span>{includeDemo ? "Demo ON" : "Demo OFF"}</span>
                  </button>
                )}

                {/* Toggle Tema Claro/Escuro */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={
                    theme === "dark"
                      ? "Mudar para tema claro"
                      : "Mudar para tema escuro"
                  }
                  title={theme === "dark" ? "Tema claro" : "Tema escuro"}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition hover:opacity-85"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text)",
                  }}
                >
                  {theme === "dark" ? (
                    <Sun className="h-4 w-4" />
                  ) : (
                    <Moon className="h-4 w-4" />
                  )}
                </button>

                {/* Avatar */}
                <div
                  title={`${adminNome} (${adminEmail})`}
                  className="hidden h-10 w-10 items-center justify-center rounded-2xl text-xs font-extrabold text-white sm:flex"
                  style={{ backgroundColor: "var(--admin-accent-strong)" }}
                >
                  {initials}
                </div>
              </div>
            </div>

            {/* Faixa compacta mobile: seletor de período + toggle demo */}
            <div
              className="flex items-center justify-between gap-2 border-t px-3 py-1.5 sm:hidden"
              style={{ borderColor: "var(--admin-border)" }}
            >
              <div className="flex items-center gap-1">
                {PERIODOS.map((p) => {
                  const active = periodoAtual === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleSelectPeriodo(p)}
                      className="min-h-[30px] rounded-xl px-2.5 text-xs font-bold"
                      style={{
                        backgroundColor: active
                          ? "var(--admin-accent-strong)"
                          : "var(--admin-surface-2)",
                        color: active ? "#ffffff" : "var(--admin-text-muted)",
                      }}
                    >
                      {p} dias
                    </button>
                  );
                })}
              </div>

              {!isProduction && (
                <button
                  type="button"
                  onClick={handleToggleDemo}
                  className="inline-flex min-h-[30px] items-center gap-1 rounded-xl px-2.5 text-[11px] font-semibold"
                  style={{
                    backgroundColor: includeDemo
                      ? "var(--admin-info-soft)"
                      : "var(--admin-surface-2)",
                    color: includeDemo
                      ? "var(--admin-info)"
                      : "var(--admin-text-muted)",
                  }}
                >
                  <Database className="h-3 w-3" />
                  {includeDemo ? "Demo ON" : "Demo OFF"}
                </button>
              )}
            </div>
          </header>

          {/* Conteúdo */}
          <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-5 px-3 py-4 pb-24 sm:px-6 sm:py-6 md:pb-10">
            {impersonando && (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm"
                style={{
                  backgroundColor: "var(--admin-warning-soft)",
                  borderColor: "var(--admin-warning)",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <Eye
                    className="h-4 w-4 shrink-0"
                    style={{ color: "var(--admin-warning)" }}
                  />
                  <span>
                    Sessão de suporte ativa para{" "}
                    <strong>{impersonando.lojaNome}</strong> (/
                    {impersonando.lojaSlug}).
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/painel"
                    className="inline-flex min-h-[36px] items-center rounded-full px-4 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: "var(--admin-accent-strong)" }}
                  >
                    Ir para /painel
                  </Link>
                  <button
                    type="button"
                    disabled={endingImpersonation}
                    onClick={handleEncerrarImpersonacao}
                    className="inline-flex min-h-[36px] items-center rounded-full border px-4 py-1 text-xs font-semibold disabled:opacity-60"
                    style={{
                      backgroundColor: "var(--admin-surface)",
                      borderColor: "var(--admin-border-strong)",
                      color: "var(--admin-text)",
                    }}
                  >
                    Encerrar suporte
                  </button>
                </div>
              </div>
            )}

            {children}
          </main>
        </div>
      </div>

      {/* Barra Inferior Mobile (4 atalhos) */}
      <nav
        aria-label="Atalhos mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur-md md:hidden"
        style={{
          backgroundColor: "var(--admin-surface-glass)",
          borderColor: "var(--admin-border)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="grid grid-cols-4 px-1 py-1">
          {BOTTOM_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            const suffix =
              item.href === "/admin" ? buildPreservedSuffix() : demoOnlySuffix;
            return (
              <Link
                key={item.href}
                href={`${item.href}${suffix}`}
                className="flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold transition"
                style={{
                  color: active ? "var(--admin-accent)" : "var(--admin-text-muted)",
                }}
              >
                <Icon className="h-4 w-4" />
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Drawer Sidebar */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu administrativo"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div
            className="relative z-10 flex h-[100dvh] w-72 max-w-[82vw] flex-col justify-between border-r p-4 shadow-2xl"
            style={{
              backgroundColor: "var(--admin-surface)",
              borderColor: "var(--admin-border)",
            }}
          >
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-2xl text-white"
                    style={{ backgroundColor: "var(--admin-accent-strong)" }}
                  >
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold">{nomePlataforma}</p>
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--admin-text-muted)" }}
                    >
                      Admin Console
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label="Fechar menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    color: "var(--admin-text-muted)",
                  }}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-1.5">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href, item.exact);
                  const suffix =
                    item.href === "/admin"
                      ? buildPreservedSuffix()
                      : demoOnlySuffix;
                  return (
                    <Link
                      key={item.href}
                      href={`${item.href}${suffix}`}
                      onClick={() => setMobileDrawerOpen(false)}
                      className="flex min-h-[44px] items-center gap-3 rounded-2xl px-3.5 text-sm font-semibold"
                      style={{
                        backgroundColor: active
                          ? "var(--admin-accent-soft)"
                          : "transparent",
                        color: active
                          ? "var(--admin-text)"
                          : "var(--admin-text-muted)",
                      }}
                    >
                      <Icon
                        className="h-4 w-4"
                        style={{
                          color: active
                            ? "var(--admin-accent)"
                            : "var(--admin-text-muted)",
                        }}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div
              className="space-y-3 border-t pt-4"
              style={{ borderColor: "var(--admin-border)" }}
            >
              {!isProduction && (
                <button
                  type="button"
                  onClick={() => {
                    handleToggleDemo();
                    setMobileDrawerOpen(false);
                  }}
                  className="flex min-h-[44px] w-full items-center justify-between rounded-2xl border px-3.5 text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Incluir dados demo
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px]"
                    style={{
                      backgroundColor: includeDemo
                        ? "var(--admin-info-soft)"
                        : "var(--admin-surface)",
                      color: includeDemo
                        ? "var(--admin-info)"
                        : "var(--admin-text-muted)",
                    }}
                  >
                    {includeDemo ? "Ligado" : "Desligado"}
                  </span>
                </button>
              )}

              <div className="flex items-center gap-2.5 px-1">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold text-white"
                  style={{ backgroundColor: "var(--admin-accent-strong)" }}
                >
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">{adminNome}</p>
                  <p
                    className="truncate text-[11px]"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    {adminEmail}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-2xl border text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text-muted)",
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Vitrine
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-2xl border text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border)",
                    color: "var(--admin-text)",
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {loggingOut ? "Saindo..." : "Sair"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paleta de Comandos Ctrl+K */}
      <AdminCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        stores={commandStores}
        querySuffix={demoOnlySuffix}
      />
    </div>
  );
}

export function AdminShell(props: AdminShellProps) {
  return (
    <Suspense fallback={<div className="admin-app min-h-[100dvh]" />}>
      <AdminShellInner {...props} />
    </Suspense>
  );
}

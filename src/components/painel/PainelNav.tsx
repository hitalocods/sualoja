"use client";

import {
  LayoutDashboard,
  Package,
  Palette,
  Settings,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/painel", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/painel/produtos", label: "Produtos", icon: Package, exact: false },
  { href: "/painel/aparencia", label: "Aparência", icon: Palette, exact: false },
  { href: "/painel/entrega", label: "Entrega", icon: Truck, exact: false },
  { href: "/painel/dados", label: "Dados da loja", icon: Settings, exact: false },
];

export function PainelNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação do painel"
      className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-zinc-100 py-2.5"
    >
      {NAV_ITEMS.map((item) => {
        const ativo = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition sm:text-sm ${
              ativo
                ? "bg-zinc-950 text-white shadow-xs"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

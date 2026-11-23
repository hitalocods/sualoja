import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminCommandPaletteStores } from "@/lib/admin/metrics";
import { getSession } from "@/lib/auth/session";
import { getPlatformConfig } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.usuario.role !== "admin") {
    redirect("/painel");
  }

  const [config, commandStores, cookieStore] = await Promise.all([
    getPlatformConfig(),
    getAdminCommandPaletteStores(),
    cookies(),
  ]);

  const themeCookie = cookieStore.get("ml_admin_theme")?.value;
  const initialTheme: "dark" | "light" =
    themeCookie === "light" ? "light" : "dark";

  return (
    <AdminShell
      nomePlataforma={config.nome_plataforma}
      adminNome={session.usuario.nome}
      adminEmail={session.usuario.email}
      impersonando={session.impersonando}
      initialTheme={initialTheme}
      isProduction={process.env.NODE_ENV === "production"}
      commandStores={commandStores}
    >
      {children}
    </AdminShell>
  );
}

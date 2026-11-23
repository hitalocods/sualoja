import { AdminLojasManager } from "@/components/admin/AdminLojasManager";
import {
  getAdminLojasData,
  resolveAdminQueryParams,
} from "@/lib/admin/metrics";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLojasPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; loja?: string }>;
}) {
  await requireAdminSession();
  const params = await searchParams;
  const { includeDemo } = resolveAdminQueryParams(params);
  const { lojas, planos } = await getAdminLojasData({ includeDemo });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
          Lojas cadastradas
        </h1>
        <p className="mt-1 text-xs sm:text-sm" style={{ color: "var(--admin-text-muted)" }}>
          Visualize faturamento 30d, status de trial, aprove cadastros ou
          entre em modo suporte.
        </p>
      </div>

      <AdminLojasManager
        key={params.loja ?? "all"}
        lojas={lojas}
        planos={planos}
        initialSelectedLojaId={params.loja ?? null}
      />
    </div>
  );
}

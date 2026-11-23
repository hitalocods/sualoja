import { AdminDashboardClient } from "@/components/admin/AdminDashboardClient";
import {
  getAdminDashboardData,
  resolveAdminQueryParams,
} from "@/lib/admin/metrics";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; demo?: string }>;
}) {
  await requireAdminSession();
  const params = await searchParams;
  const resolved = resolveAdminQueryParams(params);
  const dashboardData = await getAdminDashboardData(resolved);

  return <AdminDashboardClient data={dashboardData} />;
}

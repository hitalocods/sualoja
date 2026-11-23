import { asc, count, isNull } from "drizzle-orm";
import { db } from "@/db";
import { lojas, planos } from "@/db/schema";
import {
  AdminPlanosManager,
  type PlanoAdminRow,
} from "@/components/admin/AdminPlanosManager";
import { requireAdminSession } from "@/lib/auth/session";
import { getPlatformConfig } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

export default async function AdminPlanosPage() {
  await requireAdminSession();

  const [planosRows, lojasPorPlanoRows, platformConfig] = await Promise.all([
    db.select().from(planos).orderBy(asc(planos.mensalidade_centavos)),
    db
      .select({
        planoId: lojas.plano_id,
        total: count(),
      })
      .from(lojas)
      .where(isNull(lojas.deletada_em))
      .groupBy(lojas.plano_id),
    getPlatformConfig(),
  ]);

  const contagemPorPlano = new Map(
    lojasPorPlanoRows.map((row) => [row.planoId, Number(row.total)]),
  );

  const planosSerializados: PlanoAdminRow[] = planosRows.map((p) => ({
    id: p.id,
    nome: p.nome,
    mensalidade_centavos: p.mensalidade_centavos,
    limite_produtos: p.limite_produtos,
    taxa_fixa_centavos: p.taxa_fixa_centavos,
    taxa_percentual: p.taxa_percentual,
    ativo: p.ativo,
    lojasCount: contagemPorPlano.get(p.id) ?? 0,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
          Planos e tarifas
        </h1>
        <p
          className="mt-1 text-xs sm:text-sm"
          style={{ color: "var(--admin-text-muted)" }}
        >
          Os valores configurados aqui alimentam automaticamente a landing e os
          novos cadastros.
        </p>
      </div>

      <AdminPlanosManager
        planos={planosSerializados}
        tarifaGatewayPixCentavos={platformConfig.tarifa_gateway_pix_centavos}
        margemMinimaCentavos={platformConfig.margem_minima_centavos}
      />
    </div>
  );
}

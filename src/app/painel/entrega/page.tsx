import { EntregaManager } from "@/components/painel/EntregaManager";
import { bairros_entrega, lojas_entrega } from "@/db/schema";
import { getPanelTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PainelEntregaPage() {
  const { loja, tenantDb } = await getPanelTenantContext();

  const [entrega, bairros] = await Promise.all([
    tenantDb.findFirst(lojas_entrega),
    tenantDb.findMany(bairros_entrega, {
      orderBy: bairros_entrega.bairro,
    }),
  ]);

  return (
    <EntregaManager
      abertaInicial={loja.aberta}
      entregaInicial={entrega}
      bairrosIniciais={bairros}
    />
  );
}

import { eq } from "drizzle-orm";
import { ProdutosManager } from "@/components/painel/ProdutosManager";
import { db } from "@/db";
import { planos, produtos } from "@/db/schema";
import { getPanelTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PainelProdutosPage() {
  const { loja, tenantDb } = await getPanelTenantContext();

  const [listaProdutos, planoRows] = await Promise.all([
    tenantDb.findMany(produtos, {
      orderBy: [produtos.categoria, produtos.nome],
    }),
    db
      .select({ nome: planos.nome, limite_produtos: planos.limite_produtos })
      .from(planos)
      .where(eq(planos.id, loja.plano_id))
      .limit(1),
  ]);

  const plano = planoRows[0];

  return (
    <ProdutosManager
      produtosIniciais={listaProdutos}
      limiteProdutos={plano?.limite_produtos ?? null}
      planoNome={plano?.nome ?? "Start"}
    />
  );
}

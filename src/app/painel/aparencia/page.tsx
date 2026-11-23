import { eq } from "drizzle-orm";
import { AparenciaEditor } from "@/components/painel/AparenciaEditor";
import { lojas_entrega, lojas_tema, produtos } from "@/db/schema";
import { STORE_FONTS } from "@/lib/storefront/fonts";
import { resolverTemaLoja } from "@/lib/storefront/theme";
import { getPanelTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PainelAparenciaPage() {
  const { loja, tenantDb } = await getPanelTenantContext();

  const [temaRow, entregaRow, amostraProdutos] = await Promise.all([
    tenantDb.findFirst(lojas_tema),
    tenantDb.findFirst(lojas_entrega),
    tenantDb.findMany(produtos, {
      where: eq(produtos.ativo, true),
      limit: 2,
      orderBy: produtos.nome,
    }),
  ]);

  const temaInicial = resolverTemaLoja(temaRow);
  const todasVariaveisFontes = Object.values(STORE_FONTS)
    .map((f) => f.variable)
    .join(" ");

  return (
    <div className={todasVariaveisFontes}>
      <AparenciaEditor
        lojaNome={loja.nome}
        lojaCategoria={loja.categoria}
        lojaBairro={loja.bairro}
        lojaAberta={loja.aberta}
        tempoEstimadoMin={entregaRow?.tempo_estimado_min ?? 40}
        pedidoMinimoCentavos={entregaRow?.pedido_minimo_centavos ?? 0}
        temaInicial={temaInicial}
        produtosPreview={amostraProdutos.map((p) => ({
          id: p.id,
          nome: p.nome,
          preco_centavos: p.preco_centavos,
        }))}
      />
    </div>
  );
}

import { eq } from "drizzle-orm";
import {
  DadosLojaForm,
  type DadosLojaViewData,
} from "@/components/painel/DadosLojaForm";
import { db } from "@/db";
import { planos } from "@/db/schema";
import { getPanelTenantContext } from "@/lib/tenant";
import { mascararCpfCnpj } from "@/lib/validators/lojista";

export const dynamic = "force-dynamic";

export default async function PainelDadosPage() {
  const { loja, impersonando } = await getPanelTenantContext();

  const [plano] = await db
    .select({
      nome: planos.nome,
      taxa_fixa_centavos: planos.taxa_fixa_centavos,
      taxa_percentual: planos.taxa_percentual,
    })
    .from(planos)
    .where(eq(planos.id, loja.plano_id))
    .limit(1);

  const lojaSegura: DadosLojaViewData = {
    nome: loja.nome,
    slug: loja.slug,
    whatsapp: loja.whatsapp,
    categoria: loja.categoria,
    bairro: loja.bairro,
    status: loja.status,
    taxa_paga_por: loja.taxa_paga_por,
    documentoMascarado: mascararCpfCnpj(loja.cpf_cnpj),
    subcontaAtiva: Boolean(loja.abacate_subconta_id?.trim()),
  };

  return (
    <DadosLojaForm
      loja={lojaSegura}
      planoNome={plano?.nome ?? "Start"}
      taxaFixaCentavos={plano?.taxa_fixa_centavos ?? 0}
      taxaPercentual={plano?.taxa_percentual ?? "0.00"}
      somenteLeitura={Boolean(impersonando)}
    />
  );
}

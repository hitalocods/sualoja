import { and, eq, isNull } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import {
  bairros_entrega,
  lojas,
  lojas_entrega,
  lojas_tema,
  planos,
  produtos,
} from "@/db/schema";
import { mapaEstoqueDisponivelPorLoja } from "@/lib/inventory";
import { getPlatformConfig } from "@/lib/platform-config";
import { createTenantDb } from "@/lib/tenant";
import { SLUGS_RESERVADOS } from "@/lib/validators/lojista";
import type {
  BairroPublico,
  EntregaPublica,
  ProdutoPublico,
  TaxaCheckoutPreviewConfig,
} from "./cart";
import { verificarHorarioFuncionamento } from "./schedule";
import { resolverTemaLoja, type TemaResolvido } from "./theme";

export type LojaPublicaResumo = {
  id: string;
  slug: string;
  nome: string;
  whatsapp: string;
  categoria: string;
  bairro: string;
  status: "ativa" | "pendente" | "bloqueada";
  aberta: boolean;
  sem_subconta: boolean;
  pronta_para_pedidos: boolean;
  dentro_do_horario: boolean;
  horario_aviso: string | null;
};

export type DadosLojaPublica = {
  loja: LojaPublicaResumo;
  temaResolvido: TemaResolvido;
  entrega: EntregaPublica;
  produtos: ProdutoPublico[];
  bairros: BairroPublico[];
  taxaConfig: TaxaCheckoutPreviewConfig;
  pedido_minimo_plataforma_centavos: number;
};

export const carregarLojaPublicaPorSlug = cache(
  async (rawSlug: string): Promise<DadosLojaPublica | null> => {
    const slug = rawSlug.trim().toLowerCase();
    if (!slug || (SLUGS_RESERVADOS as readonly string[]).includes(slug)) {
      return null;
    }

    const [loja] = await db
      .select({
        id: lojas.id,
        slug: lojas.slug,
        nome: lojas.nome,
        whatsapp: lojas.whatsapp,
        categoria: lojas.categoria,
        bairro: lojas.bairro,
        status: lojas.status,
        aberta: lojas.aberta,
        abacate_subconta_id: lojas.abacate_subconta_id,
        taxa_paga_por: lojas.taxa_paga_por,
        taxa_fixa_centavos: planos.taxa_fixa_centavos,
        taxa_percentual: planos.taxa_percentual,
      })
      .from(lojas)
      .innerJoin(planos, eq(lojas.plano_id, planos.id))
      .where(and(eq(lojas.slug, slug), isNull(lojas.deletada_em)))
      .limit(1);

    if (!loja || loja.status === "bloqueada") {
      return null;
    }

    const tenantDb = createTenantDb(loja.id);
    const agora = new Date();
    const [tema, entregaRow, listaProdutos, listaBairros, platformConfig] =
      await Promise.all([
        tenantDb.findFirst(lojas_tema),
        tenantDb.findFirst(lojas_entrega),
        tenantDb.findMany(produtos, {
          where: eq(produtos.ativo, true),
          orderBy: [produtos.categoria, produtos.nome],
        }),
        tenantDb.findMany(bairros_entrega, {
          orderBy: bairros_entrega.bairro,
        }),
        getPlatformConfig(),
      ]);

    const estoqueDisponivelMap = await mapaEstoqueDisponivelPorLoja(
      loja.id,
      listaProdutos,
      agora,
    );
    const horarioStatus = verificarHorarioFuncionamento(
      entregaRow?.horarios,
      agora,
    );
    const semSubconta = !loja.abacate_subconta_id?.trim();

    const temaResolvido = resolverTemaLoja(tema);

    const entrega: EntregaPublica = {
      aceita_retirada: entregaRow?.aceita_retirada ?? true,
      aceita_entrega: entregaRow?.aceita_entrega ?? true,
      modo_frete: entregaRow?.modo_frete ?? "fixo",
      frete_fixo_centavos: entregaRow?.frete_fixo_centavos ?? 0,
      frete_gratis_acima_centavos:
        entregaRow?.frete_gratis_acima_centavos ?? null,
      pedido_minimo_centavos: entregaRow?.pedido_minimo_centavos ?? 0,
      tempo_estimado_min: entregaRow?.tempo_estimado_min ?? 40,
    };

    return {
      loja: {
        id: loja.id,
        slug: loja.slug,
        nome: loja.nome,
        whatsapp: loja.whatsapp,
        categoria: loja.categoria,
        bairro: loja.bairro,
        status: loja.status,
        aberta: loja.aberta,
        sem_subconta: semSubconta,
        pronta_para_pedidos: loja.status === "ativa" && !semSubconta,
        dentro_do_horario: horarioStatus.dentroDoHorario,
        horario_aviso: horarioStatus.motivo ?? null,
      },
      temaResolvido,
      entrega,
      produtos: listaProdutos.map((p) => ({
        id: p.id,
        nome: p.nome,
        descricao: p.descricao,
        preco_centavos: p.preco_centavos,
        imagem_url: p.imagem_url,
        estoque: estoqueDisponivelMap.get(p.id) ?? 0,
        categoria: p.categoria,
      })),
      bairros: listaBairros.map((b) => ({
        id: b.id,
        bairro: b.bairro,
        valor_centavos: b.valor_centavos,
      })),
      taxaConfig: {
        taxa_fixa_centavos: loja.taxa_fixa_centavos,
        taxa_percentual: loja.taxa_percentual,
        taxa_paga_por: loja.taxa_paga_por,
      },
      pedido_minimo_plataforma_centavos:
        platformConfig.pedido_minimo_plataforma_centavos,
    };
  },
);

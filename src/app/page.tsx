import { asc, eq } from "drizzle-orm";
import type { LojaModeloPreview } from "@/components/landing/HeroPhoneMockup";
import {
  LandingPage,
  type PlanoLanding,
} from "@/components/landing/LandingPage";
import { db } from "@/db";
import { planos } from "@/db/schema";
import { getPlatformConfig } from "@/lib/platform-config";
import { carregarLojaPublicaPorSlug } from "@/lib/storefront/data";
import { STORE_FONTS } from "@/lib/storefront/fonts";

export const dynamic = "force-dynamic";

const LOJA_MODELO_FALLBACK: LojaModeloPreview = {
  slug: "casa-atelier",
  nome: "Casa Atelier",
  categoria: "Moda & Acessórios",
  bairro: "Jóquei",
  cor_primaria: "#9F1239",
  cor_secundaria: "#18181B",
  cor_primaria_texto: "#FFFFFF",
  produtos: [
    {
      id: "preview-1",
      nome: "Vestido Midi em Linho Natural",
      preco_centavos: 24990,
      categoria: "Vestuário",
      imagem_url: null,
    },
    {
      id: "preview-2",
      nome: "Bolsa Tote Estruturada Caramelo",
      preco_centavos: 28990,
      categoria: "Bolsas",
      imagem_url: null,
    },
    {
      id: "preview-3",
      nome: "Camisa Social Algodão Off-White",
      preco_centavos: 16990,
      categoria: "Vestuário",
      imagem_url: null,
    },
    {
      id: "preview-4",
      nome: "Brinco Argola Orgânica Banhada a Ouro",
      preco_centavos: 7990,
      categoria: "Acessórios",
      imagem_url: null,
    },
  ],
};

export default async function HomePage() {
  const [planosRows, dadosLojaModelo, config] = await Promise.all([
    db
      .select({
        id: planos.id,
        nome: planos.nome,
        mensalidade_centavos: planos.mensalidade_centavos,
        limite_produtos: planos.limite_produtos,
        taxa_fixa_centavos: planos.taxa_fixa_centavos,
        taxa_percentual: planos.taxa_percentual,
      })
      .from(planos)
      .where(eq(planos.ativo, true))
      .orderBy(asc(planos.mensalidade_centavos)),
    carregarLojaPublicaPorSlug("casa-atelier"),
    getPlatformConfig(),
  ]);

  const planosLista: PlanoLanding[] = planosRows.map((p) => ({
    id: p.id,
    nome: p.nome,
    mensalidade_centavos: p.mensalidade_centavos,
    limite_produtos: p.limite_produtos,
    taxa_fixa_centavos: p.taxa_fixa_centavos,
    taxa_percentual: String(p.taxa_percentual),
  }));

  const lojaModelo: LojaModeloPreview = dadosLojaModelo
    ? {
        slug: dadosLojaModelo.loja.slug,
        nome: dadosLojaModelo.loja.nome,
        categoria: dadosLojaModelo.loja.categoria,
        bairro: dadosLojaModelo.loja.bairro,
        cor_primaria: dadosLojaModelo.temaResolvido.cor_primaria,
        cor_secundaria: dadosLojaModelo.temaResolvido.cor_secundaria,
        cor_primaria_texto: dadosLojaModelo.temaResolvido.cor_primaria_texto,
        produtos: dadosLojaModelo.produtos.slice(0, 4).map((prod) => ({
          id: prod.id,
          nome: prod.nome,
          preco_centavos: prod.preco_centavos,
          categoria: prod.categoria,
          imagem_url: prod.imagem_url,
        })),
      }
    : LOJA_MODELO_FALLBACK;

  const fontVariables = [
    STORE_FONTS["Playfair Display"].variable,
    STORE_FONTS["DM Sans"].variable,
    STORE_FONTS["Montserrat"].variable,
  ].join(" ");

  return (
    <div className={fontVariables}>
      <LandingPage
        planos={planosLista}
        lojaModelo={lojaModelo}
        diasTrial={config.dias_trial}
      />
    </div>
  );
}

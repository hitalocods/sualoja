import { notFound } from "next/navigation";
import { StoreCatalog } from "@/components/storefront/StoreCatalog";
import { StoreHeader } from "@/components/storefront/StoreHeader";
import { carregarLojaPublicaPorSlug } from "@/lib/storefront/data";

export const dynamic = "force-dynamic";

type StorePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function LojaPublicaPage({ params }: StorePageProps) {
  const { slug } = await params;
  const dados = await carregarLojaPublicaPorSlug(slug);

  if (!dados) {
    notFound();
  }

  return (
    <>
      <StoreHeader
        loja={dados.loja}
        tema={dados.temaResolvido}
        entrega={dados.entrega}
        bairros={dados.bairros}
      />
      <StoreCatalog
        loja={dados.loja}
        entrega={dados.entrega}
        produtos={dados.produtos}
        bairros={dados.bairros}
      />
    </>
  );
}

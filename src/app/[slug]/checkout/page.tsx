import { notFound } from "next/navigation";
import { CheckoutClient } from "@/components/storefront/CheckoutClient";
import { carregarLojaPublicaPorSlug } from "@/lib/storefront/data";

export const dynamic = "force-dynamic";

type CheckoutPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StoreCheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params;
  const dados = await carregarLojaPublicaPorSlug(slug);

  if (!dados) {
    notFound();
  }

  return (
    <CheckoutClient
      loja={dados.loja}
      entrega={dados.entrega}
      bairros={dados.bairros}
      taxaConfig={dados.taxaConfig}
      pedidoMinimoPlataformaCentavos={dados.pedido_minimo_plataforma_centavos}
    />
  );
}

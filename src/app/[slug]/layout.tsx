import { Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { CartProvider } from "@/components/storefront/CartProvider";
import { carregarLojaPublicaPorSlug } from "@/lib/storefront/data";
import { STORE_FONTS } from "@/lib/storefront/fonts";

export const dynamic = "force-dynamic";

type StoreLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const dados = await carregarLojaPublicaPorSlug(slug);

  if (!dados) {
    return { title: "Loja não encontrada — MinhaLoja" };
  }

  return {
    title: `${dados.loja.nome} — Catálogo & Pix`,
    description: `${dados.loja.categoria} em ${dados.loja.bairro}, Teresina-PI. Faça seu pedido e pague com Pix.`,
  };
}

export default async function StoreLayout({
  children,
  params,
}: StoreLayoutProps) {
  const { slug } = await params;
  const dados = await carregarLojaPublicaPorSlug(slug);

  if (!dados) {
    notFound();
  }

  const { loja, temaResolvido, produtos } = dados;
  const fontConfig = STORE_FONTS[temaResolvido.fonte];
  const interFontConfig = STORE_FONTS["Inter"];
  const fontVariables =
    temaResolvido.fonte === "Inter"
      ? fontConfig.variable
      : `${fontConfig.variable} ${interFontConfig.variable}`;

  const themeStyle = {
    "--cor-primaria": temaResolvido.cor_primaria,
    "--cor-secundaria": temaResolvido.cor_secundaria,
    "--cor-primaria-texto": temaResolvido.cor_primaria_texto,
    "--cor-secundaria-texto": temaResolvido.cor_secundaria_texto,
    "--cor-primaria-suave": temaResolvido.cor_primaria_suave,
    "--fonte": fontConfig.cssFontFamily,
    "--fonte-ui": interFontConfig.cssFontFamily,
  } as CSSProperties;

  if (loja.status === "pendente") {
    return (
      <div
        className={`store-theme flex min-h-dvh items-center justify-center px-4 ${fontVariables}`}
        style={themeStyle}
      >
        <div
          className="w-full max-w-md rounded-[24px] p-8 text-center shadow-sm"
          style={{
            backgroundColor: "var(--store-surface)",
            border: "1px solid var(--store-border)",
          }}
        >
          <span
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full shadow-md"
            style={{
              backgroundColor: "var(--cor-primaria)",
              backgroundImage: "var(--store-gradient-placeholder)",
              color: "var(--cor-primaria-texto)",
            }}
          >
            <Store className="h-7 w-7" />
          </span>
          <h1
            className="store-font-display mt-5 text-2xl font-extrabold tracking-tight"
            style={{ color: "var(--store-ink)" }}
          >
            {loja.nome}
          </h1>
          <p
            className="mt-2 text-[14px] leading-relaxed"
            style={{ color: "var(--store-ink-muted)" }}
          >
            Loja em preparação. Em breve estaremos aceitando pedidos via Pix por
            aqui!
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full px-6 py-2.5 text-[14px] font-bold transition hover:opacity-90"
            style={{
              backgroundColor: "var(--cor-secundaria)",
              color: "var(--cor-secundaria-texto)",
            }}
          >
            Voltar para a plataforma
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`store-theme min-h-dvh ${fontVariables}`}
      style={themeStyle}
    >
      <CartProvider slug={loja.slug} produtos={produtos}>
        {children}
      </CartProvider>
    </div>
  );
}

import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "MinhaLoja — Sua loja online em meudominio.com/sualoja",
  description:
    "Crie sua loja online personalizada em minutos, organize seu catálogo, controle estoque e configure frete por bairro direto do celular.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${plusJakarta.variable} max-w-full overflow-x-clip`}
    >
      <body className="min-h-screen max-w-full overflow-x-clip bg-zinc-50 font-sans text-zinc-950 antialiased">
        {children}
      </body>
    </html>
  );
}

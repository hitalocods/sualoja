"use client";

import { Plus } from "lucide-react";
import { formatarCentavos } from "@/lib/money";

type TemaDemo = {
  titulo: string;
  subtitulo: string;
  corPrimaria: string;
  corSecundaria: string;
  corPrimariaTexto: string;
  fonteNome: string;
  fontFamily: string;
};

const TEMAS_SHOWCASE: TemaDemo[] = [
  {
    titulo: "Bordô Editorial",
    subtitulo: "Moda, ateliês e presentes",
    corPrimaria: "#9F1239",
    corSecundaria: "#18181B",
    corPrimariaTexto: "#FFFFFF",
    fonteNome: "Playfair Display",
    fontFamily: "var(--font-store-playfair), ui-serif, Georgia, serif",
  },
  {
    titulo: "Esmeralda Botânico",
    subtitulo: "Beleza, cosméticos e bem-estar",
    corPrimaria: "#059669",
    corSecundaria: "#064E3B",
    corPrimariaTexto: "#FFFFFF",
    fonteNome: "DM Sans",
    fontFamily: "var(--font-store-dm-sans), ui-sans-serif, system-ui, sans-serif",
  },
  {
    titulo: "Cobalto Moderno",
    subtitulo: "Eletrônicos, casa e serviços",
    corPrimaria: "#2563EB",
    corSecundaria: "#0F172A",
    corPrimariaTexto: "#FFFFFF",
    fonteNome: "Montserrat",
    fontFamily: "var(--font-store-montserrat), ui-sans-serif, system-ui, sans-serif",
  },
];

const PRODUTOS_DEMO = [
  { nome: "Vestido Midi em Linho", preco_centavos: 24990, inicial: "V" },
  { nome: "Bolsa Tote Caramelo", preco_centavos: 28990, inicial: "B" },
];

export function ThemeShowcase() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {TEMAS_SHOWCASE.map((tema) => (
        <div
          key={tema.titulo}
          className="landing-card-hover flex min-w-0 flex-col justify-between rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5"
        >
          {/* Janela de vitrine isolada com o tema */}
          <div
            className="overflow-hidden rounded-[22px] bg-[#FAFAFA] text-zinc-950 shadow-lg"
            style={{ fontFamily: tema.fontFamily }}
          >
            <div
              className="h-16 w-full"
              style={{
                backgroundColor: tema.corPrimaria,
                backgroundImage: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.34) 0%, transparent 55%), linear-gradient(135deg, ${tema.corPrimaria} 0%, ${tema.corSecundaria} 100%)`,
              }}
            />

            <div className="px-3.5 pb-4">
              <div className="relative -mt-6 rounded-[18px] border border-zinc-200/80 bg-white p-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-extrabold shadow"
                    style={{
                      backgroundColor: tema.corPrimaria,
                      color: tema.corPrimariaTexto,
                    }}
                  >
                    CA
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-medium text-zinc-500">
                      Moda &amp; Acessórios
                    </p>
                    <p className="truncate text-sm font-extrabold tracking-tight text-zinc-950">
                      Casa Atelier
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex gap-1.5">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: tema.corPrimaria,
                      color: tema.corPrimariaTexto,
                    }}
                  >
                    Vestuário
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                    Bolsas
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {PRODUTOS_DEMO.map((item) => (
                  <div
                    key={item.nome}
                    className="min-w-0 overflow-hidden rounded-[16px] border border-zinc-200/80 bg-white"
                  >
                    <div
                      className="flex aspect-[4/5] items-center justify-center text-2xl font-extrabold"
                      style={{
                        backgroundColor: tema.corPrimaria,
                        backgroundImage:
                          "radial-gradient(circle at 22% 18%, rgba(255,255,255,0.28) 0%, transparent 56%)",
                        color: tema.corPrimariaTexto,
                      }}
                    >
                      {item.inicial}
                    </div>
                    <div className="p-2">
                      <p className="truncate text-[10px] font-bold text-zinc-900">
                        {item.nome}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-zinc-950">
                          {formatarCentavos(item.preco_centavos)}
                        </span>
                        <span
                          aria-hidden="true"
                          className="flex h-5 w-5 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: tema.corPrimaria,
                            color: tema.corPrimariaTexto,
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="mt-3 rounded-full py-2 text-center text-[11px] font-bold shadow-xs"
                style={{
                  backgroundColor: tema.corPrimaria,
                  color: tema.corPrimariaTexto,
                }}
              >
                Ver sacola • {formatarCentavos(24990)}
              </div>
            </div>
          </div>

          {/* Metadados do tema */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <p className="text-sm font-bold text-white">{tema.titulo}</p>
              <p className="text-xs text-zinc-400">{tema.subtitulo}</p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                {tema.fonteNome}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] text-zinc-300">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-white/30"
                  style={{ backgroundColor: tema.corPrimaria }}
                />
                {tema.corPrimaria}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

"use client";

import { Clock, ImagePlus, Loader2, Plus, Save, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState, type CSSProperties } from "react";
import {
  salvarAparenciaAction,
  uploadImagemLojaAction,
} from "@/app/painel/actions";
import { formatarCentavos } from "@/lib/money";
import { STORE_FONTS } from "@/lib/storefront/fonts";
import {
  FONTES_LOJA,
  resolverTemaLoja,
  type FonteLoja,
  type TemaResolvido,
} from "@/lib/storefront/theme";

const CORES_SUGERIDAS = [
  "#EA1D2C",
  "#18181B",
  "#059669",
  "#2563EB",
  "#7C3AED",
  "#D97706",
  "#FACC15",
];

export function AparenciaEditor({
  lojaNome,
  lojaCategoria,
  lojaBairro,
  lojaAberta,
  tempoEstimadoMin,
  pedidoMinimoCentavos,
  temaInicial,
  produtosPreview,
}: {
  lojaNome: string;
  lojaCategoria: string;
  lojaBairro: string;
  lojaAberta: boolean;
  tempoEstimadoMin: number;
  pedidoMinimoCentavos: number;
  temaInicial: TemaResolvido;
  produtosPreview: Array<{ id: string; nome: string; preco_centavos: number }>;
}) {
  const router = useRouter();
  const [corPrimaria, setCorPrimaria] = useState(temaInicial.cor_primaria);
  const [corSecundaria, setCorSecundaria] = useState(
    temaInicial.cor_secundaria,
  );
  const [fonte, setFonte] = useState<FonteLoja>(temaInicial.fonte);
  const [logoUrl, setLogoUrl] = useState<string | null>(temaInicial.logo_url);
  const [bannerUrl, setBannerUrl] = useState<string | null>(
    temaInicial.banner_url,
  );

  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);

  const previewTema = useMemo(
    () =>
      resolverTemaLoja({
        cor_primaria: corPrimaria,
        cor_secundaria: corSecundaria,
        fonte,
        logo_url: logoUrl,
        banner_url: bannerUrl,
      }),
    [corPrimaria, corSecundaria, fonte, logoUrl, bannerUrl],
  );

  const fontConfig = STORE_FONTS[previewTema.fonte];
  const previewStyle = {
    "--cor-primaria": previewTema.cor_primaria,
    "--cor-secundaria": previewTema.cor_secundaria,
    "--cor-primaria-texto": previewTema.cor_primaria_texto,
    "--cor-secundaria-texto": previewTema.cor_secundaria_texto,
    "--cor-primaria-suave": previewTema.cor_primaria_suave,
    "--fonte": fontConfig.cssFontFamily,
  } as CSSProperties;

  async function handleUpload(tipo: "logo" | "banner", file: File | undefined) {
    if (!file) return;
    setUploading(tipo);
    setFeedback(null);
    try {
      const formData = new FormData();
      formData.set("tipo", tipo);
      formData.set("file", file);
      const res = await uploadImagemLojaAction(formData);
      if (!res.ok) {
        setFeedback({ tipo: "erro", texto: res.error });
        return;
      }
      if (res.data) {
        if (tipo === "logo") setLogoUrl(res.data.url);
        else setBannerUrl(res.data.url);
      }
    } catch {
      setFeedback({
        tipo: "erro",
        texto:
          "Não foi possível enviar a imagem. Verifique se o arquivo tem até 4 MB e tente novamente.",
      });
    } finally {
      setUploading(null);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const res = await salvarAparenciaAction({
        cor_primaria: corPrimaria,
        cor_secundaria: corSecundaria,
        fonte,
        logo_url: logoUrl,
        banner_url: bannerUrl,
      });

      if (!res.ok) {
        setFeedback({ tipo: "erro", texto: res.error });
        return;
      }

      setFeedback({
        tipo: "ok",
        texto: res.message ?? "Aparência salva!",
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <form
        onSubmit={handleSubmit}
        className="min-w-0 space-y-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-7"
      >
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-950">
            Aparência da loja
          </h1>
          <p className="mt-0.5 text-xs text-zinc-600 sm:text-sm">
            Personalize cores, tipografia e imagens com contraste automático.
          </p>
        </div>

        {feedback && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              feedback.tipo === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {feedback.texto}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-800">
              Cor primária
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={previewTema.cor_primaria}
                onChange={(e) => setCorPrimaria(e.target.value.toUpperCase())}
                className="h-10 w-12 cursor-pointer rounded-xl border border-zinc-200 bg-white p-1"
              />
              <input
                type="text"
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
                placeholder="#EA1D2C"
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-mono uppercase outline-none focus:border-zinc-400"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CORES_SUGERIDAS.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setCorPrimaria(cor)}
                  aria-label={`Selecionar cor ${cor}`}
                  className="h-6 w-6 rounded-full border border-zinc-300 transition hover:scale-110"
                  style={{ backgroundColor: cor }}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-zinc-500">
              Contraste automático:{" "}
              <strong>
                {previewTema.cor_primaria_texto === "#FFFFFF"
                  ? "Texto branco"
                  : "Texto escuro"}
              </strong>
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-800">
              Cor secundária
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={previewTema.cor_secundaria}
                onChange={(e) => setCorSecundaria(e.target.value.toUpperCase())}
                className="h-10 w-12 cursor-pointer rounded-xl border border-zinc-200 bg-white p-1"
              />
              <input
                type="text"
                value={corSecundaria}
                onChange={(e) => setCorSecundaria(e.target.value)}
                placeholder="#18181B"
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-mono uppercase outline-none focus:border-zinc-400"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-800">
            Fonte da vitrine
          </label>
          <select
            value={fonte}
            onChange={(e) => setFonte(e.target.value as FonteLoja)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-zinc-400"
          >
            {FONTES_LOJA.map((nomeFonte) => (
              <option key={nomeFonte} value={nomeFonte}>
                {nomeFonte}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 p-3.5">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Logo da loja
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-400">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-bold hover:bg-zinc-50">
                  {uploading === "logo" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  Enviar logo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    disabled={uploading !== null}
                    className="sr-only"
                    onChange={(e) => {
                      void handleUpload("logo", e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    className="block text-[11px] font-semibold text-red-600 hover:underline"
                  >
                    Remover logo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 p-3.5">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Banner de capa
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                {bannerUrl ? (
                  <img
                    src={bannerUrl}
                    alt="Banner"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-400">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-bold hover:bg-zinc-50">
                  {uploading === "banner" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  Enviar banner
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    disabled={uploading !== null}
                    className="sr-only"
                    onChange={(e) => {
                      void handleUpload("banner", e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {bannerUrl && (
                  <button
                    type="button"
                    onClick={() => setBannerUrl(null)}
                    className="block text-[11px] font-semibold text-red-600 hover:underline"
                  >
                    Remover banner
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || uploading !== null}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar aparência
        </button>
      </form>

      <aside className="min-w-0 lg:col-span-5">
        <div className="sticky top-28 min-w-0 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Preview ao vivo ({previewTema.fonte})
          </p>

          <div
            className="store-theme overflow-hidden rounded-[2rem] border-4 border-zinc-900 bg-zinc-50 shadow-xl"
            style={previewStyle}
          >
            <div className="relative h-28 w-full overflow-hidden">
              {previewTema.banner_url ? (
                <img
                  src={previewTema.banner_url}
                  alt="Preview banner"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--cor-primaria) 0%, var(--cor-secundaria) 100%)",
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>

            <div className="px-3 pb-4">
              <div className="relative -mt-8 rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm">
                <div className="flex items-center gap-3">
                  {previewTema.logo_url ? (
                    <img
                      src={previewTema.logo_url}
                      alt="Preview logo"
                      className="h-12 w-12 shrink-0 rounded-xl border border-white object-cover shadow"
                    />
                  ) : (
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold shadow"
                      style={{
                        backgroundColor: "var(--cor-primaria)",
                        color: "var(--cor-primaria-texto)",
                      }}
                    >
                      {lojaNome.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        lojaAberta
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {lojaAberta ? "Aberta" : "Fechada"}
                    </span>
                    <p className="mt-0.5 truncate text-sm font-extrabold text-zinc-950">
                      {lojaNome}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {lojaCategoria} • {lojaBairro}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-2.5 text-[11px] font-semibold text-zinc-600">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1">
                    <Clock className="h-3 w-3" />
                    {tempoEstimadoMin} min
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-1">
                    <ShoppingBag className="h-3 w-3" />
                    Mín. {formatarCentavos(pedidoMinimoCentavos)}
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {(produtosPreview.length > 0
                  ? produtosPreview
                  : [
                      {
                        id: "demo",
                        nome: "Produto destaque da loja",
                        preco_centavos: 3490,
                      },
                    ]
                ).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-200 bg-white p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-zinc-900">
                        {item.nome}
                      </p>
                      <p className="text-xs font-extrabold text-zinc-950">
                        {formatarCentavos(item.preco_centavos)}
                      </p>
                    </div>
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-bold"
                      style={{
                        backgroundColor: "var(--cor-primaria)",
                        color: "var(--cor-primaria-texto)",
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      Adicionar
                    </span>
                  </div>
                ))}
              </div>

              <div
                className="mt-3 flex items-center justify-between rounded-2xl px-4 py-2.5 text-xs font-bold shadow-sm"
                style={{
                  backgroundColor: "var(--cor-primaria)",
                  color: "var(--cor-primaria-texto)",
                }}
              >
                <span>Ver sacola (1)</span>
                <span>{formatarCentavos(3490)}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

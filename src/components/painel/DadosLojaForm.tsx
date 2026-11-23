"use client";

import { Lock, Loader2, Save, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { salvarDadosLojaAction } from "@/app/painel/actions";
import type { Loja } from "@/db/schema";
import { formatarCentavos } from "@/lib/money";
import { CATEGORIAS_LOJA } from "@/lib/validators/lojista";

export interface DadosLojaViewData {
  nome: string;
  slug: string;
  whatsapp: string;
  categoria: string;
  bairro: string;
  status: Loja["status"];
  taxa_paga_por: Loja["taxa_paga_por"];
  documentoMascarado: string;
  subcontaAtiva: boolean;
}

export function DadosLojaForm({
  loja,
  planoNome,
  taxaFixaCentavos,
  taxaPercentual,
  somenteLeitura = false,
}: {
  loja: DadosLojaViewData;
  planoNome: string;
  taxaFixaCentavos: number;
  taxaPercentual: string;
  somenteLeitura?: boolean;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(loja.nome);
  const [whatsapp, setWhatsapp] = useState(loja.whatsapp);
  const [categoria, setCategoria] = useState(loja.categoria);
  const [bairro, setBairro] = useState(loja.bairro);
  const [taxaPagaPor, setTaxaPagaPor] = useState<"cliente" | "loja">(
    loja.taxa_paga_por,
  );

  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (somenteLeitura) {
      setFeedback({ tipo: "erro", texto: "Modo suporte: somente leitura." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    setFieldErrors({});

    try {
      const res = await salvarDadosLojaAction({
        nome,
        whatsapp,
        categoria,
        bairro,
        taxa_paga_por: taxaPagaPor,
      });

      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        setFeedback({ tipo: "erro", texto: res.error });
        return;
      }

      setFeedback({
        tipo: "ok",
        texto: res.message ?? "Dados da loja atualizados.",
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-950">
            Dados da loja
          </h1>
          <p className="mt-0.5 text-xs text-zinc-600 sm:text-sm">
            Informações exibidas aos clientes e configuração da taxa de serviço
            Pix.
          </p>
        </div>

        {somenteLeitura && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 sm:text-sm">
            <Lock className="h-4 w-4 shrink-0 text-amber-700" />
            <span>
              Modo suporte: somente leitura. Alterações estão bloqueadas nesta
              sessão.
            </span>
          </div>
        )}

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
            <label className="mb-1 block text-sm font-semibold text-zinc-800">
              Nome da loja
            </label>
            <input
              type="text"
              required
              disabled={somenteLeitura}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            />
            {fieldErrors.nome && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.nome}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-zinc-800">
              WhatsApp (com DDD)
            </label>
            <input
              type="tel"
              required
              disabled={somenteLeitura}
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(86) 99988-7766"
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            />
            {fieldErrors.whatsapp && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.whatsapp}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-zinc-800">
              Categoria
            </label>
            <input
              type="text"
              required
              disabled={somenteLeitura}
              list="categorias-loja-sugestoes"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            />
            <datalist id="categorias-loja-sugestoes">
              {CATEGORIAS_LOJA.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
            {fieldErrors.categoria && (
              <p className="mt-1 text-xs text-red-600">
                {fieldErrors.categoria}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-zinc-800">
              Bairro (Teresina-PI)
            </label>
            <input
              type="text"
              required
              disabled={somenteLeitura}
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            />
            {fieldErrors.bairro && (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.bairro}</p>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-4">
          <p className="text-sm font-bold text-zinc-900">
            Quem paga a taxa de serviço Pix?
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Seu plano atual ({planoNome}) possui taxa de{" "}
            {formatarCentavos(taxaFixaCentavos)} + {taxaPercentual}% por pedido.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={somenteLeitura}
              onClick={() => setTaxaPagaPor("loja")}
              className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-65 ${
                taxaPagaPor === "loja"
                  ? "border-red-600 bg-red-50/40 ring-1 ring-red-600/20"
                  : "border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <p className="text-sm font-extrabold text-zinc-950">
                Loja absorve a taxa
              </p>
              <p className="mt-0.5 text-xs text-zinc-600">
                O cliente paga apenas Produtos + Frete. A taxa é descontada no
                split.
              </p>
            </button>

            <button
              type="button"
              disabled={somenteLeitura}
              onClick={() => setTaxaPagaPor("cliente")}
              className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-65 ${
                taxaPagaPor === "cliente"
                  ? "border-red-600 bg-red-50/40 ring-1 ring-red-600/20"
                  : "border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <p className="text-sm font-extrabold text-zinc-950">
                Cliente paga a taxa
              </p>
              <p className="mt-0.5 text-xs text-zinc-600">
                A taxa de serviço é somada ao total exibido ao cliente no
                checkout Pix.
              </p>
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || somenteLeitura}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar dados da loja
        </button>
      </form>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-zinc-900">
          Identificação fixa da conta
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-zinc-50 p-3">
            <dt className="text-xs text-zinc-500">Endereço (slug)</dt>
            <dd className="mt-0.5 font-bold">/{loja.slug}</dd>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3">
            <dt className="text-xs text-zinc-500">Status</dt>
            <dd className="mt-0.5 font-bold capitalize">{loja.status}</dd>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3">
            <dt className="text-xs text-zinc-500">Plano</dt>
            <dd className="mt-0.5 font-bold">{planoNome}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-zinc-700" />
            <h2 className="text-sm font-bold text-zinc-900">Recebimento</h2>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
              loja.subcontaAtiva
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            Subconta: {loja.subcontaAtiva ? "Ativa" : "Em configuração"}
          </span>
        </div>

        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-zinc-50 p-3">
            <dt className="text-xs text-zinc-500">CPF/CNPJ cadastrado</dt>
            <dd className="mt-0.5 font-mono font-bold text-zinc-900">
              {loja.documentoMascarado}
            </dd>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3">
            <dt className="text-xs text-zinc-500">Status da subconta</dt>
            <dd className="mt-0.5 font-bold text-zinc-900">
              {loja.subcontaAtiva ? "Ativa" : "Em configuração"}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-xs leading-relaxed text-zinc-600">
          Seus repasses e saques são enviados para a chave Pix do tipo CPF/CNPJ
          deste documento. Para alterar, fale com o suporte.
        </p>
      </section>
    </div>
  );
}

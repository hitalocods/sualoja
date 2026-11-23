"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { CATEGORIAS_LOJA } from "@/lib/validators/lojista";

function gerarSlugLocal(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

type SlugCheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok"; slug: string }
  | { status: "error"; motivo: string };

export function CadastroForm() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [lojaNome, setLojaNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditadoManual, setSlugEditadoManual] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_LOJA[0]);
  const [bairro, setBairro] = useState("Centro");

  const [slugCheck, setSlugCheck] = useState<SlugCheckState>({ status: "idle" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const clean = slug.trim().toLowerCase();
    if (!clean) {
      const idleTimer = setTimeout(() => setSlugCheck({ status: "idle" }), 0);
      return () => clearTimeout(idleTimer);
    }

    const controller = new AbortController();
    const checkingTimer = setTimeout(
      () => setSlugCheck({ status: "checking" }),
      0,
    );

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/slug-disponivel?slug=${encodeURIComponent(clean)}`,
          { signal: controller.signal },
        );
        const data = (await res.json()) as {
          disponivel: boolean;
          slug: string;
          motivo?: string;
        };

        if (data.disponivel) {
          setSlugCheck({ status: "ok", slug: data.slug });
        } else {
          setSlugCheck({
            status: "error",
            motivo: data.motivo ?? "Endereço indisponível.",
          });
        }
      } catch {
        // Ignora erro de abort
      }
    }, 350);

    return () => {
      clearTimeout(checkingTimer);
      clearTimeout(timer);
      controller.abort();
    };
  }, [slug]);

  function handleLojaNomeChange(value: string) {
    setLojaNome(value);
    if (!slugEditadoManual) {
      setSlug(gerarSlugLocal(value));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const res = await fetch("/api/auth/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          email,
          senha,
          loja_nome: lojaNome,
          slug,
          cpf_cnpj: cpfCnpj,
          whatsapp,
          categoria,
          bairro,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        fieldErrors?: Record<string, string>;
      };

      if (!res.ok) {
        if (data.fieldErrors) setFieldErrors(data.fieldErrors);
        setFormError(data.error ?? "Erro ao concluir cadastro.");
        return;
      }

      router.push("/painel");
      router.refresh();
    } catch {
      setFormError("Erro de conexão ao cadastrar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {formError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {formError}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          1. Seus dados de acesso
        </h2>

        <div>
          <label className="mb-1 block text-sm font-semibold text-zinc-800">
            Seu nome completo
          </label>
          <input
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Maria Clara Sousa"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
          />
          {fieldErrors.nome && (
            <p className="mt-1 text-xs font-medium text-red-600">
              {fieldErrors.nome}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-zinc-800">
            E-mail
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@sualoja.com.br"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs font-medium text-red-600">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-zinc-800">
            Senha (mínimo 8 caracteres)
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
          />
          {fieldErrors.senha && (
            <p className="mt-1 text-xs font-medium text-red-600">
              {fieldErrors.senha}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 border-t border-zinc-100 pt-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          2. Dados da loja em Teresina-PI
        </h2>

        <div>
          <label className="mb-1 block text-sm font-semibold text-zinc-800">
            Nome da loja
          </label>
          <input
            type="text"
            required
            value={lojaNome}
            onChange={(e) => handleLojaNomeChange(e.target.value)}
            placeholder="Ex: Casa Atelier"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
          />
          {fieldErrors.loja_nome && (
            <p className="mt-1 text-xs font-medium text-red-600">
              {fieldErrors.loja_nome}
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-zinc-800">
            Link da loja
          </label>
          <div className="flex min-w-0 items-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20">
            <span className="shrink-0 pl-3 text-xs font-medium text-zinc-500">
              meudominio.com/
            </span>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => {
                setSlugEditadoManual(true);
                setSlug(e.target.value.toLowerCase());
              }}
              placeholder="casa-atelier"
              className="min-w-0 flex-1 bg-white px-2.5 py-2.5 text-sm font-medium outline-none"
            />
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 text-xs">
            {slugCheck.status === "checking" && (
              <span className="flex items-center gap-1 text-zinc-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Verificando disponibilidade...
              </span>
            )}
            {slugCheck.status === "ok" && (
              <span className="flex items-center gap-1 font-medium text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                /{slugCheck.slug} disponível
              </span>
            )}
            {slugCheck.status === "error" && (
              <span className="flex items-center gap-1 font-medium text-red-600">
                <XCircle className="h-3.5 w-3.5" />
                {slugCheck.motivo}
              </span>
            )}
          </div>
          {fieldErrors.slug && (
            <p className="mt-1 text-xs font-medium text-red-600">
              {fieldErrors.slug}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-zinc-800">
              CPF ou CNPJ
            </label>
            <input
              type="text"
              required
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              placeholder="000.000.000-00"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
            {fieldErrors.cpf_cnpj && (
              <p className="mt-1 text-xs font-medium text-red-600">
                {fieldErrors.cpf_cnpj}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-zinc-800">
              WhatsApp (com DDD)
            </label>
            <input
              type="tel"
              required
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(86) 99988-7766"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
            {fieldErrors.whatsapp && (
              <p className="mt-1 text-xs font-medium text-red-600">
                {fieldErrors.whatsapp}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-zinc-800">
              Categoria
            </label>
            <select
              required
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            >
              {CATEGORIAS_LOJA.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {fieldErrors.categoria && (
              <p className="mt-1 text-xs font-medium text-red-600">
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
              value={bairro}
              onChange={(e) => setBairro(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || slugCheck.status === "error"}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Criando sua loja...
          </>
        ) : (
          "Criar minha loja"
        )}
      </button>
    </form>
  );
}

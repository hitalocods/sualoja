"use client";

import {
  Check,
  Edit3,
  ImagePlus,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  ajustarEstoqueProdutoAction,
  alternarAtivoProdutoAction,
  criarProdutoAction,
  editarProdutoAction,
  excluirProdutoAction,
  uploadImagemLojaAction,
} from "@/app/painel/actions";
import type { Produto } from "@/db/schema";
import { formatarCentavos } from "@/lib/money";
import {
  centavosParaInputReais,
  reaisParaCentavos,
} from "@/lib/validators/painel";

type FiltroStatus = "todos" | "ativos" | "inativos" | "esgotados";

export function ProdutosManager({
  produtosIniciais,
  limiteProdutos,
  planoNome,
}: {
  produtosIniciais: Produto[];
  limiteProdutos: number | null;
  planoNome: string;
}) {
  const router = useRouter();
  const [lista, setLista] = useState<Produto[]>(produtosIniciais);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroStatus>("todos");
  const [feedback, setFeedback] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);

  const [estoqueDrafts, setEstoqueDrafts] = useState<Record<string, string>>(
    {},
  );
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Estado do modal Criar / Editar
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Geral");
  const [precoTexto, setPrecoTexto] = useState("0,00");
  const [estoqueTexto, setEstoqueTexto] = useState("10");
  const [descricao, setDescricao] = useState("");
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [ativo, setAtivo] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingModal, setSavingModal] = useState(false);
  const [modalErro, setModalErro] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [prevProdutosIniciais, setPrevProdutosIniciais] =
    useState<Produto[]>(produtosIniciais);
  if (produtosIniciais !== prevProdutosIniciais) {
    setPrevProdutosIniciais(produtosIniciais);
    setLista(produtosIniciais);
  }

  const categoriasExistentes = useMemo(() => {
    const set = new Set<string>(["Geral"]);
    for (const p of lista) {
      if (p.categoria.trim()) set.add(p.categoria.trim());
    }
    return Array.from(set);
  }, [lista]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lista.filter((p) => {
      if (filtro === "ativos" && !p.ativo) return false;
      if (filtro === "inativos" && p.ativo) return false;
      if (filtro === "esgotados" && p.estoque > 0) return false;
      if (!termo) return true;
      return (
        p.nome.toLowerCase().includes(termo) ||
        p.categoria.toLowerCase().includes(termo)
      );
    });
  }, [lista, busca, filtro]);

  const limiteAtingido =
    limiteProdutos !== null && lista.length >= limiteProdutos;

  function abrirModalNovo() {
    setEditandoId(null);
    setNome("");
    setCategoria("Geral");
    setPrecoTexto("");
    setEstoqueTexto("10");
    setDescricao("");
    setImagemUrl(null);
    setAtivo(true);
    setModalErro(null);
    setFieldErrors({});
    setModalAberto(true);
  }

  function abrirModalEditar(p: Produto) {
    setEditandoId(p.id);
    setNome(p.nome);
    setCategoria(p.categoria);
    setPrecoTexto(centavosParaInputReais(p.preco_centavos));
    setEstoqueTexto(String(p.estoque));
    setDescricao(p.descricao ?? "");
    setImagemUrl(p.imagem_url ?? null);
    setAtivo(p.ativo);
    setModalErro(null);
    setFieldErrors({});
    setModalAberto(true);
  }

  async function handleUploadImagem(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setModalErro(null);
    try {
      const formData = new FormData();
      formData.set("tipo", "produto");
      formData.set("file", file);
      const res = await uploadImagemLojaAction(formData);
      if (!res.ok) {
        setModalErro(res.error);
        return;
      }
      if (res.data) {
        setImagemUrl(res.data.url);
      }
    } catch {
      setModalErro(
        "Não foi possível enviar a imagem. Verifique se o arquivo tem até 4 MB e tente novamente.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSalvarModal(e: FormEvent) {
    e.preventDefault();
    setModalErro(null);
    setFieldErrors({});

    const precoCentavos = reaisParaCentavos(precoTexto);
    if (precoCentavos === null) {
      setFieldErrors({ preco_centavos: "Informe um preço válido (ex: 29,90)." });
      return;
    }

    const estoqueNum = Number.parseInt(estoqueTexto, 10);
    if (!Number.isSafeInteger(estoqueNum) || estoqueNum < 0) {
      setFieldErrors({ estoque: "Informe uma quantidade inteira >= 0." });
      return;
    }

    setSavingModal(true);
    try {
      const payload = {
        nome,
        descricao: descricao.trim() || null,
        preco_centavos: precoCentavos,
        estoque: estoqueNum,
        categoria: categoria.trim() || "Geral",
        ativo,
        imagem_url: imagemUrl,
      };

      const res = editandoId
        ? await editarProdutoAction(editandoId, payload)
        : await criarProdutoAction(payload);

      if (!res.ok) {
        if (res.fieldErrors) setFieldErrors(res.fieldErrors);
        setModalErro(res.error);
        return;
      }

      if (res.data) {
        const salvo = res.data;
        setLista((prev) =>
          editandoId
            ? prev.map((item) => (item.id === salvo.id ? salvo : item))
            : [...prev, salvo],
        );
      }

      setModalAberto(false);
      setFeedback({
        tipo: "ok",
        texto: res.message ?? "Produto salvo.",
      });
      router.refresh();
    } finally {
      setSavingModal(false);
    }
  }

  async function handleToggleAtivo(produto: Produto) {
    setPendingIds((p) => ({ ...p, [produto.id]: true }));
    setFeedback(null);
    try {
      const res = await alternarAtivoProdutoAction(produto.id, !produto.ativo);
      if (!res.ok) {
        setFeedback({ tipo: "erro", texto: res.error });
        return;
      }
      if (res.data) {
        const atualizado = res.data;
        setLista((prev) =>
          prev.map((i) => (i.id === atualizado.id ? atualizado : i)),
        );
      }
      router.refresh();
    } finally {
      setPendingIds((p) => ({ ...p, [produto.id]: false }));
    }
  }

  async function handleAjustarEstoque(produto: Produto, novoEstoque: number) {
    const clamped = Math.max(0, Math.floor(novoEstoque));
    setPendingIds((p) => ({ ...p, [produto.id]: true }));
    setFeedback(null);
    try {
      const res = await ajustarEstoqueProdutoAction({
        produto_id: produto.id,
        estoque: clamped,
      });
      if (!res.ok) {
        setFeedback({ tipo: "erro", texto: res.error });
        return;
      }
      if (res.data) {
        const atualizado = res.data;
        setLista((prev) =>
          prev.map((i) => (i.id === atualizado.id ? atualizado : i)),
        );
        setEstoqueDrafts((prev) => {
          const copy = { ...prev };
          delete copy[produto.id];
          return copy;
        });
      }
      router.refresh();
    } finally {
      setPendingIds((p) => ({ ...p, [produto.id]: false }));
    }
  }

  async function handleExcluir(produtoId: string) {
    setPendingIds((p) => ({ ...p, [produtoId]: true }));
    setFeedback(null);
    try {
      const res = await excluirProdutoAction(produtoId);
      if (!res.ok) {
        setFeedback({ tipo: "erro", texto: res.error });
        return;
      }
      setLista((prev) => prev.filter((i) => i.id !== produtoId));
      setConfirmDeleteId(null);
      setFeedback({ tipo: "ok", texto: "Produto removido." });
      router.refresh();
    } finally {
      setPendingIds((p) => ({ ...p, [produtoId]: false }));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-950">
            Produtos
          </h1>
          <p className="mt-0.5 text-xs text-zinc-600 sm:text-sm">
            {lista.length}{" "}
            {limiteProdutos !== null
              ? `de ${limiteProdutos} produtos (${planoNome})`
              : `produtos cadastrados (${planoNome})`}
          </p>
        </div>

        <button
          type="button"
          onClick={abrirModalNovo}
          disabled={limiteAtingido}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Novo produto
        </button>
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto ou categoria..."
            className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-zinc-400"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "todos", label: "Todos" },
              { id: "ativos", label: "Ativos" },
              { id: "inativos", label: "Inativos" },
              { id: "esgotados", label: "Esgotados" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFiltro(item.id)}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${
                filtro === item.id
                  ? "bg-zinc-950 text-white"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-zinc-300" />
          <p className="mt-3 text-sm font-bold text-zinc-800">
            Nenhum produto encontrado
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Crie seu primeiro produto para aparecer na vitrine da loja.
          </p>
        </div>
      ) : (
        <div className="grid gap-3.5 md:grid-cols-2">
          {filtrados.map((produto) => {
            const busy = Boolean(pendingIds[produto.id]);
            const draftVal = estoqueDrafts[produto.id];
            const estoqueAtualInput =
              draftVal !== undefined ? draftVal : String(produto.estoque);
            const estoqueAlterado =
              draftVal !== undefined &&
              Number.parseInt(draftVal, 10) !== produto.estoque;

            return (
              <article
                key={produto.id}
                className={`flex min-w-0 flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm ${
                  produto.ativo ? "border-zinc-200" : "border-zinc-200/70 opacity-75"
                }`}
              >
                <div className="flex gap-3.5">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-100 bg-zinc-100">
                    {produto.imagem_url ? (
                      <img
                        src={produto.imagem_url}
                        alt={produto.nome}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400">
                        <Package className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600">
                        {produto.categoria}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                          produto.ativo
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {produto.ativo ? "Ativo" : "Inativo"}
                      </span>
                      {produto.estoque === 0 && (
                        <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                          Esgotado
                        </span>
                      )}
                    </div>

                    <h2 className="mt-1 truncate text-sm font-extrabold text-zinc-950">
                      {produto.nome}
                    </h2>
                    <p className="mt-0.5 text-base font-extrabold text-zinc-900">
                      {formatarCentavos(produto.preco_centavos)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-zinc-500">
                      Estoque:
                    </span>
                    <button
                      type="button"
                      disabled={busy || produto.estoque <= 0}
                      onClick={() =>
                        handleAjustarEstoque(produto, produto.estoque - 1)
                      }
                      aria-label="Reduzir estoque"
                      className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={estoqueAtualInput}
                      onChange={(e) =>
                        setEstoqueDrafts((prev) => ({
                          ...prev,
                          [produto.id]: e.target.value,
                        }))
                      }
                      className="h-11 w-16 rounded-xl border border-zinc-200 text-center text-sm font-bold outline-none focus:border-zinc-400"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        handleAjustarEstoque(produto, produto.estoque + 1)
                      }
                      aria-label="Aumentar estoque"
                      className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    {estoqueAlterado && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleAjustarEstoque(
                            produto,
                            Number.parseInt(estoqueAtualInput, 10) || 0,
                          )
                        }
                        aria-label="Confirmar novo estoque"
                        className="flex min-h-[44px] items-center gap-1 rounded-xl bg-zinc-900 px-3 text-xs font-bold text-white"
                      >
                        <Check className="h-3.5 w-3.5" />
                        OK
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleAtivo(produto)}
                      className="rounded-xl border border-zinc-200 px-2.5 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50"
                    >
                      {produto.ativo ? "Desativar" : "Ativar"}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => abrirModalEditar(produto)}
                      aria-label={`Editar ${produto.nome}`}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 text-zinc-700 transition hover:bg-zinc-100"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>

                    {confirmDeleteId === produto.id ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleExcluir(produto.id)}
                        className="rounded-xl bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white"
                      >
                        Confirmar
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmDeleteId(produto.id)}
                        aria-label={`Excluir ${produto.nome}`}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 text-zinc-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <h2 className="text-lg font-extrabold">
                {editandoId ? "Editar produto" : "Novo produto"}
              </h2>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarModal} className="mt-5 space-y-4">
              {modalErro && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-700">
                  {modalErro}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Imagem do produto (Vercel Blob)
                </label>
                <div className="flex items-center gap-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
                    {imagemUrl ? (
                      <img
                        src={imagemUrl}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400">
                        <ImagePlus className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-50">
                      {uploading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-3.5 w-3.5" />
                          Enviar foto (até 4 MB)
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        disabled={uploading}
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          void handleUploadImagem(file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    {imagemUrl && (
                      <button
                        type="button"
                        onClick={() => setImagemUrl(null)}
                        className="block text-xs font-semibold text-red-600 hover:underline"
                      >
                        Remover imagem
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold">Nome</label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Vestido Midi Linho"
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400"
                />
                {fieldErrors.nome && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors.nome}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold">
                    Preço (R$)
                  </label>
                  <input
                    type="text"
                    required
                    value={precoTexto}
                    onChange={(e) => setPrecoTexto(e.target.value)}
                    placeholder="29,90"
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400"
                  />
                  {fieldErrors.preco_centavos && (
                    <p className="mt-1 text-xs text-red-600">
                      {fieldErrors.preco_centavos}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold">
                    Estoque
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={estoqueTexto}
                    onChange={(e) => setEstoqueTexto(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400"
                  />
                  {fieldErrors.estoque && (
                    <p className="mt-1 text-xs text-red-600">
                      {fieldErrors.estoque}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold">
                  Categoria
                </label>
                <input
                  type="text"
                  required
                  list="categorias-sugestoes"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400"
                />
                <datalist id="categorias-sugestoes">
                  {categoriasExistentes.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold">
                  Descrição (opcional)
                </label>
                <textarea
                  rows={3}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Material, tamanho, cor ou detalhes..."
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400"
                />
              </div>

              <label className="flex items-center gap-2.5 text-sm font-semibold text-zinc-800">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  className="h-4 w-4 rounded accent-red-600"
                />
                Exibir produto ativo na vitrine
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="flex-1 rounded-2xl border border-zinc-200 py-3 text-sm font-bold text-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingModal || uploading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {savingModal && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editandoId ? "Salvar alterações" : "Criar produto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

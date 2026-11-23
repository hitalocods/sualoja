"use client";

import {
  Check,
  Edit3,
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  criarBairroAction,
  editarBairroAction,
  excluirBairroAction,
  salvarEntregaAction,
} from "@/app/painel/actions";
import { LojaAbertaToggle } from "@/components/painel/LojaAbertaToggle";
import {
  HORARIOS_PADRAO,
  type BairroEntrega,
  type HorariosFuncionamento,
  type LojaEntrega,
} from "@/db/schema";
import { formatarCentavos } from "@/lib/money";
import {
  centavosParaInputReais,
  DIAS_SEMANA_CONFIG,
  reaisParaCentavos,
} from "@/lib/validators/painel";

export function EntregaManager({
  abertaInicial,
  entregaInicial,
  bairrosIniciais,
}: {
  abertaInicial: boolean;
  entregaInicial: LojaEntrega | null;
  bairrosIniciais: BairroEntrega[];
}) {
  const router = useRouter();
  const [aceitaRetirada, setAceitaRetirada] = useState(
    entregaInicial?.aceita_retirada ?? true,
  );
  const [aceitaEntrega, setAceitaEntrega] = useState(
    entregaInicial?.aceita_entrega ?? true,
  );
  const [modoFrete, setModoFrete] = useState<"fixo" | "bairro">(
    entregaInicial?.modo_frete ?? "fixo",
  );
  const [freteFixoTexto, setFreteFixoTexto] = useState(
    centavosParaInputReais(entregaInicial?.frete_fixo_centavos ?? 0),
  );
  const [freteGratisTexto, setFreteGratisTexto] = useState(
    entregaInicial?.frete_gratis_acima_centavos !== null &&
      entregaInicial?.frete_gratis_acima_centavos !== undefined
      ? centavosParaInputReais(entregaInicial.frete_gratis_acima_centavos)
      : "",
  );
  const [pedidoMinimoTexto, setPedidoMinimoTexto] = useState(
    centavosParaInputReais(entregaInicial?.pedido_minimo_centavos ?? 0),
  );
  const [tempoEstimado, setTempoEstimado] = useState(
    String(entregaInicial?.tempo_estimado_min ?? 40),
  );
  const [horarios, setHorarios] = useState<HorariosFuncionamento>(
    entregaInicial?.horarios ?? HORARIOS_PADRAO,
  );

  const [savingEntrega, setSavingEntrega] = useState(false);
  const [entregaMsg, setEntregaMsg] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);

  // Estado CRUD de Bairros
  const [bairros, setBairros] = useState<BairroEntrega[]>(bairrosIniciais);
  const [novoBairroNome, setNovoBairroNome] = useState("");
  const [novoBairroValor, setNovoBairroValor] = useState("5,00");
  const [editBairroId, setEditBairroId] = useState<string | null>(null);
  const [editBairroNome, setEditBairroNome] = useState("");
  const [editBairroValor, setEditBairroValor] = useState("");
  const [busyBairro, setBusyBairro] = useState(false);
  const [bairroMsg, setBairroMsg] = useState<{
    tipo: "ok" | "erro";
    texto: string;
  } | null>(null);

  const [prevBairrosIniciais, setPrevBairrosIniciais] =
    useState<BairroEntrega[]>(bairrosIniciais);
  if (bairrosIniciais !== prevBairrosIniciais) {
    setPrevBairrosIniciais(bairrosIniciais);
    setBairros(bairrosIniciais);
  }

  async function handleSalvarEntrega(e: FormEvent) {
    e.preventDefault();
    setEntregaMsg(null);

    const freteFixoCentavos = reaisParaCentavos(freteFixoTexto);
    if (freteFixoCentavos === null) {
      setEntregaMsg({
        tipo: "erro",
        texto: "Valor do frete fixo inválido.",
      });
      return;
    }

    const freteGratisCentavos = freteGratisTexto.trim()
      ? reaisParaCentavos(freteGratisTexto)
      : null;
    if (freteGratisTexto.trim() && freteGratisCentavos === null) {
      setEntregaMsg({
        tipo: "erro",
        texto: "Valor para frete grátis inválido.",
      });
      return;
    }

    const pedidoMinimoCentavos = reaisParaCentavos(pedidoMinimoTexto);
    if (pedidoMinimoCentavos === null) {
      setEntregaMsg({
        tipo: "erro",
        texto: "Valor do pedido mínimo inválido.",
      });
      return;
    }

    const tempoMin = Number.parseInt(tempoEstimado, 10);
    if (!Number.isSafeInteger(tempoMin)) {
      setEntregaMsg({
        tipo: "erro",
        texto: "Tempo estimado deve ser um número inteiro em minutos.",
      });
      return;
    }

    setSavingEntrega(true);
    try {
      const res = await salvarEntregaAction({
        aceita_retirada: aceitaRetirada,
        aceita_entrega: aceitaEntrega,
        modo_frete: modoFrete,
        frete_fixo_centavos: freteFixoCentavos,
        frete_gratis_acima_centavos: freteGratisCentavos,
        pedido_minimo_centavos: pedidoMinimoCentavos,
        tempo_estimado_min: tempoMin,
        horarios,
      });

      if (!res.ok) {
        const detalhe = res.fieldErrors
          ? Object.values(res.fieldErrors)[0]
          : undefined;
        setEntregaMsg({
          tipo: "erro",
          texto: detalhe ?? res.error,
        });
        return;
      }

      setEntregaMsg({
        tipo: "ok",
        texto: res.message ?? "Entrega atualizada.",
      });
      router.refresh();
    } finally {
      setSavingEntrega(false);
    }
  }

  async function handleAdicionarBairro(e: FormEvent) {
    e.preventDefault();
    setBairroMsg(null);

    const valorCentavos = reaisParaCentavos(novoBairroValor);
    if (valorCentavos === null) {
      setBairroMsg({ tipo: "erro", texto: "Informe um valor válido em R$." });
      return;
    }

    setBusyBairro(true);
    try {
      const res = await criarBairroAction({
        bairro: novoBairroNome,
        valor_centavos: valorCentavos,
      });
      if (!res.ok) {
        setBairroMsg({ tipo: "erro", texto: res.error });
        return;
      }
      if (res.data) {
        const criado = res.data;
        setBairros((prev) =>
          [...prev, criado].sort((a, b) => a.bairro.localeCompare(b.bairro)),
        );
      }
      setNovoBairroNome("");
      setNovoBairroValor("5,00");
      setBairroMsg({ tipo: "ok", texto: "Bairro adicionado." });
      router.refresh();
    } finally {
      setBusyBairro(false);
    }
  }

  async function handleSalvarEdicaoBairro(bairroId: string) {
    setBairroMsg(null);
    const valorCentavos = reaisParaCentavos(editBairroValor);
    if (valorCentavos === null) {
      setBairroMsg({ tipo: "erro", texto: "Informe um valor válido em R$." });
      return;
    }

    setBusyBairro(true);
    try {
      const res = await editarBairroAction(bairroId, {
        bairro: editBairroNome,
        valor_centavos: valorCentavos,
      });
      if (!res.ok) {
        setBairroMsg({ tipo: "erro", texto: res.error });
        return;
      }
      if (res.data) {
        const atualizado = res.data;
        setBairros((prev) =>
          prev
            .map((b) => (b.id === atualizado.id ? atualizado : b))
            .sort((a, b) => a.bairro.localeCompare(b.bairro)),
        );
      }
      setEditBairroId(null);
      setBairroMsg({ tipo: "ok", texto: "Bairro atualizado." });
      router.refresh();
    } finally {
      setBusyBairro(false);
    }
  }

  async function handleExcluirBairro(bairroId: string) {
    setBairroMsg(null);
    setBusyBairro(true);
    try {
      const res = await excluirBairroAction(bairroId);
      if (!res.ok) {
        setBairroMsg({ tipo: "erro", texto: res.error });
        return;
      }
      setBairros((prev) => prev.filter((b) => b.id !== bairroId));
      setBairroMsg({ tipo: "ok", texto: "Bairro removido." });
      router.refresh();
    } finally {
      setBusyBairro(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-950">
            Entrega e Funcionamento
          </h1>
          <p className="mt-0.5 text-xs text-zinc-600 sm:text-sm">
            Controle abertura da loja, modos de entrega, bairros e horários.
          </p>
        </div>
        <LojaAbertaToggle abertaInicial={abertaInicial} />
      </section>

      <form
        onSubmit={handleSalvarEntrega}
        className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm"
      >
        {entregaMsg && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              entregaMsg.tipo === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {entregaMsg.texto}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-200 p-4">
            <div>
              <p className="text-sm font-bold text-zinc-950">Aceitar entrega</p>
              <p className="text-xs text-zinc-500">
                Enviar pedidos para o endereço do cliente
              </p>
            </div>
            <input
              type="checkbox"
              checked={aceitaEntrega}
              onChange={(e) => setAceitaEntrega(e.target.checked)}
              className="h-5 w-5 rounded accent-red-600"
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-zinc-200 p-4">
            <div>
              <p className="text-sm font-bold text-zinc-950">
                Aceitar retirada
              </p>
              <p className="text-xs text-zinc-500">
                Cliente retira na loja sem pagar frete
              </p>
            </div>
            <input
              type="checkbox"
              checked={aceitaRetirada}
              onChange={(e) => setAceitaRetirada(e.target.checked)}
              className="h-5 w-5 rounded accent-red-600"
            />
          </label>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold text-zinc-900">Modo de frete</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setModoFrete("fixo")}
              className={`rounded-2xl border p-4 text-left transition ${
                modoFrete === "fixo"
                  ? "border-red-600 bg-red-50/40 ring-1 ring-red-600/20"
                  : "border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <p className="text-sm font-extrabold text-zinc-950">Frete fixo</p>
              <p className="mt-0.5 text-xs text-zinc-600">
                Mesmo valor para qualquer bairro entregue.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setModoFrete("bairro")}
              className={`rounded-2xl border p-4 text-left transition ${
                modoFrete === "bairro"
                  ? "border-red-600 bg-red-50/40 ring-1 ring-red-600/20"
                  : "border-zinc-200 hover:bg-zinc-50"
              }`}
            >
              <p className="text-sm font-extrabold text-zinc-950">
                Frete por bairro
              </p>
              <p className="mt-0.5 text-xs text-zinc-600">
                Defina valores específicos para cada bairro de Teresina.
              </p>
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-semibold">
              Frete fixo (R$)
            </label>
            <input
              type="text"
              value={freteFixoTexto}
              onChange={(e) => setFreteFixoTexto(e.target.value)}
              placeholder="5,00"
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">
              Frete grátis acima de (R$)
            </label>
            <input
              type="text"
              value={freteGratisTexto}
              onChange={(e) => setFreteGratisTexto(e.target.value)}
              placeholder="Opcional (ex: 80,00)"
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">
              Pedido mínimo (R$)
            </label>
            <input
              type="text"
              value={pedidoMinimoTexto}
              onChange={(e) => setPedidoMinimoTexto(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">
              Tempo estimado (min)
            </label>
            <input
              type="number"
              min={5}
              max={240}
              value={tempoEstimado}
              onChange={(e) => setTempoEstimado(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400"
            />
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-5">
          <h2 className="text-sm font-extrabold text-zinc-950">
            Horário de funcionamento por dia
          </h2>
          <div className="mt-3 space-y-2.5">
            {DIAS_SEMANA_CONFIG.map(({ key, label }) => {
              const dia = horarios[key];
              return (
                <div
                  key={key}
                  className="flex flex-col gap-2.5 rounded-2xl border border-zinc-200/80 bg-zinc-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <label className="flex items-center gap-2.5 text-sm font-bold text-zinc-800">
                    <input
                      type="checkbox"
                      checked={dia.aberto}
                      onChange={(e) =>
                        setHorarios((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], aberto: e.target.checked },
                        }))
                      }
                      className="h-4 w-4 rounded accent-red-600"
                    />
                    {label}
                  </label>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <input
                      type="time"
                      disabled={!dia.aberto}
                      value={dia.abre}
                      onChange={(e) =>
                        setHorarios((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], abre: e.target.value },
                        }))
                      }
                      className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 font-semibold disabled:opacity-40"
                    />
                    <span className="text-zinc-500">às</span>
                    <input
                      type="time"
                      disabled={!dia.aberto}
                      value={dia.fecha}
                      onChange={(e) =>
                        setHorarios((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], fecha: e.target.value },
                        }))
                      }
                      className="rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 font-semibold disabled:opacity-40"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={savingEntrega}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-zinc-800 disabled:opacity-60 sm:w-auto"
        >
          {savingEntrega ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar configurações de entrega
        </button>
      </form>

      <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-zinc-950">
            <MapPin className="h-4 w-4 text-red-600" />
            Bairros atendidos e taxas ({bairros.length})
          </h2>
          <p className="mt-0.5 text-xs text-zinc-600">
            {modoFrete === "bairro"
              ? "Modo por bairro ativo: o cliente escolherá um dos bairros abaixo no checkout."
              : "Estes bairros ficam salvos caso você altere o modo para 'Frete por bairro'."}
          </p>
        </div>

        {bairroMsg && (
          <div
            className={`rounded-2xl border px-4 py-2.5 text-xs font-semibold sm:text-sm ${
              bairroMsg.tipo === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {bairroMsg.texto}
          </div>
        )}

        <form
          onSubmit={handleAdicionarBairro}
          className="flex flex-col gap-2.5 sm:flex-row"
        >
          <input
            type="text"
            required
            value={novoBairroNome}
            onChange={(e) => setNovoBairroNome(e.target.value)}
            placeholder="Nome do bairro (ex: Fátima, Ininga)"
            className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400"
          />
          <input
            type="text"
            required
            value={novoBairroValor}
            onChange={(e) => setNovoBairroValor(e.target.value)}
            placeholder="Valor R$ (5,00)"
            className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-zinc-400 sm:w-36"
          />
          <button
            type="submit"
            disabled={busyBairro}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </form>

        {bairros.length === 0 ? (
          <p className="rounded-2xl bg-zinc-50 p-4 text-center text-xs text-zinc-500">
            Nenhum bairro cadastrado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
            {bairros.map((item) => {
              const editando = editBairroId === item.id;
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  {editando ? (
                    <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={editBairroNome}
                        onChange={(e) => setEditBairroNome(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
                      />
                      <input
                        type="text"
                        value={editBairroValor}
                        onChange={(e) => setEditBairroValor(e.target.value)}
                        className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm sm:w-28"
                      />
                    </div>
                  ) : (
                    <div>
                      <span className="text-sm font-bold text-zinc-900">
                        {item.bairro}
                      </span>
                      <span className="ml-2 text-xs font-extrabold text-zinc-600">
                        {formatarCentavos(item.valor_centavos)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    {editando ? (
                      <>
                        <button
                          type="button"
                          disabled={busyBairro}
                          onClick={() => handleSalvarEdicaoBairro(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-bold text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditBairroId(null)}
                          className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={busyBairro}
                          onClick={() => {
                            setEditBairroId(item.id);
                            setEditBairroNome(item.bairro);
                            setEditBairroValor(
                              centavosParaInputReais(item.valor_centavos),
                            );
                          }}
                          aria-label={`Editar ${item.bairro}`}
                          className="rounded-lg border border-zinc-200 p-1.5 text-zinc-600 hover:bg-zinc-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={busyBairro}
                          onClick={() => handleExcluirBairro(item.id)}
                          aria-label={`Excluir ${item.bairro}`}
                          className="rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

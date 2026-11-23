"use client";

import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  MapPin,
  QrCode,
  ShoppingBag,
  Store,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useMemo, useState } from "react";
import { criarPedidoAction } from "@/app/[slug]/checkout/actions";
import {
  formatarCentavos,
  PEDIDO_MINIMO_PLATAFORMA_PADRAO_CENTAVOS,
} from "@/lib/money";
import type { PedidoPixCriadoResumo } from "@/lib/payments/orders";
import {
  calcularCheckoutPreview,
  type BairroPublico,
  type EntregaPublica,
  type TaxaCheckoutPreviewConfig,
} from "@/lib/storefront/cart";
import type { LojaPublicaResumo } from "@/lib/storefront/data";
import { normalizarWhatsapp } from "@/lib/validators/lojista";
import { useCart } from "./CartProvider";
import { PixPaymentView } from "./PixPaymentView";

export function CheckoutClient({
  loja,
  entrega,
  bairros,
  taxaConfig,
  pedidoMinimoPlataformaCentavos = PEDIDO_MINIMO_PLATAFORMA_PADRAO_CENTAVOS,
}: {
  loja: LojaPublicaResumo;
  entrega: EntregaPublica;
  bairros: BairroPublico[];
  taxaConfig?: TaxaCheckoutPreviewConfig;
  pedidoMinimoPlataformaCentavos?: number;
}) {
  const router = useRouter();
  const { items, hydrated, totalItens, limpar } = useCart();

  const tipoInicial: "entrega" | "retirada" = entrega.aceita_entrega
    ? "entrega"
    : "retirada";

  const [tipo, setTipo] = useState<"entrega" | "retirada">(tipoInicial);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteWhatsapp, setClienteWhatsapp] = useState("");
  const [bairroId, setBairroId] = useState<string>(
    bairros.length === 1 ? bairros[0].id : "",
  );
  const [bairroTexto, setBairroTexto] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [referencia, setReferencia] = useState("");
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pixPedido, setPixPedido] = useState<PedidoPixCriadoResumo | null>(null);

  const bairroSelecionado = useMemo(() => {
    if (tipo !== "entrega" || entrega.modo_frete !== "bairro") return null;
    return bairros.find((b) => b.id === bairroId) ?? null;
  }, [tipo, entrega.modo_frete, bairros, bairroId]);

  const resumo = useMemo(
    () =>
      calcularCheckoutPreview({
        itens: items,
        entrega,
        tipo,
        bairroSelecionado,
        taxaConfig,
        pedido_minimo_plataforma_centavos: pedidoMinimoPlataformaCentavos,
      }),
    [
      items,
      entrega,
      tipo,
      bairroSelecionado,
      taxaConfig,
      pedidoMinimoPlataformaCentavos,
    ],
  );

  const lojaHabilitada =
    loja.pronta_para_pedidos &&
    !loja.sem_subconta &&
    loja.aberta &&
    loja.dentro_do_horario;

  const podeEnviar =
    !enviando &&
    lojaHabilitada &&
    items.length > 0 &&
    resumo.pedido_minimo_atingido &&
    resumo.pedido_minimo_plataforma_atingido &&
    !resumo.bairro_pendente &&
    !(tipo === "entrega" && entrega.modo_frete === "bairro" && bairros.length === 0);

  const handlePagamentoConfirmado = useCallback(() => {
    limpar();
    router.refresh();
  }, [limpar, router]);

  const handleGerarNovoPix = useCallback(() => {
    setPixPedido(null);
    setErroForm(null);
    router.refresh();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErroForm(null);

    if (!lojaHabilitada) {
      if (loja.sem_subconta || !loja.pronta_para_pedidos) {
        setErroForm(
          "Esta loja ainda não está configurada para receber pagamentos via Pix.",
        );
      } else if (!loja.aberta) {
        setErroForm("A loja está fechada no momento.");
      } else if (!loja.dentro_do_horario && loja.horario_aviso) {
        setErroForm(loja.horario_aviso);
      } else {
        setErroForm("Esta loja não pode receber pedidos neste momento.");
      }
      return;
    }

    if (clienteNome.trim().length < 2) {
      setErroForm("Informe seu nome completo para o pedido.");
      return;
    }

    if (!normalizarWhatsapp(clienteWhatsapp)) {
      setErroForm("Informe um WhatsApp válido com DDD (ex: 86 99988-7766).");
      return;
    }

    if (tipo === "entrega") {
      if (entrega.modo_frete === "bairro" && !bairroSelecionado) {
        setErroForm("Selecione o bairro de entrega.");
        return;
      }
      if (entrega.modo_frete === "fixo" && bairroTexto.trim().length < 2) {
        setErroForm("Informe o bairro para entrega.");
        return;
      }
      if (rua.trim().length < 2 || numero.trim().length < 1) {
        setErroForm("Informe rua/avenida e número do endereço.");
        return;
      }
    }

    setEnviando(true);
    try {
      const result = await criarPedidoAction(loja.slug, {
        tipo,
        cliente_nome: clienteNome.trim(),
        cliente_whatsapp: clienteWhatsapp.trim(),
        bairro_id:
          tipo === "entrega" && entrega.modo_frete === "bairro"
            ? bairroId || null
            : null,
        bairro_nome:
          tipo === "entrega" && entrega.modo_frete === "fixo"
            ? bairroTexto.trim()
            : null,
        rua: tipo === "entrega" ? rua.trim() : null,
        numero: tipo === "entrega" ? numero.trim() : null,
        complemento: tipo === "entrega" ? complemento.trim() || null : null,
        referencia: tipo === "entrega" ? referencia.trim() || null : null,
        itens: items.map((item) => ({
          produtoId: item.produto.id,
          qtd: item.qtd,
        })),
      });

      if (!result.ok) {
        setErroForm(result.error);
        router.refresh();
        return;
      }

      setPixPedido(result.data);
    } catch {
      setErroForm(
        "Falha de comunicação ao gerar seu pedido Pix. Tente novamente.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (pixPedido) {
    return (
      <PixPaymentView
        lojaNome={loja.nome}
        lojaSlug={loja.slug}
        pedido={pixPedido}
        onPagamentoConfirmado={handlePagamentoConfirmado}
        onGerarNovoPix={handleGerarNovoPix}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-14">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <Link
            href={`/${loja.slug}`}
            className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-zinc-700 transition hover:text-zinc-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao catálogo
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-extrabold text-zinc-950">
              {loja.nome}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                loja.aberta
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-zinc-100 text-zinc-600"
              }`}
            >
              {loja.aberta ? "Aberta" : "Fechada"}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950">
          Finalizar pedido
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Confira seus dados, escolha entrega ou retirada e pague com Pix.
        </p>

        {!hydrated ? (
          <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
            Carregando sua sacola...
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <ShoppingBag className="mx-auto h-10 w-10 text-zinc-300" />
            <h2 className="mt-3 text-base font-bold text-zinc-900">
              Sua sacola está vazia
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              Adicione produtos no catálogo antes de seguir para o checkout.
            </p>
            <Link
              href={`/${loja.slug}`}
              className="mt-5 inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold shadow-sm"
              style={{
                backgroundColor: "var(--cor-primaria)",
                color: "var(--cor-primaria-texto)",
              }}
            >
              Ver catálogo de {loja.nome}
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-6 grid gap-6 lg:grid-cols-12"
          >
            <div className="space-y-5 lg:col-span-7">
              {loja.sem_subconta || !loja.pronta_para_pedidos ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <div>
                    <p className="font-bold">Loja indisponível para pedidos</p>
                    <p className="mt-0.5 text-xs text-red-800">
                      Esta loja ainda não habilitou o recebimento de pagamentos
                      Pix.
                    </p>
                  </div>
                </div>
              ) : !loja.aberta ? (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold">Loja fechada no momento</p>
                    <p className="mt-0.5 text-xs text-amber-800">
                      O botão de pagamento Pix fica indisponível enquanto a loja
                      estiver fechada.
                    </p>
                  </div>
                </div>
              ) : !loja.dentro_do_horario && loja.horario_aviso ? (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold">Fora do horário de atendimento</p>
                    <p className="mt-0.5 text-xs text-amber-800">
                      {loja.horario_aviso}
                    </p>
                  </div>
                </div>
              ) : null}

              {erroForm && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {erroForm}
                </div>
              )}

              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-500">
                  1. Seus dados
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-zinc-800">
                      Seu nome
                    </label>
                    <input
                      type="text"
                      required
                      value={clienteNome}
                      onChange={(e) => setClienteNome(e.target.value)}
                      placeholder="Ex: João Pedro"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-zinc-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-zinc-800">
                      WhatsApp (com DDD)
                    </label>
                    <input
                      type="tel"
                      required
                      value={clienteWhatsapp}
                      onChange={(e) => setClienteWhatsapp(e.target.value)}
                      placeholder="(86) 99988-7766"
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-zinc-400"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-500">
                  2. Entrega ou Retirada
                </h2>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {entrega.aceita_entrega && (
                    <button
                      type="button"
                      onClick={() => setTipo("entrega")}
                      className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                        tipo === "entrega"
                          ? "border-transparent shadow-sm"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                      }`}
                      style={
                        tipo === "entrega"
                          ? {
                              backgroundColor: "var(--cor-primaria)",
                              color: "var(--cor-primaria-texto)",
                            }
                          : undefined
                      }
                    >
                      <Truck className="h-4 w-4" />
                      Entrega
                    </button>
                  )}

                  {entrega.aceita_retirada && (
                    <button
                      type="button"
                      onClick={() => setTipo("retirada")}
                      className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                        tipo === "retirada"
                          ? "border-transparent shadow-sm"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                      }`}
                      style={
                        tipo === "retirada"
                          ? {
                              backgroundColor: "var(--cor-primaria)",
                              color: "var(--cor-primaria-texto)",
                            }
                          : undefined
                      }
                    >
                      <Store className="h-4 w-4" />
                      Retirar na loja
                    </button>
                  )}
                </div>

                {tipo === "retirada" ? (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                    <div>
                      <p className="font-bold text-zinc-900">
                        Retirada na loja — {loja.bairro}, Teresina-PI
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-600">
                        Prazo estimado: {entrega.tempo_estimado_min} min • Sem
                        custo de frete.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {entrega.modo_frete === "bairro" ? (
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-zinc-800">
                          Bairro em Teresina-PI
                        </label>
                        {bairros.length === 0 ? (
                          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                            Esta loja ainda não cadastrou bairros de entrega.
                          </p>
                        ) : (
                          <select
                            required
                            value={bairroId}
                            onChange={(e) => setBairroId(e.target.value)}
                            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-zinc-400"
                          >
                            <option value="">Selecione seu bairro...</option>
                            {bairros.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.bairro} —{" "}
                                {resumo.frete_gratis_atingido
                                  ? "Frete grátis"
                                  : formatarCentavos(b.valor_centavos)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-zinc-800">
                          Bairro (frete fixo{" "}
                          {resumo.frete_gratis_atingido
                            ? "grátis"
                            : formatarCentavos(entrega.frete_fixo_centavos)}
                          )
                        </label>
                        <input
                          type="text"
                          required
                          value={bairroTexto}
                          onChange={(e) => setBairroTexto(e.target.value)}
                          placeholder="Ex: Fátima"
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-zinc-400"
                        />
                      </div>
                    )}

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-sm font-semibold text-zinc-800">
                          Rua / Avenida
                        </label>
                        <input
                          type="text"
                          required
                          value={rua}
                          onChange={(e) => setRua(e.target.value)}
                          placeholder="Ex: Av. Dom Severino"
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-zinc-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-zinc-800">
                          Número
                        </label>
                        <input
                          type="text"
                          required
                          value={numero}
                          onChange={(e) => setNumero(e.target.value)}
                          placeholder="1234"
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-zinc-400"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-zinc-800">
                          Complemento (opcional)
                        </label>
                        <input
                          type="text"
                          value={complemento}
                          onChange={(e) => setComplemento(e.target.value)}
                          placeholder="Apto, bloco, casa"
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-zinc-400"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-zinc-800">
                          Ponto de referência (opcional)
                        </label>
                        <input
                          type="text"
                          value={referencia}
                          onChange={(e) => setReferencia(e.target.value)}
                          placeholder="Próximo à praça"
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-zinc-400"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-500">
                    3. Itens ({totalItens})
                  </h2>
                  <Link
                    href={`/${loja.slug}`}
                    className="text-xs font-bold hover:underline"
                    style={{ color: "var(--cor-primaria)" }}
                  >
                    Alterar itens
                  </Link>
                </div>

                <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                  {items.map(({ produto, qtd, subtotal_centavos }) => (
                    <li
                      key={produto.id}
                      className="flex items-center justify-between py-2.5"
                    >
                      <span className="text-zinc-800">
                        <strong className="font-bold">{qtd}x</strong>{" "}
                        {produto.nome}
                      </span>
                      <span className="font-bold text-zinc-950">
                        {formatarCentavos(subtotal_centavos)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <aside className="lg:col-span-5">
              <div className="sticky top-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-extrabold text-zinc-950">
                  Resumo do pagamento (Pix)
                </h2>

                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex items-center justify-between text-zinc-600">
                    <dt>Produtos</dt>
                    <dd className="font-semibold text-zinc-950">
                      {formatarCentavos(resumo.subtotal_centavos)}
                    </dd>
                  </div>

                  <div className="flex items-center justify-between text-zinc-600">
                    <dt>Frete</dt>
                    <dd className="font-semibold text-zinc-950">
                      {tipo === "retirada" ? (
                        <span className="text-emerald-700">Grátis (retirada)</span>
                      ) : resumo.bairro_pendente ? (
                        <span className="text-zinc-400">Selecione o bairro</span>
                      ) : resumo.frete_centavos === 0 ? (
                        <span className="text-emerald-700">Grátis</span>
                      ) : (
                        formatarCentavos(resumo.frete_centavos)
                      )}
                    </dd>
                  </div>

                  {taxaConfig?.taxa_paga_por === "cliente" && (
                    <div className="flex items-center justify-between text-zinc-600">
                      <dt>Taxa de serviço</dt>
                      <dd className="font-semibold text-zinc-950">
                        {formatarCentavos(resumo.taxa_servico_centavos)}
                      </dd>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-zinc-100 pt-3 text-base font-extrabold text-zinc-950">
                    <dt>Total</dt>
                    <dd>{formatarCentavos(resumo.total_centavos)}</dd>
                  </div>
                </dl>

                {!resumo.pedido_minimo_atingido && (
                  <div className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
                    Pedido mínimo da loja:{" "}
                    {formatarCentavos(entrega.pedido_minimo_centavos)}. Faltam{" "}
                    {formatarCentavos(resumo.falta_pedido_minimo_centavos)} em
                    produtos.
                  </div>
                )}

                {resumo.pedido_minimo_atingido &&
                  !resumo.pedido_minimo_plataforma_atingido && (
                    <div className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
                      Pedido mínimo da plataforma:{" "}
                      {formatarCentavos(pedidoMinimoPlataformaCentavos)}. Faltam{" "}
                      {formatarCentavos(
                        resumo.falta_pedido_minimo_plataforma_centavos,
                      )}{" "}
                      no total.
                    </div>
                  )}

                {resumo.falta_frete_gratis_centavos !== null && (
                  <p className="mt-3 text-xs font-medium text-zinc-500">
                    Faltam{" "}
                    <strong className="text-zinc-800">
                      {formatarCentavos(resumo.falta_frete_gratis_centavos)}
                    </strong>{" "}
                    para frete grátis na entrega.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!podeEnviar}
                  className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: "var(--cor-primaria)",
                    color: "var(--cor-primaria-texto)",
                  }}
                >
                  {enviando ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Gerando Pix...
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4" />
                      Pagar com Pix • {formatarCentavos(resumo.total_centavos)}
                    </>
                  )}
                </button>

                <p className="mt-3 text-center text-[11px] text-zinc-500">
                  Pagamento exclusivo via Pix. Valores finais confirmados no
                  servidor ao gerar a cobrança.
                </p>
              </div>
            </aside>
          </form>
        )}
      </main>
    </div>
  );
}

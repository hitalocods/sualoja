import { eq, isNull } from "drizzle-orm";
import { db } from "./index";
import {
  lojas,
  pedido_itens,
  pedidos,
  planos,
  produtos,
  type EnderecoEntrega,
} from "./schema";
import { calcularTaxaServicoCentavos } from "../lib/money";

function createMulberry32(seed: number) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLIENTES_DEMO = [
  { nome: "Beatriz Almeida", whatsapp: "5586999112233" },
  { nome: "Lucas Ferreira", whatsapp: "5586999223344" },
  { nome: "Mariana Costa", whatsapp: "5586999334455" },
  { nome: "Gabriel Santos", whatsapp: "5586999445566" },
  { nome: "Juliana Ribeiro", whatsapp: "5586999556677" },
  { nome: "Pedro Henrique", whatsapp: "5586999667788" },
  { nome: "Larissa Monteiro", whatsapp: "5586999778899" },
  { nome: "Thiago Oliveira", whatsapp: "5586999880011" },
  { nome: "Fernanda Cavalcante", whatsapp: "5586999991122" },
  { nome: "Matheus Rocha", whatsapp: "5586998123456" },
  { nome: "Camila Nogueira", whatsapp: "5586998234567" },
  { nome: "Bruno Carvalho", whatsapp: "5586998345678" },
];

const RUAS_TERESINA = [
  { rua: "Av. Nossa Senhora de Fátima", bairro: "Fátima" },
  { rua: "Rua Angélica", bairro: "Jóquei" },
  { rua: "Av. Homero Castelo Branco", bairro: "Horto" },
  { rua: "Rua Elias João Tajra", bairro: "Jóquei" },
  { rua: "Av. Frei Serafim", bairro: "Centro" },
  { rua: "Rua Coelho de Resende", bairro: "Centro" },
];

const SLUG_WEIGHTS: Record<string, number> = {
  "casa-atelier": 0.58,
  "norte-tech": 0.28,
  "estudio-lumina": 0.14,
};

export async function seedDemoOrders(): Promise<number> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SEED_DEMO é proibido em ambiente de produção.");
  }
  if (process.env.SEED_DEMO !== "true") {
    return 0;
  }

  // Idempotência: remove apenas pedidos demo anteriores sem tocar em dados reais.
  await db.delete(pedidos).where(eq(pedidos.demo, true));

  const lojasRows = await db
    .select({
      id: lojas.id,
      slug: lojas.slug,
      taxa_fixa_centavos: planos.taxa_fixa_centavos,
      taxa_percentual: planos.taxa_percentual,
    })
    .from(lojas)
    .innerJoin(planos, eq(lojas.plano_id, planos.id))
    .where(isNull(lojas.deletada_em));

  if (lojasRows.length === 0) {
    console.log("Nenhuma loja encontrada para gerar pedidos demo.");
    return 0;
  }

  const produtosRows = await db
    .select({
      id: produtos.id,
      loja_id: produtos.loja_id,
      nome: produtos.nome,
      preco_centavos: produtos.preco_centavos,
    })
    .from(produtos);

  const produtosPorLoja = new Map<
    string,
    { id: string; nome: string; preco_centavos: number }[]
  >();
  for (const prod of produtosRows) {
    const arr = produtosPorLoja.get(prod.loja_id) ?? [];
    arr.push({ id: prod.id, nome: prod.nome, preco_centavos: prod.preco_centavos });
    produtosPorLoja.set(prod.loja_id, arr);
  }

  // Monta distribuição ponderada das lojas
  const weightedStores = lojasRows.map((l) => ({
    ...l,
    weight: SLUG_WEIGHTS[l.slug] ?? 1 / lojasRows.length,
  }));
  const totalStoreWeight = weightedStores.reduce((acc, s) => acc + s.weight, 0);

  // Calcula peso por dia dos últimos 90 dias (dia 89 = 89 dias atrás -> dia 0 = hoje)
  // Combina crescimento gradual linear com picos nos fins de semana (sex/sab/dom)
  const rng = createMulberry32(20261122);
  const agora = new Date();
  const baseHojeMeiaNoite = Date.UTC(
    agora.getUTCFullYear(),
    agora.getUTCMonth(),
    agora.getUTCDate(),
    15, // 12:00 BRT
    0,
    0,
  );

  const dayBuckets: { dayOffset: number; cumulative: number }[] = [];
  let cumulative = 0;
  for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
    const dt = new Date(baseHojeMeiaNoite - daysAgo * 86_400_000);
    const dow = dt.getUTCDay(); // 0 dom, 5 sex, 6 sab
    const progress = (89 - daysAgo) / 89; // 0 -> 1
    const growthFactor = 0.55 + progress * 1.15;
    const weekendFactor = dow === 0 || dow === 5 || dow === 6 ? 1.55 : 1.0;
    cumulative += growthFactor * weekendFactor;
    dayBuckets.push({ dayOffset: daysAgo, cumulative });
  }

  const TOTAL_PEDIDOS = 400;
  const lojaCounters = new Map<string, number>();

  interface DraftPedido {
    loja_id: string;
    codigo: string;
    status: "pago";
    cliente_nome: string;
    cliente_whatsapp: string;
    tipo: "entrega" | "retirada";
    endereco: EnderecoEntrega | null;
    subtotal_centavos: number;
    frete_centavos: number;
    taxa_servico_centavos: number;
    taxa_paga_por: "loja";
    total_centavos: number;
    pago_em: Date;
    demo: true;
    criado_em: Date;
    _produto: { id: string | null; nome: string; qtd: number; unitCentavos: number };
  }

  const drafts: DraftPedido[] = [];

  for (let i = 0; i < TOTAL_PEDIDOS; i++) {
    // Seleciona dia respeitando curva de crescimento + pico fim de semana
    const pickDay = rng() * cumulative;
    const dayEntry =
      dayBuckets.find((b) => pickDay <= b.cumulative) ??
      dayBuckets[dayBuckets.length - 1];

    // Seleciona loja ponderada
    const pickStore = rng() * totalStoreWeight;
    let accStore = 0;
    let lojaAlvo = weightedStores[weightedStores.length - 1];
    for (const st of weightedStores) {
      accStore += st.weight;
      if (pickStore <= accStore) {
        lojaAlvo = st;
        break;
      }
    }

    const seq = (lojaCounters.get(lojaAlvo.id) ?? 0) + 1;
    lojaCounters.set(lojaAlvo.id, seq);

    const cliente = CLIENTES_DEMO[Math.floor(rng() * CLIENTES_DEMO.length)];
    const isEntrega = rng() < 0.74;
    const qtd = rng() < 0.72 ? 1 : 2;
    // Subtotal entre R$ 40,00 (4000) e R$ 400,00 (40000)
    const targetSubtotal = 4000 + Math.floor(rng() * 36001);
    const unitCentavos = Math.max(2000, Math.round(targetSubtotal / qtd / 10) * 10);
    const subtotalCentavos = unitCentavos * qtd;
    const freteCentavos = isEntrega
      ? subtotalCentavos >= 25000
        ? 0
        : 600 + Math.floor(rng() * 7) * 100
      : 0;
    const taxaServicoCentavos = calcularTaxaServicoCentavos({
      subtotal_centavos: subtotalCentavos,
      taxa_fixa_centavos: lojaAlvo.taxa_fixa_centavos,
      taxa_percentual: lojaAlvo.taxa_percentual,
    });
    const totalCentavos = subtotalCentavos + freteCentavos;

    // Hora dentro do dia (09h..21h BRT -> 12h..24h UTC)
    const hourOffsetMs = Math.floor(rng() * 12 * 60 * 60 * 1000) - 3 * 3600_000;
    const createdAt = new Date(
      baseHojeMeiaNoite - dayEntry.dayOffset * 86_400_000 + hourOffsetMs,
    );
    const clampedCreatedAt =
      createdAt.getTime() > agora.getTime()
        ? new Date(agora.getTime() - Math.floor(rng() * 3600_000))
        : createdAt;
    const paidAt = new Date(clampedCreatedAt.getTime() + Math.floor(rng() * 180_000) + 15_000);

    const ruaDemo = RUAS_TERESINA[Math.floor(rng() * RUAS_TERESINA.length)];
    const lojaProdutos = produtosPorLoja.get(lojaAlvo.id) ?? [];
    const prodEscolhido =
      lojaProdutos.length > 0
        ? lojaProdutos[Math.floor(rng() * lojaProdutos.length)]
        : null;

    drafts.push({
      loja_id: lojaAlvo.id,
      codigo: `DEMO-${String(seq).padStart(4, "0")}`,
      status: "pago",
      cliente_nome: cliente.nome,
      cliente_whatsapp: cliente.whatsapp,
      tipo: isEntrega ? "entrega" : "retirada",
      endereco: isEntrega
        ? {
            rua: ruaDemo.rua,
            numero: String(100 + Math.floor(rng() * 900)),
            bairro: ruaDemo.bairro,
            cidade: "Teresina",
            uf: "PI",
          }
        : null,
      subtotal_centavos: subtotalCentavos,
      frete_centavos: freteCentavos,
      taxa_servico_centavos: taxaServicoCentavos,
      taxa_paga_por: "loja",
      total_centavos: totalCentavos,
      pago_em: paidAt,
      demo: true,
      criado_em: clampedCreatedAt,
      _produto: {
        id: prodEscolhido?.id ?? null,
        nome: prodEscolhido?.nome ?? "Item Demonstração",
        qtd,
        unitCentavos,
      },
    });
  }

  // Insere em chunks de 100 para máxima performance sem exceder limite de parâmetros
  const CHUNK_SIZE = 100;
  let inseridos = 0;

  for (let start = 0; start < drafts.length; start += CHUNK_SIZE) {
    const chunk = drafts.slice(start, start + CHUNK_SIZE);
    const createdOrders = await db
      .insert(pedidos)
      .values(
        chunk.map((d) => ({
          loja_id: d.loja_id,
          codigo: d.codigo,
          status: d.status,
          cliente_nome: d.cliente_nome,
          cliente_whatsapp: d.cliente_whatsapp,
          tipo: d.tipo,
          endereco: d.endereco,
          subtotal_centavos: d.subtotal_centavos,
          frete_centavos: d.frete_centavos,
          taxa_servico_centavos: d.taxa_servico_centavos,
          taxa_paga_por: d.taxa_paga_por,
          total_centavos: d.total_centavos,
          pago_em: d.pago_em,
          demo: d.demo,
          criado_em: d.criado_em,
        })),
      )
      .returning({ id: pedidos.id, loja_id: pedidos.loja_id });

    await db.insert(pedido_itens).values(
      createdOrders.map((order, idx) => {
        const draft = chunk[idx];
        return {
          loja_id: order.loja_id,
          pedido_id: order.id,
          produto_id: draft._produto.id,
          nome_snapshot: draft._produto.nome,
          preco_snapshot_centavos: draft._produto.unitCentavos,
          qtd: draft._produto.qtd,
        };
      }),
    );

    inseridos += createdOrders.length;
  }

  console.log(`Seed demo concluído: ${inseridos} pedidos 'pago' (últimos 90 dias).`);
  return inseridos;
}

import { eq } from "drizzle-orm";
import {
  ArrowRight,
  MapPin,
  Package,
  Palette,
  Settings,
  ShoppingBag,
  Truck,
} from "lucide-react";
import Link from "next/link";
import { LojaAbertaToggle } from "@/components/painel/LojaAbertaToggle";
import {
  assinaturas,
  bairros_entrega,
  lojas_entrega,
  pedidos,
  produtos,
} from "@/db/schema";
import { formatarCentavos } from "@/lib/money";
import { getPanelTenantContext } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function PainelPage() {
  const { loja, tenantDb } = await getPanelTenantContext();
  const incluirDemo =
    process.env.NODE_ENV !== "production" && process.env.SEED_DEMO === "true";

  const [entrega, assinatura, totalProdutos, totalBairros, totalPedidos] =
    await Promise.all([
      tenantDb.findFirst(lojas_entrega),
      tenantDb.findFirst(assinaturas),
      tenantDb.count(produtos),
      tenantDb.count(bairros_entrega),
      tenantDb.count(pedidos, incluirDemo ? undefined : eq(pedidos.demo, false)),
    ]);

  const atalhos = [
    {
      href: "/painel/produtos",
      titulo: "Produtos",
      desc: "Crie, edite, ajuste estoque e suba fotos.",
      icon: Package,
    },
    {
      href: "/painel/aparencia",
      titulo: "Aparência",
      desc: "Cores, fonte, logo e banner com preview ao vivo.",
      icon: Palette,
    },
    {
      href: "/painel/entrega",
      titulo: "Entrega e Horários",
      desc: "Retirada, frete fixo ou por bairro e horários.",
      icon: Truck,
    },
    {
      href: "/painel/dados",
      titulo: "Dados da loja",
      desc: "Nome, WhatsApp e quem paga a taxa de serviço.",
      icon: Settings,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-zinc-950">
            Visão geral
          </h1>
          <p className="mt-0.5 text-sm text-zinc-600">
            {loja.categoria} • {loja.bairro}, Teresina-PI
          </p>
        </div>
        <LojaAbertaToggle abertaInicial={loja.aberta} />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold">Produtos</span>
            <Package className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-extrabold">{totalProdutos}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold">Pedidos</span>
            <ShoppingBag className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-extrabold">{totalPedidos}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold">Bairros</span>
            <MapPin className="h-4 w-4" />
          </div>
          <p className="mt-2 text-2xl font-extrabold">{totalBairros}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold text-zinc-500">
            Assinatura
          </span>
          <p className="mt-2 text-base font-extrabold capitalize">
            {assinatura?.status ?? "trial"}
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {atalhos.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow"
            >
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800 transition group-hover:bg-zinc-950 group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-extrabold text-zinc-950">
                    {item.titulo}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-600">{item.desc}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-900" />
            </Link>
          );
        })}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-zinc-900">
          Configuração rápida atual
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-zinc-50 p-3">
            <dt className="text-xs font-medium text-zinc-500">Pedido mínimo</dt>
            <dd className="mt-0.5 font-bold">
              {formatarCentavos(entrega?.pedido_minimo_centavos ?? 0)}
            </dd>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3">
            <dt className="text-xs font-medium text-zinc-500">
              Tempo estimado
            </dt>
            <dd className="mt-0.5 font-bold">
              {entrega?.tempo_estimado_min ?? 40} min
            </dd>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3">
            <dt className="text-xs font-medium text-zinc-500">
              Taxa de serviço Pix
            </dt>
            <dd className="mt-0.5 font-bold">
              {loja.taxa_paga_por === "cliente"
                ? "Repassada ao cliente"
                : "Absorvida pela loja"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

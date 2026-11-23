"use client";

import {
  ArrowRight,
  CheckCircle2,
  Palette,
  Share2,
  Sparkles,
  Store,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatarCentavos } from "@/lib/money";
import { FaqSection } from "./FaqSection";
import {
  HeroPhoneMockup,
  type LojaModeloPreview,
} from "./HeroPhoneMockup";
import { ThemeShowcase } from "./ThemeShowcase";

export type PlanoLanding = {
  id: string;
  nome: string;
  mensalidade_centavos: number;
  limite_produtos: number | null;
  taxa_fixa_centavos: number;
  taxa_percentual: string;
};

type MetricaItem = {
  target: number;
  suffix: string;
  label: string;
  detail: string;
};

function criarMetricas(diasTrial: number): MetricaItem[] {
  return [
    {
      target: diasTrial,
      suffix: diasTrial === 1 ? " dia" : " dias",
      label: "Teste grátis",
      detail: "Comece sem cartão ao cadastrar sua loja",
    },
    {
      target: 8,
      suffix: " fontes",
      label: "Identidade própria",
      detail: "Combine cores, tipografia, logo e banner",
    },
    {
      target: 3,
      suffix: " min",
      label: "Para publicar",
      detail: "Do cadastro ao link pronto para compartilhar",
    },
    {
      target: 100,
      suffix: "%",
      label: "Validação no servidor",
      detail: "Preços, frete e estoque protegidos no backend",
    },
  ];
}

const BENEFICIOS_MARQUEE = [
  "Moda & Acessórios",
  "Beleza & Cosméticos",
  "Doces & Confeitaria",
  "Eletrônicos",
  "Casa & Decoração",
  "Serviços Locais",
  "Frete por Bairro",
  "Retirada na Loja",
  "Contraste Automático",
  "Controle de Estoque",
  "Catálogo Mobile-First",
];

const PASSOS = [
  {
    numero: "01",
    titulo: "Cadastre sua loja",
    descricao:
      "Informe seus dados básicos, escolha sua categoria e garanta seu endereço exclusivo em meudominio.com/sualoja.",
    icon: UserPlus,
  },
  {
    numero: "02",
    titulo: "Personalize cor, fonte e logo",
    descricao:
      "Defina cor primária, secundária, fonte, logo, banner, produtos com estoque e regras de entrega por bairro.",
    icon: Palette,
  },
  {
    numero: "03",
    titulo: "Compartilhe o link",
    descricao:
      "Divulgue sua loja no WhatsApp, Instagram ou cartão e receba pedidos organizados com cálculo exato de frete.",
    icon: Share2,
  },
];

function formatarTaxaPlano(
  taxaFixaCentavos: number,
  taxaPercentual: string,
): string {
  const percentualFmt = `${taxaPercentual.replace(".", ",")}%`;
  if (taxaFixaCentavos > 0) {
    return `Taxa por pedido: ${formatarCentavos(taxaFixaCentavos)} + ${percentualFmt}`;
  }
  return `Taxa por pedido: ${percentualFmt} (sem taxa fixa)`;
}

export function LandingPage({
  planos,
  lojaModelo,
  diasTrial = 14,
}: {
  planos: PlanoLanding[];
  lojaModelo: LojaModeloPreview;
  diasTrial?: number;
}) {
  const metricas = useMemo(() => criarMetricas(diasTrial), [diasTrial]);
  const labelDiasTrial = diasTrial === 1 ? "1 dia" : `${diasTrial} dias`;
  const metricsRef = useRef<HTMLDivElement | null>(null);
  const [animados, setAnimados] = useState<number[] | null>(null);
  const contadores = animados ?? metricas.map((m) => m.target);
  const animouContadoresRef = useRef(false);

  // Reveal suave ao rolar (respeitando prefers-reduced-motion)
  useEffect(() => {
    const items = Array.from(
      document.querySelectorAll<HTMLElement>("[data-landing-reveal]"),
    );
    if (items.length === 0) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      for (const el of items) el.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -24px 0px" },
    );

    for (const el of items) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
        el.classList.add("is-visible");
      } else {
        observer.observe(el);
      }
    }

    return () => observer.disconnect();
  }, []);

  // Contadores animados ao entrar na viewport
  useEffect(() => {
    const targetEl = metricsRef.current;
    if (!targetEl) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion || typeof IntersectionObserver === "undefined") {
      return;
    }

    let rafId = 0;

    const dispararAnimacao = () => {
      if (animouContadoresRef.current) return;
      animouContadoresRef.current = true;
      const inicio = performance.now();
      const duracao = 950;

      const step = (agora: number) => {
        const progresso = Math.min(1, (agora - inicio) / duracao);
        const eased = 1 - Math.pow(1 - progresso, 3);
        setAnimados(metricas.map((m) => Math.round(m.target * eased)));
        if (progresso < 1) {
          rafId = window.requestAnimationFrame(step);
        }
      };

      setAnimados(metricas.map(() => 0));
      rafId = window.requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          dispararAnimacao();
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(targetEl);
    return () => {
      observer.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [metricas]);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[#09090B] text-zinc-100 selection:bg-white selection:text-zinc-950">
      {/* Glow editorial sutil no topo */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[520px] opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% -10%, rgba(159, 18, 57, 0.34), transparent 75%)",
        }}
      />

      {/* Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#09090B]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-2 px-4 py-3.5 sm:px-6 sm:py-4">
          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2 font-extrabold tracking-tight text-white sm:gap-2.5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950">
              <Store className="h-4 w-4" />
            </span>
            <span className="truncate text-base sm:text-lg">MinhaLoja</span>
          </Link>

          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-7 text-sm font-medium text-zinc-400 md:flex"
          >
            <a href="#como-funciona" className="transition hover:text-white">
              Como funciona
            </a>
            <a href="#personalizacao" className="transition hover:text-white">
              Personalização
            </a>
            <a href="#planos" className="transition hover:text-white">
              Planos
            </a>
            <a href="#faq" className="transition hover:text-white">
              FAQ
            </a>
          </nav>

          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2.5">
            <Link
              href="/login"
              className="rounded-full px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.06] hover:text-white sm:px-4 sm:text-sm"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-full bg-white px-3.5 py-2 text-xs font-bold text-zinc-950 transition hover:bg-zinc-200 sm:px-5 sm:py-2.5 sm:text-sm"
            >
              Criar loja
            </Link>
          </div>
        </div>
      </header>

      <main className="relative w-full max-w-full overflow-x-clip">
        {/* 1) Hero */}
        <section className="mx-auto w-full max-w-[1200px] px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:pb-24 lg:pt-24">
          <div className="grid w-full max-w-full items-start gap-10 lg:grid-cols-[minmax(0,1fr)_350px] lg:items-start lg:gap-12 xl:gap-16">
            <div className="w-full min-w-0 max-w-full">
              <div className="inline-flex max-w-full items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold leading-snug text-zinc-300 sm:items-center sm:rounded-full sm:px-4">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400 sm:mt-0" />
                <span className="min-w-0 break-words">
                  Para moda, beleza, doces, eletrônicos, serviços e muito mais
                </span>
              </div>

              <h1 className="mt-6 max-w-full text-balance break-words [overflow-wrap:anywhere] text-[clamp(1.9rem,8.2vw,3.375rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-white lg:text-wrap lg:break-normal lg:[overflow-wrap:normal] lg:text-[clamp(2.35rem,3.8vw,3.375rem)]">
                Sua loja online em{" "}
                <span className="break-words [overflow-wrap:anywhere] bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent lg:block lg:w-fit lg:whitespace-nowrap lg:break-normal lg:[overflow-wrap:normal]">
                  meudominio.com/<wbr />sualoja
                </span>
              </h1>

              <p className="mt-5 max-w-full break-words text-base leading-relaxed text-zinc-400 sm:mt-6 sm:max-w-xl sm:text-xl">
                Monte seu catálogo com a identidade da sua marca, controle
                estoque em tempo real e configure frete por bairro direto do
                celular.
              </p>

              <div className="mt-8 flex w-full max-w-full flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap sm:items-center">
                <Link
                  href="/cadastro"
                  className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-4 text-center text-sm font-extrabold leading-snug whitespace-normal text-zinc-950 shadow-[0_20px_50px_-16px_rgba(255,255,255,0.45)] transition hover:bg-zinc-200 active:scale-[0.98] sm:w-auto sm:px-7"
                >
                  <span>Criar minha loja grátis ({labelDiasTrial})</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>

                <Link
                  href={`/${lojaModelo.slug}`}
                  className="inline-flex w-full max-w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-4 text-center text-sm font-bold leading-snug whitespace-normal text-white transition hover:border-white/30 hover:bg-white/[0.08] sm:w-auto sm:px-7"
                >
                  Ver loja modelo
                </Link>
              </div>
            </div>

            <div className="w-full min-w-0 max-w-full">
              <HeroPhoneMockup lojaModelo={lojaModelo} />
            </div>
          </div>
        </section>

        {/* 2) Faixa de números & benefícios */}
        <section className="border-y border-white/[0.06] bg-white/[0.015] py-14 sm:py-16">
          <div
            ref={metricsRef}
            className="mx-auto grid max-w-[1200px] grid-cols-2 gap-4 px-4 sm:px-6 lg:grid-cols-4 lg:gap-6"
          >
            {metricas.map((item, idx) => (
              <div
                key={item.label}
                data-landing-reveal
                className="landing-reveal min-w-0 rounded-[24px] border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6"
              >
                <p className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  {contadores[idx]}
                  <span className="text-zinc-400">{item.suffix}</span>
                </p>
                <p className="mt-2 text-sm font-bold text-zinc-200">
                  {item.label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 overflow-hidden">
            <div className="landing-marquee-track gap-3 px-4">
              {BENEFICIOS_MARQUEE.map((tag) => (
                <span
                  key={tag}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-zinc-300"
                >
                  {tag}
                </span>
              ))}
              {BENEFICIOS_MARQUEE.map((tag) => (
                <span
                  key={`${tag}-dup`}
                  aria-hidden="true"
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-zinc-300 motion-reduce:hidden"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* 3) Como funciona em 3 passos */}
        <section
          id="como-funciona"
          className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 sm:py-28"
        >
          <div data-landing-reveal className="landing-reveal max-w-2xl">
            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-300">
              Como funciona
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Do cadastro ao catálogo no ar em três passos.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
              Sem código, sem planilhas e sem depender de terceiros para atualizar
              seus produtos.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PASSOS.map((passo) => {
              const Icon = passo.icon;
              return (
                <article
                  key={passo.numero}
                  data-landing-reveal
                  className="landing-reveal landing-card-hover flex flex-col justify-between rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-7 sm:p-8"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="font-mono text-sm font-bold text-zinc-500">
                        {passo.numero}
                      </span>
                    </div>

                    <h3 className="mt-8 text-xl font-extrabold tracking-tight text-white">
                      {passo.titulo}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
                      {passo.descricao}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* 4) Personalização: mesma loja em 3 temas lado a lado */}
        <section
          id="personalizacao"
          className="border-y border-white/[0.06] bg-white/[0.015] py-20 sm:py-28"
        >
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
            <div data-landing-reveal className="landing-reveal max-w-2xl">
              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-300">
                Personalização em tempo real
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                A mesma loja, três personalidades.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
                Troque cor primária, secundária, tipografia, logo e banner no
                painel. Toda a vitrine se adapta instantaneamente com contraste
                legível.
              </p>
            </div>

            <div data-landing-reveal className="landing-reveal mt-12">
              <ThemeShowcase />
            </div>
          </div>
        </section>

        {/* 5) Planos vindos do banco */}
        <section
          id="planos"
          className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6 sm:py-28"
        >
          <div data-landing-reveal className="landing-reveal max-w-2xl">
            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-300">
              Planos
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Estrutura que acompanha o seu catálogo.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
              Comece com {labelDiasTrial} grátis ao cadastrar sua loja.
              Mensalidade e taxa Pix por pedido sem surpresas.
            </p>
          </div>

          {planos.length === 0 ? (
            <div className="mt-12 rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-8 text-center text-sm text-zinc-400">
              Nenhum plano cadastrado no banco no momento.
            </div>
          ) : (
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {planos.map((plano) => {
                const destaque = plano.nome.trim().toLowerCase() === "pro";

                return (
                  <div
                    key={plano.id}
                    data-landing-reveal
                    className={`landing-reveal landing-card-hover flex min-w-0 flex-col justify-between rounded-[28px] border p-7 sm:p-8 ${
                      destaque
                        ? "border-white/30 bg-gradient-to-b from-white/[0.09] to-white/[0.03] shadow-[0_30px_80px_-30px_rgba(255,255,255,0.22)]"
                        : "border-white/[0.08] bg-white/[0.025]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xl font-extrabold text-white">
                          {plano.nome}
                        </h3>
                        {destaque && (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-zinc-950">
                            Mais escolhido
                          </span>
                        )}
                      </div>

                      <div className="mt-6 flex items-baseline gap-1.5">
                        <span className="text-4xl font-extrabold tracking-tight text-white">
                          {formatarCentavos(plano.mensalidade_centavos)}
                        </span>
                        <span className="text-sm font-medium text-zinc-400">
                          /mês
                        </span>
                      </div>

                      <ul className="mt-7 space-y-3.5 text-sm text-zinc-300">
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                          <span>
                            {plano.limite_produtos === null
                              ? "Produtos ilimitados no catálogo"
                              : `Até ${plano.limite_produtos} produtos no catálogo`}
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                          <span>
                            {formatarTaxaPlano(
                              plano.taxa_fixa_centavos,
                              plano.taxa_percentual,
                            )}
                          </span>
                        </li>
                        <li className="flex items-start gap-2.5">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                          <span>
                            Tema personalizável, frete por bairro e painel de gestão
                          </span>
                        </li>
                      </ul>
                    </div>

                    <Link
                      href="/cadastro"
                      className={`mt-8 block rounded-full py-3.5 text-center text-sm font-extrabold transition active:scale-[0.98] ${
                        destaque
                          ? "bg-white text-zinc-950 hover:bg-zinc-200"
                          : "border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12]"
                      }`}
                    >
                      Começar teste de {labelDiasTrial}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 6) FAQ e CTA Final */}
        <section
          id="faq"
          className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 sm:px-6 sm:pb-32"
        >
          <div className="grid gap-12 lg:grid-cols-12">
            <div data-landing-reveal className="landing-reveal min-w-0 lg:col-span-4">
              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-zinc-300">
                Dúvidas frequentes
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Tudo o que você precisa saber antes de começar.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
                Transparência total sobre como criar, personalizar e operar a
                sua loja na plataforma.
              </p>
            </div>

            <div data-landing-reveal className="landing-reveal min-w-0 lg:col-span-8">
              <FaqSection diasTrial={diasTrial} />
            </div>
          </div>

          <div
            data-landing-reveal
            className="landing-reveal mt-20 overflow-hidden rounded-[32px] border border-white/15 bg-gradient-to-br from-white/[0.09] via-white/[0.04] to-transparent p-6 text-center sm:mt-24 sm:p-14"
          >
            <h2 className="mx-auto max-w-2xl text-balance text-2xl font-extrabold tracking-tight text-white sm:text-5xl">
              Pronto para colocar sua loja no ar hoje?
            </h2>
            <p className="mx-auto mt-4 max-w-xl break-words text-base text-zinc-400 sm:text-lg">
              Crie seu endereço em meudominio.com/<wbr />sualoja, personalize o
              visual com sua marca e experimente por {labelDiasTrial} grátis.
            </p>
            <div className="mt-8 flex w-full flex-col justify-center gap-3.5 sm:flex-row">
              <Link
                href="/cadastro"
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-4 text-center text-sm font-extrabold leading-snug whitespace-normal text-zinc-950 transition hover:bg-zinc-200 active:scale-[0.98] sm:w-auto sm:px-7"
              >
                <span>Criar minha loja grátis ({labelDiasTrial})</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Link>
              <Link
                href={`/${lojaModelo.slug}`}
                className="inline-flex w-full items-center justify-center rounded-full border border-white/15 bg-white/[0.05] px-5 py-4 text-center text-sm font-bold leading-snug whitespace-normal text-white transition hover:bg-white/[0.1] sm:w-auto sm:px-7"
              >
                Ver loja modelo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-4 text-xs text-zinc-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2 font-semibold text-zinc-400">
            <Store className="h-4 w-4 shrink-0" />
            <span>MinhaLoja</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <Link
              href={`/${lojaModelo.slug}`}
              className="transition hover:text-zinc-300"
            >
              Loja modelo
            </Link>
            <Link href="/login" className="transition hover:text-zinc-300">
              Painel do lojista
            </Link>
            <Link href="/cadastro" className="transition hover:text-zinc-300">
              Criar loja
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

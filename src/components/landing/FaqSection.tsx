"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

export function FaqSection({ diasTrial = 14 }: { diasTrial?: number }) {
  const faqItems = useMemo(() => {
    const labelDias = diasTrial === 1 ? "1 dia" : `${diasTrial} dias`;
    return [
      {
        id: "dominio",
        pergunta: "Preciso de domínio próprio ou saber programar?",
        resposta:
          "Não. Ao cadastrar sua loja você escolhe seu endereço em meudominio.com/sualoja e já gerencia produtos, aparência, horários e taxas de entrega direto pelo painel no celular ou computador.",
      },
      {
        id: "segmentos",
        pergunta: "Para quais segmentos a MinhaLoja serve?",
        resposta:
          "A plataforma é genérica e atende moda, beleza, doces, eletrônicos, casa e decoração, alimentação, serviços e qualquer negócio que precise exibir catálogo com estoque atualizado e recebimento de pedidos.",
      },
      {
        id: "trial",
        pergunta: `Como funciona o teste grátis de ${labelDias}?`,
        resposta: `Ao concluir o cadastro, sua assinatura inicia em período de teste por ${labelDias} sem precisar informar cartão. Você já pode montar todo o catálogo, subir imagens e personalizar o tema enquanto sua loja é ativada.`,
      },
      {
        id: "tema",
        pergunta: "Posso personalizar cores, fontes, logo e banner?",
        resposta:
          "Sim. No editor de aparência você escolhe cor primária, cor secundária, uma entre 8 tipografias e envia logo e banner com preview ao vivo. O contraste de texto é ajustado automaticamente.",
      },
      {
        id: "frete",
        pergunta: "Como funciona o cálculo de frete e retirada?",
        resposta:
          "Você decide se aceita entrega, retirada na loja ou ambos. Na entrega, é possível configurar frete fixo, tabela por bairro com valores específicos, pedido mínimo e faixa para frete grátis.",
      },
      {
        id: "pagamentos",
        pergunta: "Os pagamentos online já estão disponíveis?",
        resposta:
          "O catálogo público, o controle de estoque, as regras de frete e a revisão do pedido no checkout já estão prontos. A integração de pagamentos online está em desenvolvimento e será conectada na próxima etapa.",
      },
    ];
  }, [diasTrial]);

  const [abertoId, setAbertoId] = useState<string | null>(faqItems[0].id);

  return (
    <div className="space-y-3">
      {faqItems.map((item) => {
        const aberto = abertoId === item.id;
        const panelId = `faq-panel-${item.id}`;
        const buttonId = `faq-btn-${item.id}`;

        return (
          <div
            key={item.id}
            className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.03] transition-colors hover:border-white/15"
          >
            <button
              id={buttonId}
              type="button"
              aria-expanded={aberto}
              aria-controls={panelId}
              onClick={() => setAbertoId(aberto ? null : item.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left sm:px-7 sm:py-6"
            >
              <span className="text-base font-bold tracking-tight text-white sm:text-lg">
                {item.pergunta}
              </span>
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-zinc-200 transition-transform duration-300 motion-reduce:transition-none ${
                  aberto ? "rotate-45 bg-white text-zinc-950" : ""
                }`}
              >
                <Plus className="h-4 w-4" />
              </span>
            </button>

            {aberto && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                className="px-5 pb-6 text-sm leading-relaxed text-zinc-400 sm:px-7 sm:text-base"
              >
                {item.resposta}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { z } from "zod";
import { normalizarWhatsapp } from "./lojista";
import { UUID_SCHEMA } from "./painel";

export const itemPedidoCheckoutSchema = z.object({
  produtoId: UUID_SCHEMA,
  qtd: z
    .number({ error: "Quantidade inválida." })
    .int("Quantidade deve ser um número inteiro.")
    .min(1, "Quantidade mínima é 1 unidade.")
    .max(99, "Quantidade máxima por item é 99 unidades."),
});

export const criarPedidoPayloadSchema = z.object({
  tipo: z.enum(["entrega", "retirada"], {
    error: "Selecione entrega ou retirada.",
  }),
  cliente_nome: z
    .string({ error: "Informe seu nome completo." })
    .trim()
    .min(2, "Informe seu nome completo.")
    .max(120, "Nome muito longo."),
  cliente_whatsapp: z
    .string({ error: "Informe seu WhatsApp." })
    .trim()
    .transform((val, ctx) => {
      const normalized = normalizarWhatsapp(val);
      if (!normalized) {
        ctx.addIssue({
          code: "custom",
          message: "Informe um WhatsApp válido com DDD.",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  bairro_id: UUID_SCHEMA.nullable().optional(),
  bairro_nome: z.string().trim().max(80).nullable().optional(),
  cep: z.string().trim().max(12).nullable().optional(),
  rua: z.string().trim().max(140).nullable().optional(),
  numero: z.string().trim().max(20).nullable().optional(),
  complemento: z.string().trim().max(120).nullable().optional(),
  referencia: z.string().trim().max(160).nullable().optional(),
  itens: z
    .array(itemPedidoCheckoutSchema, {
      error: "Informe os itens do pedido.",
    })
    .min(1, "Seu carrinho está vazio.")
    .max(50, "Máximo de 50 itens por pedido."),
});

export type CriarPedidoPayload = z.infer<typeof criarPedidoPayloadSchema>;

export function consolidarItensCheckout(
  itens: ReadonlyArray<{ produtoId: string; qtd: number }>,
): Array<{ produtoId: string; qtd: number }> {
  const map = new Map<string, number>();
  for (const item of itens) {
    const atual = map.get(item.produtoId) ?? 0;
    map.set(item.produtoId, atual + Math.trunc(item.qtd));
  }
  return Array.from(map.entries())
    .map(([produtoId, qtd]) => ({ produtoId, qtd }))
    .sort((a, b) => a.produtoId.localeCompare(b.produtoId));
}

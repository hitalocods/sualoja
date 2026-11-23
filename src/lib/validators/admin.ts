import { z } from "zod";
import { UUID_SCHEMA } from "@/lib/validators/painel";

export const planoAdminSchema = z.object({
  nome: z
    .string({ error: "Informe o nome do plano." })
    .trim()
    .min(2, "O nome do plano deve ter pelo menos 2 caracteres.")
    .max(40, "O nome do plano deve ter no máximo 40 caracteres."),
  mensalidade_centavos: z.coerce
    .number({ error: "Informe uma mensalidade válida." })
    .int("Mensalidade deve ser um valor inteiro em centavos.")
    .min(0, "Mensalidade não pode ser negativa.")
    .max(10_000_000, "Valor de mensalidade muito alto."),
  limite_produtos: z.union([
    z.null(),
    z.coerce
      .number({ error: "Informe um limite válido." })
      .int("Limite de produtos deve ser inteiro.")
      .positive("Limite de produtos deve ser maior que zero.")
      .max(100_000, "Limite muito alto."),
  ]),
  taxa_fixa_centavos: z.coerce
    .number({ error: "Informe uma taxa fixa válida." })
    .int("Taxa fixa deve ser um valor inteiro em centavos.")
    .min(0, "Taxa fixa não pode ser negativa.")
    .max(1_000_000, "Valor de taxa fixa muito alto."),
  taxa_percentual: z
    .string({ error: "Informe a taxa percentual." })
    .trim()
    .refine((v) => {
      if (!v) return false;
      const norm = v.replace(",", ".");
      const num = Number(norm);
      return Number.isFinite(num) && num >= 0 && num <= 100;
    }, "A taxa percentual deve ficar entre 0% e 100%.")
    .transform((v) => Number(v.replace(",", ".")).toFixed(2)),
  ativo: z.boolean().default(true),
});

export const editarPlanoAdminSchema = planoAdminSchema.extend({
  planoId: UUID_SCHEMA,
});

export const alternarAtivoPlanoSchema = z.object({
  planoId: UUID_SCHEMA,
  ativo: z.boolean(),
});

export const lojaIdAdminSchema = z.object({
  lojaId: UUID_SCHEMA,
});

export const corrigirDocumentoLojaSchema = z.object({
  lojaId: UUID_SCHEMA,
  cpf_cnpj: z
    .string({ error: "Informe o CPF ou CNPJ." })
    .trim()
    .min(11, "Informe um CPF ou CNPJ válido.")
    .max(20, "Documento inválido."),
});

export const trocarPlanoLojaSchema = z.object({
  lojaId: UUID_SCHEMA,
  planoId: UUID_SCHEMA,
});

export const alterarStatusLojaSchema = z.object({
  lojaId: UUID_SCHEMA,
  status: z.enum(["ativa", "pendente", "bloqueada"], {
    error: "Status inválido para a loja.",
  }),
});

export const usuarioIdAdminSchema = z.object({
  usuarioId: UUID_SCHEMA,
});

export const alternarAtivoUsuarioSchema = z.object({
  usuarioId: UUID_SCHEMA,
  ativo: z.boolean(),
});

export function parseSlugsReservadosText(input: string): string[] {
  const itens = input
    .split(/[\n,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(itens));
}

const SLUG_RESERVADO_REGEX = /^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$|^[a-z0-9]{2,3}$/;

export const configuracoesPlataformaSchema = z.object({
  nome_plataforma: z
    .string({ error: "Informe o nome da plataforma." })
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres.")
    .max(60, "O nome deve ter no máximo 60 caracteres."),
  email_suporte: z
    .string({ error: "Informe o e-mail de suporte." })
    .trim()
    .toLowerCase()
    .email("Informe um e-mail de suporte válido.")
    .max(120, "E-mail muito longo."),
  dias_trial: z.coerce
    .number({ error: "Informe a quantidade de dias de trial." })
    .int("Os dias de trial devem ser um número inteiro.")
    .min(1, "O período de trial deve ser de no mínimo 1 dia.")
    .max(365, "O período de trial deve ser de no máximo 365 dias."),
  pedido_minimo_plataforma_centavos: z.coerce
    .number({ error: "Informe o pedido mínimo da plataforma." })
    .int("O pedido mínimo da plataforma deve ser um valor inteiro em centavos.")
    .min(100, "O pedido mínimo da plataforma deve ser de pelo menos R$ 1,00.")
    .max(1_000_000, "Valor de pedido mínimo muito alto.")
    .default(1000),
  tarifa_gateway_pix_centavos: z.coerce
    .number({ error: "Informe a tarifa do gateway Pix." })
    .int("A tarifa do gateway Pix deve ser um valor inteiro em centavos.")
    .min(0, "A tarifa do gateway Pix não pode ser negativa.")
    .max(100_000, "Valor de tarifa do gateway muito alto.")
    .default(80),
  margem_minima_centavos: z.coerce
    .number({ error: "Informe a margem mínima." })
    .int("A margem mínima deve ser um valor inteiro em centavos.")
    .min(0, "A margem mínima não pode ser negativa.")
    .max(100_000, "Valor de margem mínima muito alto.")
    .default(30),
  slugs_reservados: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(
          SLUG_RESERVADO_REGEX,
          "Cada slug reservado deve conter apenas letras minúsculas, números e hífen.",
        ),
    )
    .min(1, "Informe ao menos um slug reservado (ex.: admin).")
    .max(100, "Limite de 100 slugs reservados.")
    .transform((arr) => Array.from(new Set(arr))),
});

export type PlanoAdminInput = z.infer<typeof planoAdminSchema>;
export type ConfiguracoesPlataformaInput = z.infer<
  typeof configuracoesPlataformaSchema
>;

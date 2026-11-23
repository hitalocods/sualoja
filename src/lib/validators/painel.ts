import { z } from "zod";
import { FONTES_LOJA, normalizarCorHex } from "../storefront/theme";
import { normalizarWhatsapp } from "./lojista";

export const UUID_SCHEMA = z.string().uuid("Identificador inválido.");

export const BLOB_MEDIA_PATHNAME_REGEX =
  /^lojas\/[0-9a-f-]{36}\/(?:logo|banner|produto)\/[0-9a-f-]{36}\.(?:jpg|png|webp|avif)$/i;

const PRIVATE_MEDIA_URL_REGEX =
  /^\/api\/midia\/lojas\/[0-9a-f-]{36}\/(?:logo|banner|produto)\/[0-9a-f-]{36}\.(?:jpg|png|webp|avif)$/i;

export function buildPrivateMediaUrl(pathname: string): string {
  return `/api/midia/${pathname}`;
}

export const DIAS_SEMANA_CONFIG = [
  { key: "seg", label: "Segunda-feira" },
  { key: "ter", label: "Terça-feira" },
  { key: "qua", label: "Quarta-feira" },
  { key: "qui", label: "Quinta-feira" },
  { key: "sex", label: "Sexta-feira" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
] as const;

export function reaisParaCentavos(valor: string | number): number | null {
  if (typeof valor === "number") {
    if (!Number.isFinite(valor) || valor < 0) return null;
    const centavos = Math.round((valor + Number.EPSILON) * 100);
    return Number.isSafeInteger(centavos) && centavos >= 0 ? centavos : null;
  }

  if (typeof valor !== "string") return null;
  const limpo = valor.replace(/R\$/gi, "").replace(/\s+/g, "").trim();
  if (!limpo || /^-/.test(limpo) || /[^0-9.,]/.test(limpo)) {
    return null;
  }

  let intStr: string;
  let decStr = "";

  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(limpo)) {
    const [parteInteira, parteDec = ""] = limpo.replace(/\./g, "").split(",");
    intStr = parteInteira;
    decStr = parteDec;
  } else if (/^\d+(,\d{1,2})?$/.test(limpo)) {
    const [parteInteira, parteDec = ""] = limpo.split(",");
    intStr = parteInteira;
    decStr = parteDec;
  } else if (/^\d+(\.\d{1,2})?$/.test(limpo)) {
    const [parteInteira, parteDec = ""] = limpo.split(".");
    intStr = parteInteira;
    decStr = parteDec;
  } else {
    return null;
  }

  const centavos = Number(intStr) * 100 + Number(decStr.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    return null;
  }
  return centavos;
}

export function centavosParaInputReais(centavos: number): string {
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    return "0,00";
  }
  const reais = Math.floor(centavos / 100);
  const resto = centavos % 100;
  return `${reais},${String(resto).padStart(2, "0")}`;
}

export const urlImagemSchema = z
  .string()
  .trim()
  .nullable()
  .optional()
  .transform((val, ctx) => {
    if (!val) return null;
    if (
      (/^\/seed\/[a-z0-9/_-]+\.(?:webp|png|jpe?g|avif)$/i.test(val) ||
        PRIVATE_MEDIA_URL_REGEX.test(val)) &&
      !val.includes("..") &&
      !val.includes("//")
    ) {
      return val;
    }
    try {
      const parsed = new URL(val);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        ctx.addIssue({
          code: "custom",
          message: "URL da imagem deve usar http:// ou https://.",
        });
        return z.NEVER;
      }
      return parsed.toString();
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "URL de imagem inválida.",
      });
      return z.NEVER;
    }
  });

export const produtoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, "O nome do produto deve ter pelo menos 2 caracteres.")
    .max(120, "Nome do produto muito longo."),
  descricao: z
    .string()
    .trim()
    .max(500, "Descrição pode ter no máximo 500 caracteres.")
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  preco_centavos: z
    .number()
    .int("Preço deve ser um número inteiro em centavos.")
    .min(0, "Preço não pode ser negativo.")
    .max(100_000_000, "Preço acima do limite permitido."),
  estoque: z
    .number()
    .int("Estoque deve ser um número inteiro.")
    .min(0, "Estoque não pode ser negativo.")
    .max(100_000, "Estoque acima do limite permitido."),
  categoria: z
    .string()
    .trim()
    .min(1, "Informe a categoria.")
    .max(60, "Categoria muito longa.")
    .default("Geral"),
  ativo: z.boolean().default(true),
  imagem_url: urlImagemSchema,
});

export const ajustarEstoqueSchema = z.object({
  produto_id: UUID_SCHEMA,
  estoque: z
    .number()
    .int("Estoque deve ser inteiro.")
    .min(0, "Estoque não pode ser negativo.")
    .max(100_000, "Estoque acima do limite permitido."),
});

const hexSchema = z
  .string()
  .trim()
  .regex(
    /^#([0-9a-f]{3}|[0-9a-f]{6})$/i,
    "Informe uma cor hexadecimal válida (ex: #EA1D2C).",
  )
  .transform((val) => normalizarCorHex(val));

export const aparenciaSchema = z.object({
  cor_primaria: hexSchema,
  cor_secundaria: hexSchema,
  fonte: z.enum(FONTES_LOJA, {
    error: "Selecione uma fonte da lista permitida.",
  }),
  logo_url: urlImagemSchema,
  banner_url: urlImagemSchema,
});

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const diaHorarioSchema = z
  .object({
    aberto: z.boolean(),
    abre: z.string().regex(HH_MM_REGEX, "Horário inválido (use HH:MM)."),
    fecha: z.string().regex(HH_MM_REGEX, "Horário inválido (use HH:MM)."),
  })
  .superRefine((dia, ctx) => {
    if (dia.aberto && dia.abre >= dia.fecha) {
      ctx.addIssue({
        code: "custom",
        path: ["fecha"],
        message: "Horário de fechamento deve ser após a abertura.",
      });
    }
  });

export const horariosSchema = z.object({
  seg: diaHorarioSchema,
  ter: diaHorarioSchema,
  qua: diaHorarioSchema,
  qui: diaHorarioSchema,
  sex: diaHorarioSchema,
  sab: diaHorarioSchema,
  dom: diaHorarioSchema,
});

export const entregaSchema = z
  .object({
    aceita_retirada: z.boolean(),
    aceita_entrega: z.boolean(),
    modo_frete: z.enum(["fixo", "bairro"]),
    frete_fixo_centavos: z
      .number()
      .int("Frete fixo deve ser inteiro em centavos.")
      .min(0, "Frete fixo não pode ser negativo.")
      .max(1_000_000),
    frete_gratis_acima_centavos: z
      .number()
      .int("Frete grátis deve ser inteiro em centavos.")
      .min(0, "Valor para frete grátis não pode ser negativo.")
      .max(10_000_000)
      .nullable(),
    pedido_minimo_centavos: z
      .number()
      .int("Pedido mínimo deve ser inteiro em centavos.")
      .min(0, "Pedido mínimo não pode ser negativo.")
      .max(10_000_000),
    tempo_estimado_min: z
      .number()
      .int("Tempo estimado deve ser inteiro em minutos.")
      .min(5, "Tempo mínimo de 5 minutos.")
      .max(240, "Tempo máximo de 240 minutos."),
    horarios: horariosSchema,
  })
  .superRefine((data, ctx) => {
    if (!data.aceita_retirada && !data.aceita_entrega) {
      ctx.addIssue({
        code: "custom",
        path: ["aceita_entrega"],
        message: "Ative pelo menos Retirada ou Entrega.",
      });
    }
  });

export const bairroEntregaSchema = z.object({
  bairro: z
    .string()
    .trim()
    .min(2, "Informe o nome do bairro.")
    .max(80, "Nome do bairro muito longo."),
  valor_centavos: z
    .number()
    .int("Valor do frete deve ser inteiro em centavos.")
    .min(0, "Valor do frete não pode ser negativo.")
    .max(1_000_000),
});

export const dadosLojaSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(3, "O nome da loja deve ter pelo menos 3 caracteres.")
      .max(100, "Nome da loja muito longo."),
    whatsapp: z.string().trim().min(10, "Informe o WhatsApp com DDD."),
    categoria: z
      .string()
      .trim()
      .min(2, "Informe a categoria.")
      .max(60, "Categoria muito longa."),
    bairro: z
      .string()
      .trim()
      .min(2, "Informe o bairro em Teresina-PI.")
      .max(80, "Bairro muito longo."),
    taxa_paga_por: z.enum(["cliente", "loja"]),
  })
  .superRefine((data, ctx) => {
    if (!normalizarWhatsapp(data.whatsapp)) {
      ctx.addIssue({
        code: "custom",
        path: ["whatsapp"],
        message: "WhatsApp inválido. Informe DDD + número (ex: 86 99988-7766).",
      });
    }
  });

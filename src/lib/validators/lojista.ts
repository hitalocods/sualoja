import { z, ZodError } from "zod";

export const SLUGS_RESERVADOS = [
  "admin",
  "api",
  "login",
  "cadastro",
  "painel",
  "app",
  "www",
  "auth",
  "webhooks",
  "checkout",
] as const;

export const CATEGORIAS_LOJA = [
  "Moda",
  "Beleza",
  "Alimentação",
  "Casa",
  "Eletrônicos",
  "Serviços",
  "Outros",
] as const;

const SLUGS_RESERVADOS_SET = new Set<string>(SLUGS_RESERVADOS);
const SLUG_REGEX = /^(?!.*--)[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export function limparDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function normalizarSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validarSlug(
  input: string,
  slugsReservados?: readonly string[],
): { ok: true; slug: string } | { ok: false; erro: string } {
  const slug = input.trim().toLowerCase();
  if (slug.length < 3 || slug.length > 50) {
    return {
      ok: false,
      erro: "O endereço da loja deve ter entre 3 e 50 caracteres.",
    };
  }
  if (!SLUG_REGEX.test(slug)) {
    return {
      ok: false,
      erro: "Use apenas letras minúsculas, números e hífen simples.",
    };
  }
  const reservedSet = slugsReservados
    ? new Set(slugsReservados.map((s) => s.trim().toLowerCase()).filter(Boolean))
    : SLUGS_RESERVADOS_SET;
  if (reservedSet.has(slug)) {
    return {
      ok: false,
      erro: `O endereço "${slug}" é reservado pela plataforma.`,
    };
  }
  return { ok: true, slug };
}

export function validarCpf(valor: string): boolean {
  const cpf = limparDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += Number(cpf[i]) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== Number(cpf[9])) {
    return false;
  }

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += Number(cpf[i]) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === Number(cpf[10]);
}

export function validarCnpj(valor: string): boolean {
  const cnpj = limparDigitos(valor);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const calcularDigito = (base: string, pesos: number[]) => {
    const soma = base
      .split("")
      .reduce((acc, digit, idx) => acc + Number(digit) * pesos[idx], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcularDigito(cnpj.slice(0, 12), pesos1);
  if (d1 !== Number(cnpj[12])) {
    return false;
  }

  const d2 = calcularDigito(cnpj.slice(0, 13), pesos2);
  return d2 === Number(cnpj[13]);
}

export function validarCpfCnpj(valor: string): boolean {
  const digitos = limparDigitos(valor);
  if (digitos.length === 11) return validarCpf(digitos);
  if (digitos.length === 14) return validarCnpj(digitos);
  return false;
}

export function mascararCpfCnpj(valor: string): string {
  const digitos = limparDigitos(valor);
  if (digitos.length === 11) {
    return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`;
  }
  if (digitos.length === 14) {
    return `**.***.***/${digitos.slice(8, 12)}-${digitos.slice(12, 14)}`;
  }
  const fonte = digitos || valor.trim();
  if (!fonte) return "";
  if (fonte.length <= 4) return "****";
  return `${"*".repeat(fonte.length - 4)}${fonte.slice(-4)}`;
}

export function normalizarWhatsapp(valor: string): string | null {
  const digitos = limparDigitos(valor);
  let nacional = digitos;

  if (digitos.startsWith("55") && (digitos.length === 12 || digitos.length === 13)) {
    nacional = digitos.slice(2);
  } else if (digitos.length !== 10 && digitos.length !== 11) {
    return null;
  }

  const ddd = Number(nacional.slice(0, 2));
  if (ddd < 11 || ddd > 99) {
    return null;
  }
  if (/^(\d)\1+$/.test(nacional)) {
    return null;
  }

  return `55${nacional}`;
}

export const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  senha: z.string().min(1, "Informe sua senha."),
});

export const cadastroLojistaSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(3, "Informe seu nome completo.")
      .max(120, "Nome muito longo."),
    email: z
      .string()
      .trim()
      .email("Informe um e-mail válido.")
      .transform((val) => val.toLowerCase()),
    senha: z
      .string()
      .min(8, "A senha deve ter pelo menos 8 caracteres.")
      .max(128, "Senha muito longa."),
    loja_nome: z
      .string()
      .trim()
      .min(3, "O nome da loja deve ter pelo menos 3 caracteres.")
      .max(100, "Nome da loja muito longo."),
    slug: z.string().trim().min(1, "Informe o endereço da sua loja."),
    cpf_cnpj: z.string().trim().min(11, "Informe um CPF ou CNPJ válido."),
    whatsapp: z.string().trim().min(10, "Informe um WhatsApp com DDD."),
    categoria: z
      .string()
      .trim()
      .min(2, "Informe a categoria da loja.")
      .max(60)
      .default("Outros"),
    bairro: z
      .string()
      .trim()
      .min(2, "Informe o bairro em Teresina-PI.")
      .max(80)
      .default("Centro"),
  })
  .superRefine((data, ctx) => {
    const slugRes = validarSlug(data.slug);
    if (!slugRes.ok) {
      ctx.addIssue({
        code: "custom",
        path: ["slug"],
        message: slugRes.erro,
      });
    }

    if (!validarCpfCnpj(data.cpf_cnpj)) {
      ctx.addIssue({
        code: "custom",
        path: ["cpf_cnpj"],
        message: "CPF ou CNPJ inválido.",
      });
    }

    if (!normalizarWhatsapp(data.whatsapp)) {
      ctx.addIssue({
        code: "custom",
        path: ["whatsapp"],
        message: "WhatsApp inválido. Informe DDD + número (ex: 86 99988-7766).",
      });
    }
  });

export function extrairErrosZod(error: ZodError): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = issue.path[0] ? String(issue.path[0]) : "_form";
    if (!erros[campo]) {
      erros[campo] = issue.message;
    }
  }
  return erros;
}

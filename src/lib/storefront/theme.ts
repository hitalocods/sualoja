export const FONTES_LOJA = [
  "Inter",
  "Poppins",
  "Playfair Display",
  "Montserrat",
  "DM Sans",
  "Lora",
  "Nunito",
  "Bebas Neue",
] as const;

export type FonteLoja = (typeof FONTES_LOJA)[number];

export type TemaResolvido = {
  cor_primaria: string;
  cor_secundaria: string;
  cor_primaria_texto: "#FFFFFF" | "#111827";
  cor_secundaria_texto: "#FFFFFF" | "#111827";
  cor_primaria_suave: string;
  fonte: FonteLoja;
  logo_url: string | null;
  banner_url: string | null;
};

const FONTES_MAP = new Map<string, FonteLoja>(
  FONTES_LOJA.map((f) => [f.toLowerCase(), f]),
);

export function normalizarFonteLoja(fonte?: string | null): FonteLoja {
  if (!fonte) return "Inter";
  return FONTES_MAP.get(fonte.trim().toLowerCase()) ?? "Inter";
}

export function normalizarCorHex(
  cor?: string | null,
  fallback = "#EA1D2C",
): string {
  if (!cor) return fallback;
  const limpa = cor.trim();
  if (/^#[0-9a-f]{6}$/i.test(limpa)) {
    return limpa.toUpperCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(limpa)) {
    const [, r, g, b] = limpa;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

function hexParaRgb(hex: string): [number, number, number] {
  const normalizado = normalizarCorHex(hex);
  const intVal = Number.parseInt(normalizado.slice(1), 16);
  return [(intVal >> 16) & 255, (intVal >> 8) & 255, intVal & 255];
}

export function calcularLuminanciaRelativa(hex: string): number {
  const [r, g, b] = hexParaRgb(hex).map((canal) => {
    const srgb = canal / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function calcularRazaoContraste(hexA: string, hexB: string): number {
  const lumA = calcularLuminanciaRelativa(hexA);
  const lumB = calcularLuminanciaRelativa(hexB);
  const maior = Math.max(lumA, lumB);
  const menor = Math.min(lumA, lumB);
  return (maior + 0.05) / (menor + 0.05);
}

export function calcularCorTextoContraste(
  corFundoHex: string,
): "#FFFFFF" | "#111827" {
  const contrasteBranco = calcularRazaoContraste(corFundoHex, "#FFFFFF");
  const contrasteEscuro = calcularRazaoContraste(corFundoHex, "#111827");
  return contrasteBranco >= contrasteEscuro ? "#FFFFFF" : "#111827";
}

export function hexParaRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexParaRgb(hex);
  const clamped = Math.min(1, Math.max(0, alpha));
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}

export function resolverTemaLoja(
  tema?: {
    cor_primaria?: string | null;
    cor_secundaria?: string | null;
    fonte?: string | null;
    logo_url?: string | null;
    banner_url?: string | null;
  } | null,
): TemaResolvido {
  const cor_primaria = normalizarCorHex(tema?.cor_primaria, "#EA1D2C");
  const cor_secundaria = normalizarCorHex(tema?.cor_secundaria, "#18181B");

  return {
    cor_primaria,
    cor_secundaria,
    cor_primaria_texto: calcularCorTextoContraste(cor_primaria),
    cor_secundaria_texto: calcularCorTextoContraste(cor_secundaria),
    cor_primaria_suave: hexParaRgba(cor_primaria, 0.12),
    fonte: normalizarFonteLoja(tema?.fonte),
    logo_url: tema?.logo_url ?? null,
    banner_url: tema?.banner_url ?? null,
  };
}

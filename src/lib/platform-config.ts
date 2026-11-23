import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  configuracoes_plataforma,
  ConfiguracaoPlataforma,
  DEFAULT_SLUGS_RESERVADOS,
} from "@/db/schema";

const DEFAULT_CONFIG_FALLBACK: ConfiguracaoPlataforma = {
  id: "default",
  nome_plataforma: "MinhaLoja",
  email_suporte: "suporte@minhaloja.com.br",
  dias_trial: 14,
  pedido_minimo_plataforma_centavos: 1000,
  tarifa_gateway_pix_centavos: 80,
  margem_minima_centavos: 30,
  slugs_reservados: [...DEFAULT_SLUGS_RESERVADOS],
  atualizado_em: new Date(0),
};

export async function getPlatformConfig(): Promise<ConfiguracaoPlataforma> {
  try {
    const [existing] = await db
      .select()
      .from(configuracoes_plataforma)
      .where(eq(configuracoes_plataforma.id, "default"))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [created] = await db
      .insert(configuracoes_plataforma)
      .values({
        id: "default",
        nome_plataforma: DEFAULT_CONFIG_FALLBACK.nome_plataforma,
        email_suporte: DEFAULT_CONFIG_FALLBACK.email_suporte,
        dias_trial: DEFAULT_CONFIG_FALLBACK.dias_trial,
        pedido_minimo_plataforma_centavos:
          DEFAULT_CONFIG_FALLBACK.pedido_minimo_plataforma_centavos,
        tarifa_gateway_pix_centavos:
          DEFAULT_CONFIG_FALLBACK.tarifa_gateway_pix_centavos,
        margem_minima_centavos: DEFAULT_CONFIG_FALLBACK.margem_minima_centavos,
        slugs_reservados: [...DEFAULT_SLUGS_RESERVADOS],
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      return created;
    }

    const [retry] = await db
      .select()
      .from(configuracoes_plataforma)
      .where(eq(configuracoes_plataforma.id, "default"))
      .limit(1);

    return retry ?? DEFAULT_CONFIG_FALLBACK;
  } catch {
    return DEFAULT_CONFIG_FALLBACK;
  }
}

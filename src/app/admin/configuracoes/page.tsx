import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { impersonacoes_auditoria, lojas, usuarios } from "@/db/schema";
import { AdminConfigForm } from "@/components/admin/AdminConfigForm";
import { requireAdminSession } from "@/lib/auth/session";
import { getPlatformConfig } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

function formatarDataHoraBr(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

export default async function AdminConfiguracoesPage() {
  await requireAdminSession();

  const [config, auditoriaRows] = await Promise.all([
    getPlatformConfig(),
    db
      .select({
        id: impersonacoes_auditoria.id,
        criado_em: impersonacoes_auditoria.criado_em,
        adminEmail: usuarios.email,
        adminNome: usuarios.nome,
        lojaNome: lojas.nome,
        lojaSlug: lojas.slug,
      })
      .from(impersonacoes_auditoria)
      .innerJoin(usuarios, eq(impersonacoes_auditoria.admin_id, usuarios.id))
      .innerJoin(lojas, eq(impersonacoes_auditoria.loja_id, lojas.id))
      .orderBy(desc(impersonacoes_auditoria.criado_em))
      .limit(50),
  ]);

  const auditoriaSerializada = auditoriaRows.map((row) => ({
    id: row.id,
    adminNome: row.adminNome,
    adminEmail: row.adminEmail,
    lojaNome: row.lojaNome,
    lojaSlug: row.lojaSlug,
    criadoEmFormatada: formatarDataHoraBr(row.criado_em),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
          Configurações da plataforma
        </h1>
        <p
          className="mt-1 text-xs sm:text-sm"
          style={{ color: "var(--admin-text-muted)" }}
        >
          Ajuste identidade, período de trial, slugs reservados e acompanhe a
          auditoria de suporte.
        </p>
      </div>

      <AdminConfigForm
        initialNomePlataforma={config.nome_plataforma}
        initialEmailSuporte={config.email_suporte}
        initialDiasTrial={config.dias_trial}
        initialPedidoMinimoPlataformaCentavos={
          config.pedido_minimo_plataforma_centavos
        }
        initialTarifaGatewayPixCentavos={config.tarifa_gateway_pix_centavos}
        initialMargemMinimaCentavos={config.margem_minima_centavos}
        initialSlugsReservados={config.slugs_reservados}
        atualizadoEmFormatada={
          config.atualizado_em.getTime() > 0
            ? formatarDataHoraBr(config.atualizado_em)
            : "Padrão inicial"
        }
        auditoria={auditoriaSerializada}
      />
    </div>
  );
}

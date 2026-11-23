import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  assinaturas,
  bairros_entrega,
  lojas_entrega,
  lojas_tema,
  pedidos,
  produtos,
} from "@/db/schema";
import { AuthError } from "@/lib/auth/session";
import { getPanelTenantContext } from "@/lib/tenant";

export async function GET() {
  try {
    const { usuario, loja, tenantDb } = await getPanelTenantContext();
    const incluirDemo =
      process.env.NODE_ENV !== "production" &&
      process.env.SEED_DEMO === "true";

    const [
      tema,
      entrega,
      assinatura,
      totalProdutos,
      totalBairros,
      totalPedidos,
    ] = await Promise.all([
      tenantDb.findFirst(lojas_tema),
      tenantDb.findFirst(lojas_entrega),
      tenantDb.findFirst(assinaturas),
      tenantDb.count(produtos),
      tenantDb.count(bairros_entrega),
      tenantDb.count(pedidos, incluirDemo ? undefined : eq(pedidos.demo, false)),
    ]);

    return NextResponse.json({
      usuario,
      loja,
      tema,
      entrega,
      assinatura,
      totais: {
        produtos: totalProdutos,
        bairros: totalBairros,
        pedidos: totalPedidos,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("Erro ao carregar resumo do painel:", error);
    return NextResponse.json(
      { error: "Erro interno ao carregar painel." },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { consultarStatusPedidoPublico } from "@/lib/payments/orders";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await context.params;
  if (!codigo || !/^[A-Z0-9-]{10,32}$/i.test(codigo.trim())) {
    return NextResponse.json(
      { error: "Código de pedido inválido." },
      { status: 400 },
    );
  }

  const statusData = await consultarStatusPedidoPublico(codigo);
  if (!statusData) {
    return NextResponse.json(
      { error: "Pedido não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json(statusData, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

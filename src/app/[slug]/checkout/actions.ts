"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  type CriarPedidoResult,
  executarCriacaoPedido,
} from "@/lib/payments/orders";
import { extrairIpCliente } from "@/lib/rate-limit";

export async function criarPedidoAction(
  slug: string,
  payload: unknown,
): Promise<CriarPedidoResult> {
  const headersList = await headers();
  const ip = extrairIpCliente(headersList);

  const result = await executarCriacaoPedido(slug, payload, { ip });

  if (result.ok) {
    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/checkout`);
    revalidatePath("/painel");
    revalidatePath("/painel/produtos");
  }

  return result;
}

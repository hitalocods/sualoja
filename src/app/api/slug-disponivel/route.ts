import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lojas } from "@/db/schema";
import { getPlatformConfig } from "@/lib/platform-config";
import { validarSlug } from "@/lib/validators/lojista";

export async function GET(request: NextRequest) {
  const rawSlug = request.nextUrl.searchParams.get("slug") ?? "";
  const config = await getPlatformConfig();
  const validacao = validarSlug(rawSlug, config.slugs_reservados);

  if (!validacao.ok) {
    return NextResponse.json({
      disponivel: false,
      slug: rawSlug,
      motivo: validacao.erro,
    });
  }

  const [existente] = await db
    .select({ id: lojas.id })
    .from(lojas)
    .where(eq(lojas.slug, validacao.slug))
    .limit(1);

  if (existente) {
    return NextResponse.json({
      disponivel: false,
      slug: validacao.slug,
      motivo: "Este endereço já está em uso por outra loja.",
    });
  }

  return NextResponse.json({
    disponivel: true,
    slug: validacao.slug,
  });
}

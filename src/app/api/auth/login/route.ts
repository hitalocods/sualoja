import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { lojas, usuarios } from "@/db/schema";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { extrairErrosZod, loginSchema } from "@/lib/validators/lojista";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição JSON inválido." },
      { status: 400 },
    );
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Preencha e-mail e senha válidos.",
        fieldErrors: extrairErrosZod(parsed.error),
      },
      { status: 400 },
    );
  }

  const emailNormalizado = parsed.data.email.toLowerCase();
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, emailNormalizado))
    .limit(1);

  const senhaValida = await verifyPassword(
    parsed.data.senha,
    usuario?.senha_hash ?? DUMMY_PASSWORD_HASH,
  );

  if (!usuario || !senhaValida) {
    return NextResponse.json(
      { error: "E-mail ou senha incorretos." },
      { status: 401 },
    );
  }

  if (!usuario.ativo) {
    return NextResponse.json(
      { error: "Usuário desativado. Contate o administrador da plataforma." },
      { status: 403 },
    );
  }

  const [loja] =
    usuario.role === "admin"
      ? [null]
      : await db
          .select()
          .from(lojas)
          .where(and(eq(lojas.dono_id, usuario.id), isNull(lojas.deletada_em)))
          .limit(1);

  await createSession({ id: usuario.id, role: usuario.role });

  return NextResponse.json({
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      role: usuario.role,
      ativo: usuario.ativo,
      criado_em: usuario.criado_em,
    },
    loja: loja ?? null,
    redirectTo: usuario.role === "admin" ? "/admin" : "/painel",
  });
}

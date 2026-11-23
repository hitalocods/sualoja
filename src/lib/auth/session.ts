import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { Loja, lojas, Usuario, usuarios } from "@/db/schema";
import {
  IMPERSONATION_COOKIE_NAME,
  IMPERSONATION_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  signImpersonationToken,
  signSessionToken,
  verifyImpersonationToken,
  verifySessionToken,
} from "./token";

export { IMPERSONATION_COOKIE_NAME, SESSION_COOKIE_NAME };

export type SafeUsuario = Omit<Usuario, "senha_hash">;

export interface ImpersonationInfo {
  adminId: string;
  adminNome: string;
  adminEmail: string;
  lojaId: string;
  lojaNome: string;
  lojaSlug: string;
}

export interface SessionContext {
  usuario: SafeUsuario;
  loja: Loja | null;
  impersonando: ImpersonationInfo | null;
}

export interface LojistaSessionContext {
  usuario: SafeUsuario;
  loja: Loja;
  impersonando: ImpersonationInfo | null;
}

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function createSession(usuario: {
  id: string;
  role: "lojista" | "admin";
}): Promise<void> {
  const token = await signSessionToken({
    sub: usuario.id,
    role: usuario.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  cookieStore.set(IMPERSONATION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function createImpersonationSession(params: {
  adminId: string;
  lojaId: string;
}): Promise<void> {
  const token = await signImpersonationToken({
    adminId: params.adminId,
    lojaId: params.lojaId,
  });

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: IMPERSONATION_MAX_AGE_SECONDS,
  });
}

export async function clearImpersonationSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  cookieStore.set(IMPERSONATION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const verified = await verifySessionToken(token);
  if (!verified) {
    return null;
  }

  const [usuario] = await db
    .select({
      id: usuarios.id,
      email: usuarios.email,
      nome: usuarios.nome,
      role: usuarios.role,
      ativo: usuarios.ativo,
      criado_em: usuarios.criado_em,
    })
    .from(usuarios)
    .where(eq(usuarios.id, verified.sub))
    .limit(1);

  if (!usuario || !usuario.ativo) {
    return null;
  }

  if (usuario.role === "admin") {
    const impToken = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;
    if (impToken) {
      const imp = await verifyImpersonationToken(impToken);
      if (imp && imp.adminId === usuario.id) {
        const [impLoja] = await db
          .select()
          .from(lojas)
          .where(and(eq(lojas.id, imp.lojaId), isNull(lojas.deletada_em)))
          .limit(1);

        if (impLoja) {
          return {
            usuario,
            loja: impLoja,
            impersonando: {
              adminId: usuario.id,
              adminNome: usuario.nome,
              adminEmail: usuario.email,
              lojaId: impLoja.id,
              lojaNome: impLoja.nome,
              lojaSlug: impLoja.slug,
            },
          };
        }
      }
    }

    return {
      usuario,
      loja: null,
      impersonando: null,
    };
  }

  const [loja] = await db
    .select()
    .from(lojas)
    .where(and(eq(lojas.dono_id, usuario.id), isNull(lojas.deletada_em)))
    .limit(1);

  return {
    usuario,
    loja: loja ?? null,
    impersonando: null,
  };
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("Você precisa entrar para continuar.", 401);
  }
  return session;
}

export async function requireLojistaSession(): Promise<LojistaSessionContext> {
  const session = await requireSession();
  if (session.usuario.role !== "lojista" && session.usuario.role !== "admin") {
    throw new AuthError("Acesso permitido apenas para lojistas.", 403);
  }
  if (session.usuario.role === "admin" && !session.impersonando) {
    throw new AuthError(
      "Use o painel administrativo ou entre como lojista.",
      403,
    );
  }
  if (!session.loja) {
    throw new AuthError("Nenhuma loja vinculada a esta conta.", 403);
  }
  if (!session.impersonando && session.loja.status === "bloqueada") {
    throw new AuthError("Sua loja está bloqueada no momento.", 403);
  }
  return {
    usuario: session.usuario,
    loja: session.loja,
    impersonando: session.impersonando,
  };
}

export async function requireAdminSession(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.usuario.role !== "admin") {
    throw new AuthError("Acesso restrito a administradores.", 403);
  }
  return session;
}

export async function assertNaoImpersonando(
  context?: Pick<SessionContext, "impersonando">,
): Promise<void> {
  if (context) {
    if (context.impersonando) {
      throw new AuthError("Modo suporte: somente leitura", 403);
    }
    return;
  }

  const cookieStore = await cookies();
  const impToken = cookieStore.get(IMPERSONATION_COOKIE_NAME)?.value;
  if (!impToken) {
    return;
  }

  const imp = await verifyImpersonationToken(impToken);
  if (imp) {
    throw new AuthError("Modo suporte: somente leitura", 403);
  }
}

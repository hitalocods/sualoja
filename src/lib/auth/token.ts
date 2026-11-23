import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "ml_session";
export const IMPERSONATION_COOKIE_NAME = "ml_impersonate";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dias
export const IMPERSONATION_MAX_AGE_SECONDS = 60 * 60 * 4; // 4 horas

const DEV_FALLBACK_SECRET =
  "minhaloja-dev-secret-local-only-min-32-chars-change-prod";

export interface SessionJwtPayload {
  sub: string;
  role: "lojista" | "admin";
}

export interface ImpersonationJwtPayload {
  adminId: string;
  lojaId: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) {
    return new TextEncoder().encode(secret);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET ausente ou menor que 32 caracteres em ambiente de produção.",
    );
  }
  return new TextEncoder().encode(DEV_FALLBACK_SECRET);
}

export async function signSessionToken(
  payload: SessionJwtPayload,
): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "lojista" && payload.role !== "admin")
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function signImpersonationToken(
  payload: ImpersonationJwtPayload,
): Promise<string> {
  return new SignJWT({
    adminId: payload.adminId,
    lojaId: payload.lojaId,
    purpose: "admin-impersonation",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.adminId)
    .setIssuedAt()
    .setExpirationTime(`${IMPERSONATION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyImpersonationToken(
  token: string,
): Promise<ImpersonationJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (
      payload.purpose !== "admin-impersonation" ||
      typeof payload.adminId !== "string" ||
      typeof payload.lojaId !== "string"
    ) {
      return null;
    }
    return {
      adminId: payload.adminId,
      lojaId: payload.lojaId,
    };
  } catch {
    return null;
  }
}

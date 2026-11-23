export type RateLimitResult =
  | {
      ok: true;
      remaining: number;
      resetAtMs: number;
    }
  | {
      ok: false;
      retryAfterSeconds: number;
      resetAtMs: number;
    };

interface Bucket {
  count: number;
  resetAtMs: number;
}

const buckets = new Map<string, Bucket>();
let checkCounter = 0;

function limparExpirados(nowMs: number) {
  if (buckets.size === 0) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAtMs <= nowMs) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
}): RateLimitResult {
  const nowMs = options.nowMs ?? Date.now();
  checkCounter += 1;
  if (checkCounter % 100 === 0 || buckets.size > 5000) {
    limparExpirados(nowMs);
  }

  const existing = buckets.get(options.key);
  if (!existing || existing.resetAtMs <= nowMs) {
    const resetAtMs = nowMs + options.windowMs;
    buckets.set(options.key, { count: 1, resetAtMs });
    return {
      ok: true,
      remaining: Math.max(0, options.limit - 1),
      resetAtMs,
    };
  }

  if (existing.count >= options.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAtMs - nowMs) / 1000),
    );
    return {
      ok: false,
      retryAfterSeconds,
      resetAtMs: existing.resetAtMs,
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, options.limit - existing.count),
    resetAtMs: existing.resetAtMs,
  };
}

export function extrairIpCliente(headersList: Headers): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded) {
    const primeiro = forwarded.split(",")[0]?.trim();
    if (primeiro) return primeiro.slice(0, 64);
  }
  const realIp = headersList.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  return "127.0.0.1";
}

export function verificarRateLimitPedido(options: {
  ip: string;
  lojaId: string;
  nowMs?: number;
}): RateLimitResult {
  const nowMs = options.nowMs ?? Date.now();
  const porIpLoja = checkRateLimit({
    key: `pedido:ip-loja:${options.ip}:${options.lojaId}`,
    limit: 10,
    windowMs: 60_000,
    nowMs,
  });
  if (!porIpLoja.ok) return porIpLoja;

  const porIp = checkRateLimit({
    key: `pedido:ip:${options.ip}`,
    limit: 20,
    windowMs: 60_000,
    nowMs,
  });
  if (!porIp.ok) return porIp;

  const porLoja = checkRateLimit({
    key: `pedido:loja:${options.lojaId}`,
    limit: 60,
    windowMs: 60_000,
    nowMs,
  });
  return porLoja;
}

export function resetRateLimitForTests(): void {
  buckets.clear();
  checkCounter = 0;
}

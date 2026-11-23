const ABACATEPAY_BASE_URL = "https://api.abacatepay.com/v2";
const DEFAULT_TIMEOUT_MS = 12_000;

export type AbacatePayErrorCode =
  | "MISSING_API_KEY"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "FEATURE_DISABLED"
  | "SPLIT_DISABLED"
  | "SPLIT_EXCEEDS_NET"
  | "SUBACCOUNT_NOT_FOUND"
  | "INVALID_TAX_ID"
  | "SAME_PLATFORM_TAX_ID"
  | "EXTERNAL_ID_IN_USE"
  | "PIX_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "API_ERROR";

export class AbacatePayError extends Error {
  readonly code: AbacatePayErrorCode;
  readonly status: number | null;
  readonly apiMessage: string;
  readonly rawResponseBody: string | null;

  constructor(params: {
    code: AbacatePayErrorCode;
    message: string;
    status?: number | null;
    apiMessage?: string;
    rawResponseBody?: string | null;
  }) {
    super(params.message);
    this.name = "AbacatePayError";
    this.code = params.code;
    this.status = params.status ?? null;
    this.apiMessage = params.apiMessage ?? params.message;
    this.rawResponseBody = params.rawResponseBody ?? null;
  }
}

export interface AbacatePayEnvelope<T> {
  data: T | null;
  success: boolean;
  error: string | null;
}

export interface CreateSubAccountInput {
  name: string;
  taxId: string;
  externalId?: string;
  metadata?: Record<string, string>;
}

export interface AbacatePaySubAccount {
  id: string;
  name: string;
  taxId: string;
  externalId?: string | null;
  balance?: {
    available: number;
    blocked: number;
  };
  devMode?: boolean;
  metadata?: Record<string, string> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TransparentPixSplit {
  subAccountId: string;
  amount: number;
}

export interface CreateTransparentPixInput {
  amount: number;
  description?: string;
  expiresIn?: number;
  externalId?: string;
  metadata?: Record<string, string>;
  splits?: TransparentPixSplit[];
}

export interface AbacatePayTransparentPixCharge {
  id: string;
  amount: number;
  status: string;
  devMode?: boolean;
  brCode: string;
  brCodeBase64?: string;
  platformFee?: number;
  receiptUrl?: string | null;
  expiresAt: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, string> | null;
}

export interface AbacatePayClientOptions {
  apiKey?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  baseUrl?: string;
}

function assertServerSide() {
  if (typeof window !== "undefined") {
    throw new AbacatePayError({
      code: "API_ERROR",
      message: "Cliente AbacatePay só pode ser executado no servidor.",
    });
  }
}

export function sanitizePixDescription(text: string): string {
  // AbacatePay v2 rejeita emojis na descrição ("Disallowed character in description")
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[^\p{L}\p{N}\s.,:/\-()#]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

export function classificarErroAbacatePay(
  status: number | null,
  rawMessage: string,
): AbacatePayErrorCode {
  const normalized = rawMessage
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("funcao nao habilitada")) {
    return "FEATURE_DISABLED";
  }
  if (
    normalized.includes("split para subcontas nao esta habilitado") ||
    normalized.includes("split para subcontas nao esta disponivel")
  ) {
    return "SPLIT_DISABLED";
  }
  if (
    normalized.includes("soma dos splits passa do valor liquido") ||
    normalized.includes("split") && normalized.includes("valor liquido")
  ) {
    return "SPLIT_EXCEEDS_NET";
  }
  if (
    normalized.includes("subconta") &&
    normalized.includes("nao encontrada")
  ) {
    return "SUBACCOUNT_NOT_FOUND";
  }
  if (
    normalized.includes("nao pode ter o cpf ou cnpj da propria loja") ||
    normalized.includes("cpf ou cnpj da propria loja")
  ) {
    return "SAME_PLATFORM_TAX_ID";
  }
  if (normalized.includes("cpf ou cnpj invalido")) {
    return "INVALID_TAX_ID";
  }
  if (normalized.includes("externalid ja usado")) {
    return "EXTERNAL_ID_IN_USE";
  }
  if (normalized.includes("pix is not available")) {
    return "PIX_UNAVAILABLE";
  }
  if (status === 401 || status === 403) {
    return "UNAUTHORIZED";
  }
  if (status === 429) {
    return "RATE_LIMITED";
  }
  if (status === 400 || status === 422) {
    return "INVALID_REQUEST";
  }
  return "API_ERROR";
}

export function mascararTaxId(valor: string): string {
  const digits = valor.replace(/\D/g, "");
  const source = digits || valor.trim();
  if (!source) return "";
  if (source.length <= 4) return "****";
  return `${"*".repeat(source.length - 4)}${source.slice(-4)}`;
}

export function sanitizarTextoComSegredo(
  texto: string,
  apiKey?: string,
): string {
  let clean = texto.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
  const keys = [
    (apiKey ?? "").trim(),
    (process.env.ABACATEPAY_API_KEY ?? "").trim(),
  ].filter(Boolean);
  for (const k of keys) {
    clean = clean.split(k).join("[REDACTED]");
  }
  return clean;
}

export function mascararCorpoParaLog(body: unknown, apiKey?: string): unknown {
  if (body === null || body === undefined) return body;
  if (typeof body === "string") {
    return sanitizarTextoComSegredo(body, apiKey);
  }
  if (Array.isArray(body)) {
    return body.map((item) => mascararCorpoParaLog(item, apiKey));
  }
  if (typeof body === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (k === "taxId" && typeof v === "string") {
        out[k] = mascararTaxId(v);
      } else {
        out[k] = mascararCorpoParaLog(v, apiKey);
      }
    }
    return out;
  }
  return body;
}

function extrairMensagemErro(
  payload: unknown,
  rawText: string,
  fallbackStatus: number,
  apiKey?: string,
): string {
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.error === "string" && obj.error.trim()) {
      return sanitizarTextoComSegredo(obj.error.trim(), apiKey);
    }
    if (obj.error && typeof obj.error === "object") {
      const errObj = obj.error as Record<string, unknown>;
      const parts = [
        typeof errObj.message === "string" ? errObj.message.trim() : "",
        typeof errObj.details === "string" ? errObj.details.trim() : "",
      ].filter(Boolean);
      if (parts.length > 0) {
        return sanitizarTextoComSegredo(parts.join(" — "), apiKey);
      }
    }
    if (typeof obj.message === "string" && obj.message.trim()) {
      return sanitizarTextoComSegredo(obj.message.trim(), apiKey);
    }
    if (typeof obj.details === "string" && obj.details.trim()) {
      return sanitizarTextoComSegredo(obj.details.trim(), apiKey);
    }
    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
      const joined = obj.errors
        .map((e) => (typeof e === "string" ? e : JSON.stringify(e)))
        .join("; ");
      if (joined) return sanitizarTextoComSegredo(joined, apiKey);
    }
  }

  const trimmed = rawText.trim();
  if (trimmed) {
    return sanitizarTextoComSegredo(trimmed.slice(0, 300), apiKey);
  }
  return `Erro na comunicação com o provedor de pagamentos (HTTP ${fallbackStatus}).`;
}

async function abacatePayRequest<T>(
  path: string,
  body: unknown,
  opts: AbacatePayClientOptions = {},
  method: "GET" | "POST" = "POST",
): Promise<T> {
  assertServerSide();

  const apiKey = (opts.apiKey ?? process.env.ABACATEPAY_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new AbacatePayError({
      code: "MISSING_API_KEY",
      message: "Chave do AbacatePay não configurada",
    });
  }

  const baseUrl = (opts.baseUrl ?? ABACATEPAY_BASE_URL).replace(/\/+$/, "");
  const fullUrl = `${baseUrl}${path}`;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchFn = opts.fetchFn ?? fetch;
  const hasJsonBody = method === "POST" && body !== undefined;
  const maskedRequestBody = hasJsonBody ? mascararCorpoParaLog(body, apiKey) : null;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  if (hasJsonBody) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchFn(fullUrl, {
      method,
      headers,
      ...(hasJsonBody ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    const isAbort =
      err &&
      typeof err === "object" &&
      "name" in err &&
      (err as { name: string }).name === "AbortError";

    console.error("[abacatepay]", {
      method,
      url: fullUrl,
      status: null,
      requestBody: maskedRequestBody,
      responseBody: null,
      error: isAbort
        ? "TIMEOUT"
        : sanitizarTextoComSegredo(
            err instanceof Error ? err.message : String(err),
            apiKey,
          ),
    });

    if (isAbort) {
      throw new AbacatePayError({
        code: "TIMEOUT",
        message: "Tempo esgotado ao comunicar com a AbacatePay.",
      });
    }
    throw new AbacatePayError({
      code: "NETWORK_ERROR",
      message: "Falha de rede ao comunicar com a AbacatePay.",
    });
  } finally {
    clearTimeout(timer);
  }

  const rawText = await response.text();
  const safeResponseBody = sanitizarTextoComSegredo(rawText, apiKey);

  let parsed: unknown = null;
  let jsonParseFailed = false;
  if (rawText.trim()) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      jsonParseFailed = true;
    }
  }

  const envelope =
    parsed && typeof parsed === "object"
      ? (parsed as Partial<AbacatePayEnvelope<T>>)
      : null;

  const isError =
    jsonParseFailed ||
    !response.ok ||
    envelope?.success === false ||
    Boolean(envelope?.error);

  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    if (isError) {
      console.error("[abacatepay]", {
        method,
        url: fullUrl,
        status: response.status,
        requestBody: maskedRequestBody,
        responseBody: safeResponseBody,
      });
    } else {
      console.info("[abacatepay]", {
        method,
        url: fullUrl,
        status: response.status,
        requestBody: maskedRequestBody,
        responseBody: safeResponseBody,
      });
    }
  } else if (isError) {
    console.error("[abacatepay]", {
      method,
      path,
      status: response.status,
    });
  }

  if (jsonParseFailed) {
    const snippet = safeResponseBody.trim().slice(0, 200);
    throw new AbacatePayError({
      code: "API_ERROR",
      status: response.status,
      apiMessage: snippet || `Resposta inválida (HTTP ${response.status})`,
      rawResponseBody: safeResponseBody,
      message: `Resposta inválida da AbacatePay (HTTP ${response.status})${snippet ? `: ${snippet}` : "."}`,
    });
  }

  if (!response.ok || envelope?.success === false || envelope?.error) {
    const apiMessage = extrairMensagemErro(
      parsed,
      rawText,
      response.status,
      apiKey,
    );
    const code = classificarErroAbacatePay(response.status, apiMessage);
    throw new AbacatePayError({
      code,
      status: response.status,
      apiMessage,
      rawResponseBody: safeResponseBody,
      message: apiMessage,
    });
  }

  if (!envelope || envelope.data === undefined || envelope.data === null) {
    throw new AbacatePayError({
      code: "API_ERROR",
      status: response.status,
      rawResponseBody: safeResponseBody,
      message: "AbacatePay retornou sucesso sem dados na resposta.",
    });
  }

  return envelope.data;
}

export async function criarSubcontaAbacatePay(
  input: CreateSubAccountInput,
  opts?: AbacatePayClientOptions,
): Promise<AbacatePaySubAccount> {
  const payload: {
    name: string;
    taxId: string;
    externalId?: string;
    metadata?: Record<string, string>;
  } = {
    name: input.name.trim().slice(0, 100),
    taxId: input.taxId.replace(/\D/g, ""),
  };

  if (input.externalId) {
    payload.externalId = input.externalId.slice(0, 100);
  }
  if (input.metadata && Object.keys(input.metadata).length > 0) {
    payload.metadata = Object.fromEntries(
      Object.entries(input.metadata).map(([k, v]) => [k, String(v)]),
    );
  }

  return abacatePayRequest<AbacatePaySubAccount>(
    "/sub-accounts/create",
    payload,
    opts,
  );
}

export async function criarCobrancaPixTransparente(
  input: CreateTransparentPixInput,
  opts?: AbacatePayClientOptions,
): Promise<AbacatePayTransparentPixCharge> {
  const dataPayload: {
    amount: number;
    description?: string;
    expiresIn?: number;
    externalId?: string;
    metadata?: Record<string, string>;
    splits?: TransparentPixSplit[];
  } = {
    amount: Math.trunc(input.amount),
  };

  if (input.description) {
    const clean = sanitizePixDescription(input.description);
    if (clean) dataPayload.description = clean;
  }
  if (input.expiresIn !== undefined) {
    dataPayload.expiresIn = Math.max(300, Math.trunc(input.expiresIn));
  }
  if (input.externalId) {
    dataPayload.externalId = input.externalId.slice(0, 100);
  }
  if (input.metadata && Object.keys(input.metadata).length > 0) {
    dataPayload.metadata = input.metadata;
  }
  if (input.splits && input.splits.length > 0) {
    dataPayload.splits = input.splits.map((s) => ({
      subAccountId: s.subAccountId,
      amount: Math.trunc(s.amount),
    }));
  }

  // Omite "customer" no PIX transparente pois a AbacatePay exige todos os campos
  // (inclusive taxId/email do comprador) se o objeto customer for enviado.
  return abacatePayRequest<AbacatePayTransparentPixCharge>(
    "/transparents/create",
    {
      method: "PIX",
      data: dataPayload,
    },
    opts,
  );
}

/** Consulta os dados e o saldo atual de uma subconta na AbacatePay. */
export async function buscarSubcontaAbacatePay(
  subAccountId: string,
  opts: AbacatePayClientOptions = {},
): Promise<AbacatePaySubAccount> {
  const id = subAccountId.trim();
  if (!id) {
    throw new AbacatePayError({
      code: "INVALID_REQUEST",
      message: "Identificador da subconta não informado.",
    });
  }

  return abacatePayRequest<AbacatePaySubAccount>(
    `/sub-accounts/get?id=${encodeURIComponent(id)}`,
    undefined,
    opts,
    "GET",
  );
}

/** Simula o pagamento de um QRCode Pix no Modo Teste (sandbox) da AbacatePay. */
export async function simularPagamentoPixTransparente(
  cobrancaId: string,
  opts: AbacatePayClientOptions = {},
): Promise<AbacatePayTransparentPixCharge> {
  const id = cobrancaId.trim();
  if (!id) {
    throw new AbacatePayError({
      code: "INVALID_REQUEST",
      message: "Identificador da cobrança Pix não informado.",
    });
  }

  const apiKey = (opts.apiKey ?? process.env.ABACATEPAY_API_KEY ?? "").trim();
  if (apiKey.startsWith("abc_prod_")) {
    throw new AbacatePayError({
      code: "INVALID_REQUEST",
      message: "Simulação de pagamento só é permitida no Modo Teste (chave abc_dev_).",
    });
  }

  return abacatePayRequest<AbacatePayTransparentPixCharge>(
    `/transparents/simulate-payment?id=${encodeURIComponent(id)}`,
    undefined,
    opts,
    "POST",
  );
}

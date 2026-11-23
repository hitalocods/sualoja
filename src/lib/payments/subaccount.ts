import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { lojas } from "@/db/schema";
import {
  AbacatePayError,
  type AbacatePayClientOptions,
  type AbacatePayErrorCode,
  criarSubcontaAbacatePay,
} from "@/lib/abacatepay";
import { limparDigitos, validarCpfCnpj } from "@/lib/validators/lojista";

export interface LojaSubcontaInput {
  id: string;
  nome: string;
  slug: string;
  cpf_cnpj: string;
  abacate_subconta_id?: string | null;
}

export type EnsureSubcontaResult =
  | {
      ok: true;
      subcontaId: string;
      reused: boolean;
    }
  | {
      ok: false;
      error: string;
      code?: AbacatePayErrorCode;
    };

export interface EnsureSubcontaDeps {
  dbExecutor?: DbExecutor;
  abacateOptions?: AbacatePayClientOptions;
  platformTaxId?: string | null;
  criarSubcontaFn?: typeof criarSubcontaAbacatePay;
}

export function sanitizarSegredo(texto: string): string {
  let clean = texto.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");
  const apiKey = (process.env.ABACATEPAY_API_KEY ?? "").trim();
  if (apiKey) {
    clean = clean.split(apiKey).join("[REDACTED]");
  }
  return clean;
}

function logErroSubconta(
  contexto: string,
  detalhes: Record<string, unknown>,
  err?: unknown,
): void {
  const erroInfo: Record<string, unknown> = {};
  if (err instanceof AbacatePayError) {
    erroInfo.name = err.name;
    erroInfo.code = err.code;
    erroInfo.status = err.status;
    erroInfo.apiMessage = sanitizarSegredo(err.apiMessage);
    erroInfo.message = sanitizarSegredo(err.message);
    if (err.stack) erroInfo.stack = sanitizarSegredo(err.stack);
  } else if (err instanceof Error) {
    erroInfo.name = err.name;
    erroInfo.message = sanitizarSegredo(err.message);
    if (err.stack) erroInfo.stack = sanitizarSegredo(err.stack);
  } else if (err !== undefined) {
    erroInfo.raw = sanitizarSegredo(String(err));
  }

  console.error("[subconta]", contexto, {
    ...detalhes,
    ...(Object.keys(erroInfo).length > 0 ? { err: erroInfo } : {}),
  });
}

function mensagemAmigavelSubconta(err: unknown): string {
  if (err instanceof AbacatePayError) {
    if (err.code === "MISSING_API_KEY") {
      return "Chave do AbacatePay não configurada";
    }
    if (err.code === "INVALID_TAX_ID") {
      return err.status !== null
        ? `HTTP ${err.status}: ${sanitizarSegredo(err.apiMessage || "CPF/CNPJ da loja inválido para criar subconta.")}`
        : "CPF/CNPJ da loja inválido para criar subconta.";
    }
    if (err.code === "SAME_PLATFORM_TAX_ID") {
      return err.status !== null
        ? `HTTP ${err.status}: ${sanitizarSegredo(err.apiMessage || "A subconta não pode ter o mesmo CPF ou CNPJ da plataforma.")}`
        : "A subconta não pode ter o mesmo CPF ou CNPJ da plataforma.";
    }
    if (err.code === "TIMEOUT") {
      return "Tempo esgotado ao conectar com a AbacatePay. Tente novamente.";
    }
    if (err.code === "NETWORK_ERROR") {
      return "Falha de rede ao conectar com a AbacatePay. Tente novamente.";
    }

    const apiMsg = sanitizarSegredo((err.apiMessage || err.message || "").trim());
    const prefix = err.status !== null ? `HTTP ${err.status}: ` : "";

    switch (err.code) {
      case "UNAUTHORIZED":
        return `${prefix}${apiMsg || "Chave do AbacatePay inválida ou sem permissão."} (verifique a chave v2 e a permissão SUB_ACCOUNT:CREATE)`;
      case "FEATURE_DISABLED":
        return `${prefix}${apiMsg || "Subcontas não estão habilitadas na sua conta AbacatePay."} (subcontas não habilitadas na conta)`;
      case "SPLIT_DISABLED":
        return `${prefix}${apiMsg || "Split para subcontas não está habilitado."} (split não habilitado na conta)`;
      default:
        return `${prefix}${apiMsg || "Não foi possível criar a subconta na AbacatePay. Tente novamente."}`;
    }
  }

  return "Não foi possível criar a subconta na AbacatePay. Tente novamente.";
}

async function gravarResultadoSubconta(
  executor: DbExecutor,
  lojaId: string,
  valores: {
    abacate_subconta_id?: string | null;
    subconta_erro: string | null;
  },
): Promise<void> {
  try {
    await executor
      .update(lojas)
      .set({
        ...(valores.abacate_subconta_id !== undefined
          ? { abacate_subconta_id: valores.abacate_subconta_id }
          : {}),
        subconta_erro: valores.subconta_erro,
        abacate_subconta_erro: valores.subconta_erro,
      })
      .where(eq(lojas.id, lojaId));
  } catch (dbErr) {
    logErroSubconta("Falha ao persistir resultado de subconta no banco", { lojaId }, dbErr);
  }
}

export async function ensureSubconta(
  loja: LojaSubcontaInput,
  deps: EnsureSubcontaDeps = {},
): Promise<EnsureSubcontaResult> {
  const executor = deps.dbExecutor ?? db;

  try {
    if (loja.abacate_subconta_id && loja.abacate_subconta_id.trim()) {
      await gravarResultadoSubconta(executor, loja.id, {
        subconta_erro: null,
      });
      return {
        ok: true,
        subcontaId: loja.abacate_subconta_id.trim(),
        reused: true,
      };
    }

    const taxId = limparDigitos(loja.cpf_cnpj);
    if (!validarCpfCnpj(taxId)) {
      const errorMsg = "CPF/CNPJ da loja inválido para criar subconta.";
      logErroSubconta("Documento da loja inválido", {
        lojaId: loja.id,
        slug: loja.slug,
      });
      await gravarResultadoSubconta(executor, loja.id, {
        subconta_erro: errorMsg,
      });
      return { ok: false, error: errorMsg, code: "INVALID_TAX_ID" };
    }

    const platformTaxIdRaw =
      deps.platformTaxId ??
      process.env.PLATFORM_TAX_ID ??
      process.env.ABACATEPAY_PLATFORM_TAX_ID ??
      "";
    const platformTaxId = limparDigitos(platformTaxIdRaw);
    if (platformTaxId && taxId === platformTaxId) {
      const errorMsg =
        "A subconta não pode ter o mesmo CPF ou CNPJ da plataforma.";
      logErroSubconta("CPF/CNPJ igual ao da plataforma", {
        lojaId: loja.id,
        slug: loja.slug,
      });
      await gravarResultadoSubconta(executor, loja.id, {
        subconta_erro: errorMsg,
      });
      return { ok: false, error: errorMsg, code: "SAME_PLATFORM_TAX_ID" };
    }

    // Idempotência por taxId: verifica se a própria loja (em leitura fresca)
    // ou outra loja com o mesmo documento já possui subconta registrada.
    const [lojaAtual] = await executor
      .select({ abacate_subconta_id: lojas.abacate_subconta_id })
      .from(lojas)
      .where(eq(lojas.id, loja.id))
      .limit(1);

    if (lojaAtual?.abacate_subconta_id?.trim()) {
      const existingId = lojaAtual.abacate_subconta_id.trim();
      await gravarResultadoSubconta(executor, loja.id, {
        subconta_erro: null,
      });
      return { ok: true, subcontaId: existingId, reused: true };
    }

    const [outraComMesmoDoc] = await executor
      .select({ abacate_subconta_id: lojas.abacate_subconta_id })
      .from(lojas)
      .where(
        and(
          eq(lojas.cpf_cnpj, taxId),
          ne(lojas.id, loja.id),
          isNotNull(lojas.abacate_subconta_id),
        ),
      )
      .limit(1);

    if (outraComMesmoDoc?.abacate_subconta_id?.trim()) {
      const reusedId = outraComMesmoDoc.abacate_subconta_id.trim();
      await gravarResultadoSubconta(executor, loja.id, {
        abacate_subconta_id: reusedId,
        subconta_erro: null,
      });
      return { ok: true, subcontaId: reusedId, reused: true };
    }

    const apiKey = (
      deps.abacateOptions?.apiKey ??
      process.env.ABACATEPAY_API_KEY ??
      ""
    ).trim();

    if (!apiKey && !deps.criarSubcontaFn) {
      const errorMsg = "Chave do AbacatePay não configurada";
      logErroSubconta("ABACATEPAY_API_KEY ausente", {
        lojaId: loja.id,
        slug: loja.slug,
      });
      await gravarResultadoSubconta(executor, loja.id, {
        subconta_erro: errorMsg,
      });
      return { ok: false, error: errorMsg, code: "MISSING_API_KEY" };
    }

    const criarFn = deps.criarSubcontaFn ?? criarSubcontaAbacatePay;
    const subconta = await criarFn(
      {
        name: loja.nome,
        taxId,
        externalId: loja.id,
        metadata: { slug: loja.slug },
      },
      deps.abacateOptions,
    );

    await gravarResultadoSubconta(executor, loja.id, {
      abacate_subconta_id: subconta.id,
      subconta_erro: null,
    });

    return {
      ok: true,
      subcontaId: subconta.id,
      reused: false,
    };
  } catch (err) {
    const code = err instanceof AbacatePayError ? err.code : "API_ERROR";
    const friendlyMessage = mensagemAmigavelSubconta(err);

    logErroSubconta(
      "Erro ao criar subconta na AbacatePay",
      {
        lojaId: loja.id,
        slug: loja.slug,
        code,
        friendlyMessage,
      },
      err,
    );

    await gravarResultadoSubconta(executor, loja.id, {
      subconta_erro: friendlyMessage,
    });

    return {
      ok: false,
      error: friendlyMessage,
      code,
    };
  }
}

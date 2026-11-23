import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditoria_admin, lojas } from "@/db/schema";
import {
  limparDigitos,
  mascararCpfCnpj,
  validarCpfCnpj,
} from "@/lib/validators/lojista";

export type CorrigirDocumentoResult =
  | {
      ok: true;
      mensagem: string;
      cpfCnpj: string;
      cpfCnpjMascarado: string;
    }
  | {
      ok: false;
      mensagem: string;
    };

export interface CorrigirDocumentoDeps {
  dbClient?: typeof db;
  platformTaxId?: string | null;
}

class DocumentoCorrectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentoCorrectionError";
  }
}

export async function executarCorrecaoDocumentoLoja(
  params: {
    adminId: string;
    lojaId: string;
    cpfCnpj: string;
  },
  deps: CorrigirDocumentoDeps = {},
): Promise<CorrigirDocumentoResult> {
  const novoDoc = limparDigitos(params.cpfCnpj);
  if (!validarCpfCnpj(novoDoc)) {
    return {
      ok: false,
      mensagem:
        "CPF ou CNPJ inválido. Verifique os dígitos verificadores e tente novamente.",
    };
  }

  const platformTaxId = limparDigitos(
    deps.platformTaxId ??
      process.env.PLATFORM_TAX_ID ??
      process.env.ABACATEPAY_PLATFORM_TAX_ID ??
      "",
  );
  if (platformTaxId && novoDoc === platformTaxId) {
    return {
      ok: false,
      mensagem:
        "O documento da loja não pode ser igual ao CPF/CNPJ da plataforma.",
    };
  }

  const dbClient = deps.dbClient ?? db;

  try {
    const resultado = await dbClient.transaction(async (tx) => {
      const [loja] = await tx
        .select({
          id: lojas.id,
          cpf_cnpj: lojas.cpf_cnpj,
          abacate_subconta_id: lojas.abacate_subconta_id,
        })
        .from(lojas)
        .where(and(eq(lojas.id, params.lojaId), isNull(lojas.deletada_em)))
        .for("update");

      if (!loja) {
        throw new DocumentoCorrectionError("Loja não encontrada.");
      }

      if (loja.abacate_subconta_id && loja.abacate_subconta_id.trim()) {
        throw new DocumentoCorrectionError(
          "Esta loja já possui subconta criada; o documento não pode ser alterado.",
        );
      }

      const [duplicada] = await tx
        .select({ id: lojas.id })
        .from(lojas)
        .where(
          and(
            ne(lojas.id, loja.id),
            isNull(lojas.deletada_em),
            sql`regexp_replace(${lojas.cpf_cnpj}, '[^0-9]', '', 'g') = ${novoDoc}`,
          ),
        )
        .limit(1);

      if (duplicada) {
        throw new DocumentoCorrectionError(
          "Já existe outra loja cadastrada com este CPF/CNPJ.",
        );
      }

      const valorAntigoMascarado = mascararCpfCnpj(loja.cpf_cnpj);
      const valorNovoMascarado = mascararCpfCnpj(novoDoc);

      await tx
        .update(lojas)
        .set({
          cpf_cnpj: novoDoc,
          subconta_erro: null,
          abacate_subconta_erro: null,
        })
        .where(
          and(
            eq(lojas.id, loja.id),
            isNull(lojas.abacate_subconta_id),
          ),
        );

      await tx.insert(auditoria_admin).values({
        admin_id: params.adminId,
        loja_id: loja.id,
        acao: "corrigir_documento",
        valor_antigo_mascarado: valorAntigoMascarado,
        valor_novo_mascarado: valorNovoMascarado,
      });

      return { valorNovoMascarado };
    });

    return {
      ok: true,
      mensagem:
        "Documento atualizado com sucesso e erro de subconta limpo.",
      cpfCnpj: novoDoc,
      cpfCnpjMascarado: resultado.valorNovoMascarado,
    };
  } catch (err) {
    if (err instanceof DocumentoCorrectionError) {
      return { ok: false, mensagem: err.message };
    }
    console.error("[admin] Erro ao corrigir documento da loja:", {
      lojaId: params.lojaId,
      mensagem: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      mensagem: "Não foi possível atualizar o documento no momento.",
    };
  }
}

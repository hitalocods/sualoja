"use server";

import crypto from "node:crypto";
import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  assinaturas,
  configuracoes_plataforma,
  impersonacoes_auditoria,
  lojas,
  planos,
  usuarios,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import {
  AuthError,
  clearImpersonationSession,
  createImpersonationSession,
  requireAdminSession,
  type SessionContext,
} from "@/lib/auth/session";
import {
  alternarAtivoPlanoSchema,
  alternarAtivoUsuarioSchema,
  alterarStatusLojaSchema,
  configuracoesPlataformaSchema,
  corrigirDocumentoLojaSchema,
  editarPlanoAdminSchema,
  lojaIdAdminSchema,
  planoAdminSchema,
  trocarPlanoLojaSchema,
  usuarioIdAdminSchema,
} from "@/lib/validators/admin";
import { executarCorrecaoDocumentoLoja } from "@/lib/payments/documento";
import { ensureSubconta, sanitizarSegredo } from "@/lib/payments/subaccount";
import { extrairErrosZod } from "@/lib/validators/lojista";

export type AdminActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

async function getAdminOrError(): Promise<
  { ok: true; session: SessionContext } | { ok: false; error: string }
> {
  try {
    const session = await requireAdminSession();
    return { ok: true, session };
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: "Acesso restrito a administradores." };
  }
}

function isPgUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const obj = err as { code?: string; cause?: { code?: string } };
  return (obj.code ?? obj.cause?.code) === "23505";
}

function gerarSenhaTemporaria(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits + "@#$!";
  const bytes = crypto.randomBytes(12);
  const chars = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    "@#$!"[bytes[3] % 4],
  ];
  for (let i = 4; i < 12; i++) {
    chars.push(all[bytes[i] % all.length]);
  }
  return chars.join("");
}

function revalidateAdminPaths() {
  revalidatePath("/admin");
  revalidatePath("/admin/lojas");
  revalidatePath("/admin/planos");
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/configuracoes");
  revalidatePath("/");
}

export interface SubcontaAdminActionResult {
  ok: boolean;
  mensagem: string;
  subcontaId?: string;
  reused?: boolean;
}

export async function aprovarLojaAdminAction(
  rawInput: unknown,
): Promise<AdminActionResult> {
  try {
    const auth = await getAdminOrError();
    if (!auth.ok) return auth;

    const parsed = lojaIdAdminSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { ok: false, error: "Identificador de loja inválido." };
    }

    const [updated] = await db
      .update(lojas)
      .set({ status: "ativa" })
      .where(and(eq(lojas.id, parsed.data.lojaId), isNull(lojas.deletada_em)))
      .returning({
        id: lojas.id,
        nome: lojas.nome,
        slug: lojas.slug,
        cpf_cnpj: lojas.cpf_cnpj,
        abacate_subconta_id: lojas.abacate_subconta_id,
      });

    if (!updated) {
      return { ok: false, error: "Loja não encontrada." };
    }

    const subcontaRes = await ensureSubconta(updated);

    try {
      revalidateAdminPaths();
      revalidatePath(`/${updated.slug}`);
      revalidatePath(`/${updated.slug}/checkout`);
    } catch (revalErr) {
      console.error("[subconta] Falha ao revalidar rotas após aprovação:", {
        lojaId: updated.id,
        mensagem:
          revalErr instanceof Error
            ? sanitizarSegredo(revalErr.message)
            : String(revalErr),
      });
    }

    return {
      ok: true,
      data: {
        subcontaOk: subcontaRes.ok,
        subcontaId: subcontaRes.ok ? subcontaRes.subcontaId : null,
        subcontaErro: subcontaRes.ok ? null : subcontaRes.error,
      },
    };
  } catch (err) {
    console.error("[subconta] Erro inesperado ao aprovar loja:", {
      mensagem:
        err instanceof Error ? sanitizarSegredo(err.message) : String(err),
      stack: err instanceof Error && err.stack ? sanitizarSegredo(err.stack) : undefined,
    });
    return {
      ok: false,
      error: "Não foi possível aprovar a loja no momento. Tente novamente.",
    };
  }
}

export async function tentarCriarSubcontaAdminAction(
  rawInput: unknown,
): Promise<SubcontaAdminActionResult> {
  try {
    const auth = await getAdminOrError();
    if (!auth.ok) {
      return { ok: false, mensagem: auth.error };
    }

    const parsed = lojaIdAdminSchema.safeParse(rawInput);
    if (!parsed.success) {
      return { ok: false, mensagem: "Identificador de loja inválido." };
    }

    const [loja] = await db
      .select({
        id: lojas.id,
        nome: lojas.nome,
        slug: lojas.slug,
        cpf_cnpj: lojas.cpf_cnpj,
        abacate_subconta_id: lojas.abacate_subconta_id,
      })
      .from(lojas)
      .where(and(eq(lojas.id, parsed.data.lojaId), isNull(lojas.deletada_em)))
      .limit(1);

    if (!loja) {
      return { ok: false, mensagem: "Loja não encontrada." };
    }

    const subcontaRes = await ensureSubconta(loja);

    try {
      revalidateAdminPaths();
      revalidatePath(`/${loja.slug}`);
      revalidatePath(`/${loja.slug}/checkout`);
    } catch (revalErr) {
      console.error("[subconta] Falha ao revalidar rotas após subconta:", {
        lojaId: loja.id,
        mensagem:
          revalErr instanceof Error
            ? sanitizarSegredo(revalErr.message)
            : String(revalErr),
      });
    }

    if (!subcontaRes.ok) {
      return { ok: false, mensagem: subcontaRes.error };
    }

    return {
      ok: true,
      mensagem: `Subconta AbacatePay ativa para "${loja.nome}".`,
      subcontaId: subcontaRes.subcontaId,
      reused: subcontaRes.reused,
    };
  } catch (err) {
    console.error("[subconta] Erro inesperado na server action de subconta:", {
      mensagem:
        err instanceof Error ? sanitizarSegredo(err.message) : String(err),
      stack: err instanceof Error && err.stack ? sanitizarSegredo(err.stack) : undefined,
    });
    return {
      ok: false,
      mensagem:
        "Não foi possível criar a subconta no momento. Tente novamente.",
    };
  }
}

export interface CorrigirDocumentoAdminActionResult {
  ok: boolean;
  mensagem: string;
  cpfCnpj?: string;
}

export async function corrigirDocumentoLojaAdminAction(
  rawInput: unknown,
): Promise<CorrigirDocumentoAdminActionResult> {
  try {
    const auth = await getAdminOrError();
    if (!auth.ok) {
      return { ok: false, mensagem: auth.error };
    }

    const parsed = corrigirDocumentoLojaSchema.safeParse(rawInput);
    if (!parsed.success) {
      const errMap = extrairErrosZod(parsed.error);
      const firstErr = Object.values(errMap)[0];
      return {
        ok: false,
        mensagem: firstErr ?? "Informe um CPF ou CNPJ válido.",
      };
    }

    const resultado = await executarCorrecaoDocumentoLoja({
      adminId: auth.session.usuario.id,
      lojaId: parsed.data.lojaId,
      cpfCnpj: parsed.data.cpf_cnpj,
    });

    if (resultado.ok) {
      try {
        revalidateAdminPaths();
        revalidatePath("/painel/dados");
      } catch (revalErr) {
        console.error("[admin] Falha ao revalidar após corrigir documento:", {
          lojaId: parsed.data.lojaId,
          mensagem:
            revalErr instanceof Error ? revalErr.message : String(revalErr),
        });
      }
      return {
        ok: true,
        mensagem: resultado.mensagem,
        cpfCnpj: resultado.cpfCnpj,
      };
    }

    return { ok: false, mensagem: resultado.mensagem };
  } catch (err) {
    console.error("[admin] Erro inesperado em corrigirDocumentoLojaAdminAction:", {
      mensagem: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      mensagem: "Não foi possível corrigir o documento no momento.",
    };
  }
}

export async function alterarStatusLojaAdminAction(
  rawInput: unknown,
): Promise<AdminActionResult> {
  const auth = await getAdminOrError();
  if (!auth.ok) return auth;

  const parsed = alterarStatusLojaSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos ao atualizar status da loja." };
  }

  const updateFields =
    parsed.data.status === "bloqueada"
      ? { status: parsed.data.status, aberta: false }
      : { status: parsed.data.status };

  const [updated] = await db
    .update(lojas)
    .set(updateFields)
    .where(and(eq(lojas.id, parsed.data.lojaId), isNull(lojas.deletada_em)))
    .returning({ id: lojas.id, slug: lojas.slug });

  if (!updated) {
    return { ok: false, error: "Loja não encontrada." };
  }

  revalidateAdminPaths();
  revalidatePath(`/${updated.slug}`);
  return { ok: true };
}

export async function arquivarLojaAdminAction(
  rawInput: unknown,
): Promise<AdminActionResult> {
  const auth = await getAdminOrError();
  if (!auth.ok) return auth;

  const parsed = lojaIdAdminSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Identificador de loja inválido." };
  }

  const [archived] = await db
    .update(lojas)
    .set({
      deletada_em: new Date(),
      status: "bloqueada",
      aberta: false,
    })
    .where(and(eq(lojas.id, parsed.data.lojaId), isNull(lojas.deletada_em)))
    .returning({ id: lojas.id, slug: lojas.slug });

  if (!archived) {
    return { ok: false, error: "Loja não encontrada ou já arquivada." };
  }

  revalidateAdminPaths();
  revalidatePath(`/${archived.slug}`);
  return { ok: true };
}

export async function trocarPlanoLojaAdminAction(
  rawInput: unknown,
): Promise<AdminActionResult> {
  const auth = await getAdminOrError();
  if (!auth.ok) return auth;

  const parsed = trocarPlanoLojaSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos para troca de plano." };
  }

  const [planoDestino] = await db
    .select({ id: planos.id })
    .from(planos)
    .where(eq(planos.id, parsed.data.planoId))
    .limit(1);

  if (!planoDestino) {
    return { ok: false, error: "Plano de destino não encontrado." };
  }

  const [lojaAlvo] = await db
    .select({ id: lojas.id })
    .from(lojas)
    .where(and(eq(lojas.id, parsed.data.lojaId), isNull(lojas.deletada_em)))
    .limit(1);

  if (!lojaAlvo) {
    return { ok: false, error: "Loja não encontrada." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(lojas)
      .set({ plano_id: parsed.data.planoId })
      .where(eq(lojas.id, parsed.data.lojaId));

    await tx
      .update(assinaturas)
      .set({ plano_id: parsed.data.planoId })
      .where(eq(assinaturas.loja_id, parsed.data.lojaId));
  });

  revalidateAdminPaths();
  return { ok: true };
}

export async function impersonarLojaAdminAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ redirectTo: string; lojaNome: string }>> {
  const auth = await getAdminOrError();
  if (!auth.ok) return auth;

  const parsed = lojaIdAdminSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Identificador de loja inválido." };
  }

  const [lojaAlvo] = await db
    .select({ id: lojas.id, nome: lojas.nome })
    .from(lojas)
    .where(and(eq(lojas.id, parsed.data.lojaId), isNull(lojas.deletada_em)))
    .limit(1);

  if (!lojaAlvo) {
    return { ok: false, error: "Loja não encontrada." };
  }

  await db.insert(impersonacoes_auditoria).values({
    admin_id: auth.session.usuario.id,
    loja_id: lojaAlvo.id,
  });

  await createImpersonationSession({
    adminId: auth.session.usuario.id,
    lojaId: lojaAlvo.id,
  });

  revalidatePath("/painel", "layout");
  revalidatePath("/admin");

  return {
    ok: true,
    data: {
      redirectTo: "/painel",
      lojaNome: lojaAlvo.nome,
    },
  };
}

export async function sairImpersonacaoAction(): Promise<
  AdminActionResult<{ redirectTo: string }>
> {
  const auth = await getAdminOrError();
  if (!auth.ok) return auth;

  await clearImpersonationSession();
  revalidatePath("/painel", "layout");
  revalidateAdminPaths();

  return { ok: true, data: { redirectTo: "/admin" } };
}

export async function criarPlanoAdminAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ id: string }>> {
  const auth = await getAdminOrError();
  if (!auth.ok) return auth;

  const parsed = planoAdminSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revise os dados do plano.",
      fieldErrors: extrairErrosZod(parsed.error),
    };
  }

  try {
    const [criado] = await db
      .insert(planos)
      .values({
        nome: parsed.data.nome,
        mensalidade_centavos: parsed.data.mensalidade_centavos,
        limite_produtos: parsed.data.limite_produtos,
        taxa_fixa_centavos: parsed.data.taxa_fixa_centavos,
        taxa_percentual: parsed.data.taxa_percentual,
        ativo: parsed.data.ativo,
      })
      .returning({ id: planos.id });

    revalidateAdminPaths();
    return { ok: true, data: { id: criado.id } };
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      return {
        ok: false,
        error: "Já existe um plano com esse nome.",
        fieldErrors: { nome: "Já existe um plano com esse nome." },
      };
    }
    return { ok: false, error: "Erro ao criar plano." };
  }
}

export async function editarPlanoAdminAction(
  rawInput: unknown,
): Promise<AdminActionResult> {
  const auth = await getAdminOrError();
  if (!auth.ok) return auth;

  const parsed = editarPlanoAdminSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revise os dados do plano.",
      fieldErrors: extrairErrosZod(parsed.error),
    };
  }

  try {
    const [atualizado] = await db
      .update(planos)
      .set({
        nome: parsed.data.nome,
        mensalidade_centavos: parsed.data.mensalidade_centavos,
        limite_produtos: parsed.data.limite_produtos,
        taxa_fixa_centavos: parsed.data.taxa_fixa_centavos,
        taxa_percentual: parsed.data.taxa_percentual,
        ativo: parsed.data.ativo,
      })
      .where(eq(planos.id, parsed.data.planoId))
      .returning({ id: planos.id });

    if (!atualizado) {
      return { ok: false, error: "Plano não encontrado." };
    }

    revalidateAdminPaths();
    return { ok: true };
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      return {
        ok: false,
        error: "Já existe outro plano com esse nome.",
        fieldErrors: { nome: "Já existe outro plano com esse nome." },
      };
    }
    return { ok: false, error: "Erro ao atualizar plano." };
  }
}

export async function alternarAtivoPlanoAdminAction(
  rawInput: unknown,
): Promise<AdminActionResult> {
  const auth = await getAdminOrError();
  if (!auth.ok) return auth;

  const parsed = alternarAtivoPlanoSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }

  if (!parsed.data.ativo) {
    const outrosAtivos = await db
      .select({ id: planos.id })
      .from(planos)
      .where(and(eq(planos.ativo, true), ne(planos.id, parsed.data.planoId)))
      .limit(1);

    if (outrosAtivos.length === 0) {
      return {
        ok: false,
        error: "Mantenha ao menos um plano ativo na plataforma.",
      };
    }
  }

  const [atualizado] = await db
    .update(planos)
    .set({ ativo: parsed.data.ativo })
    .where(eq(planos.id, parsed.data.planoId))
    .returning({ id: planos.id });

  if (!atualizado) {
    return { ok: false, error: "Plano não encontrado." };
  }

  revalidateAdminPaths();
  return { ok: true };
}

export async function redefinirSenhaUsuarioAdminAction(
  rawInput: unknown,
): Promise<AdminActionResult<{ email: string; senhaTemporaria: string }>> {
  const auth = await getAdminOrError();
  if (!auth.ok) return auth;

  const parsed = usuarioIdAdminSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Identificador de usuário inválido." };
  }

  const senhaTemporaria = gerarSenhaTemporaria();
  const senhaHash = await hashPassword(senhaTemporaria);

  const [atualizado] = await db
    .update(usuarios)
    .set({ senha_hash: senhaHash })
    .where(eq(usuarios.id, parsed.data.usuarioId))
    .returning({ id: usuarios.id, email: usuarios.email });

  if (!atualizado) {
    return { ok: false, error: "Usuário não encontrado." };
  }

  revalidatePath("/admin/usuarios");
  return {
    ok: true,
    data: {
      email: atualizado.email,
      senhaTemporaria,
    },
  };
}

export async function alternarAtivoUsuarioAdminAction(
  rawInput: unknown,
): Promise<AdminActionResult> {
  const auth = await getAdminOrError();
  if (!auth.ok) return auth;

  const parsed = alternarAtivoUsuarioSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Dados inválidos." };
  }

  if (!parsed.data.ativo && parsed.data.usuarioId === auth.session.usuario.id) {
    return {
      ok: false,
      error: "Você não pode desativar sua própria conta de administrador.",
    };
  }

  const [atualizado] = await db
    .update(usuarios)
    .set({ ativo: parsed.data.ativo })
    .where(eq(usuarios.id, parsed.data.usuarioId))
    .returning({ id: usuarios.id });

  if (!atualizado) {
    return { ok: false, error: "Usuário não encontrado." };
  }

  revalidateAdminPaths();
  return { ok: true };
}

export async function salvarConfiguracoesPlataformaAction(
  rawInput: unknown,
): Promise<AdminActionResult> {
  const auth = await getAdminOrError();
  if (!auth.ok) return auth;

  const parsed = configuracoesPlataformaSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Revise os campos de configuração.",
      fieldErrors: extrairErrosZod(parsed.error),
    };
  }

  await db
    .insert(configuracoes_plataforma)
    .values({
      id: "default",
      nome_plataforma: parsed.data.nome_plataforma,
      email_suporte: parsed.data.email_suporte,
      dias_trial: parsed.data.dias_trial,
      pedido_minimo_plataforma_centavos:
        parsed.data.pedido_minimo_plataforma_centavos,
      slugs_reservados: parsed.data.slugs_reservados,
      atualizado_em: new Date(),
    })
    .onConflictDoUpdate({
      target: configuracoes_plataforma.id,
      set: {
        nome_plataforma: parsed.data.nome_plataforma,
        email_suporte: parsed.data.email_suporte,
        dias_trial: parsed.data.dias_trial,
        pedido_minimo_plataforma_centavos:
          parsed.data.pedido_minimo_plataforma_centavos,
        slugs_reservados: parsed.data.slugs_reservados,
        atualizado_em: new Date(),
      },
    });

  revalidateAdminPaths();
  revalidatePath("/cadastro");
  return { ok: true };
}

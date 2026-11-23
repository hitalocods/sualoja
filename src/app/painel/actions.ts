"use server";

import { randomUUID } from "node:crypto";
import { BlobError, put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  bairros_entrega,
  lojas,
  lojas_entrega,
  lojas_tema,
  planos,
  produtos,
  type BairroEntrega,
  type Loja,
  type LojaEntrega,
  type LojaTema,
  type Produto,
} from "@/db/schema";
import { assertNaoImpersonando, AuthError } from "@/lib/auth/session";
import { getPanelTenantContext } from "@/lib/tenant";
import { extrairErrosZod, normalizarWhatsapp } from "@/lib/validators/lojista";
import {
  ajustarEstoqueSchema,
  aparenciaSchema,
  bairroEntregaSchema,
  buildPrivateMediaUrl,
  dadosLojaSchema,
  entregaSchema,
  produtoSchema,
  UUID_SCHEMA,
} from "@/lib/validators/painel";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

function revalidarLoja(slug: string) {
  revalidatePath("/painel");
  revalidatePath("/painel/produtos");
  revalidatePath("/painel/aparencia");
  revalidatePath("/painel/entrega");
  revalidatePath("/painel/dados");
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/checkout`);
}

function extrairCodigoPg(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const obj = error as { code?: string; cause?: { code?: string } };
  return obj.code ?? obj.cause?.code;
}

function tratarErroAction(error: unknown, fallbackMessage: string): ActionResult<never> {
  if (error instanceof AuthError) {
    return { ok: false, error: error.message };
  }
  console.error(fallbackMessage, error);
  return { ok: false, error: fallbackMessage };
}

export async function uploadImagemLojaAction(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  try {
    await assertNaoImpersonando();
    const { loja } = await getPanelTenantContext();

    const tipoRaw = formData.get("tipo");
    if (tipoRaw !== "produto" && tipoRaw !== "logo" && tipoRaw !== "banner") {
      return { ok: false, error: "Tipo de imagem inválido." };
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return { ok: false, error: "Selecione um arquivo de imagem válido." };
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        error: "A imagem deve ter no máximo 4 MB.",
      };
    }

    const ext = MIME_TO_EXT[file.type];
    if (!ext) {
      return {
        ok: false,
        error: "Formato não suportado. Use JPG, PNG, WebP ou AVIF.",
      };
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return {
        ok: false,
        error:
          "Upload indisponível: configure BLOB_READ_WRITE_TOKEN (Vercel Blob) no ambiente.",
      };
    }

    const pathname = `lojas/${loja.id}/${tipoRaw}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    let uploadedUrl: string;
    try {
      const blob = await put(pathname, buffer, {
        access: "public",
        contentType: file.type,
        addRandomSuffix: false,
      });
      uploadedUrl = blob.url;
    } catch (uploadError) {
      const msg =
        uploadError instanceof Error ? uploadError.message : String(uploadError);
      if (/private store|cannot use public access/i.test(msg)) {
        const privateBlob = await put(pathname, buffer, {
          access: "private",
          contentType: file.type,
          addRandomSuffix: false,
        });
        uploadedUrl = buildPrivateMediaUrl(privateBlob.pathname);
      } else {
        throw uploadError;
      }
    }

    return {
      ok: true,
      data: { url: uploadedUrl },
      message: "Imagem enviada com sucesso.",
    };
  } catch (error) {
    if (error instanceof BlobError) {
      console.error("Erro no upload Vercel Blob:", error);
      const msg = error.message.toLowerCase();
      if (msg.includes("suspended")) {
        return {
          ok: false,
          error: "Armazenamento de imagens suspenso no momento.",
        };
      }
      if (msg.includes("access denied") || msg.includes("valid token")) {
        return {
          ok: false,
          error: "Permissão negada ao enviar imagem para o Vercel Blob.",
        };
      }
      if (msg.includes("too large")) {
        return {
          ok: false,
          error: "A imagem excede o limite de tamanho permitido.",
        };
      }
      return { ok: false, error: "Erro ao fazer upload da imagem." };
    }
    return tratarErroAction(error, "Erro ao fazer upload da imagem.");
  }
}

export async function criarProdutoAction(
  input: unknown,
): Promise<ActionResult<Produto>> {
  try {
    await assertNaoImpersonando();
    const { loja, tenantDb } = await getPanelTenantContext();

    const parsed = produtoSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Corrija os dados do produto.",
        fieldErrors: extrairErrosZod(parsed.error),
      };
    }

    const [plano] = await db
      .select({ limite_produtos: planos.limite_produtos, nome: planos.nome })
      .from(planos)
      .where(eq(planos.id, loja.plano_id))
      .limit(1);

    if (plano?.limite_produtos !== null && plano?.limite_produtos !== undefined) {
      const totalAtual = await tenantDb.count(produtos);
      if (totalAtual >= plano.limite_produtos) {
        return {
          ok: false,
          error: `Seu plano ${plano.nome} permite até ${plano.limite_produtos} produtos.`,
        };
      }
    }

    const [criado] = await tenantDb.insert(produtos, {
      nome: parsed.data.nome,
      descricao: parsed.data.descricao,
      preco_centavos: parsed.data.preco_centavos,
      estoque: parsed.data.estoque,
      categoria: parsed.data.categoria,
      ativo: parsed.data.ativo,
      imagem_url: parsed.data.imagem_url,
    });

    revalidarLoja(loja.slug);
    return { ok: true, data: criado, message: "Produto criado com sucesso." };
  } catch (error) {
    return tratarErroAction(error, "Erro ao criar produto.");
  }
}

export async function editarProdutoAction(
  produtoId: string,
  input: unknown,
): Promise<ActionResult<Produto>> {
  try {
    await assertNaoImpersonando();
    const { loja, tenantDb } = await getPanelTenantContext();

    const idCheck = UUID_SCHEMA.safeParse(produtoId);
    if (!idCheck.success) {
      return { ok: false, error: "Produto inválido." };
    }

    const parsed = produtoSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Corrija os dados do produto.",
        fieldErrors: extrairErrosZod(parsed.error),
      };
    }

    const atualizado = await tenantDb.updateById(produtos, idCheck.data, {
      nome: parsed.data.nome,
      descricao: parsed.data.descricao,
      preco_centavos: parsed.data.preco_centavos,
      estoque: parsed.data.estoque,
      categoria: parsed.data.categoria,
      ativo: parsed.data.ativo,
      imagem_url: parsed.data.imagem_url,
      atualizado_em: new Date(),
    });

    if (!atualizado) {
      return { ok: false, error: "Produto não encontrado nesta loja." };
    }

    revalidarLoja(loja.slug);
    return {
      ok: true,
      data: atualizado,
      message: "Produto atualizado com sucesso.",
    };
  } catch (error) {
    return tratarErroAction(error, "Erro ao atualizar produto.");
  }
}

export async function alternarAtivoProdutoAction(
  produtoId: string,
  ativo: boolean,
): Promise<ActionResult<Produto>> {
  try {
    await assertNaoImpersonando();
    const { loja, tenantDb } = await getPanelTenantContext();

    const idCheck = UUID_SCHEMA.safeParse(produtoId);
    if (!idCheck.success || typeof ativo !== "boolean") {
      return { ok: false, error: "Dados inválidos." };
    }

    const atualizado = await tenantDb.updateById(produtos, idCheck.data, {
      ativo,
      atualizado_em: new Date(),
    });

    if (!atualizado) {
      return { ok: false, error: "Produto não encontrado nesta loja." };
    }

    revalidarLoja(loja.slug);
    return {
      ok: true,
      data: atualizado,
      message: ativo ? "Produto ativado." : "Produto desativado.",
    };
  } catch (error) {
    return tratarErroAction(error, "Erro ao alterar status do produto.");
  }
}

export async function ajustarEstoqueProdutoAction(
  input: unknown,
): Promise<ActionResult<Produto>> {
  try {
    await assertNaoImpersonando();
    const { loja, tenantDb } = await getPanelTenantContext();

    const parsed = ajustarEstoqueSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Valor de estoque inválido.",
        fieldErrors: extrairErrosZod(parsed.error),
      };
    }

    const atualizado = await tenantDb.updateById(
      produtos,
      parsed.data.produto_id,
      {
        estoque: parsed.data.estoque,
        atualizado_em: new Date(),
      },
    );

    if (!atualizado) {
      return { ok: false, error: "Produto não encontrado nesta loja." };
    }

    revalidarLoja(loja.slug);
    return { ok: true, data: atualizado, message: "Estoque atualizado." };
  } catch (error) {
    return tratarErroAction(error, "Erro ao ajustar estoque.");
  }
}

export async function excluirProdutoAction(
  produtoId: string,
): Promise<ActionResult> {
  try {
    await assertNaoImpersonando();
    const { loja, tenantDb } = await getPanelTenantContext();

    const idCheck = UUID_SCHEMA.safeParse(produtoId);
    if (!idCheck.success) {
      return { ok: false, error: "Produto inválido." };
    }

    const removido = await tenantDb.removeById(produtos, idCheck.data);
    if (!removido) {
      return { ok: false, error: "Produto não encontrado nesta loja." };
    }

    revalidarLoja(loja.slug);
    return { ok: true, message: "Produto removido." };
  } catch (error) {
    return tratarErroAction(error, "Erro ao excluir produto.");
  }
}

export async function salvarAparenciaAction(
  input: unknown,
): Promise<ActionResult<LojaTema>> {
  try {
    await assertNaoImpersonando();
    const { loja, tenantDb } = await getPanelTenantContext();

    const parsed = aparenciaSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Corrija os campos de aparência.",
        fieldErrors: extrairErrosZod(parsed.error),
      };
    }

    const existente = await tenantDb.findFirst(lojas_tema);
    let salvo: LojaTema;

    if (existente) {
      const [atualizado] = await tenantDb.update(lojas_tema, parsed.data);
      salvo = atualizado;
    } else {
      const [criado] = await tenantDb.insert(lojas_tema, parsed.data);
      salvo = criado;
    }

    revalidarLoja(loja.slug);
    return {
      ok: true,
      data: salvo,
      message: "Aparência da loja salva com sucesso.",
    };
  } catch (error) {
    return tratarErroAction(error, "Erro ao salvar aparência.");
  }
}

export async function alternarLojaAbertaAction(
  aberta: boolean,
): Promise<ActionResult<{ aberta: boolean }>> {
  try {
    await assertNaoImpersonando();
    const { loja } = await getPanelTenantContext();
    if (typeof aberta !== "boolean") {
      return { ok: false, error: "Valor inválido." };
    }

    await db
      .update(lojas)
      .set({ aberta })
      .where(eq(lojas.id, loja.id));

    revalidarLoja(loja.slug);
    return {
      ok: true,
      data: { aberta },
      message: aberta ? "Loja aberta para pedidos!" : "Loja fechada.",
    };
  } catch (error) {
    return tratarErroAction(error, "Erro ao alterar abertura da loja.");
  }
}

export async function salvarEntregaAction(
  input: unknown,
): Promise<ActionResult<LojaEntrega>> {
  try {
    await assertNaoImpersonando();
    const { loja, tenantDb } = await getPanelTenantContext();

    const parsed = entregaSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Corrija as configurações de entrega.",
        fieldErrors: extrairErrosZod(parsed.error),
      };
    }

    const existente = await tenantDb.findFirst(lojas_entrega);
    let salvo: LojaEntrega;

    if (existente) {
      const [atualizado] = await tenantDb.update(lojas_entrega, parsed.data);
      salvo = atualizado;
    } else {
      const [criado] = await tenantDb.insert(lojas_entrega, parsed.data);
      salvo = criado;
    }

    revalidarLoja(loja.slug);
    return {
      ok: true,
      data: salvo,
      message: "Configurações de entrega e horários salvas.",
    };
  } catch (error) {
    return tratarErroAction(error, "Erro ao salvar entrega.");
  }
}

export async function criarBairroAction(
  input: unknown,
): Promise<ActionResult<BairroEntrega>> {
  try {
    await assertNaoImpersonando();
    const { loja, tenantDb } = await getPanelTenantContext();

    const parsed = bairroEntregaSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Corrija os dados do bairro.",
        fieldErrors: extrairErrosZod(parsed.error),
      };
    }

    const [criado] = await tenantDb.insert(bairros_entrega, parsed.data);
    revalidarLoja(loja.slug);
    return { ok: true, data: criado, message: "Bairro adicionado." };
  } catch (error) {
    if (extrairCodigoPg(error) === "23505") {
      return {
        ok: false,
        error: "Este bairro já está cadastrado na sua loja.",
      };
    }
    return tratarErroAction(error, "Erro ao cadastrar bairro.");
  }
}

export async function editarBairroAction(
  bairroId: string,
  input: unknown,
): Promise<ActionResult<BairroEntrega>> {
  try {
    await assertNaoImpersonando();
    const { loja, tenantDb } = await getPanelTenantContext();

    const idCheck = UUID_SCHEMA.safeParse(bairroId);
    if (!idCheck.success) {
      return { ok: false, error: "Bairro inválido." };
    }

    const parsed = bairroEntregaSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Corrija os dados do bairro.",
        fieldErrors: extrairErrosZod(parsed.error),
      };
    }

    const atualizado = await tenantDb.updateById(
      bairros_entrega,
      idCheck.data,
      parsed.data,
    );

    if (!atualizado) {
      return { ok: false, error: "Bairro não encontrado nesta loja." };
    }

    revalidarLoja(loja.slug);
    return { ok: true, data: atualizado, message: "Bairro atualizado." };
  } catch (error) {
    if (extrairCodigoPg(error) === "23505") {
      return {
        ok: false,
        error: "Já existe outro registro com este nome de bairro.",
      };
    }
    return tratarErroAction(error, "Erro ao atualizar bairro.");
  }
}

export async function excluirBairroAction(
  bairroId: string,
): Promise<ActionResult> {
  try {
    await assertNaoImpersonando();
    const { loja, tenantDb } = await getPanelTenantContext();

    const idCheck = UUID_SCHEMA.safeParse(bairroId);
    if (!idCheck.success) {
      return { ok: false, error: "Bairro inválido." };
    }

    const removido = await tenantDb.removeById(bairros_entrega, idCheck.data);
    if (!removido) {
      return { ok: false, error: "Bairro não encontrado nesta loja." };
    }

    revalidarLoja(loja.slug);
    return { ok: true, message: "Bairro removido." };
  } catch (error) {
    return tratarErroAction(error, "Erro ao remover bairro.");
  }
}

export async function salvarDadosLojaAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    await assertNaoImpersonando();
    const { loja } = await getPanelTenantContext();

    const parsed = dadosLojaSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Corrija os dados da loja.",
        fieldErrors: extrairErrosZod(parsed.error),
      };
    }

    const whatsappNormalizado = normalizarWhatsapp(parsed.data.whatsapp);
    if (!whatsappNormalizado) {
      return {
        ok: false,
        error: "WhatsApp inválido.",
        fieldErrors: { whatsapp: "Informe DDD + número válido." },
      };
    }

    await db
      .update(lojas)
      .set({
        nome: parsed.data.nome,
        whatsapp: whatsappNormalizado,
        categoria: parsed.data.categoria,
        bairro: parsed.data.bairro,
        taxa_paga_por: parsed.data.taxa_paga_por,
      })
      .where(eq(lojas.id, loja.id));

    revalidarLoja(loja.slug);
    return {
      ok: true,
      message: "Dados da loja salvos com sucesso.",
    };
  } catch (error) {
    return tratarErroAction(error, "Erro ao salvar dados da loja.");
  }
}

import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  assinaturas,
  HORARIOS_PADRAO,
  lojas,
  lojas_entrega,
  lojas_tema,
  planos,
  usuarios,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { getPlatformConfig } from "@/lib/platform-config";
import {
  cadastroLojistaSchema,
  extrairErrosZod,
  limparDigitos,
  normalizarWhatsapp,
  validarSlug,
} from "@/lib/validators/lojista";

function extrairCodigoPg(error: unknown): { code?: string; constraint?: string } {
  if (!error || typeof error !== "object") return {};
  const errObj = error as {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };
  return {
    code: errObj.code ?? errObj.cause?.code,
    constraint: errObj.constraint ?? errObj.cause?.constraint,
  };
}

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

  const parsed = cadastroLojistaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Corrija os campos destacados.",
        fieldErrors: extrairErrosZod(parsed.error),
      },
      { status: 400 },
    );
  }

  const dados = parsed.data;
  const config = await getPlatformConfig();
  const slugValidado = validarSlug(dados.slug, config.slugs_reservados);
  if (!slugValidado.ok) {
    return NextResponse.json(
      {
        error: "Endereço da loja inválido.",
        fieldErrors: { slug: slugValidado.erro },
      },
      { status: 400 },
    );
  }
  const slugNormalizado = slugValidado.slug;
  const cpfCnpjLimpo = limparDigitos(dados.cpf_cnpj);
  const whatsappNormalizado = normalizarWhatsapp(dados.whatsapp);

  if (!whatsappNormalizado) {
    return NextResponse.json(
      {
        error: "WhatsApp inválido.",
        fieldErrors: { whatsapp: "Informe DDD + número válido." },
      },
      { status: 400 },
    );
  }

  const [emailExistente, slugExistente, planosAtivos] = await Promise.all([
    db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, dados.email))
      .limit(1),
    db
      .select({ id: lojas.id })
      .from(lojas)
      .where(eq(lojas.slug, slugNormalizado))
      .limit(1),
    db
      .select({ id: planos.id })
      .from(planos)
      .where(eq(planos.ativo, true))
      .orderBy(asc(planos.mensalidade_centavos))
      .limit(1),
  ]);

  if (emailExistente.length > 0 || slugExistente.length > 0) {
    const fieldErrors: Record<string, string> = {};
    if (emailExistente.length > 0) {
      fieldErrors.email = "Já existe uma conta cadastrada com este e-mail.";
    }
    if (slugExistente.length > 0) {
      fieldErrors.slug = "Este endereço de loja já está em uso.";
    }
    return NextResponse.json(
      { error: "Dados já cadastrados.", fieldErrors },
      { status: 409 },
    );
  }

  const planoInicial = planosAtivos[0];
  if (!planoInicial) {
    return NextResponse.json(
      {
        error:
          "Nenhum plano ativo encontrado no banco. Execute o seed ou cadastre um plano.",
      },
      { status: 500 },
    );
  }

  const senhaHash = await hashPassword(dados.senha);
  const agora = new Date();
  const trialAte = new Date(
    agora.getTime() + config.dias_trial * 24 * 60 * 60 * 1000,
  );

  try {
    const resultado = await db.transaction(async (tx) => {
      const [usuarioCriado] = await tx
        .insert(usuarios)
        .values({
          email: dados.email,
          senha_hash: senhaHash,
          nome: dados.nome,
          role: "lojista",
        })
        .returning({
          id: usuarios.id,
          email: usuarios.email,
          nome: usuarios.nome,
          role: usuarios.role,
          criado_em: usuarios.criado_em,
        });

      const [lojaCriada] = await tx
        .insert(lojas)
        .values({
          dono_id: usuarioCriado.id,
          slug: slugNormalizado,
          nome: dados.loja_nome,
          cpf_cnpj: cpfCnpjLimpo,
          whatsapp: whatsappNormalizado,
          categoria: dados.categoria,
          bairro: dados.bairro,
          status: "pendente",
          plano_id: planoInicial.id,
          aberta: false,
        })
        .returning();

      await tx.insert(lojas_tema).values({
        loja_id: lojaCriada.id,
        cor_primaria: "#EA1D2C",
        cor_secundaria: "#18181B",
        fonte: "Inter",
      });

      await tx.insert(lojas_entrega).values({
        loja_id: lojaCriada.id,
        aceita_retirada: true,
        aceita_entrega: true,
        modo_frete: "fixo",
        frete_fixo_centavos: 500,
        frete_gratis_acima_centavos: null,
        pedido_minimo_centavos: 0,
        tempo_estimado_min: 40,
        horarios: HORARIOS_PADRAO,
      });

      await tx.insert(assinaturas).values({
        loja_id: lojaCriada.id,
        plano_id: planoInicial.id,
        status: "trial",
        proximo_vencimento: trialAte,
        trial_ate: trialAte,
      });

      return { usuario: usuarioCriado, loja: lojaCriada };
    });

    await createSession({
      id: resultado.usuario.id,
      role: resultado.usuario.role,
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error) {
    const pgErr = extrairCodigoPg(error);
    if (pgErr.code === "23505") {
      const fieldErrors: Record<string, string> = {};
      if (pgErr.constraint?.includes("email")) {
        fieldErrors.email = "Já existe uma conta cadastrada com este e-mail.";
      } else if (pgErr.constraint?.includes("slug")) {
        fieldErrors.slug = "Este endereço de loja já está em uso.";
      }
      return NextResponse.json(
        { error: "Conflito de cadastro.", fieldErrors },
        { status: 409 },
      );
    }

    console.error("Erro no cadastro do lojista:", error);
    return NextResponse.json(
      { error: "Não foi possível concluir o cadastro." },
      { status: 500 },
    );
  }
}

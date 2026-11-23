import "dotenv/config";
import { eq } from "drizzle-orm";
import { closeDb, db } from "./index";
import {
  assinaturas,
  bairros_entrega,
  configuracoes_plataforma,
  DEFAULT_SLUGS_RESERVADOS,
  HORARIOS_PADRAO,
  lojas,
  lojas_entrega,
  lojas_tema,
  planos,
  produtos,
  usuarios,
} from "./schema";
import { hashPassword } from "../lib/auth/password";
import { createTenantDb } from "../lib/tenant";
import { seedDemoOrders } from "./seed-demo";

async function seed() {
  console.log("Iniciando seed do MinhaLoja (Teresina-PI)...");

  const planosConfig = [
    {
      nome: "Start",
      mensalidade_centavos: 4990,
      limite_produtos: 30,
      taxa_fixa_centavos: 100,
      taxa_percentual: "2.50",
    },
    {
      nome: "Pro",
      mensalidade_centavos: 9990,
      limite_produtos: 150,
      taxa_fixa_centavos: 50,
      taxa_percentual: "1.50",
    },
    {
      nome: "Premium",
      mensalidade_centavos: 19990,
      limite_produtos: null,
      taxa_fixa_centavos: 0,
      taxa_percentual: "0.99",
    },
  ];

  const planosCriados = [];
  for (const plano of planosConfig) {
    const [row] = await db
      .insert(planos)
      .values(plano)
      .onConflictDoUpdate({
        target: planos.nome,
        set: {
          mensalidade_centavos: plano.mensalidade_centavos,
          limite_produtos: plano.limite_produtos,
          taxa_fixa_centavos: plano.taxa_fixa_centavos,
          taxa_percentual: plano.taxa_percentual,
        },
      })
      .returning();
    planosCriados.push(row);
  }

  const planoStart = planosCriados.find((p) => p.nome === "Start");
  const planoPro = planosCriados.find((p) => p.nome === "Pro");
  if (!planoStart || !planoPro) {
    throw new Error("Planos Start/Pro não encontrados após seed.");
  }

  await db
    .insert(configuracoes_plataforma)
    .values({
      id: "default",
      nome_plataforma: "MinhaLoja",
      email_suporte: "suporte@minhaloja.com.br",
      dias_trial: 14,
      slugs_reservados: [...DEFAULT_SLUGS_RESERVADOS],
    })
    .onConflictDoNothing();

  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@minhaloja.com.br")
    .trim()
    .toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin@1234";
  const adminSenhaHash = await hashPassword(adminPassword);
  await db
    .insert(usuarios)
    .values({
      email: adminEmail,
      senha_hash: adminSenhaHash,
      nome: "Administrador Plataforma",
      role: "admin",
      ativo: true,
    })
    .onConflictDoUpdate({
      target: usuarios.email,
      set: {
        nome: "Administrador Plataforma",
        role: "admin",
        senha_hash: adminSenhaHash,
        ativo: true,
      },
    });

  const lojistaSenhaHash = await hashPassword("Loja@1234");
  const [lojista] = await db
    .insert(usuarios)
    .values({
      email: "lojista@casaatelier.com.br",
      senha_hash: lojistaSenhaHash,
      nome: "Marina Vasconcelos",
      role: "lojista",
    })
    .onConflictDoUpdate({
      target: usuarios.email,
      set: {
        nome: "Marina Vasconcelos",
        role: "lojista",
      },
    })
    .returning();

  const [lojaTeste] = await db
    .insert(lojas)
    .values({
      dono_id: lojista.id,
      slug: "casa-atelier",
      nome: "Casa Atelier",
      cpf_cnpj: "11222333000181",
      whatsapp: "5586999887766",
      categoria: "Moda & Acessórios",
      bairro: "Jóquei",
      status: "ativa",
      plano_id: planoPro.id,
      aberta: true,
    })
    .onConflictDoUpdate({
      target: lojas.slug,
      set: {
        nome: "Casa Atelier",
        cpf_cnpj: "11222333000181",
        categoria: "Moda & Acessórios",
        bairro: "Jóquei",
        status: "ativa",
        plano_id: planoPro.id,
        aberta: true,
      },
    })
    .returning();

  await db
    .insert(lojas_tema)
    .values({
      loja_id: lojaTeste.id,
      cor_primaria: "#9F1239",
      cor_secundaria: "#18181B",
      fonte: "Playfair Display",
      banner_url: "/seed/banner-casa-atelier.webp",
    })
    .onConflictDoUpdate({
      target: lojas_tema.loja_id,
      set: {
        cor_primaria: "#9F1239",
        cor_secundaria: "#18181B",
        fonte: "Playfair Display",
        banner_url: "/seed/banner-casa-atelier.webp",
      },
    });

  await db
    .insert(lojas_entrega)
    .values({
      loja_id: lojaTeste.id,
      aceita_retirada: true,
      aceita_entrega: true,
      modo_frete: "bairro",
      frete_fixo_centavos: 1000,
      frete_gratis_acima_centavos: 25000,
      pedido_minimo_centavos: 4000,
      tempo_estimado_min: 60,
      horarios: HORARIOS_PADRAO,
    })
    .onConflictDoUpdate({
      target: lojas_entrega.loja_id,
      set: {
        aceita_retirada: true,
        aceita_entrega: true,
        modo_frete: "bairro",
        frete_fixo_centavos: 1000,
        frete_gratis_acima_centavos: 25000,
        pedido_minimo_centavos: 4000,
        tempo_estimado_min: 60,
      },
    });

  const bairrosTeresina = [
    { bairro: "Jóquei", valor_centavos: 500 },
    { bairro: "Fátima", valor_centavos: 600 },
    { bairro: "Ininga", valor_centavos: 700 },
    { bairro: "São Cristóvão", valor_centavos: 800 },
    { bairro: "Centro", valor_centavos: 900 },
  ];

  for (const item of bairrosTeresina) {
    await db
      .insert(bairros_entrega)
      .values({
        loja_id: lojaTeste.id,
        bairro: item.bairro,
        valor_centavos: item.valor_centavos,
      })
      .onConflictDoUpdate({
        target: [bairros_entrega.loja_id, bairros_entrega.bairro],
        set: { valor_centavos: item.valor_centavos },
      });
  }

  const produtosCasaAtelier = [
    {
      nome: "Vestido Midi em Linho Natural",
      descricao:
        "Modelagem fluida com alças ajustáveis, bolso lateral e caimento leve.",
      preco_centavos: 24990,
      imagem_url: "/seed/produtos/vestido-midi-em-linho-natural.webp",
      estoque: 8,
      ativo: true,
      categoria: "Vestuário",
    },
    {
      nome: "Camisa Social Algodão Off-White",
      descricao:
        "Corte reto em algodão respirável com botões madrepérola.",
      preco_centavos: 16990,
      imagem_url: "/seed/produtos/camisa-social-algodao-off-white.webp",
      estoque: 14,
      ativo: true,
      categoria: "Vestuário",
    },
    {
      nome: "Calça Pantalona Alfaiataria Areia",
      descricao:
        "Cintura alta com pregas frontais e tecido de toque macio.",
      preco_centavos: 21900,
      imagem_url: "/seed/produtos/calca-pantalona-alfaiataria-areia.webp",
      estoque: 3,
      ativo: true,
      categoria: "Vestuário",
    },
    {
      nome: "Bolsa Tote Estruturada Caramelo",
      descricao:
        "Acabamento premium com alça dupla reforçada e fecho magnético.",
      preco_centavos: 28990,
      imagem_url: "/seed/produtos/bolsa-tote-estruturada-caramelo.webp",
      estoque: 6,
      ativo: true,
      categoria: "Bolsas",
    },
    {
      nome: "Clutch Minimalista Nude",
      descricao:
        "Compacta e versátil com alça removível em corrente dourada.",
      preco_centavos: 13990,
      imagem_url: "/seed/produtos/clutch-minimalista-nude.webp",
      estoque: 2,
      ativo: true,
      categoria: "Bolsas",
    },
    {
      nome: "Mini Bag Transversal Terracota",
      descricao:
        "Ideal para o dia a dia, comporta celular, carteira e chaves.",
      preco_centavos: 15900,
      imagem_url: "/seed/produtos/mini-bag-transversal-terracota.webp",
      estoque: 0,
      ativo: true,
      categoria: "Bolsas",
    },
    {
      nome: "Brinco Argola Orgânica Banhada a Ouro",
      descricao:
        "Design contemporâneo leve, hipoalergênico e de alta durabilidade.",
      preco_centavos: 7990,
      imagem_url: "/seed/produtos/brinco-argola-organica-banhada-a-ouro.webp",
      estoque: 25,
      ativo: true,
      categoria: "Acessórios",
    },
    {
      nome: "Lenço de Seda Estampa Botânica",
      descricao:
        "Peça multifuncional 70x70cm para usar no pescoço, cabelo ou na bolsa.",
      preco_centavos: 6490,
      imagem_url: "/seed/produtos/lenco-de-seda-estampa-botanica.webp",
      estoque: 18,
      ativo: true,
      categoria: "Acessórios",
    },
  ];

  const tenantDb = createTenantDb(lojaTeste.id);
  const totalProdutos = await tenantDb.count(produtos);

  if (totalProdutos === 0) {
    await tenantDb.insert(produtos, produtosCasaAtelier);
  } else {
    const existentes = await tenantDb.findMany(produtos);
    const porNome = new Map(existentes.map((item) => [item.nome, item]));
    for (const item of produtosCasaAtelier) {
      const existente = porNome.get(item.nome);
      if (
        existente &&
        (existente.imagem_url === null ||
          existente.imagem_url.startsWith("/seed/"))
      ) {
        await tenantDb.updateById(produtos, existente.id, {
          imagem_url: item.imagem_url,
        });
      }
    }
  }

  const proximoVencimento = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [assinaturaExistente] = await db
    .select()
    .from(assinaturas)
    .where(eq(assinaturas.loja_id, lojaTeste.id))
    .limit(1);

  if (!assinaturaExistente) {
    await db.insert(assinaturas).values({
      loja_id: lojaTeste.id,
      plano_id: planoPro.id,
      status: "ativa",
      proximo_vencimento: proximoVencimento,
      trial_ate: null,
    });
  } else {
    await db
      .update(assinaturas)
      .set({
        plano_id: planoPro.id,
        status: "ativa",
      })
      .where(eq(assinaturas.loja_id, lojaTeste.id));
  }

  const lojasExtras = [
    {
      email: "lumina@minhaloja.com.br",
      donoNome: "Camila Andrade",
      slug: "estudio-lumina",
      nome: "Estúdio Lumina Beleza",
      cpf_cnpj: "22333444000181",
      whatsapp: "5586988776655",
      categoria: "Beleza",
      bairro: "Fátima",
      status: "pendente" as const,
      aberta: false,
      cor_primaria: "#BE185D",
      cor_secundaria: "#18181B",
      fonte: "Playfair Display",
      trialDias: 14,
      produtoExemplo: {
        nome: "Sérum Facial Vitamina C 30ml",
        descricao: "Fórmula antioxidante iluminadora de uso diário.",
        preco_centavos: 8990,
        estoque: 15,
        categoria: "Skincare",
      },
    },
    {
      email: "norte@minhaloja.com.br",
      donoNome: "Rafael Moura",
      slug: "norte-tech",
      nome: "Norte Tech Acessórios",
      cpf_cnpj: "33444555000181",
      whatsapp: "5586977665544",
      categoria: "Eletrônicos",
      bairro: "Centro",
      status: "ativa" as const,
      aberta: true,
      cor_primaria: "#1D4ED8",
      cor_secundaria: "#09090B",
      fonte: "Space Grotesk",
      trialDias: 10,
      produtoExemplo: {
        nome: "Carregador USB-C Turbo 30W",
        descricao: "Carregamento rápido bivolt com cabo trançado 1,5m.",
        preco_centavos: 7990,
        estoque: 20,
        categoria: "Carregadores",
      },
    },
  ];

  for (const extra of lojasExtras) {
    const extraSenhaHash = await hashPassword("Loja@1234");
    const [donoExtra] = await db
      .insert(usuarios)
      .values({
        email: extra.email,
        senha_hash: extraSenhaHash,
        nome: extra.donoNome,
        role: "lojista",
        ativo: true,
      })
      .onConflictDoUpdate({
        target: usuarios.email,
        set: { nome: extra.donoNome, role: "lojista" },
      })
      .returning();

    const [lojaExtra] = await db
      .insert(lojas)
      .values({
        dono_id: donoExtra.id,
        slug: extra.slug,
        nome: extra.nome,
        cpf_cnpj: extra.cpf_cnpj,
        whatsapp: extra.whatsapp,
        categoria: extra.categoria,
        bairro: extra.bairro,
        status: extra.status,
        plano_id: planoStart.id,
        aberta: extra.aberta,
      })
      .onConflictDoUpdate({
        target: lojas.slug,
        set: {
          dono_id: donoExtra.id,
          nome: extra.nome,
          cpf_cnpj: extra.cpf_cnpj,
          categoria: extra.categoria,
          bairro: extra.bairro,
          status: extra.status,
          plano_id: planoStart.id,
          aberta: extra.aberta,
          deletada_em: null,
        },
      })
      .returning();

    await db
      .insert(lojas_tema)
      .values({
        loja_id: lojaExtra.id,
        cor_primaria: extra.cor_primaria,
        cor_secundaria: extra.cor_secundaria,
        fonte: extra.fonte,
      })
      .onConflictDoNothing();

    await db
      .insert(lojas_entrega)
      .values({
        loja_id: lojaExtra.id,
        aceita_retirada: true,
        aceita_entrega: true,
        modo_frete: "fixo",
        frete_fixo_centavos: 800,
        frete_gratis_acima_centavos: 15000,
        pedido_minimo_centavos: 3000,
        tempo_estimado_min: 45,
        horarios: HORARIOS_PADRAO,
      })
      .onConflictDoNothing();

    const extraTenantDb = createTenantDb(lojaExtra.id);
    if ((await extraTenantDb.count(produtos)) === 0) {
      await extraTenantDb.insert(produtos, {
        ...extra.produtoExemplo,
        imagem_url: null,
        ativo: true,
      });
    }

    const trialAteExtra = new Date(
      Date.now() + extra.trialDias * 24 * 60 * 60 * 1000,
    );
    const [assExtra] = await db
      .select({ id: assinaturas.id })
      .from(assinaturas)
      .where(eq(assinaturas.loja_id, lojaExtra.id))
      .limit(1);

    if (!assExtra) {
      await db.insert(assinaturas).values({
        loja_id: lojaExtra.id,
        plano_id: planoStart.id,
        status: "trial",
        proximo_vencimento: trialAteExtra,
        trial_ate: trialAteExtra,
      });
    }
  }

  if (process.env.SEED_DEMO === "true") {
    await seedDemoOrders();
  }

  console.log("Seed concluído com sucesso!");
  console.log("Planos: Start, Pro, Premium");
  console.log(
    "Loja de teste (ativa): /casa-atelier (lojista@casaatelier.com.br / Loja@1234)",
  );
  console.log(
    "Loja pendente/trial: /estudio-lumina (lumina@minhaloja.com.br / Loja@1234)",
  );
  console.log(
    "Loja ativa/trial: /norte-tech (norte@minhaloja.com.br / Loja@1234)",
  );
  console.log(`Admin: ${adminEmail}`);
}

seed()
  .catch((err) => {
    console.error("Erro ao executar seed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });

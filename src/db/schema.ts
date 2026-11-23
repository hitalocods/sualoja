import {
  InferInsertModel,
  InferSelectModel,
  relations,
  sql,
} from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type DiaHorario = {
  aberto: boolean;
  abre: string;
  fecha: string;
};

export type HorariosFuncionamento = Record<
  "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom",
  DiaHorario
>;

export type EnderecoEntrega = {
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  referencia?: string;
  cidade: string;
  uf: string;
};

export const HORARIOS_PADRAO: HorariosFuncionamento = {
  seg: { aberto: true, abre: "18:00", fecha: "23:00" },
  ter: { aberto: true, abre: "18:00", fecha: "23:00" },
  qua: { aberto: true, abre: "18:00", fecha: "23:00" },
  qui: { aberto: true, abre: "18:00", fecha: "23:00" },
  sex: { aberto: true, abre: "18:00", fecha: "23:59" },
  sab: { aberto: true, abre: "18:00", fecha: "23:59" },
  dom: { aberto: true, abre: "18:00", fecha: "23:00" },
};

export const usuarioRoleEnum = pgEnum("usuario_role", ["lojista", "admin"]);

export const lojaStatusEnum = pgEnum("loja_status", [
  "ativa",
  "pendente",
  "bloqueada",
]);

export const modoFreteEnum = pgEnum("modo_frete", ["fixo", "bairro"]);

export const pedidoStatusEnum = pgEnum("pedido_status", [
  "aguardando_pagamento",
  "pago",
  "em_separacao",
  "saiu_entrega",
  "entregue",
  "cancelado",
  "expirado",
]);

export const pedidoTipoEnum = pgEnum("pedido_tipo", ["entrega", "retirada"]);

export const taxaPagaPorEnum = pgEnum("taxa_paga_por", ["cliente", "loja"]);

export const assinaturaStatusEnum = pgEnum("assinatura_status", [
  "trial",
  "ativa",
  "atrasada",
  "bloqueada",
]);

export const DEFAULT_SLUGS_RESERVADOS = [
  "admin",
  "api",
  "login",
  "cadastro",
  "painel",
  "app",
  "www",
  "auth",
  "webhooks",
  "checkout",
] as const;

export const planos = pgTable(
  "planos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nome: text("nome").notNull().unique(),
    mensalidade_centavos: integer("mensalidade_centavos").notNull(),
    limite_produtos: integer("limite_produtos"),
    taxa_fixa_centavos: integer("taxa_fixa_centavos").notNull().default(0),
    taxa_percentual: numeric("taxa_percentual", { precision: 5, scale: 2 })
      .notNull()
      .default("0.00"),
    ativo: boolean("ativo").notNull().default(true),
  },
  (table) => [
    check("planos_mensalidade_non_neg", sql`${table.mensalidade_centavos} >= 0`),
    check("planos_taxa_fixa_non_neg", sql`${table.taxa_fixa_centavos} >= 0`),
    check(
      "planos_limite_produtos_pos",
      sql`${table.limite_produtos} IS NULL OR ${table.limite_produtos} > 0`,
    ),
  ],
);

export const usuarios = pgTable("usuarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  senha_hash: text("senha_hash").notNull(),
  nome: text("nome").notNull(),
  role: usuarioRoleEnum("role").notNull().default("lojista"),
  ativo: boolean("ativo").notNull().default(true),
  criado_em: timestamp("criado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const lojas = pgTable(
  "lojas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dono_id: uuid("dono_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    nome: text("nome").notNull(),
    cpf_cnpj: text("cpf_cnpj").notNull(),
    whatsapp: text("whatsapp").notNull(),
    categoria: text("categoria").notNull().default("Alimentação"),
    bairro: text("bairro").notNull().default("Centro"),
    status: lojaStatusEnum("status").notNull().default("pendente"),
    plano_id: uuid("plano_id")
      .notNull()
      .references(() => planos.id, { onDelete: "restrict" }),
    taxa_paga_por: taxaPagaPorEnum("taxa_paga_por").notNull().default("loja"),
    abacate_subconta_id: text("abacate_subconta_id"),
    subconta_erro: text("subconta_erro"),
    abacate_subconta_erro: text("abacate_subconta_erro"),
    aberta: boolean("aberta").notNull().default(false),
    criada_em: timestamp("criada_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletada_em: timestamp("deletada_em", { withTimezone: true }),
  },
  (table) => [
    index("lojas_dono_id_idx").on(table.dono_id),
    index("lojas_status_idx").on(table.status),
  ],
);

export const lojas_tema = pgTable("lojas_tema", {
  loja_id: uuid("loja_id")
    .primaryKey()
    .references(() => lojas.id, { onDelete: "cascade" }),
  cor_primaria: text("cor_primaria").notNull().default("#EA1D2C"),
  cor_secundaria: text("cor_secundaria").notNull().default("#18181B"),
  fonte: text("fonte").notNull().default("Plus Jakarta Sans"),
  logo_url: text("logo_url"),
  banner_url: text("banner_url"),
});

export const lojas_entrega = pgTable(
  "lojas_entrega",
  {
    loja_id: uuid("loja_id")
      .primaryKey()
      .references(() => lojas.id, { onDelete: "cascade" }),
    aceita_retirada: boolean("aceita_retirada").notNull().default(true),
    aceita_entrega: boolean("aceita_entrega").notNull().default(true),
    modo_frete: modoFreteEnum("modo_frete").notNull().default("fixo"),
    frete_fixo_centavos: integer("frete_fixo_centavos").notNull().default(0),
    frete_gratis_acima_centavos: integer("frete_gratis_acima_centavos"),
    pedido_minimo_centavos: integer("pedido_minimo_centavos")
      .notNull()
      .default(0),
    tempo_estimado_min: integer("tempo_estimado_min").notNull().default(40),
    horarios: jsonb("horarios")
      .$type<HorariosFuncionamento>()
      .notNull()
      .default(HORARIOS_PADRAO),
  },
  (table) => [
    check(
      "lojas_entrega_frete_fixo_non_neg",
      sql`${table.frete_fixo_centavos} >= 0`,
    ),
    check(
      "lojas_entrega_pedido_minimo_non_neg",
      sql`${table.pedido_minimo_centavos} >= 0`,
    ),
    check(
      "lojas_entrega_tempo_estimado_pos",
      sql`${table.tempo_estimado_min} > 0`,
    ),
    check(
      "lojas_entrega_frete_gratis_non_neg",
      sql`${table.frete_gratis_acima_centavos} IS NULL OR ${table.frete_gratis_acima_centavos} >= 0`,
    ),
  ],
);

export const bairros_entrega = pgTable(
  "bairros_entrega",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    loja_id: uuid("loja_id")
      .notNull()
      .references(() => lojas.id, { onDelete: "cascade" }),
    bairro: text("bairro").notNull(),
    valor_centavos: integer("valor_centavos").notNull(),
  },
  (table) => [
    index("bairros_entrega_loja_id_idx").on(table.loja_id),
    uniqueIndex("bairros_entrega_loja_bairro_uq").on(
      table.loja_id,
      table.bairro,
    ),
    check("bairros_entrega_valor_non_neg", sql`${table.valor_centavos} >= 0`),
  ],
);

export const produtos = pgTable(
  "produtos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    loja_id: uuid("loja_id")
      .notNull()
      .references(() => lojas.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    preco_centavos: integer("preco_centavos").notNull(),
    imagem_url: text("imagem_url"),
    estoque: integer("estoque").notNull().default(0),
    ativo: boolean("ativo").notNull().default(true),
    categoria: text("categoria").notNull().default("Geral"),
    criado_em: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
    atualizado_em: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("produtos_loja_id_idx").on(table.loja_id),
    index("produtos_loja_ativo_idx").on(table.loja_id, table.ativo),
    check("produtos_preco_non_neg", sql`${table.preco_centavos} >= 0`),
    check("produtos_estoque_non_neg", sql`${table.estoque} >= 0`),
  ],
);

export const pedidos = pgTable(
  "pedidos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    loja_id: uuid("loja_id")
      .notNull()
      .references(() => lojas.id, { onDelete: "restrict" }),
    codigo: text("codigo").notNull(),
    status: pedidoStatusEnum("status")
      .notNull()
      .default("aguardando_pagamento"),
    cliente_nome: text("cliente_nome").notNull(),
    cliente_whatsapp: text("cliente_whatsapp").notNull(),
    tipo: pedidoTipoEnum("tipo").notNull(),
    endereco: jsonb("endereco").$type<EnderecoEntrega | null>(),
    subtotal_centavos: integer("subtotal_centavos").notNull(),
    frete_centavos: integer("frete_centavos").notNull().default(0),
    taxa_servico_centavos: integer("taxa_servico_centavos").notNull().default(0),
    taxa_paga_por: taxaPagaPorEnum("taxa_paga_por").notNull().default("loja"),
    total_centavos: integer("total_centavos").notNull(),
    abacate_cobranca_id: text("abacate_cobranca_id").unique(),
    pix_copia_cola: text("pix_copia_cola"),
    pix_expira_em: timestamp("pix_expira_em", { withTimezone: true }),
    pago_em: timestamp("pago_em", { withTimezone: true }),
    demo: boolean("demo").notNull().default(false),
    criado_em: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("pedidos_loja_status_idx").on(table.loja_id, table.status),
    index("pedidos_loja_criado_em_idx").on(table.loja_id, table.criado_em),
    index("pedidos_demo_status_criado_idx").on(
      table.demo,
      table.status,
      table.criado_em,
    ),
    uniqueIndex("pedidos_loja_codigo_uq").on(table.loja_id, table.codigo),
    index("pedidos_codigo_idx").on(table.codigo),
    check("pedidos_subtotal_non_neg", sql`${table.subtotal_centavos} >= 0`),
    check("pedidos_frete_non_neg", sql`${table.frete_centavos} >= 0`),
    check(
      "pedidos_taxa_servico_non_neg",
      sql`${table.taxa_servico_centavos} >= 0`,
    ),
    check("pedidos_total_non_neg", sql`${table.total_centavos} >= 0`),
  ],
);

export const pedido_itens = pgTable(
  "pedido_itens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    loja_id: uuid("loja_id")
      .notNull()
      .references(() => lojas.id, { onDelete: "cascade" }),
    pedido_id: uuid("pedido_id")
      .notNull()
      .references(() => pedidos.id, { onDelete: "cascade" }),
    produto_id: uuid("produto_id").references(() => produtos.id, {
      onDelete: "set null",
    }),
    nome_snapshot: text("nome_snapshot").notNull(),
    preco_snapshot_centavos: integer("preco_snapshot_centavos").notNull(),
    qtd: integer("qtd").notNull(),
  },
  (table) => [
    index("pedido_itens_loja_id_idx").on(table.loja_id),
    index("pedido_itens_pedido_id_idx").on(table.pedido_id),
    check("pedido_itens_qtd_pos", sql`${table.qtd} > 0`),
    check(
      "pedido_itens_preco_non_neg",
      sql`${table.preco_snapshot_centavos} >= 0`,
    ),
  ],
);

export const reservas_estoque = pgTable(
  "reservas_estoque",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    loja_id: uuid("loja_id")
      .notNull()
      .references(() => lojas.id, { onDelete: "cascade" }),
    pedido_id: uuid("pedido_id")
      .notNull()
      .references(() => pedidos.id, { onDelete: "cascade" }),
    produto_id: uuid("produto_id")
      .notNull()
      .references(() => produtos.id, { onDelete: "cascade" }),
    qtd: integer("qtd").notNull(),
    expira_em: timestamp("expira_em", { withTimezone: true }).notNull(),
    liberada: boolean("liberada").notNull().default(false),
  },
  (table) => [
    index("reservas_estoque_loja_produto_liberada_idx").on(
      table.loja_id,
      table.produto_id,
      table.liberada,
    ),
    index("reservas_estoque_liberada_expira_idx").on(
      table.liberada,
      table.expira_em,
    ),
    index("reservas_estoque_pedido_id_idx").on(table.pedido_id),
    check("reservas_estoque_qtd_pos", sql`${table.qtd} > 0`),
  ],
);

export const assinaturas = pgTable(
  "assinaturas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    loja_id: uuid("loja_id")
      .notNull()
      .unique()
      .references(() => lojas.id, { onDelete: "cascade" }),
    plano_id: uuid("plano_id")
      .notNull()
      .references(() => planos.id, { onDelete: "restrict" }),
    status: assinaturaStatusEnum("status").notNull().default("trial"),
    proximo_vencimento: timestamp("proximo_vencimento", {
      withTimezone: true,
    }).notNull(),
    trial_ate: timestamp("trial_ate", { withTimezone: true }),
  },
  (table) => [index("assinaturas_status_idx").on(table.status)],
);

export const webhook_eventos = pgTable("webhook_eventos", {
  id: uuid("id").defaultRandom().primaryKey(),
  evento_id: text("evento_id").notNull().unique(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  processado_em: timestamp("processado_em", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const impersonacoes_auditoria = pgTable(
  "impersonacoes_auditoria",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    admin_id: uuid("admin_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    loja_id: uuid("loja_id")
      .notNull()
      .references(() => lojas.id, { onDelete: "restrict" }),
    criado_em: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("impersonacoes_admin_id_idx").on(table.admin_id),
    index("impersonacoes_loja_id_idx").on(table.loja_id),
    index("impersonacoes_criado_em_idx").on(table.criado_em),
  ],
);

export const auditoria_admin = pgTable(
  "auditoria_admin",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    admin_id: uuid("admin_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    loja_id: uuid("loja_id")
      .notNull()
      .references(() => lojas.id, { onDelete: "restrict" }),
    acao: text("acao").notNull().default("corrigir_documento"),
    valor_antigo_mascarado: text("valor_antigo_mascarado").notNull(),
    valor_novo_mascarado: text("valor_novo_mascarado").notNull(),
    criado_em: timestamp("criado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("auditoria_admin_admin_id_idx").on(table.admin_id),
    index("auditoria_admin_loja_id_idx").on(table.loja_id),
    index("auditoria_admin_criado_em_idx").on(table.criado_em),
  ],
);

export const configuracoes_plataforma = pgTable(
  "configuracoes_plataforma",
  {
    id: text("id").primaryKey().default("default"),
    nome_plataforma: text("nome_plataforma").notNull().default("MinhaLoja"),
    email_suporte: text("email_suporte")
      .notNull()
      .default("suporte@minhaloja.com.br"),
    dias_trial: integer("dias_trial").notNull().default(14),
    pedido_minimo_plataforma_centavos: integer(
      "pedido_minimo_plataforma_centavos",
    )
      .notNull()
      .default(1000),
    slugs_reservados: jsonb("slugs_reservados")
      .$type<string[]>()
      .notNull()
      .default([...DEFAULT_SLUGS_RESERVADOS]),
    atualizado_em: timestamp("atualizado_em", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "config_dias_trial_range",
      sql`${table.dias_trial} >= 1 AND ${table.dias_trial} <= 365`,
    ),
    check(
      "config_pedido_minimo_min",
      sql`${table.pedido_minimo_plataforma_centavos} >= 100`,
    ),
  ],
);

export const usuariosRelations = relations(usuarios, ({ many }) => ({
  lojas: many(lojas),
}));

export const planosRelations = relations(planos, ({ many }) => ({
  lojas: many(lojas),
  assinaturas: many(assinaturas),
}));

export const lojasRelations = relations(lojas, ({ one, many }) => ({
  dono: one(usuarios, {
    fields: [lojas.dono_id],
    references: [usuarios.id],
  }),
  plano: one(planos, {
    fields: [lojas.plano_id],
    references: [planos.id],
  }),
  tema: one(lojas_tema, {
    fields: [lojas.id],
    references: [lojas_tema.loja_id],
  }),
  entrega: one(lojas_entrega, {
    fields: [lojas.id],
    references: [lojas_entrega.loja_id],
  }),
  assinatura: one(assinaturas, {
    fields: [lojas.id],
    references: [assinaturas.loja_id],
  }),
  bairros: many(bairros_entrega),
  produtos: many(produtos),
  pedidos: many(pedidos),
}));

export const pedidosRelations = relations(pedidos, ({ one, many }) => ({
  loja: one(lojas, {
    fields: [pedidos.loja_id],
    references: [lojas.id],
  }),
  itens: many(pedido_itens),
  reservas: many(reservas_estoque),
}));

export const pedidoItensRelations = relations(pedido_itens, ({ one }) => ({
  pedido: one(pedidos, {
    fields: [pedido_itens.pedido_id],
    references: [pedidos.id],
  }),
  produto: one(produtos, {
    fields: [pedido_itens.produto_id],
    references: [produtos.id],
  }),
}));

export const impersonacoesAuditoriaRelations = relations(
  impersonacoes_auditoria,
  ({ one }) => ({
    admin: one(usuarios, {
      fields: [impersonacoes_auditoria.admin_id],
      references: [usuarios.id],
    }),
    loja: one(lojas, {
      fields: [impersonacoes_auditoria.loja_id],
      references: [lojas.id],
    }),
  }),
);

export const auditoriaAdminRelations = relations(
  auditoria_admin,
  ({ one }) => ({
    admin: one(usuarios, {
      fields: [auditoria_admin.admin_id],
      references: [usuarios.id],
    }),
    loja: one(lojas, {
      fields: [auditoria_admin.loja_id],
      references: [lojas.id],
    }),
  }),
);

export type Plano = InferSelectModel<typeof planos>;
export type NovoPlano = InferInsertModel<typeof planos>;
export type Usuario = InferSelectModel<typeof usuarios>;
export type NovoUsuario = InferInsertModel<typeof usuarios>;
export type Loja = InferSelectModel<typeof lojas>;
export type NovaLoja = InferInsertModel<typeof lojas>;
export type LojaTema = InferSelectModel<typeof lojas_tema>;
export type LojaEntrega = InferSelectModel<typeof lojas_entrega>;
export type BairroEntrega = InferSelectModel<typeof bairros_entrega>;
export type Produto = InferSelectModel<typeof produtos>;
export type Pedido = InferSelectModel<typeof pedidos>;
export type PedidoItem = InferSelectModel<typeof pedido_itens>;
export type ReservaEstoque = InferSelectModel<typeof reservas_estoque>;
export type Assinatura = InferSelectModel<typeof assinaturas>;
export type WebhookEvento = InferSelectModel<typeof webhook_eventos>;
export type ImpersonacaoAuditoria = InferSelectModel<
  typeof impersonacoes_auditoria
>;
export type AuditoriaAdmin = InferSelectModel<typeof auditoria_admin>;
export type ConfiguracaoPlataforma = InferSelectModel<
  typeof configuracoes_plataforma
>;

CREATE TYPE "public"."assinatura_status" AS ENUM('trial', 'ativa', 'atrasada', 'bloqueada');--> statement-breakpoint
CREATE TYPE "public"."loja_status" AS ENUM('ativa', 'pendente', 'bloqueada');--> statement-breakpoint
CREATE TYPE "public"."modo_frete" AS ENUM('fixo', 'bairro');--> statement-breakpoint
CREATE TYPE "public"."pedido_status" AS ENUM('aguardando_pagamento', 'pago', 'preparando', 'saiu_entrega', 'entregue', 'cancelado', 'expirado');--> statement-breakpoint
CREATE TYPE "public"."pedido_tipo" AS ENUM('entrega', 'retirada');--> statement-breakpoint
CREATE TYPE "public"."taxa_paga_por" AS ENUM('cliente', 'loja');--> statement-breakpoint
CREATE TYPE "public"."usuario_role" AS ENUM('lojista', 'admin');--> statement-breakpoint
CREATE TABLE "assinaturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loja_id" uuid NOT NULL,
	"plano_id" uuid NOT NULL,
	"status" "assinatura_status" DEFAULT 'trial' NOT NULL,
	"proximo_vencimento" timestamp with time zone NOT NULL,
	"trial_ate" timestamp with time zone,
	CONSTRAINT "assinaturas_loja_id_unique" UNIQUE("loja_id")
);
--> statement-breakpoint
CREATE TABLE "bairros_entrega" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loja_id" uuid NOT NULL,
	"bairro" text NOT NULL,
	"valor_centavos" integer NOT NULL,
	CONSTRAINT "bairros_entrega_valor_non_neg" CHECK ("bairros_entrega"."valor_centavos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lojas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dono_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"nome" text NOT NULL,
	"cpf_cnpj" text NOT NULL,
	"whatsapp" text NOT NULL,
	"categoria" text DEFAULT 'Alimentação' NOT NULL,
	"bairro" text DEFAULT 'Centro' NOT NULL,
	"status" "loja_status" DEFAULT 'pendente' NOT NULL,
	"plano_id" uuid NOT NULL,
	"abacate_subconta_id" text,
	"aberta" boolean DEFAULT false NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lojas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "lojas_entrega" (
	"loja_id" uuid PRIMARY KEY NOT NULL,
	"aceita_retirada" boolean DEFAULT true NOT NULL,
	"aceita_entrega" boolean DEFAULT true NOT NULL,
	"modo_frete" "modo_frete" DEFAULT 'fixo' NOT NULL,
	"frete_fixo_centavos" integer DEFAULT 0 NOT NULL,
	"frete_gratis_acima_centavos" integer,
	"pedido_minimo_centavos" integer DEFAULT 0 NOT NULL,
	"tempo_estimado_min" integer DEFAULT 40 NOT NULL,
	"horarios" jsonb DEFAULT '{"seg":{"aberto":true,"abre":"18:00","fecha":"23:00"},"ter":{"aberto":true,"abre":"18:00","fecha":"23:00"},"qua":{"aberto":true,"abre":"18:00","fecha":"23:00"},"qui":{"aberto":true,"abre":"18:00","fecha":"23:00"},"sex":{"aberto":true,"abre":"18:00","fecha":"23:59"},"sab":{"aberto":true,"abre":"18:00","fecha":"23:59"},"dom":{"aberto":true,"abre":"18:00","fecha":"23:00"}}'::jsonb NOT NULL,
	CONSTRAINT "lojas_entrega_frete_fixo_non_neg" CHECK ("lojas_entrega"."frete_fixo_centavos" >= 0),
	CONSTRAINT "lojas_entrega_pedido_minimo_non_neg" CHECK ("lojas_entrega"."pedido_minimo_centavos" >= 0),
	CONSTRAINT "lojas_entrega_tempo_estimado_pos" CHECK ("lojas_entrega"."tempo_estimado_min" > 0),
	CONSTRAINT "lojas_entrega_frete_gratis_non_neg" CHECK ("lojas_entrega"."frete_gratis_acima_centavos" IS NULL OR "lojas_entrega"."frete_gratis_acima_centavos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "lojas_tema" (
	"loja_id" uuid PRIMARY KEY NOT NULL,
	"cor_primaria" text DEFAULT '#EA1D2C' NOT NULL,
	"cor_secundaria" text DEFAULT '#18181B' NOT NULL,
	"fonte" text DEFAULT 'Plus Jakarta Sans' NOT NULL,
	"logo_url" text,
	"banner_url" text
);
--> statement-breakpoint
CREATE TABLE "pedido_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loja_id" uuid NOT NULL,
	"pedido_id" uuid NOT NULL,
	"produto_id" uuid,
	"nome_snapshot" text NOT NULL,
	"preco_snapshot_centavos" integer NOT NULL,
	"qtd" integer NOT NULL,
	CONSTRAINT "pedido_itens_qtd_pos" CHECK ("pedido_itens"."qtd" > 0),
	CONSTRAINT "pedido_itens_preco_non_neg" CHECK ("pedido_itens"."preco_snapshot_centavos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loja_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"status" "pedido_status" DEFAULT 'aguardando_pagamento' NOT NULL,
	"cliente_nome" text NOT NULL,
	"cliente_whatsapp" text NOT NULL,
	"tipo" "pedido_tipo" NOT NULL,
	"endereco" jsonb,
	"subtotal_centavos" integer NOT NULL,
	"frete_centavos" integer DEFAULT 0 NOT NULL,
	"taxa_servico_centavos" integer DEFAULT 0 NOT NULL,
	"taxa_paga_por" "taxa_paga_por" DEFAULT 'loja' NOT NULL,
	"total_centavos" integer NOT NULL,
	"abacate_cobranca_id" text,
	"pix_copia_cola" text,
	"pix_expira_em" timestamp with time zone,
	"pago_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedidos_abacate_cobranca_id_unique" UNIQUE("abacate_cobranca_id"),
	CONSTRAINT "pedidos_subtotal_non_neg" CHECK ("pedidos"."subtotal_centavos" >= 0),
	CONSTRAINT "pedidos_frete_non_neg" CHECK ("pedidos"."frete_centavos" >= 0),
	CONSTRAINT "pedidos_taxa_servico_non_neg" CHECK ("pedidos"."taxa_servico_centavos" >= 0),
	CONSTRAINT "pedidos_total_non_neg" CHECK ("pedidos"."total_centavos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "planos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"mensalidade_centavos" integer NOT NULL,
	"limite_produtos" integer,
	"taxa_fixa_centavos" integer DEFAULT 0 NOT NULL,
	"taxa_percentual" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	CONSTRAINT "planos_nome_unique" UNIQUE("nome"),
	CONSTRAINT "planos_mensalidade_non_neg" CHECK ("planos"."mensalidade_centavos" >= 0),
	CONSTRAINT "planos_taxa_fixa_non_neg" CHECK ("planos"."taxa_fixa_centavos" >= 0),
	CONSTRAINT "planos_limite_produtos_pos" CHECK ("planos"."limite_produtos" IS NULL OR "planos"."limite_produtos" > 0)
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loja_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"preco_centavos" integer NOT NULL,
	"imagem_url" text,
	"estoque" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"categoria" text DEFAULT 'Geral' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produtos_preco_non_neg" CHECK ("produtos"."preco_centavos" >= 0),
	CONSTRAINT "produtos_estoque_non_neg" CHECK ("produtos"."estoque" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reservas_estoque" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loja_id" uuid NOT NULL,
	"pedido_id" uuid NOT NULL,
	"produto_id" uuid NOT NULL,
	"qtd" integer NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"liberada" boolean DEFAULT false NOT NULL,
	CONSTRAINT "reservas_estoque_qtd_pos" CHECK ("reservas_estoque"."qtd" > 0)
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"nome" text NOT NULL,
	"role" "usuario_role" DEFAULT 'lojista' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evento_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_eventos_evento_id_unique" UNIQUE("evento_id")
);
--> statement-breakpoint
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_plano_id_planos_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."planos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bairros_entrega" ADD CONSTRAINT "bairros_entrega_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lojas" ADD CONSTRAINT "lojas_dono_id_usuarios_id_fk" FOREIGN KEY ("dono_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lojas" ADD CONSTRAINT "lojas_plano_id_planos_id_fk" FOREIGN KEY ("plano_id") REFERENCES "public"."planos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lojas_entrega" ADD CONSTRAINT "lojas_entrega_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lojas_tema" ADD CONSTRAINT "lojas_tema_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas_estoque" ADD CONSTRAINT "reservas_estoque_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas_estoque" ADD CONSTRAINT "reservas_estoque_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas_estoque" ADD CONSTRAINT "reservas_estoque_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assinaturas_status_idx" ON "assinaturas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bairros_entrega_loja_id_idx" ON "bairros_entrega" USING btree ("loja_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bairros_entrega_loja_bairro_uq" ON "bairros_entrega" USING btree ("loja_id","bairro");--> statement-breakpoint
CREATE INDEX "lojas_dono_id_idx" ON "lojas" USING btree ("dono_id");--> statement-breakpoint
CREATE INDEX "lojas_status_idx" ON "lojas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pedido_itens_loja_id_idx" ON "pedido_itens" USING btree ("loja_id");--> statement-breakpoint
CREATE INDEX "pedido_itens_pedido_id_idx" ON "pedido_itens" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "pedidos_loja_status_idx" ON "pedidos" USING btree ("loja_id","status");--> statement-breakpoint
CREATE INDEX "pedidos_loja_criado_em_idx" ON "pedidos" USING btree ("loja_id","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_loja_codigo_uq" ON "pedidos" USING btree ("loja_id","codigo");--> statement-breakpoint
CREATE INDEX "produtos_loja_id_idx" ON "produtos" USING btree ("loja_id");--> statement-breakpoint
CREATE INDEX "produtos_loja_ativo_idx" ON "produtos" USING btree ("loja_id","ativo");--> statement-breakpoint
CREATE INDEX "reservas_estoque_loja_produto_liberada_idx" ON "reservas_estoque" USING btree ("loja_id","produto_id","liberada");--> statement-breakpoint
CREATE INDEX "reservas_estoque_liberada_expira_idx" ON "reservas_estoque" USING btree ("liberada","expira_em");--> statement-breakpoint
CREATE INDEX "reservas_estoque_pedido_id_idx" ON "reservas_estoque" USING btree ("pedido_id");
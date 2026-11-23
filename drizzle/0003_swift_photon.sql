CREATE TABLE "configuracoes_plataforma" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"nome_plataforma" text DEFAULT 'MinhaLoja' NOT NULL,
	"email_suporte" text DEFAULT 'suporte@minhaloja.com.br' NOT NULL,
	"dias_trial" integer DEFAULT 14 NOT NULL,
	"slugs_reservados" jsonb DEFAULT '["admin","api","login","cadastro","painel","app","www","auth","webhooks","checkout"]'::jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "config_dias_trial_range" CHECK ("configuracoes_plataforma"."dias_trial" >= 1 AND "configuracoes_plataforma"."dias_trial" <= 365)
);
--> statement-breakpoint
CREATE TABLE "impersonacoes_auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"loja_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "deletada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "planos" ADD COLUMN "ativo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "ativo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "impersonacoes_auditoria" ADD CONSTRAINT "impersonacoes_auditoria_admin_id_usuarios_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impersonacoes_auditoria" ADD CONSTRAINT "impersonacoes_auditoria_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "impersonacoes_admin_id_idx" ON "impersonacoes_auditoria" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "impersonacoes_loja_id_idx" ON "impersonacoes_auditoria" USING btree ("loja_id");--> statement-breakpoint
CREATE INDEX "impersonacoes_criado_em_idx" ON "impersonacoes_auditoria" USING btree ("criado_em");
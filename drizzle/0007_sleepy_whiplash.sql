CREATE TABLE "auditoria_admin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"loja_id" uuid NOT NULL,
	"acao" text DEFAULT 'corrigir_documento' NOT NULL,
	"valor_antigo_mascarado" text NOT NULL,
	"valor_novo_mascarado" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auditoria_admin" ADD CONSTRAINT "auditoria_admin_admin_id_usuarios_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria_admin" ADD CONSTRAINT "auditoria_admin_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_admin_admin_id_idx" ON "auditoria_admin" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "auditoria_admin_loja_id_idx" ON "auditoria_admin" USING btree ("loja_id");--> statement-breakpoint
CREATE INDEX "auditoria_admin_criado_em_idx" ON "auditoria_admin" USING btree ("criado_em");
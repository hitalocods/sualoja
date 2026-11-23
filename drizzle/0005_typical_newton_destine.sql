ALTER TABLE "configuracoes_plataforma" ADD COLUMN "pedido_minimo_plataforma_centavos" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "abacate_subconta_erro" text;--> statement-breakpoint
CREATE INDEX "pedidos_codigo_idx" ON "pedidos" USING btree ("codigo");--> statement-breakpoint
ALTER TABLE "configuracoes_plataforma" ADD CONSTRAINT "config_pedido_minimo_min" CHECK ("configuracoes_plataforma"."pedido_minimo_plataforma_centavos" >= 100);
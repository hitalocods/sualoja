ALTER TABLE "configuracoes_plataforma" ADD COLUMN "tarifa_gateway_pix_centavos" integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "configuracoes_plataforma" ADD COLUMN "margem_minima_centavos" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "configuracoes_plataforma" ADD CONSTRAINT "config_tarifa_gateway_pix_non_neg" CHECK ("configuracoes_plataforma"."tarifa_gateway_pix_centavos" >= 0);--> statement-breakpoint
ALTER TABLE "configuracoes_plataforma" ADD CONSTRAINT "config_margem_minima_non_neg" CHECK ("configuracoes_plataforma"."margem_minima_centavos" >= 0);
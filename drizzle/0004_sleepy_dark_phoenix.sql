ALTER TABLE "pedidos" ADD COLUMN "demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "pedidos_demo_status_criado_idx" ON "pedidos" USING btree ("demo","status","criado_em");
import { desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { lojas, usuarios } from "@/db/schema";
import {
  AdminUsuariosManager,
  type UsuarioAdminRow,
} from "@/components/admin/AdminUsuariosManager";
import { requireAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function formatarDataBr(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(data);
}

export default async function AdminUsuariosPage() {
  const session = await requireAdminSession();

  const [usuariosRows, lojasRows] = await Promise.all([
    db
      .select({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        role: usuarios.role,
        ativo: usuarios.ativo,
        criado_em: usuarios.criado_em,
      })
      .from(usuarios)
      .orderBy(desc(usuarios.criado_em)),
    db
      .select({
        dono_id: lojas.dono_id,
        nome: lojas.nome,
        slug: lojas.slug,
        status: lojas.status,
      })
      .from(lojas)
      .where(isNull(lojas.deletada_em)),
  ]);

  const lojasPorDono = new Map<
    string,
    { nome: string; slug: string; status: string }[]
  >();
  for (const loja of lojasRows) {
    const lista = lojasPorDono.get(loja.dono_id) ?? [];
    lista.push({ nome: loja.nome, slug: loja.slug, status: loja.status });
    lojasPorDono.set(loja.dono_id, lista);
  }

  const usuariosSerializados: UsuarioAdminRow[] = usuariosRows.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    role: u.role,
    ativo: u.ativo,
    criadoEmFormatada: formatarDataBr(u.criado_em),
    lojasVinculadas: lojasPorDono.get(u.id) ?? [],
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
          Usuários da plataforma
        </h1>
        <p
          className="mt-1 text-xs sm:text-sm"
          style={{ color: "var(--admin-text-muted)" }}
        >
          Consulte contas cadastradas, gere senhas temporárias para suporte ou
          desative acessos.
        </p>
      </div>

      <AdminUsuariosManager
        usuarios={usuariosSerializados}
        currentAdminId={session.usuario.id}
      />
    </div>
  );
}

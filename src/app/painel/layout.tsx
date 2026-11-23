import { AlertCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { ImpersonationBanner } from "@/components/painel/ImpersonationBanner";
import { PainelHeader } from "@/components/painel/PainelHeader";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (session.usuario.role === "admin" && !session.impersonando) {
    redirect("/admin");
  }

  if (!session.loja) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">Olá, {session.usuario.nome}</h1>
            <LogoutButton />
          </div>
          <p className="mt-2 text-sm text-zinc-600">
            Conta autenticada ({session.usuario.role}), porém sem loja vinculada.
          </p>
        </div>
      </div>
    );
  }

  const loja = session.loja;

  if (loja.status === "bloqueada" && !session.impersonando) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-red-700">{loja.nome}</h1>
            <LogoutButton />
          </div>
          <p className="mt-2 text-sm text-zinc-700">
            Sua loja está bloqueada no momento. Entre em contato com o suporte
            da plataforma para regularizar o acesso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-zinc-50 pb-16">
      {session.impersonando && (
        <ImpersonationBanner lojaNome={session.impersonando.lojaNome} />
      )}
      <PainelHeader
        lojaNome={loja.nome}
        lojaSlug={loja.slug}
        impersonando={Boolean(session.impersonando)}
      />

      <main className="mx-auto w-full min-w-0 max-w-5xl space-y-5 px-4 pt-6">
        {loja.status === "pendente" && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm">
              <p className="font-bold">
                Cadastro recebido — loja aguardando aprovação
              </p>
              <p className="mt-0.5 text-xs text-amber-800 sm:text-sm">
                Você já pode cadastrar produtos, personalizar a aparência e
                configurar entrega. Assim que aprovada, sua loja em /{loja.slug}{" "}
                receberá pedidos Pix.
              </p>
            </div>
          </div>
        )}

        {children}
      </main>
    </div>
  );
}

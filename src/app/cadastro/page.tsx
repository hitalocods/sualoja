import { Store } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CadastroForm } from "@/components/CadastroForm";
import { getSession } from "@/lib/auth/session";
import { getPlatformConfig } from "@/lib/platform-config";

export const dynamic = "force-dynamic";

export default async function CadastroPage() {
  const session = await getSession();
  if (session?.usuario.role === "admin") {
    redirect("/admin");
  }
  if (session?.loja) {
    redirect("/painel");
  }

  const config = await getPlatformConfig();
  const labelDiasTrial =
    config.dias_trial === 1 ? "1 dia" : `${config.dias_trial} dias`;

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-white">
              <Store className="h-4 w-4" />
            </span>
            <span>MinhaLoja</span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
          >
            Já tenho conta
          </Link>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Cadastre sua loja
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Sua loja inicia como pendente para validação rápida e{" "}
            {labelDiasTrial} de teste grátis.
          </p>

          <div className="mt-6">
            <CadastroForm />
          </div>
        </div>
      </div>
    </div>
  );
}

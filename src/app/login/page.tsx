import { Store } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.usuario.role === "admin") {
    redirect("/admin");
  }
  if (session?.loja) {
    redirect("/painel");
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-zinc-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-600 text-white">
              <Store className="h-4 w-4" />
            </span>
            <span>MinhaLoja</span>
          </Link>
          <Link
            href="/cadastro"
            className="text-sm font-semibold text-red-600 hover:text-red-700"
          >
            Criar loja
          </Link>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Acessar painel
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Gerencie seus produtos, entregas e pedidos Pix.
          </p>

          <div className="mt-6">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}

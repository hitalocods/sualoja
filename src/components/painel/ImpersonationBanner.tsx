"use client";

import { ArrowLeft, Eye, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { sairImpersonacaoAction } from "@/app/admin/actions";

export function ImpersonationBanner({ lojaNome }: { lojaNome: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSair() {
    startTransition(async () => {
      const res = await sairImpersonacaoAction();
      if (res.ok) {
        router.push(res.data?.redirectTo ?? "/admin");
        router.refresh();
      }
    });
  }

  return (
    <div className="sticky top-0 z-50 border-b border-amber-400/40 bg-amber-500 text-zinc-950">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs font-semibold sm:text-sm">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 shrink-0" />
          <span>
            Você está vendo como <strong>{lojaNome}</strong> · Modo suporte
          </span>
        </div>
        <button
          type="button"
          onClick={handleSair}
          disabled={isPending}
          className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-zinc-950 px-3.5 py-1 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowLeft className="h-3.5 w-3.5" />
          )}
          Voltar ao admin
        </button>
      </div>
    </div>
  );
}

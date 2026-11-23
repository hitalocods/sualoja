"use client";

import { Loader2, Power } from "lucide-react";
import { useState, useTransition } from "react";
import { alternarLojaAbertaAction } from "@/app/painel/actions";

export function LojaAbertaToggle({
  abertaInicial,
  compact = false,
}: {
  abertaInicial: boolean;
  compact?: boolean;
}) {
  const [aberta, setAberta] = useState(abertaInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const proximo = !aberta;
    setErro(null);
    startTransition(async () => {
      const res = await alternarLojaAbertaAction(proximo);
      if (res.ok && res.data) {
        setAberta(res.data.aberta);
      } else if (!res.ok) {
        setErro(res.error);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className={`inline-flex items-center gap-2 rounded-2xl font-bold transition disabled:opacity-60 ${
          compact ? "px-3.5 py-2 text-xs" : "px-4 py-2.5 text-sm"
        } ${
          aberta
            ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
            : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"
        }`}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Power className="h-4 w-4" />
        )}
        <span>{aberta ? "Loja aberta" : "Loja fechada"}</span>
      </button>
      {erro && <p className="mt-1 text-xs font-medium text-red-600">{erro}</p>}
    </div>
  );
}

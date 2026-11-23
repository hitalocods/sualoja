"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AdminLojasError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="admin-surface mx-auto max-w-lg rounded-[20px] p-6 text-center"
      style={{ color: "var(--admin-text)" }}
    >
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{
          backgroundColor: "var(--admin-negative-soft)",
          color: "var(--admin-negative)",
        }}
      >
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="mt-3 text-lg font-extrabold">
        Não foi possível carregar parte desta tela
      </h2>
      <p
        className="mt-1 text-xs sm:text-sm"
        style={{ color: "var(--admin-text-muted)" }}
      >
        Ocorreu uma falha temporária ao processar a solicitação. Você pode
        recarregar a listagem de lojas com segurança.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex min-h-[42px] items-center gap-2 rounded-full px-5 text-xs font-bold text-white"
        style={{ backgroundColor: "var(--admin-accent-strong)" }}
      >
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </button>
    </div>
  );
}

"use client";

import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Search,
  Shield,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  alternarAtivoUsuarioAdminAction,
  redefinirSenhaUsuarioAdminAction,
} from "@/app/admin/actions";

export interface UsuarioAdminRow {
  id: string;
  nome: string;
  email: string;
  role: "admin" | "lojista";
  ativo: boolean;
  criadoEmFormatada: string;
  lojasVinculadas: { nome: string; slug: string; status: string }[];
}

type ModalUsuarioState =
  | { kind: "reset"; usuario: UsuarioAdminRow }
  | { kind: "toggle"; usuario: UsuarioAdminRow; novoAtivo: boolean }
  | { kind: "senhaGerada"; email: string; senhaTemporaria: string }
  | null;

interface OpenUserMenuState {
  usuarioId: string;
  top: number;
  right: number;
}

export function AdminUsuariosManager({
  usuarios,
  currentAdminId,
}: {
  usuarios: UsuarioAdminRow[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtroRole, setFiltroRole] = useState("todos");
  const [openMenu, setOpenMenu] = useState<OpenUserMenuState | null>(null);
  const [modal, setModal] = useState<ModalUsuarioState>(null);
  const [copiado, setCopiado] = useState(false);
  const [feedback, setFeedback] = useState<{
    tipo: "erro" | "sucesso";
    mensagem: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [openMenu]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (filtroRole !== "todos" && u.role !== filtroRole) {
        return false;
      }
      if (!q) return true;
      return (
        u.nome.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.lojasVinculadas.some(
          (l) =>
            l.nome.toLowerCase().includes(q) ||
            l.slug.toLowerCase().includes(q),
        )
      );
    });
  }, [usuarios, busca, filtroRole]);

  function openUserMenu(
    e: React.MouseEvent<HTMLButtonElement>,
    usuarioId: string,
  ) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < 140 ? Math.max(12, rect.top - 120) : rect.bottom + 6;
    const right = Math.max(12, window.innerWidth - rect.right);
    setOpenMenu((prev) =>
      prev?.usuarioId === usuarioId ? null : { usuarioId, top, right },
    );
  }

  function handleConfirmModal() {
    if (!modal || modal.kind === "senhaGerada") return;
    setFeedback(null);

    startTransition(async () => {
      if (modal.kind === "reset") {
        const res = await redefinirSenhaUsuarioAdminAction({
          usuarioId: modal.usuario.id,
        });
        if (!res.ok || !res.data) {
          setFeedback({
            tipo: "erro",
            mensagem: !res.ok ? res.error : "Erro ao gerar senha temporária.",
          });
          setModal(null);
          return;
        }
        setCopiado(false);
        setModal({
          kind: "senhaGerada",
          email: res.data.email,
          senhaTemporaria: res.data.senhaTemporaria,
        });
        router.refresh();
        return;
      }

      if (modal.kind === "toggle") {
        const res = await alternarAtivoUsuarioAdminAction({
          usuarioId: modal.usuario.id,
          ativo: modal.novoAtivo,
        });
        if (!res.ok) {
          setFeedback({ tipo: "erro", mensagem: res.error });
          setModal(null);
          return;
        }
        setFeedback({
          tipo: "sucesso",
          mensagem: modal.novoAtivo
            ? `Usuário "${modal.usuario.email}" reativado.`
            : `Usuário "${modal.usuario.email}" desativado.`,
        });
        setModal(null);
        router.refresh();
      }
    });
  }

  async function copiarSenha(senha: string) {
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  const menuUsuario = openMenu
    ? usuarios.find((u) => u.id === openMenu.usuarioId) ?? null
    : null;

  const roleChips = [
    { key: "todos", label: "Todos" },
    { key: "lojista", label: "Lojistas" },
    { key: "admin", label: "Administradores" },
  ];

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold"
          style={{
            backgroundColor:
              feedback.tipo === "erro"
                ? "var(--admin-negative-soft)"
                : "var(--admin-positive-soft)",
            borderColor:
              feedback.tipo === "erro"
                ? "var(--admin-negative)"
                : "var(--admin-positive)",
            color:
              feedback.tipo === "erro"
                ? "var(--admin-negative)"
                : "var(--admin-positive)",
          }}
        >
          <span>{feedback.mensagem}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="rounded-full p-1 hover:opacity-80"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="admin-surface space-y-3 rounded-[20px] p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
            style={{ color: "var(--admin-text-subtle)" }}
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar usuário por nome, e-mail ou loja vinculada..."
            className="min-h-[44px] w-full rounded-2xl border pr-4 pl-10 text-sm outline-none"
            style={{
              backgroundColor: "var(--admin-surface-2)",
              borderColor: "var(--admin-border)",
              color: "var(--admin-text)",
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {roleChips.map((chip) => {
            const active = filtroRole === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFiltroRole(chip.key)}
                className="min-h-[34px] rounded-full border px-3.5 text-xs font-semibold transition"
                style={{
                  backgroundColor: active
                    ? "var(--admin-accent-soft)"
                    : "var(--admin-surface-2)",
                  borderColor: active
                    ? "var(--admin-accent)"
                    : "var(--admin-border)",
                  color: active ? "var(--admin-text)" : "var(--admin-text-muted)",
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div
          className="admin-surface rounded-[20px] border-dashed px-6 py-12 text-center text-sm"
          style={{ color: "var(--admin-text-muted)" }}
        >
          Nenhum usuário encontrado com os filtros selecionados.
        </div>
      ) : (
        <>
          {/* Tabela Compacta Desktop */}
          <div className="admin-surface hidden rounded-[20px] md:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead>
            <tr
              className="border-b text-[11px] font-bold uppercase tracking-wider"
              style={{
                borderColor: "var(--admin-border)",
                color: "var(--admin-text-subtle)",
              }}
            >
              <th className="w-[33%] px-4 py-3.5">Usuário</th>
              <th className="w-[14%] px-3 py-3.5">Perfil</th>
              <th className="w-[26%] px-3 py-3.5">Loja vinculada</th>
              <th className="w-[11%] px-3 py-3.5">Status</th>
              <th className="w-[10%] px-3 py-3.5">Cadastro</th>
              <th className="w-[6%] px-3 py-3.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody
            className="divide-y"
            style={{ borderColor: "var(--admin-border)" }}
          >
            {filtrados.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3.5">
                  <p className="truncate font-bold">{u.nome}</p>
                  <p
                    className="truncate text-xs"
                    style={{ color: "var(--admin-text-muted)" }}
                  >
                    {u.email}
                  </p>
                </td>
                <td className="px-3 py-3.5">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={
                      u.role === "admin"
                        ? {
                            backgroundColor: "var(--admin-accent-soft)",
                            color: "var(--admin-accent)",
                          }
                        : {
                            backgroundColor: "var(--admin-surface-2)",
                            color: "var(--admin-text-muted)",
                          }
                    }
                  >
                    {u.role === "admin" && <Shield className="h-3 w-3" />}
                    {u.role}
                  </span>
                </td>
                <td className="px-3 py-3.5">
                  {u.lojasVinculadas.length === 0 ? (
                    <span
                      className="text-xs"
                      style={{ color: "var(--admin-text-subtle)" }}
                    >
                      —
                    </span>
                  ) : (
                    <div className="space-y-0.5">
                      {u.lojasVinculadas.map((l) => (
                        <p key={l.slug} className="truncate text-xs">
                          <span className="font-semibold">{l.nome}</span>{" "}
                          <span
                            className="font-mono text-[11px]"
                            style={{ color: "var(--admin-text-subtle)" }}
                          >
                            /{l.slug}
                          </span>
                        </p>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-3 py-3.5">
                  <span
                    className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{
                      backgroundColor: u.ativo
                        ? "var(--admin-positive-soft)"
                        : "var(--admin-negative-soft)",
                      color: u.ativo
                        ? "var(--admin-positive)"
                        : "var(--admin-negative)",
                    }}
                  >
                    {u.ativo ? "Ativo" : "Desativado"}
                  </span>
                </td>
                <td
                  className="px-3 py-3.5 text-xs tabular-nums"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  {u.criadoEmFormatada}
                </td>
                <td className="px-3 py-3.5 text-right">
                  <button
                    type="button"
                    aria-label={`Ações para ${u.nome}`}
                    onClick={(e) => openUserMenu(e, u.id)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition hover:opacity-85"
                    style={{
                      backgroundColor: "var(--admin-surface-2)",
                      borderColor: "var(--admin-border)",
                      color: "var(--admin-text-muted)",
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards Mobile */}
      <div className="space-y-3 md:hidden">
        {filtrados.map((u) => (
          <div key={u.id} className="admin-surface rounded-[20px] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">{u.nome}</p>
                <p
                  className="truncate text-xs"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  {u.email}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Ações para ${u.nome}`}
                onClick={(e) => openUserMenu(e, u.id)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: "var(--admin-surface-2)",
                  borderColor: "var(--admin-border)",
                  color: "var(--admin-text-muted)",
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                style={
                  u.role === "admin"
                    ? {
                        backgroundColor: "var(--admin-accent-soft)",
                        color: "var(--admin-accent)",
                      }
                    : {
                        backgroundColor: "var(--admin-surface-2)",
                        color: "var(--admin-text-muted)",
                      }
                }
              >
                {u.role}
              </span>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                style={{
                  backgroundColor: u.ativo
                    ? "var(--admin-positive-soft)"
                    : "var(--admin-negative-soft)",
                  color: u.ativo
                    ? "var(--admin-positive)"
                    : "var(--admin-negative)",
                }}
              >
                {u.ativo ? "Ativo" : "Desativado"}
              </span>
              <span
                className="ml-auto text-xs"
                style={{ color: "var(--admin-text-subtle)" }}
              >
                {u.criadoEmFormatada}
              </span>
            </div>

            {u.lojasVinculadas.length > 0 && (
              <p
                className="mt-2 truncate text-xs"
                style={{ color: "var(--admin-text-muted)" }}
              >
                Loja:{" "}
                <strong style={{ color: "var(--admin-text)" }}>
                  {u.lojasVinculadas
                    .map((l) => `${l.nome} (/${l.slug})`)
                    .join(", ")}
                </strong>
              </p>
            )}
          </div>
        ))}
      </div>
        </>
      )}

      {/* Menu "..." Flutuante */}
      {openMenu && menuUsuario && (
        <div
          className="fixed z-40 w-52 rounded-2xl border p-1.5 shadow-2xl"
          style={{
            top: openMenu.top,
            right: openMenu.right,
            backgroundColor: "var(--admin-surface)",
            borderColor: "var(--admin-border-strong)",
            color: "var(--admin-text)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              setOpenMenu(null);
              setModal({ kind: "reset", usuario: menuUsuario });
            }}
            className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-semibold transition hover:opacity-85"
          >
            <KeyRound
              className="h-4 w-4"
              style={{ color: "var(--admin-info)" }}
            />
            Redefinir senha
          </button>

          <button
            type="button"
            disabled={menuUsuario.id === currentAdminId}
            onClick={() => {
              setOpenMenu(null);
              setModal({
                kind: "toggle",
                usuario: menuUsuario,
                novoAtivo: !menuUsuario.ativo,
              });
            }}
            className="flex min-h-[40px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-semibold transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              color: menuUsuario.ativo
                ? "var(--admin-negative)"
                : "var(--admin-positive)",
            }}
          >
            {menuUsuario.ativo ? (
              <>
                <UserX className="h-4 w-4" />
                Desativar usuário
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4" />
                Reativar usuário
              </>
            )}
          </button>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
            style={{
              backgroundColor: "var(--admin-surface)",
              borderColor: "var(--admin-border-strong)",
              color: "var(--admin-text)",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-extrabold">
                {modal.kind === "reset" && "Gerar senha temporária?"}
                {modal.kind === "toggle" &&
                  (modal.novoAtivo
                    ? "Reativar usuário?"
                    : "Desativar usuário?")}
                {modal.kind === "senhaGerada" && "Senha temporária gerada"}
              </h3>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl p-1.5"
                style={{
                  backgroundColor: "var(--admin-surface-2)",
                  color: "var(--admin-text-muted)",
                }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modal.kind === "reset" && (
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--admin-text-muted)" }}
              >
                A senha atual de{" "}
                <strong style={{ color: "var(--admin-text)" }}>
                  {modal.usuario.email}
                </strong>{" "}
                será substituída imediatamente por uma nova senha temporária.
              </p>
            )}

            {modal.kind === "toggle" && (
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--admin-text-muted)" }}
              >
                {modal.novoAtivo
                  ? `O usuário ${modal.usuario.email} poderá fazer login novamente.`
                  : `O usuário ${modal.usuario.email} perderá o acesso imediato à conta e não poderá entrar até ser reativado.`}
              </p>
            )}

            {modal.kind === "senhaGerada" && (
              <div className="mt-3 space-y-3">
                <p
                  className="text-sm"
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  Envie esta senha temporária para{" "}
                  <strong style={{ color: "var(--admin-text)" }}>
                    {modal.email}
                  </strong>
                  . Ela não será exibida novamente após fechar esta janela.
                </p>
                <div
                  className="flex items-center justify-between gap-2 rounded-2xl border px-4 py-3"
                  style={{
                    backgroundColor: "var(--admin-surface-2)",
                    borderColor: "var(--admin-border-strong)",
                  }}
                >
                  <code className="font-mono text-base font-bold">
                    {modal.senhaTemporaria}
                  </code>
                  <button
                    type="button"
                    onClick={() => copiarSenha(modal.senhaTemporaria)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-bold text-white"
                    style={{ backgroundColor: "var(--admin-accent-strong)" }}
                  >
                    {copiado ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copiada
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              {modal.kind === "senhaGerada" ? (
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="min-h-[42px] rounded-full px-5 text-sm font-bold text-white"
                  style={{ backgroundColor: "var(--admin-accent-strong)" }}
                >
                  Concluir
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setModal(null)}
                    className="min-h-[42px] rounded-full border px-4 text-sm font-semibold"
                    style={{
                      backgroundColor: "var(--admin-surface-2)",
                      borderColor: "var(--admin-border)",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleConfirmModal}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-full px-5 text-sm font-bold text-white disabled:opacity-60"
                    style={{
                      backgroundColor:
                        modal.kind === "toggle" && !modal.novoAtivo
                          ? "var(--admin-negative)"
                          : "var(--admin-accent-strong)",
                    }}
                  >
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirmar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

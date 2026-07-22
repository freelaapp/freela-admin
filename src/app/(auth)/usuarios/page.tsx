"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Pencil, Loader2, UserX, Clock, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useAdminUsers } from "@/modules/admin/application/use-admin-users";
import { useAdminDeletionStats } from "@/modules/admin/application/use-admin-deletion-stats";
import type { UserItem } from "@/modules/admin/infrastructure/admin-api";
import { formatReferralOrigin, changeUserEmail } from "@/modules/admin/infrastructure/admin-api";
import { formatInstantDate } from "@/lib/date.utils";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";

function mapUserStatus(status: string) {
  switch (status) {
    case "ACTIVE": return "active" as const;
    case "PENDING_DELETION": return "pending-deletion" as const;
    case "DELETION_SUSPENDED": return "deletion-suspended" as const;
    case "DELETED": return "deleted" as const;
    default: return "active" as const;
  }
}

function formatStatusLabel(status: string) {
  switch (status) {
    case "ACTIVE": return "Ativo";
    case "PENDING_DELETION": return "Exclusão pendente";
    case "DELETION_SUSPENDED": return "Exclusão suspensa";
    case "DELETED": return "Excluído";
    default: return status;
  }
}

function mapUserToRow(u: UserItem) {
  // Ban/desativação vive em isActive (status continua ACTIVE) — sem esta
  // checagem a conta banida aparecia com badge verde "Ativo".
  const blocked = u.status === "ACTIVE" && u.isActive === false;
  return {
    id: u.id,
    email: u.email,
    status: blocked ? ("blocked" as const) : mapUserStatus(u.status),
    statusLabel: blocked ? "Bloqueado" : formatStatusLabel(u.status),
    emailConfirmado: u.emailConfirmed,
    feedback: u.deletionFeedback,
    deletionRequestedAt: u.deletionRequestedAt,
    deletionScheduledAt: u.deletionScheduledAt,
    deletedAt: u.deletedAt,
    origem: formatReferralOrigin(u),
    raw: u,
  };
}

type Row = ReturnType<typeof mapUserToRow>;

const tabs = ["Todos", "Excluídos", "Exclusão Pendente"] as const;
type Tab = typeof tabs[number];

const PAGE_SIZE = 50;

export default function UsuariosPage() {
  // Área controlada por permissão (USERS); sem ela, volta para o dashboard.
  const { isChecking: isAreaChecking, allowed: isAreaAllowed } = useAreaGuard("USERS");
  const [tab, setTab] = useState<Tab>("Todos");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const statusParam =
    tab === "Excluídos" ? "DELETED" : tab === "Exclusão Pendente" ? "PENDING" : undefined;

  // Debounce da busca por e-mail (server-side) — e volta pra página 1 a cada mudança.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data, isLoading, isError, isFetching } = useAdminUsers({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    status: statusParam,
  });
  const { data: deletionStats } = useAdminDeletionStats();
  const [modalEditar, setModalEditar] = useState<Row | null>(null);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const selectTab = (t: Tab) => {
    setTab(t);
    setPage(1);
  };

  const changeEmail = useMutation({
    mutationFn: (vars: { userId: string; email: string }) =>
      changeUserEmail(vars.userId, vars.email),
    onSuccess: (data) => {
      toast.success(`E-mail alterado para ${data.email}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setModalEditar((prev) =>
        prev ? { ...prev, email: data.email, emailConfirmado: true } : prev,
      );
      setEmailDraft(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg ?? "Não foi possível alterar o e-mail.");
    },
  });

  const closeModal = () => {
    setModalEditar(null);
    setEmailDraft(null);
  };

  const rows: Row[] = data?.data.map(mapUserToRow) ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-red-500">Erro ao carregar usuários.</p>
      </div>
    );
  }

  const columns = [
    { header: "Email", accessor: "email" as const },
    {
      header: "Origem",
      accessor: (row: Row) => (
        <span className="text-xs text-[#737373]">{row.origem}</span>
      ),
      className: "hidden lg:table-cell",
    },
    {
      header: "Email Confirmado",
      accessor: (row: Row) => (
        <span className={`text-xs font-medium ${row.emailConfirmado ? "text-green-500" : "text-red-500"}`}>
          {row.emailConfirmado ? "Sim" : "Não"}
        </span>
      ),
      className: "hidden md:table-cell",
    },
    {
      header: "Status",
      accessor: (row: Row) => <StatusBadge status={row.status} />,
    },
    {
      header: "Motivo Exclusão",
      accessor: (row: Row) =>
        row.feedback ? (
          <span className="text-xs text-[#737373] max-w-[200px] truncate block">{row.feedback}</span>
        ) : (
          <span className="text-xs text-[#e5e5e5]">—</span>
        ),
      className: "hidden lg:table-cell",
    },
    {
      header: "Ações",
      accessor: (row: Row) => (
        <button
          onClick={() => setModalEditar(row)}
          className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors"
          title="Ver detalhes"
        >
          <Pencil className="w-4 h-4" />
        </button>
      ),
    },
  ];

  if (isAreaChecking || !isAreaAllowed) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gerencie os usuários da plataforma"
      />

      {deletionStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-[#e5e5e5] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <UserX className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-[11px] text-[#737373]">Total excluídos</p>
                <p className="text-xl font-bold text-[#1d1d1b]">{deletionStats.totalDeleted}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#e5e5e5] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-[11px] text-[#737373]">Exclusão pendente</p>
                <p className="text-xl font-bold text-[#1d1d1b]">{deletionStats.pendingDeletion}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#e5e5e5] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-[11px] text-[#737373]">Suspensos</p>
                <p className="text-xl font-bold text-[#1d1d1b]">{deletionStats.suspendedDeletion}</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-[#e5e5e5] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-[11px] text-[#737373]">Excluídos este mês</p>
                <p className="text-xl font-bold text-[#1d1d1b]">{deletionStats.deletedThisMonth}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {deletionStats && deletionStats.feedbackBreakdown.length > 0 && (
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-5 mb-6">
          <h3 className="text-sm font-bold text-[#1d1d1b] mb-3">Motivos de exclusão</h3>
          <div className="space-y-2">
            {deletionStats.feedbackBreakdown.map((item, i) => {
              const maxCount = Math.max(...deletionStats.feedbackBreakdown.map((b) => b.count), 1);
              const pct = Math.round((item.count / maxCount) * 100);
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#1d1d1b] font-medium">{item.reason}</span>
                      <span className="text-xs text-[#737373]">{item.count}</span>
                    </div>
                    <div className="w-full h-2 bg-[#f7f7f7] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#eca826] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => selectTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-[#eca826] text-white"
                : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]"
            }`}
          >
            {t}
            {t === "Excluídos" && deletionStats && deletionStats.totalDeleted > 0 && (
              <span className="ml-1.5 text-xs">({deletionStats.totalDeleted})</span>
            )}
            {t === "Exclusão Pendente" && deletionStats && deletionStats.pendingDeletion + deletionStats.suspendedDeletion > 0 && (
              <span className="ml-1.5 text-xs">({deletionStats.pendingDeletion + deletionStats.suspendedDeletion})</span>
            )}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Buscar por email..."
        controlledSearch={{ value: searchInput, onChange: setSearchInput }}
        isFetching={isFetching}
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-[#737373]">
              {total.toLocaleString("pt-BR")} usuário(s)
              {search ? " no filtro" : ""} · página {page} de {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isFetching}
                className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7] h-8 disabled:opacity-40"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isFetching}
                className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7] h-8 disabled:opacity-40"
              >
                Próxima
              </Button>
            </div>
          </div>
        }
      />

      <Dialog open={!!modalEditar} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent>
          <DialogClose onClick={closeModal} />
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
            <DialogDescription>Informações completas do usuário selecionado.</DialogDescription>
          </DialogHeader>
          {modalEditar && (
            <div className="space-y-3 text-sm">
              <div className="bg-[#f7f7f7] rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[#737373]">E-mail de login</p>
                  {emailDraft === null && (
                    <button
                      onClick={() => setEmailDraft(modalEditar.email)}
                      className="text-xs font-medium text-[#eca826] hover:underline cursor-pointer"
                    >
                      Alterar
                    </button>
                  )}
                </div>
                {emailDraft === null ? (
                  <p className="font-semibold text-[#1d1d1b] break-all">{modalEditar.email}</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <input
                      type="email"
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      placeholder="novo@email.com"
                      autoFocus
                      className="w-full h-9 px-3 rounded-lg bg-white border border-[#e5e5e5] text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          changeEmail.mutate({ userId: modalEditar.raw.id, email: emailDraft.trim() })
                        }
                        disabled={
                          changeEmail.isPending ||
                          !emailDraft.trim() ||
                          emailDraft.trim().toLowerCase() === modalEditar.email.toLowerCase()
                        }
                        className="bg-[#eca826] text-white hover:bg-[#d4951e] h-8 text-xs"
                      >
                        {changeEmail.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Salvar e-mail"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEmailDraft(null)}
                        className="border-[#e5e5e5] text-[#737373] h-8 text-xs hover:bg-[#eee]"
                      >
                        Cancelar
                      </Button>
                    </div>
                    <p className="text-[11px] text-[#737373]">
                      O titular passa a entrar com o novo e-mail e a senha atual.
                    </p>
                  </div>
                )}
              </div>
              <div className="bg-[#f7f7f7] rounded-lg p-3">
                <p className="text-[#737373]">Email Confirmado</p>
                <p className={`font-semibold ${modalEditar.emailConfirmado ? "text-green-600" : "text-red-500"}`}>
                  {modalEditar.emailConfirmado ? "Sim" : "Não"}
                </p>
              </div>
              <div className="bg-[#f7f7f7] rounded-lg p-3">
                <p className="text-[#737373]">Status</p>
                <div className="mt-1"><StatusBadge status={modalEditar.status} /></div>
              </div>
              <div className="bg-[#f7f7f7] rounded-lg p-3">
                <p className="text-[#737373]">Origem do cadastro</p>
                <p className="font-semibold text-[#1d1d1b]">{modalEditar.origem}</p>
              </div>

              {(modalEditar.raw.status !== "ACTIVE") && (
                <div className="space-y-3">
                  {modalEditar.feedback && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-xs text-red-700 mb-1">Motivo da exclusão</p>
                      <p className="font-semibold text-red-900">{modalEditar.feedback}</p>
                    </div>
                  )}
                  {modalEditar.deletionRequestedAt && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#f7f7f7] rounded-lg p-3">
                        <p className="text-[#737373]">Solicitado em</p>
                        <p className="font-semibold text-[#1d1d1b]">
                          {formatInstantDate(modalEditar.deletionRequestedAt)}
                        </p>
                      </div>
                      <div className="bg-[#f7f7f7] rounded-lg p-3">
                        <p className="text-[#737373]">Agendado para</p>
                        <p className="font-semibold text-[#1d1d1b]">
                          {modalEditar.deletionScheduledAt
                            ? formatInstantDate(modalEditar.deletionScheduledAt)
                            : "—"}
                        </p>
                      </div>
                    </div>
                  )}
                  {modalEditar.deletedAt && (
                    <div className="bg-[#f7f7f7] rounded-lg p-3">
                      <p className="text-[#737373]">Excluído em</p>
                      <p className="font-semibold text-[#1d1d1b]">
                        {formatInstantDate(modalEditar.deletedAt)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeModal} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

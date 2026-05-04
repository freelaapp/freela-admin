"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Plus, Pencil, Loader2, UserX, Clock, AlertTriangle, Trash2 } from "lucide-react";
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
  return {
    id: u.id,
    email: u.email,
    status: mapUserStatus(u.status),
    statusLabel: formatStatusLabel(u.status),
    emailConfirmado: u.emailConfirmed,
    feedback: u.deletionFeedback,
    deletionRequestedAt: u.deletionRequestedAt,
    deletionScheduledAt: u.deletionScheduledAt,
    deletedAt: u.deletedAt,
    raw: u,
  };
}

type Row = ReturnType<typeof mapUserToRow>;

const tabs = ["Todos", "Excluídos", "Exclusão Pendente"] as const;
type Tab = typeof tabs[number];

export default function UsuariosPage() {
  const { data: users, isLoading, isError } = useAdminUsers();
  const { data: deletionStats } = useAdminDeletionStats();
  const [modalEditar, setModalEditar] = useState<Row | null>(null);
  const [tab, setTab] = useState<Tab>("Todos");

  const rows: Row[] = users?.map(mapUserToRow) ?? [];

  const filteredRows = tab === "Todos"
    ? rows
    : tab === "Excluídos"
      ? rows.filter((r) => r.raw.status === "DELETED")
      : rows.filter((r) => r.raw.status === "PENDING_DELETION" || r.raw.status === "DELETION_SUSPENDED");

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

  return (
    <div>
      <PageHeader
        title="Usuários"
        description="Gerencie os usuários da plataforma"
        action={
          <Button className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
            <Plus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        }
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
            onClick={() => setTab(t)}
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
            {t === "Exclusão Pendente" && deletionStats && deletionStats.pendingDeletion > 0 && (
              <span className="ml-1.5 text-xs">({deletionStats.pendingDeletion})</span>
            )}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={filteredRows} searchPlaceholder="Buscar por email..." searchKey="email" />

      <Dialog open={!!modalEditar} onOpenChange={(open) => !open && setModalEditar(null)}>
        <DialogContent>
          <DialogClose onClick={() => setModalEditar(null)} />
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
            <DialogDescription>Informações completas do usuário selecionado.</DialogDescription>
          </DialogHeader>
          {modalEditar && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Email</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalEditar.email}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Email Confirmado</p>
                  <p className={`font-semibold ${modalEditar.emailConfirmado ? "text-green-600" : "text-red-500"}`}>
                    {modalEditar.emailConfirmado ? "Sim" : "Não"}
                  </p>
                </div>
              </div>
              <div className="bg-[#f7f7f7] rounded-lg p-3">
                <p className="text-[#737373]">Status</p>
                <div className="mt-1"><StatusBadge status={modalEditar.status} /></div>
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
                          {new Date(modalEditar.deletionRequestedAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="bg-[#f7f7f7] rounded-lg p-3">
                        <p className="text-[#737373]">Agendado para</p>
                        <p className="font-semibold text-[#1d1d1b]">
                          {modalEditar.deletionScheduledAt
                            ? new Date(modalEditar.deletionScheduledAt).toLocaleDateString("pt-BR")
                            : "—"}
                        </p>
                      </div>
                    </div>
                  )}
                  {modalEditar.deletedAt && (
                    <div className="bg-[#f7f7f7] rounded-lg p-3">
                      <p className="text-[#737373]">Excluído em</p>
                      <p className="font-semibold text-[#1d1d1b]">
                        {new Date(modalEditar.deletedAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEditar(null)} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

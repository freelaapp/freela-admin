"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, UserPlus, Copy, Power, Eye, Pencil, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  useAdminConsultants,
  useRestoreAdminConsultant,
  useUpdateAdminConsultant,
} from "@/modules/admin/application/use-admin-consultants";
import { useAuth } from "@/modules/auth/application/use-auth";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { formatInstantDate } from "@/lib/date.utils";
import { formatCents } from "@/lib/money";
import { useCommissionsSummary } from "@/modules/admin/application/use-admin-consultant-commissions";
import type { ConsultantItem } from "@/modules/admin/infrastructure/consultants-api";
import { buildReferralLink } from "@/modules/admin/infrastructure/referral-link";
import { ConsultantFormDialog } from "./_components/consultant-form-dialog";
import { DeleteConsultantDialog } from "./_components/delete-consultant-dialog";
import { isConsultantDeleted } from "./_lib/consultant-delete";

export default function ConsultoresPage() {
  const router = useRouter();
  const { isHydrated, isSuperAdmin } = useAuth();
  const [showDeleted, setShowDeleted] = useState(false);
  const {
    data: consultants,
    isLoading,
    isError,
  } = useAdminConsultants({
    includeDeleted: showDeleted,
  });
  const updateMutation = useUpdateAdminConsultant();
  const restoreMutation = useRestoreAdminConsultant();
  const commissionsSummary = useCommissionsSummary();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  // `null` no modal aberto = cadastro novo; com consultor = edição.
  const [editing, setEditing] = useState<ConsultantItem | null>(null);
  const [deleting, setDeleting] = useState<ConsultantItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (isHydrated && !isSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [isHydrated, isSuperAdmin, router]);

  if (!isHydrated || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(consultant: ConsultantItem) {
    setEditing(consultant);
    setModalOpen(true);
  }

  async function copyLink(code: string) {
    const link = buildReferralLink(code, {
      webAppUrl: process.env.NEXT_PUBLIC_WEB_APP_URL,
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
    });
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link de indicação copiado!");
    } catch {
      toast.error(`Não foi possível copiar. Link: ${link}`);
    }
  }

  async function toggleActive(consultant: ConsultantItem) {
    setTogglingId(consultant.id);
    try {
      await updateMutation.mutateAsync({
        id: consultant.id,
        payload: { isActive: !consultant.isActive },
      });
      toast.success(consultant.isActive ? "Consultor desativado." : "Consultor ativado.");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Erro ao atualizar consultor"));
    } finally {
      setTogglingId(null);
    }
  }

  async function restore(consultant: ConsultantItem) {
    setRestoringId(consultant.id);
    try {
      await restoreMutation.mutateAsync(consultant.id);
      toast.success(
        `${consultant.name} restaurado — ainda inativo. Use o botão de status para reativar.`,
      );
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível restaurar o consultor."));
    } finally {
      setRestoringId(null);
    }
  }

  const columns = [
    {
      header: "Nome",
      accessor: (row: ConsultantItem) => (
        <Link
          href={`/consultores/${row.id}`}
          className="font-medium text-[#1d1d1b] hover:text-[#eca826] transition-colors"
        >
          {row.name}
        </Link>
      ),
      sortAccessor: (row: ConsultantItem) => row.name,
      sortable: true,
    },
    {
      header: "Código",
      accessor: (row: ConsultantItem) => (
        <span className="font-mono text-xs font-semibold text-[#1d1d1b]">{row.code}</span>
      ),
    },
    {
      header: "Cidade",
      accessor: (row: ConsultantItem) =>
        row.city ? `${row.city}${row.uf ? `/${row.uf}` : ""}` : "—",
      className: "hidden md:table-cell",
    },
    {
      header: "Cadastros indicados",
      accessor: (row: ConsultantItem) => (
        <span className="font-semibold text-[#1d1d1b]">{row.referralsCount}</span>
      ),
      sortAccessor: (row: ConsultantItem) => row.referralsCount,
      sortable: true,
      className: "hidden lg:table-cell",
    },
    {
      header: "Comissão",
      accessor: (row: ConsultantItem) => (
        <span className="text-xs text-[#1d1d1b]">{row.commissionRuleSummary ?? "—"}</span>
      ),
      className: "hidden lg:table-cell",
    },
    {
      header: "A pagar",
      accessor: (row: ConsultantItem) =>
        row.openBalanceInCents != null ? (
          <span className={row.openBalanceInCents > 0 ? "font-semibold text-[#1d1d1b]" : "text-[#737373]"}>
            {formatCents(row.openBalanceInCents)}
          </span>
        ) : (
          "—"
        ),
      sortAccessor: (row: ConsultantItem) => row.openBalanceInCents ?? 0,
      sortable: true,
    },
    {
      header: "Status",
      accessor: (row: ConsultantItem) =>
        isConsultantDeleted(row) ? (
          <span
            className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
            title={row.deletedAt ? `Excluído em ${formatInstantDate(row.deletedAt)}` : undefined}
          >
            Excluído
          </span>
        ) : (
          <span
            className={
              row.isActive
                ? "inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
                : "inline-flex items-center rounded-full bg-[#f1f1f1] px-2 py-0.5 text-xs font-medium text-[#737373]"
            }
          >
            {row.isActive ? "Ativo" : "Inativo"}
          </span>
        ),
    },
    {
      header: "Cadastrado em",
      accessor: (row: ConsultantItem) => formatInstantDate(row.createdAt),
      className: "hidden md:table-cell",
    },
    {
      header: "Ações",
      accessor: (row: ConsultantItem) =>
        isConsultantDeleted(row) ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/consultores/${row.id}`)}
              title="Ver perfil"
              className="text-[#737373] hover:text-[#1d1d1b]"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => restore(row)}
              disabled={restoringId === row.id}
              title="Restaurar (volta inativo)"
              className="text-[#737373] hover:text-[#1d1d1b]"
            >
              {restoringId === row.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Restaurar
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/consultores/${row.id}`)}
              title="Ver perfil"
              className="text-[#737373] hover:text-[#1d1d1b]"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyLink(row.code)}
              title="Copiar link de indicação"
              className="text-[#737373] hover:text-[#1d1d1b]"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEdit(row)}
              title="Editar"
              className="text-[#737373] hover:text-[#1d1d1b]"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleActive(row)}
              disabled={togglingId === row.id}
              title={row.isActive ? "Desativar" : "Ativar"}
              className={
                row.isActive
                  ? "text-red-500 hover:text-red-600"
                  : "text-green-600 hover:text-green-700"
              }
            >
              {togglingId === row.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Power className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleting(row)}
              title={
                row.referralsCount > 0
                  ? "Excluir (exclusão lógica — mantém as indicações)"
                  : "Excluir"
              }
              aria-label="Excluir"
              className="text-red-500 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Consultores"
        description="Parceiros que indicam novos cadastros por um link dedicado (?ref=código)"
        action={
          <Button
            onClick={openCreate}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Consultor
          </Button>
        }
      />

      {commissionsSummary.data && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
            <p className="text-xs text-[#737373]">Comissão a pagar (todos)</p>
            <p className="mt-1 text-2xl font-bold text-[#1d1d1b]">
              {formatCents(commissionsSummary.data.openInCents)}
            </p>
          </div>
          <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
            <p className="text-xs text-[#737373]">Pago no mês</p>
            <p className="mt-1 text-2xl font-bold text-[#1d1d1b]">
              {formatCents(commissionsSummary.data.paidThisMonthInCents)}
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-[40vh]">
          <p className="text-red-500">Erro ao carregar consultores.</p>
        </div>
      ) : consultants && consultants.length === 0 && !showDeleted ? (
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center mb-3">
            <UserPlus className="w-6 h-6 text-[#eca826]" />
          </div>
          <p className="text-sm font-semibold text-[#1d1d1b] mb-1">
            Nenhum consultor cadastrado ainda
          </p>
          <p className="text-xs text-[#737373] mb-4">
            Cadastre o primeiro consultor para gerar um link de indicação.
          </p>
          <Button
            onClick={openCreate}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Consultor
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={consultants ?? []}
          searchPlaceholder="Buscar por nome..."
          searchKey="name"
          defaultSort={{ index: 3, direction: "desc" }}
          filters={
            <label className="flex items-center gap-2 text-sm text-[#525252] cursor-pointer select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="h-4 w-4 rounded border-[#d4d4d4] accent-[#eca826]"
              />
              Mostrar excluídos
            </label>
          }
        />
      )}

      <ConsultantFormDialog open={modalOpen} onOpenChange={setModalOpen} consultant={editing} />

      <DeleteConsultantDialog
        consultant={deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      />
    </div>
  );
}

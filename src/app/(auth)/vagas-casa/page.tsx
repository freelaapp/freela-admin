"use client";

import { useState } from "react";
import { Loader2, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { RefundTypeSelector } from "@/components/shared/refund-type-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useAdminCasaVacancies } from "@/modules/admin/application/use-admin-casa-vacancies";
import { useAdminCancelCasaVacancy } from "@/modules/admin/application/use-admin-cancel-casa-vacancy";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useAdminConsultants } from "@/modules/admin/application/use-admin-consultants";
import { useAuth } from "@/modules/auth/application/use-auth";
import type { CasaVacancyItem } from "@/modules/admin/infrastructure/casa-vacancies-api";
import type { RefundType } from "@/modules/admin/infrastructure/admin-api";
import { formatVacancyDate, formatVacancyTime } from "@/lib/date.utils";

function mapVacancyStatus(status: string) {
  switch (status.toUpperCase()) {
    case "OPEN":
      return "open" as const;
    case "CLOSED":
      return "filled" as const;
    case "CANCELLED":
    case "CANCELLED_BY_CONTRACTOR":
      return "cancelled" as const;
    default:
      return "open" as const;
  }
}

function mapToRow(v: CasaVacancyItem) {
  return {
    id: v.id,
    empresa: v.contractorCompanyName || v.contractorName || "Sem nome",
    cargo: v.serviceType,
    lugar: v.address || "N/A",
    valor: `R$ ${(v.payment / 100).toFixed(2).replace(".", ",")}`,
    data: formatVacancyDate(v.date),
    horario: `${formatVacancyTime(v.startTime)} - ${formatVacancyTime(v.endTime)}`,
    status: mapVacancyStatus(v.status),
    consultor: v.referringConsultant?.name ?? null,
    raw: v,
  };
}

type Row = ReturnType<typeof mapToRow>;

const statusFilters = [
  { key: "all", label: "Todas" },
  { key: "open", label: "Abertas" },
  { key: "filled", label: "Fechadas" },
  { key: "cancelled", label: "Canceladas" },
] as const;

type StatusKey = (typeof statusFilters)[number]["key"];

export default function VagasCasaPage() {
  const { isSuperAdmin } = useAuth();
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");
  const { data: vacancies, isLoading, isError } = useAdminCasaVacancies(
    selectedConsultantId || undefined,
  );
  const { data: consultants } = useAdminConsultants();
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");

  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRefundType, setCancelRefundType] = useState<RefundType>("FULL");
  const cancelMutation = useAdminCancelCasaVacancy();

  const openCancelModal = (row: Row) => {
    setCancelTarget(row);
    setCancelReason("");
    setCancelRefundType("FULL");
  };

  const closeCancelModal = () => {
    if (cancelMutation.isPending) return;
    setCancelTarget(null);
    setCancelReason("");
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 5) {
      toast.error("Informe um motivo com pelo menos 5 caracteres.");
      return;
    }
    try {
      const result = await cancelMutation.mutateAsync({
        vacancyId: cancelTarget.raw.id,
        reason: cancelReason.trim(),
        refundType: cancelRefundType,
      });
      if (result.refundAmount > 0) {
        const valor = (result.refundAmount / 100).toFixed(2).replace(".", ",");
        const tipo = result.refundType === "FULL" ? "integral" : "parcial (50%)";
        toast.success(`Vaga cancelada. Estorno ${tipo} de R$ ${valor} processado.`);
      } else {
        toast.success("Vaga cancelada com sucesso.");
      }
      setCancelTarget(null);
      setCancelReason("");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Falha ao cancelar a vaga."));
    }
  };

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
        <p className="text-red-500">Erro ao carregar vagas.</p>
      </div>
    );
  }

  const allRows: Row[] = vacancies?.map(mapToRow) ?? [];
  const rows =
    statusFilter === "all" ? allRows : allRows.filter((r) => r.status === statusFilter);

  const columns = [
    { header: "Empresa", accessor: "empresa" as const, sortable: true, sortAccessor: (r: Row) => r.empresa },
    { header: "Serviço", accessor: "cargo" as const, sortable: true, sortAccessor: (r: Row) => r.cargo },
    { header: "Lugar", accessor: "lugar" as const, className: "hidden md:table-cell" },
    ...(isSuperAdmin
      ? [
          {
            header: "Consultor",
            accessor: (row: Row) =>
              row.consultor ? (
                <span className="text-[#1d1d1b]">{row.consultor}</span>
              ) : (
                <span className="text-[#a3a3a3]">—</span>
              ),
            className: "hidden md:table-cell",
            sortable: true,
            sortAccessor: (r: Row) => r.consultor ?? "",
          },
        ]
      : []),
    { header: "Valor", accessor: "valor" as const, className: "hidden lg:table-cell", sortable: true, sortAccessor: (r: Row) => r.raw.payment },
    { header: "Data", accessor: "data" as const, sortable: true, sortAccessor: (r: Row) => new Date(r.raw.date) },
    { header: "Horário", accessor: "horario" as const, className: "hidden lg:table-cell" },
    { header: "Status", accessor: (row: Row) => <StatusBadge status={row.status} /> },
    {
      header: "Ações",
      accessor: (row: Row) =>
        row.status !== "cancelled" ? (
          <button
            onClick={() => openCancelModal(row)}
            className="p-1.5 rounded-md text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
            title="Cancelar vaga"
          >
            <XCircle className="w-4 h-4" />
          </button>
        ) : (
          <span className="text-[#a3a3a3] text-xs">—</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Vagas — Freela em Casa"
        description="Vagas de serviços domésticos publicadas pelos contratantes"
      />
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Buscar por empresa..."
        searchKey="empresa"
        defaultSort={{ index: isSuperAdmin ? 5 : 4, direction: "desc" }}
        filters={
          <div className="flex flex-col gap-3">
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <label htmlFor="consultor-filter" className="text-xs font-medium text-[#737373]">
                  Consultor:
                </label>
                <select
                  id="consultor-filter"
                  value={selectedConsultantId}
                  onChange={(e) => setSelectedConsultantId(e.target.value)}
                  className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-medium text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
                >
                  <option value="">Todos os consultores</option>
                  {consultants?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              {statusFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === f.key
                      ? "bg-[#eca826] text-white"
                      : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]"
                  }`}
                >
                  {f.label} (
                  {f.key === "all"
                    ? allRows.length
                    : allRows.filter((r) => r.status === f.key).length}
                  )
                </button>
              ))}
            </div>
          </div>
        }
        footer={
          <span className="inline-flex items-center gap-1.5 text-xs text-[#737373]">
            <Users className="w-3.5 h-3.5" />
            {rows.length} vaga(s)
          </span>
        }
      />

      {/* Modal Cancelar Vaga (admin — Casa) */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) closeCancelModal();
        }}
      >
        <DialogContent>
          <DialogClose onClick={closeCancelModal} />
          <DialogHeader>
            <DialogTitle>Cancelar Vaga</DialogTitle>
            <DialogDescription>
              Esta ação cancela todas as candidaturas e, quando houver pagamento, aplica o estorno
              que você escolher abaixo. A ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {cancelTarget && (
            <div className="space-y-3">
              <div className="bg-[#f7f7f7] rounded-lg p-3 text-sm">
                <p className="text-[#737373] text-xs uppercase tracking-wide">Vaga</p>
                <p className="font-semibold text-[#1d1d1b]">{cancelTarget.empresa}</p>
                <p className="text-xs text-[#737373]">
                  {cancelTarget.cargo} • {cancelTarget.data} • {cancelTarget.horario}
                </p>
              </div>
              <RefundTypeSelector
                value={cancelRefundType}
                onChange={setCancelRefundType}
                disabled={cancelMutation.isPending}
              />
              <div>
                <label className="block text-sm font-medium text-[#1d1d1b] mb-1">
                  Motivo do cancelamento <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Ex.: Fraude detectada no contratante; vaga duplicada por erro; solicitação formal do contratante via suporte..."
                  className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  disabled={cancelMutation.isPending}
                />
                <p className="text-xs text-[#737373] mt-1">
                  Mínimo 5 caracteres. Ficará registrado em auditoria.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeCancelModal}
              disabled={cancelMutation.isPending}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Voltar
            </Button>
            <Button
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending || cancelReason.trim().length < 5}
              className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Confirmar cancelamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

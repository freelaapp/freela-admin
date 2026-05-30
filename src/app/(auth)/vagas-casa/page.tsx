"use client";

import { useState } from "react";
import { Loader2, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAdminCasaVacancies } from "@/modules/admin/application/use-admin-casa-vacancies";
import { useAdminConsultants } from "@/modules/admin/application/use-admin-consultants";
import { useAuth } from "@/modules/auth/application/use-auth";
import type { CasaVacancyItem } from "@/modules/admin/infrastructure/casa-vacancies-api";
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
    </div>
  );
}

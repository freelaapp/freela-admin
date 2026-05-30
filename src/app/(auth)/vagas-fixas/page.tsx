"use client";

import { useState } from "react";
import { Loader2, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAdminFixedJobs } from "@/modules/admin/application/use-admin-fixed-jobs";
import { useAdminConsultants } from "@/modules/admin/application/use-admin-consultants";
import { useAuth } from "@/modules/auth/application/use-auth";
import type { FixedJobItem } from "@/modules/admin/infrastructure/fixed-jobs-api";
import { formatVacancyDate } from "@/lib/date.utils";

function formatSalary(min: number | null, max: number | null): string {
  const fmt = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
  if (min != null && max != null) return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `A partir de ${fmt(min)}`;
  if (max != null) return `Até ${fmt(max)}`;
  return "—";
}

function mapStatus(status: string) {
  return status.toUpperCase() === "OPEN" ? ("open" as const) : ("finished" as const);
}

function mapToRow(v: FixedJobItem) {
  return {
    id: v.id,
    empresa: v.companyName,
    cargo: v.role,
    lugar: v.location,
    salario: formatSalary(v.salaryMinInCents, v.salaryMaxInCents),
    candidatos: v.applicationCount,
    data: formatVacancyDate(v.createdAt),
    status: mapStatus(v.status),
    statusKey: v.status.toUpperCase(),
    consultor: v.referringConsultant?.name ?? null,
    raw: v,
  };
}

type Row = ReturnType<typeof mapToRow>;

const statusFilters = [
  { key: "all", label: "Todas" },
  { key: "OPEN", label: "Abertas" },
  { key: "CLOSED", label: "Encerradas" },
] as const;

type StatusKey = (typeof statusFilters)[number]["key"];

export default function VagasFixasPage() {
  const { isSuperAdmin } = useAuth();
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");
  const { data: posts, isLoading, isError } = useAdminFixedJobs(selectedConsultantId || undefined);
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
        <p className="text-red-500">Erro ao carregar vagas fixas.</p>
      </div>
    );
  }

  const allRows: Row[] = posts?.map(mapToRow) ?? [];
  const rows =
    statusFilter === "all" ? allRows : allRows.filter((r) => r.statusKey === statusFilter);

  const columns = [
    { header: "Empresa", accessor: "empresa" as const, sortable: true, sortAccessor: (r: Row) => r.empresa },
    { header: "Cargo", accessor: "cargo" as const, sortable: true, sortAccessor: (r: Row) => r.cargo },
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
    { header: "Salário", accessor: "salario" as const, className: "hidden lg:table-cell" },
    {
      header: "Candidatos",
      accessor: (row: Row) => (
        <span className="inline-flex items-center gap-1.5">
          <Users className="w-4 h-4 text-[#737373]" />
          {row.candidatos}
        </span>
      ),
      sortable: true,
      sortAccessor: (r: Row) => r.candidatos,
    },
    { header: "Criada em", accessor: "data" as const, sortable: true, sortAccessor: (r: Row) => new Date(r.raw.createdAt) },
    { header: "Status", accessor: (row: Row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Vagas Fixas / CLT"
        description="Vagas fixas (CLT/efetivas) publicadas no mural pelos contratantes"
      />
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Buscar por empresa..."
        searchKey="empresa"
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
                    : allRows.filter((r) => r.statusKey === f.key).length}
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

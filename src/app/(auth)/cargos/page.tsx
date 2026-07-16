"use client";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Loader2 } from "lucide-react";
import { useAdminProviders } from "@/modules/admin/application/use-admin-providers";

export default function CargosPage() {
  const { data, isLoading } = useAdminProviders({ limit: 500 });
  const providers = data?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  // Agrupar por jobTitle. Colunas fabricadas removidas: "Jobs" era hardcoded 0
  // e "Demanda" classificava OFERTA de freelancers (2-3 pessoas = "Alta").
  const roleMap = new Map<string, { cargo: string; freelancers: number; jobs: number }>();

  for (const p of providers ?? []) {
    const title = p.jobTitle || "N/A";
    const existing = roleMap.get(title) ?? { cargo: title, freelancers: 0, jobs: 0 };
    existing.freelancers += 1;
    existing.jobs += p.trabalhos ?? 0;
    roleMap.set(title, existing);
  }

  const cargos = Array.from(roleMap.values())
    .sort((a, b) => b.freelancers - a.freelancers)
    .map((c, i) => ({ id: i + 1, ...c }));

  const columns = [
    { header: "Cargo", accessor: "cargo" as const },
    { header: "Freelancers", accessor: "freelancers" as const },
    { header: "Jobs concluídos", accessor: "jobs" as const },
  ];

  return (
    <div>
      <PageHeader
        title="Cargos"
        description="Cargos dos freelancers de Bares & Restaurantes (base: 500 cadastros mais recentes)"
      />
      <DataTable columns={columns} data={cargos} searchPlaceholder="Buscar cargo..." searchKey="cargo" />
    </div>
  );
}

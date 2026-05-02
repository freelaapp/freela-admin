"use client";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { useAdminProviders } from "@/modules/admin/application/use-admin-providers";
import { useAdminContractors } from "@/modules/admin/application/use-admin-contractors";
import { Loader2 } from "lucide-react";

export default function CidadesPage() {
  const { data: providers, isLoading: loadingProviders } = useAdminProviders();
  const { data: contractors, isLoading: loadingContractors } = useAdminContractors();

  const isLoading = loadingProviders || loadingContractors;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  // Agrupar por cidade
  const cityMap = new Map<string, { cidade: string; estado: string; freelancers: number; empresas: number }>();

  for (const p of providers ?? []) {
    const city = p.city || "N/A";
    const uf = p.uf || "N/A";
    const existing = cityMap.get(city) ?? { cidade: city, estado: uf, freelancers: 0, empresas: 0 };
    existing.freelancers += 1;
    cityMap.set(city, existing);
  }

  for (const c of contractors ?? []) {
    const city = c.city || "N/A";
    const uf = c.uf || "N/A";
    const existing = cityMap.get(city) ?? { cidade: city, estado: uf, freelancers: 0, empresas: 0 };
    existing.empresas += 1;
    if (existing.estado === "N/A" && uf !== "N/A") existing.estado = uf;
    cityMap.set(city, existing);
  }

  const cidades = Array.from(cityMap.values()).map((c, i) => ({
    id: i + 1,
    ...c,
    jobs: 0,
    taxa: "—",
  }));

  const columns = [
    { header: "Cidade", accessor: "cidade" as const },
    { header: "Estado", accessor: "estado" as const },
    { header: "Freelancers", accessor: "freelancers" as const },
    { header: "Empresas", accessor: "empresas" as const },
    { header: "Jobs realizados", accessor: "jobs" as const },
    {
      header: "Taxa preenchimento",
      accessor: (row: typeof cidades[0]) => (
        <span className="text-sm font-semibold text-green-500">{row.taxa}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Cidades" description="Métricas por cidade de operação" />
      <DataTable columns={columns} data={cidades} searchPlaceholder="Buscar cidade..." searchKey="cidade" />
    </div>
  );
}

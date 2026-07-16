"use client";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { useAdminProviders } from "@/modules/admin/application/use-admin-providers";
import { useAdminContractors } from "@/modules/admin/application/use-admin-contractors";
import { Loader2 } from "lucide-react";

export default function CidadesPage() {
  const { data: providersPage, isLoading: loadingProviders } = useAdminProviders({ limit: 500 });
  const providers = providersPage?.data;
  const { data: contractors, isLoading: loadingContractors } = useAdminContractors();

  const isLoading = loadingProviders || loadingContractors;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  // Agrupar por cidade|UF (cidades homônimas de UFs diferentes eram fundidas
  // numa linha só). Colunas fabricadas "Jobs realizados" (sempre 0) e "Taxa
  // preenchimento" (sempre — verde) foram removidas.
  const cityMap = new Map<string, { cidade: string; estado: string; freelancers: number; empresas: number }>();

  const bump = (city: string | null, uf: string | null, kind: "freelancers" | "empresas") => {
    const cidade = city || "N/A";
    const estado = uf || "N/A";
    const key = `${cidade}|${estado}`;
    const existing = cityMap.get(key) ?? { cidade, estado, freelancers: 0, empresas: 0 };
    existing[kind] += 1;
    cityMap.set(key, existing);
  };
  for (const p of providers ?? []) bump(p.city, p.uf, "freelancers");
  for (const c of contractors ?? []) bump(c.city, c.uf, "empresas");

  const cidades = Array.from(cityMap.values())
    .sort((a, b) => b.freelancers + b.empresas - (a.freelancers + a.empresas))
    .map((c, i) => ({ id: i + 1, ...c }));

  const columns = [
    { header: "Cidade", accessor: "cidade" as const },
    { header: "Estado", accessor: "estado" as const },
    { header: "Freelancers", accessor: "freelancers" as const },
    { header: "Empresas", accessor: "empresas" as const },
  ];

  return (
    <div>
      <PageHeader title="Cidades" description="Freelancers e empresas por cidade — módulo Bares & Restaurantes (freelancers: 500 cadastros mais recentes)" />
      <DataTable columns={columns} data={cidades} searchPlaceholder="Buscar cidade..." searchKey="cidade" />
    </div>
  );
}

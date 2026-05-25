"use client";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  // Agrupar por jobTitle
  const roleMap = new Map<string, { cargo: string; freelancers: number }>();

  for (const p of providers ?? []) {
    const title = p.jobTitle || "N/A";
    const existing = roleMap.get(title) ?? { cargo: title, freelancers: 0 };
    existing.freelancers += 1;
    roleMap.set(title, existing);
  }

  const cargos = Array.from(roleMap.values()).map((c, i) => ({
    id: i + 1,
    ...c,
    jobs: 0,
    demanda: c.freelancers > 2 ? "Alta" : c.freelancers > 1 ? "Média" : "Baixa" as const,
  }));

  const columns = [
    { header: "Cargo", accessor: "cargo" as const },
    { header: "Freelancers", accessor: "freelancers" as const },
    { header: "Jobs", accessor: "jobs" as const },
    {
      header: "Demanda",
      accessor: (row: typeof cargos[0]) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          row.demanda === "Alta" ? "bg-[#eca826]/10 text-[#eca826]" :
          row.demanda === "Média" ? "bg-green-500/10 text-green-500" :
          "bg-[#f7f7f7] text-[#737373]"
        }`}>{row.demanda}</span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Cargos"
        description="Lista de cargos disponíveis na plataforma"
        action={
          <Button className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
            <Plus className="w-4 h-4 mr-2" />
            Novo Cargo
          </Button>
        }
      />
      <DataTable columns={columns} data={cargos} searchPlaceholder="Buscar cargo..." searchKey="cargo" />
    </div>
  );
}

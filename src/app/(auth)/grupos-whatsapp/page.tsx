"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useGroupDiagnostics } from "@/modules/admin/application/use-admin-whatsapp-groups";
import { useAuth } from "@/modules/auth/application/use-auth";
import type { GroupDiagnostic } from "@/modules/admin/infrastructure/whatsapp-groups-api";

export default function GruposWhatsappPage() {
  const router = useRouter();
  const { isHydrated, isSuperAdmin } = useAuth();
  const { data: groups, isLoading, isError } = useGroupDiagnostics();

  useEffect(() => {
    if (isHydrated && !isSuperAdmin) router.replace("/dashboard");
  }, [isHydrated, isSuperAdmin, router]);

  if (!isHydrated || !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  const recognized = groups?.filter((g) => g.recognized).length ?? 0;
  const offPattern = groups?.filter((g) => !g.recognized).length ?? 0;
  const rows = (groups ?? []).map((g) => ({ ...g, id: g.jid }));

  const columns = [
    { header: "Grupo", accessor: "name" as const },
    {
      header: "Cidade",
      accessor: (g: GroupDiagnostic) => g.city ?? "—",
    },
    {
      header: "UF",
      accessor: (g: GroupDiagnostic) => g.uf ?? "—",
    },
    {
      header: "Status",
      accessor: (g: GroupDiagnostic) =>
        g.recognized ? (
          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4" /> Reconhecido
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
            <AlertTriangle className="w-4 h-4" /> Fora do padrão
          </span>
        ),
    },
    {
      header: "Participantes",
      accessor: (g: GroupDiagnostic) => g.participants ?? "—",
      className: "hidden md:table-cell",
    },
    {
      header: "JID",
      accessor: (g: GroupDiagnostic) => (
        <span className="font-mono text-xs text-[#737373]">{g.jid}</span>
      ),
      className: "hidden lg:table-cell",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Grupos WhatsApp"
        description='O roteamento é automático pelo nome do grupo no padrão "Vagas <Cidade> <UF>". A vaga de um contratante vai para o grupo da sua cidade + estado. Grupos fora do padrão não recebem vagas.'
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-[40vh]">
          <p className="text-red-500">
            Erro ao carregar grupos. Verifique a conexão da instância na Evolution API.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-3 mb-4 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 text-green-700 px-3 py-1.5">
              <CheckCircle2 className="w-4 h-4" /> {recognized} reconhecidos
            </span>
            {offPattern > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 text-amber-700 px-3 py-1.5">
                <AlertTriangle className="w-4 h-4" /> {offPattern} fora do padrão
              </span>
            )}
          </div>
          <DataTable
            columns={columns}
            data={rows}
            searchPlaceholder="Buscar por grupo, cidade ou UF..."
            searchKey="name"
          />
        </>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Loader2, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { formatInstantDate } from "@/lib/date.utils";
import { useConsultantRegistrations } from "@/modules/consultant/application/use-consultant-registrations";
import type { RegistrationItem } from "@/modules/consultant/domain/types";

const PERSONA_LABEL: Record<string, string> = {
  provider: "Freelancer",
  contractor: "Contratante",
};

export default function ConsultorDashboardPage() {
  const { data: registrations, isLoading, isError } = useConsultantRegistrations();

  const columns = [
    { header: "Nome", accessor: "name" as const },
    {
      header: "Tipo",
      accessor: (r: RegistrationItem) => (r.persona ? PERSONA_LABEL[r.persona] ?? r.persona : "—"),
    },
    {
      header: "Telefone",
      accessor: (r: RegistrationItem) => r.phone ?? "—",
      className: "hidden md:table-cell",
    },
    {
      header: "Status",
      accessor: (r: RegistrationItem) => (
        <span
          className={
            r.status === "active"
              ? "inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
              : "inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
          }
        >
          {r.status === "active" ? "Ativo" : "Convite pendente"}
        </span>
      ),
    },
    {
      header: "Cadastrado em",
      accessor: (r: RegistrationItem) => formatInstantDate(r.createdAt),
      className: "hidden md:table-cell",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Meus cadastros"
        description="Freelancers e contratantes que você cadastrou"
        action={
          <Link href="/consultor/cadastrar">
            <Button className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
              <Plus className="w-4 h-4 mr-2" />
              Novo cadastro
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-[40vh]">
          <p className="text-red-500">Erro ao carregar seus cadastros.</p>
        </div>
      ) : registrations && registrations.length === 0 ? (
        <div className="bg-white border border-[#e5e5e5] rounded-xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-[#eca826]" />
          </div>
          <p className="text-sm font-semibold text-[#1d1d1b] mb-1">Nenhum cadastro ainda</p>
          <p className="text-xs text-[#737373] mb-4">
            Cadastre seu primeiro freelancer ou contratante.
          </p>
          <Link href="/consultor/cadastrar">
            <Button className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
              <Plus className="w-4 h-4 mr-2" />
              Novo cadastro
            </Button>
          </Link>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={registrations ?? []}
          searchPlaceholder="Buscar por nome..."
          searchKey="name"
        />
      )}
    </div>
  );
}

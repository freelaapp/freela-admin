"use client";

import { useState } from "react";
import { Eye, Loader2, Download, Building2, Phone, Mail, User, CalendarDays, Package } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
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
import { useCompanyRegistrations } from "@/modules/fretes/application/use-fretes-registrations";
import {
  formatDocument,
  type CompanyRegistration,
} from "@/modules/fretes/infrastructure/fretes-api";
import { formatInstantDate } from "@/lib/date.utils";
import { formatPhoneBr } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";

function mapToRow(c: CompanyRegistration) {
  return {
    id: c.id,
    empresa: c.companyName || c.corporateReason || "Sem nome",
    cnpj: formatDocument(c.cnpj),
    segmento: c.segment || "—",
    volume: c.monthlyFreightVolume || "—",
    contato: c.contactName || "—",
    telefone: formatPhoneBr(c.contactPhone),
    email: c.contactEmail || "—",
    parceiro: c.isCompanyPartner ? "Sim" : "Não",
    cadastro: c.createdAt ? formatInstantDate(c.createdAt) : "—",
    _search:
      `${c.companyName} ${c.corporateReason} ${c.cnpj} ${c.contactName} ${c.contactEmail} ${c.segment}`.toLowerCase(),
    raw: c,
  };
}

type Row = ReturnType<typeof mapToRow>;

export default function FretesEmpresasPage() {
  const { data, isLoading, isError, error } = useCompanyRegistrations();
  const [selected, setSelected] = useState<Row | null>(null);

  const companies = data?.data ?? [];
  const rows: Row[] = companies.map(mapToRow);

  const handleExport = () => {
    if (!companies.length) {
      toast.info("Nada para exportar.");
      return;
    }
    const header = [
      "Empresa", "Razão social", "CNPJ", "Segmento", "Volume mensal de fretes",
      "Contato", "CPF do contato", "Telefone", "E-mail", "Parceira", "Data de cadastro",
    ];
    const body = companies.map((c) => [
      c.companyName, c.corporateReason, formatDocument(c.cnpj), c.segment,
      c.monthlyFreightVolume, c.contactName, formatDocument(c.cpf),
      formatPhoneBr(c.contactPhone), c.contactEmail, c.isCompanyPartner ? "Sim" : "Não",
      c.createdAt ? formatInstantDate(c.createdAt) : "",
    ]);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    downloadCsv(`fretes-empresas-${today}.csv`, header, body);
    toast.success(`${companies.length} empresa(s) exportada(s).`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  if (isError) {
    const message =
      (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
        ?.message ?? "Erro ao carregar as empresas cadastradas.";
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-2">
        <p className="text-red-500">{message}</p>
      </div>
    );
  }

  const columns = [
    { header: "Empresa", accessor: "empresa" as const },
    { header: "CNPJ", accessor: "cnpj" as const, className: "hidden lg:table-cell" },
    { header: "Segmento", accessor: "segmento" as const, className: "hidden md:table-cell" },
    { header: "Volume/mês", accessor: "volume" as const, className: "hidden md:table-cell" },
    { header: "Contato", accessor: "contato" as const },
    { header: "Telefone", accessor: "telefone" as const },
    {
      header: "Cadastro",
      accessor: "cadastro" as const,
      sortable: true,
      sortAccessor: (row: Row) => row.raw.createdAt ?? "",
      className: "hidden md:table-cell",
    },
    {
      header: "Ações",
      accessor: (row: Row) => (
        <button
          onClick={() => setSelected(row)}
          className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors"
          title="Ver detalhes"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Empresas — Fretes"
        description={`${companies.length} empresa(s) cadastrada(s) no Freela Fretes`}
        action={
          <Button
            onClick={handleExport}
            className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Buscar por empresa, CNPJ, contato, e-mail ou segmento..."
        searchKey="_search"
      />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="relative">
          <DialogClose onClick={() => setSelected(null)} />
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.empresa}</DialogTitle>
                <DialogDescription>Cadastro de empresa — Freela Fretes.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <Building2 className="w-4 h-4 text-[#737373]" />
                  {selected.raw.corporateReason} · {selected.cnpj}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                    <Package className="w-4 h-4 text-[#737373]" />
                    {selected.segmento}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                    <Package className="w-4 h-4 text-[#737373]" />
                    {selected.volume} fretes/mês
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <User className="w-4 h-4 text-[#737373]" />
                  {selected.contato} · CPF {formatDocument(selected.raw.cpf)}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                    <Phone className="w-4 h-4 text-[#737373]" />
                    {selected.telefone}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#1d1d1b] break-all">
                    <Mail className="w-4 h-4 text-[#737373] shrink-0" />
                    {selected.email}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <CalendarDays className="w-4 h-4 text-[#737373]" />
                  Cadastro: {selected.cadastro} · Parceira: {selected.parceiro}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSelected(null)}
                  className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

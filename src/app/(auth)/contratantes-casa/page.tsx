"use client";

import { useState } from "react";
import {
  Eye,
  Star,
  MapPin,
  User,
  Home,
  CalendarDays,
  Loader2,
  Download,
  FileText,
  Phone,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { useAdminCasaContractors } from "@/modules/admin/application/use-admin-casa-contractors";
import type { CasaContractorItem } from "@/modules/admin/infrastructure/casa-contractors-api";
import { formatReferralOrigin } from "@/modules/admin/infrastructure/admin-api";
import { formatInstantDate } from "@/lib/date.utils";
import { formatPhoneBr } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";

function fullAddress(c: CasaContractorItem): string {
  const line = [c.street, c.number].filter(Boolean).join(", ");
  const rest = [c.neighborhood, [c.city, c.uf].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(" — ");
  return [line, rest].filter(Boolean).join(" — ") || c.address || "—";
}

function mapToRow(c: CasaContractorItem) {
  return {
    id: c.id,
    nome: c.name || c.companyName || "Sem nome",
    empresa: c.companyName || "—",
    _search: `${c.name ?? ""} ${c.companyName ?? ""} ${c.document ?? ""} ${c.phone ?? ""} ${c.registrationEmail ?? ""}`.toLowerCase(),
    documento: c.document || "—",
    telefone: formatPhoneBr(c.phone),
    email: c.registrationEmail || "—",
    cidade: c.city || "—",
    uf: c.uf || "—",
    avaliacao: c.rating ?? 0,
    origem: formatReferralOrigin(c),
    cadastro: c.createdAt ? formatInstantDate(c.createdAt) : "—",
    status: c.isActive ? ("active" as const) : ("inactive" as const),
    raw: c,
  };
}

type Row = ReturnType<typeof mapToRow>;

export default function ContratantesCasaPage() {
  const { data: contractors, isLoading, isError } = useAdminCasaContractors();
  const [selected, setSelected] = useState<Row | null>(null);

  const rows: Row[] = contractors?.map(mapToRow) ?? [];

  const handleExport = () => {
    if (!contractors?.length) {
      toast.info("Nada para exportar.");
      return;
    }
    const header = [
      "Nome",
      "Empresa",
      "Documento",
      "Telefone",
      "E-mail de cadastro",
      "Cidade",
      "UF",
      "Endereço",
      "Origem do cadastro",
      "Avaliação",
      "Status",
      "Data de cadastro",
    ];
    const body = contractors.map((c) => [
      c.name || c.companyName || "Sem nome",
      c.companyName ?? "",
      c.document ?? "",
      formatPhoneBr(c.phone),
      c.registrationEmail ?? "",
      c.city ?? "",
      c.uf ?? "",
      fullAddress(c),
      formatReferralOrigin(c),
      c.rating != null ? c.rating.toFixed(1).replace(".", ",") : "",
      c.isActive ? "Ativo" : "Inativo",
      c.createdAt ? formatInstantDate(c.createdAt) : "",
    ]);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    downloadCsv(`contratantes-casa-${today}.csv`, header, body);
    toast.success(`${contractors.length} contratante(s) exportado(s).`);
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
        <p className="text-red-500">Erro ao carregar contratantes do Freela em Casa.</p>
      </div>
    );
  }

  const columns = [
    { header: "Nome", accessor: "nome" as const },
    { header: "Empresa", accessor: "empresa" as const, className: "hidden md:table-cell" },
    { header: "Documento", accessor: "documento" as const, className: "hidden lg:table-cell" },
    { header: "Telefone", accessor: "telefone" as const },
    { header: "Cidade", accessor: "cidade" as const },
    { header: "UF", accessor: "uf" as const, className: "hidden md:table-cell" },
    { header: "Origem do cadastro", accessor: "origem" as const, className: "hidden lg:table-cell" },
    {
      header: "Cadastro",
      accessor: "cadastro" as const,
      sortable: true,
      sortAccessor: (row: Row) => row.raw.createdAt ?? "",
      className: "hidden md:table-cell",
    },
    {
      header: "Avaliação",
      accessor: (row: Row) => (
        <span className="inline-flex items-center gap-1 text-sm">
          <Star className="w-3.5 h-3.5 text-[#eca826] fill-[#eca826]" />
          {row.avaliacao > 0 ? row.avaliacao.toFixed(1) : "—"}
        </span>
      ),
    },
    {
      header: "Status",
      accessor: (row: Row) => <StatusBadge status={row.status} />,
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
        title="Contratantes — Casa"
        description="Contratantes do módulo Freela em Casa (não aparecem na lista de Empresas de Bares & Restaurantes)"
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
        searchPlaceholder="Buscar por nome, empresa, documento, telefone ou e-mail..."
        searchKey="_search"
      />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="relative">
          <DialogClose onClick={() => setSelected(null)} />
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Detalhes do contratante</DialogTitle>
                <DialogDescription>Freela em Casa — informações do contratante.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center text-sm font-bold text-[#eca826]">
                    {selected.nome.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#1d1d1b]">{selected.nome}</p>
                    <p className="text-sm text-[#737373]">{selected.empresa}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                    <FileText className="w-4 h-4 text-[#737373]" />
                    {selected.documento}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                    <Star className="w-4 h-4 text-[#eca826]" />
                    {selected.avaliacao > 0 ? `${selected.avaliacao.toFixed(1)} / 5.0` : "—"}
                  </div>
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
                <div className="flex items-start gap-2 text-sm text-[#1d1d1b]">
                  <Home className="w-4 h-4 text-[#737373] mt-0.5 shrink-0" />
                  {fullAddress(selected.raw)}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <MapPin className="w-4 h-4 text-[#737373]" />
                  {[selected.cidade, selected.uf].filter((v) => v && v !== "—").join("/") || "—"}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <User className="w-4 h-4 text-[#737373]" />
                  Origem do cadastro: {selected.origem}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <CalendarDays className="w-4 h-4 text-[#737373]" />
                  Data de cadastro: {selected.cadastro}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  Status: <StatusBadge status={selected.status} />
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

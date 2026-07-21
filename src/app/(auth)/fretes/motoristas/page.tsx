"use client";

import { useState } from "react";
import { Eye, Loader2, Download, Truck, Phone, Mail, MapPin, IdCard, CalendarDays } from "lucide-react";
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
import { useDriverRegistrations } from "@/modules/fretes/application/use-fretes-registrations";
import {
  formatDocument,
  type DriverRegistration,
} from "@/modules/fretes/infrastructure/fretes-api";
import { formatInstantDate } from "@/lib/date.utils";
import { formatPhoneBr } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";

function mapToRow(d: DriverRegistration) {
  return {
    id: d.id,
    nome: d.fullName,
    cpf: formatDocument(d.cpf),
    telefone: formatPhoneBr(d.phone),
    email: d.email,
    veiculo: [d.vehicleType, d.bodyType].filter(Boolean).join(" · ") || "—",
    placa: d.plate || "—",
    cidade: [d.city, d.uf].filter(Boolean).join("/") || "—",
    cnh: `${d.cnhNumber} (${d.cnhCategory})`,
    cadastro: d.createdAt ? formatInstantDate(d.createdAt) : "—",
    _search: `${d.fullName} ${d.cpf} ${d.email} ${d.phone} ${d.plate} ${d.city}`.toLowerCase(),
    raw: d,
  };
}

type Row = ReturnType<typeof mapToRow>;

export default function FretesMotoristasPage() {
  const { data, isLoading, isError, error } = useDriverRegistrations();
  const [selected, setSelected] = useState<Row | null>(null);

  const drivers = data?.data ?? [];
  const rows: Row[] = drivers.map(mapToRow);

  const handleExport = () => {
    if (!drivers.length) {
      toast.info("Nada para exportar.");
      return;
    }
    const header = [
      "Nome", "CPF", "Telefone", "E-mail", "Nascimento", "CNH", "Categoria",
      "Validade CNH", "Tipo de veículo", "Carroceria", "Placa", "Capacidade (kg)",
      "Cidade", "UF", "Data de cadastro",
    ];
    const body = drivers.map((d) => [
      d.fullName, formatDocument(d.cpf), formatPhoneBr(d.phone), d.email,
      d.birthdate ? formatInstantDate(d.birthdate) : "", d.cnhNumber, d.cnhCategory,
      d.cnhExpiresAt ? formatInstantDate(d.cnhExpiresAt) : "", d.vehicleType, d.bodyType,
      d.plate, String(d.capacityKg ?? ""), d.city, d.uf,
      d.createdAt ? formatInstantDate(d.createdAt) : "",
    ]);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    downloadCsv(`fretes-motoristas-${today}.csv`, header, body);
    toast.success(`${drivers.length} motorista(s) exportado(s).`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  if (isError) {
    // A mensagem do proxy é útil (ex.: integração não configurada) — mostra em vez
    // de esconder atrás de um "erro" genérico.
    const message =
      (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
        ?.message ?? "Erro ao carregar os motoristas cadastrados.";
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-2">
        <p className="text-red-500">{message}</p>
      </div>
    );
  }

  const columns = [
    { header: "Nome", accessor: "nome" as const },
    { header: "CPF", accessor: "cpf" as const, className: "hidden lg:table-cell" },
    { header: "Telefone", accessor: "telefone" as const },
    { header: "Veículo", accessor: "veiculo" as const, className: "hidden md:table-cell" },
    { header: "Placa", accessor: "placa" as const, className: "hidden md:table-cell" },
    { header: "Cidade", accessor: "cidade" as const },
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
        title="Motoristas — Fretes"
        description={`${drivers.length} motorista(s) cadastrado(s) no Freela Fretes`}
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
        searchPlaceholder="Buscar por nome, CPF, e-mail, telefone, placa ou cidade..."
        searchKey="_search"
      />

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="relative">
          <DialogClose onClick={() => setSelected(null)} />
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.nome}</DialogTitle>
                <DialogDescription>Cadastro de motorista — Freela Fretes.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                    <IdCard className="w-4 h-4 text-[#737373]" />
                    {selected.cpf}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                    <Phone className="w-4 h-4 text-[#737373]" />
                    {selected.telefone}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b] break-all">
                  <Mail className="w-4 h-4 text-[#737373] shrink-0" />
                  {selected.email}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <Truck className="w-4 h-4 text-[#737373]" />
                  {selected.veiculo} · placa {selected.placa} ·{" "}
                  {selected.raw.capacityKg?.toLocaleString("pt-BR")} kg
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <IdCard className="w-4 h-4 text-[#737373]" />
                  CNH {selected.cnh}
                  {selected.raw.cnhExpiresAt
                    ? ` · válida até ${formatInstantDate(selected.raw.cnhExpiresAt)}`
                    : ""}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <MapPin className="w-4 h-4 text-[#737373]" />
                  {selected.cidade}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <CalendarDays className="w-4 h-4 text-[#737373]" />
                  Cadastro: {selected.cadastro}
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

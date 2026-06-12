"use client";

import { useState } from "react";
import { Plus, Eye, Pencil, Star, MapPin, Phone, User, Briefcase, TrendingUp, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useAdminContractors } from "@/modules/admin/application/use-admin-contractors";
import type { ContractorItem } from "@/modules/admin/infrastructure/admin-api";
import { formatPhoneBr } from "@/lib/utils";

type ModalType = "view" | "edit" | null;

function mapContractorToRow(c: ContractorItem) {
  return {
    id: c.id,
    nome: c.companyName || c.contactName || "Sem nome",
    responsavel: c.contactName,
    // formatPhoneBr: contactPhone pode vir em E.164 (+55...) — exibe nacional
    telefone: c.contactPhone ? formatPhoneBr(c.contactPhone) : "N/A",
    cidade: c.city || "N/A",
    segmento: c.segment || "N/A",
    jobs: c.jobs,
    ticket: c.ticketMedio ? `R$ ${(c.ticketMedio / 100).toFixed(2)}` : "N/A",
    avaliacao: c.avaliacao ?? 0,
    status: c.isActive ? ("active" as const) : ("inactive" as const),
    raw: c,
  };
}

type Row = ReturnType<typeof mapContractorToRow>;

export default function EmpresasPage() {
  const { data: contractors, isLoading, isError } = useAdminContractors();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedItem, setSelectedItem] = useState<Row | null>(null);

  const rows: Row[] = contractors?.map(mapContractorToRow) ?? [];

  const openModal = (type: ModalType, item: Row) => {
    setModalType(type);
    setSelectedItem(item);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalType(null);
    setSelectedItem(null);
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
        <p className="text-red-500">Erro ao carregar empresas.</p>
      </div>
    );
  }

  const columns = [
    { header: "Empresa", accessor: "nome" as const },
    { header: "Responsável", accessor: "responsavel" as const, className: "hidden md:table-cell" },
    { header: "Telefone", accessor: "telefone" as const, className: "hidden lg:table-cell" },
    { header: "Cidade", accessor: "cidade" as const },
    { header: "Segmento", accessor: "segmento" as const, className: "hidden md:table-cell" },
    { header: "Jobs", accessor: "jobs" as const },
    { header: "Ticket Médio", accessor: "ticket" as const, className: "hidden lg:table-cell" },
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
        <div className="flex items-center gap-1">
          <button onClick={() => openModal("view", row)} className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors" title="Ver detalhes"><Eye className="w-4 h-4" /></button>
          <button onClick={() => openModal("edit", row)} className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors" title="Editar"><Pencil className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  const renderModalContent = () => {
    if (!selectedItem) return null;

    switch (modalType) {
      case "view":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Detalhes da Empresa</DialogTitle>
              <DialogDescription>Informações completas da empresa contratante.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center text-sm font-bold text-[#eca826]">
                  {selectedItem.nome.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="text-base font-semibold text-[#1d1d1b]">{selectedItem.nome}</p>
                  <p className="text-sm text-[#737373]">{selectedItem.segmento}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <User className="w-4 h-4 text-[#737373]" />
                  {selectedItem.responsavel}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <Phone className="w-4 h-4 text-[#737373]" />
                  {selectedItem.telefone}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <MapPin className="w-4 h-4 text-[#737373]" />
                  {selectedItem.cidade}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <Briefcase className="w-4 h-4 text-[#737373]" />
                  {selectedItem.jobs > 0 ? `${selectedItem.jobs} jobs` : "—"}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <TrendingUp className="w-4 h-4 text-[#737373]" />
                  Ticket médio: {selectedItem.ticket}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <Star className="w-4 h-4 text-[#eca826]" />
                  {selectedItem.avaliacao > 0 ? `${selectedItem.avaliacao} / 5.0` : "—"}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                Status: <StatusBadge status={selectedItem.status} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModal} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">Fechar</Button>
            </DialogFooter>
          </>
        );
      case "edit":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Editar Empresa</DialogTitle>
              <DialogDescription>Altere os dados da empresa. (Apenas visual)</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome-emp">Nome da empresa</Label>
                <Input id="nome-emp" defaultValue={selectedItem.nome} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="responsavel">Responsável</Label>
                <Input id="responsavel" defaultValue={selectedItem.responsavel} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="telefone-emp">Telefone</Label>
                  <Input id="telefone-emp" defaultValue={selectedItem.telefone} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cidade-emp">Cidade</Label>
                  <Input id="cidade-emp" defaultValue={selectedItem.cidade} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="segmento">Segmento</Label>
                  <Input id="segmento" defaultValue={selectedItem.segmento} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ticket">Ticket Médio</Label>
                  <Input id="ticket" defaultValue={selectedItem.ticket} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModal} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">Cancelar</Button>
              <Button onClick={closeModal} className="bg-[#eca826] text-white hover:bg-[#d4951e]">Salvar alterações</Button>
            </DialogFooter>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <PageHeader
        title="Empresas"
        description="Empresas contratantes cadastradas na plataforma"
        action={
          <Button className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
            <Plus className="w-4 h-4 mr-2" />
            Nova Empresa
          </Button>
        }
      />
      <DataTable columns={columns} data={rows} searchPlaceholder="Buscar empresa..." searchKey="nome" />
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="relative">
          <DialogClose onClick={closeModal} />
          {renderModalContent()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

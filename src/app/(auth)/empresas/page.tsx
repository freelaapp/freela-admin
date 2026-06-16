"use client";

import { useState } from "react";
import { Plus, Eye, Pencil, Star, MapPin, Phone, User, Briefcase, TrendingUp, Loader2, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
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
import {
  useAdminContractors,
  useAdminHardDeleteContractor,
  useAdminUpdateContractor,
} from "@/modules/admin/application/use-admin-contractors";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import type { ContractorItem } from "@/modules/admin/infrastructure/admin-api";
import { formatPhoneBr } from "@/lib/utils";

type ModalType = "view" | "edit" | "delete" | null;
const DELETE_CONFIRM_WORD = "EXCLUIR";

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
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const hardDelete = useAdminHardDeleteContractor();
  const updateContractor = useAdminUpdateContractor();
  const [editForm, setEditForm] = useState({ companyName: "", segment: "" });

  const rows: Row[] = contractors?.map(mapContractorToRow) ?? [];

  const openModal = (type: ModalType, item: Row) => {
    setModalType(type);
    setSelectedItem(item);
    setModalOpen(true);
    if (type === "delete") {
      setDeleteReason("");
      setDeleteConfirm("");
    }
    if (type === "edit") {
      setEditForm({
        companyName: item.raw.companyName ?? "",
        segment: item.raw.segment ?? "",
      });
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalType(null);
    setSelectedItem(null);
  };

  const handleHardDelete = async () => {
    if (!selectedItem) return;
    const userId = selectedItem.raw.userId;
    if (!userId) {
      toast.error("Usuário deste contratante não encontrado.");
      return;
    }
    try {
      await hardDelete.mutateAsync({ userId, reason: deleteReason.trim() });
      toast.success(`${selectedItem.nome} foi excluído permanentemente.`);
      closeModal();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível excluir o contratante."));
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedItem) return;
    try {
      await updateContractor.mutateAsync({
        id: selectedItem.id,
        payload: {
          companyName: editForm.companyName.trim() || undefined,
          segment: editForm.segment.trim() || undefined,
        },
      });
      toast.success("Empresa atualizada com sucesso.");
      closeModal();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível atualizar a empresa."));
    }
  };

  const canConfirmDelete =
    deleteReason.trim().length >= 20 && deleteConfirm.trim().toUpperCase() === DELETE_CONFIRM_WORD;

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
          <button onClick={() => openModal("delete", row)} className="p-1.5 rounded-md hover:bg-red-50 hover:text-red-600 text-red-500 cursor-pointer transition-colors" title="Excluir permanentemente"><Trash2 className="w-4 h-4" /></button>
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
              <DialogDescription>Edite o nome e o segmento da empresa. (Responsável, telefone e cidade em breve.)</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome-emp">Nome da empresa</Label>
                <Input id="nome-emp" value={editForm.companyName} onChange={(e) => setEditForm((f) => ({ ...f, companyName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="responsavel">Responsável</Label>
                <Input id="responsavel" defaultValue={selectedItem.responsavel} disabled />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="telefone-emp">Telefone</Label>
                  <Input id="telefone-emp" defaultValue={selectedItem.telefone} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cidade-emp">Cidade</Label>
                  <Input id="cidade-emp" defaultValue={selectedItem.cidade} disabled />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="segmento">Segmento</Label>
                  <Input id="segmento" value={editForm.segment} onChange={(e) => setEditForm((f) => ({ ...f, segment: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ticket">Ticket Médio</Label>
                  <Input id="ticket" defaultValue={selectedItem.ticket} disabled />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModal} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">Cancelar</Button>
              <Button onClick={handleSaveEdit} disabled={updateContractor.isPending} className="bg-[#eca826] text-white hover:bg-[#d4951e]">{updateContractor.isPending ? "Salvando..." : "Salvar alterações"}</Button>
            </DialogFooter>
          </>
        );
      case "delete":
        return (
          <>
            <DialogHeader>
              <DialogTitle><span className="text-red-600">Excluir contratante permanentemente</span></DialogTitle>
              <DialogDescription>
                Esta ação é irreversível e apaga todos os dados do usuário.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div className="text-sm text-red-700">
                  <p className="font-medium">Hard delete — sem volta</p>
                  <p className="mt-1">
                    <strong>{selectedItem.nome}</strong> e tudo vinculado (perfis, vagas, jobs,
                    candidaturas, avaliações e chat) serão removidos do banco. Repasses já
                    liquidados são mantidos para rastro financeiro. A exclusão é bloqueada se houver
                    job em andamento ou pagamento/repasse pendente.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delete-reason">Motivo da exclusão (mín. 20 caracteres)</Label>
                <textarea
                  id="delete-reason"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={3}
                  placeholder="Descreva o motivo desta exclusão definitiva..."
                  className="w-full rounded-lg border border-[#e5e5e5] bg-[#f7f7f7] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 resize-none"
                />
                <p className="text-xs text-[#a3a3a3]">{deleteReason.trim().length}/20</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delete-confirm">
                  Digite <span className="font-bold text-red-600">{DELETE_CONFIRM_WORD}</span> para confirmar
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={DELETE_CONFIRM_WORD}
                  autoComplete="off"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModal} disabled={hardDelete.isPending} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">Cancelar</Button>
              <Button
                onClick={handleHardDelete}
                disabled={!canConfirmDelete || hardDelete.isPending}
                className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {hardDelete.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  "Excluir permanentemente"
                )}
              </Button>
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

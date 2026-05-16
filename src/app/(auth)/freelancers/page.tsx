"use client";

import { useState } from "react";
import { Plus, Eye, Pencil, Ban, History, Star, Briefcase, MapPin, Phone, User, Award, ShieldAlert, Loader2 } from "lucide-react";
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
import { useAdminProviders } from "@/modules/admin/application/use-admin-providers";
import type { ProviderItem, ProviderHistoryItem } from "@/modules/admin/infrastructure/admin-api";
import { getProviderHistory } from "@/modules/admin/infrastructure/admin-api";
import { formatVacancyDate } from "@/lib/date.utils";

type ModalType = "view" | "edit" | "ban" | "history" | null;

function mapProviderToRow(p: ProviderItem) {
  return {
    id: p.id,
    nome: p.name || (p.jobTitle ? `Profissional (${p.jobTitle})` : "Sem nome"),
    telefone: p.phone || "N/A",
    cidade: p.city || "N/A",
    cargo: p.jobTitle || "N/A",
    avaliacao: p.avaliacao ?? 0,
    trabalhos: p.trabalhos,
    status: p.isActive ? ("active" as const) : ("inactive" as const),
    score: p.score,
    raw: p,
  };
}

type Row = ReturnType<typeof mapProviderToRow>;

export default function FreelancersPage() {
  const { data: providers, isLoading, isError } = useAdminProviders();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedItem, setSelectedItem] = useState<Row | null>(null);
  const [historyData, setHistoryData] = useState<ProviderHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const rows: Row[] = providers?.map(mapProviderToRow) ?? [];

  const openModal = async (type: ModalType, item: Row) => {
    setModalType(type);
    setSelectedItem(item);
    setModalOpen(true);
    if (type === "history") {
      setHistoryLoading(true);
      setHistoryData([]);
      try {
        const data = await getProviderHistory(item.id);
        setHistoryData(data);
      } catch {
        setHistoryData([]);
      } finally {
        setHistoryLoading(false);
      }
    }
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
        <p className="text-red-500">Erro ao carregar freelancers.</p>
      </div>
    );
  }

  const columns = [
    {
      header: "",
      accessor: (row: Row) => (
        <div className="w-8 h-8 rounded-full bg-[#eca826]/10 flex items-center justify-center text-xs font-semibold text-[#eca826]">
          {row.nome.split(" ").map(n => n[0]).join("").slice(0, 2)}
        </div>
      ),
      className: "w-12",
    },
    { header: "Nome", accessor: "nome" as const },
    { header: "Telefone", accessor: "telefone" as const, className: "hidden md:table-cell" },
    { header: "Cidade", accessor: "cidade" as const, className: "hidden lg:table-cell" },
    { header: "Cargo", accessor: "cargo" as const },
    {
      header: "Avaliação",
      accessor: (row: Row) => (
        <span className="inline-flex items-center gap-1 text-sm">
          <Star className="w-3.5 h-3.5 text-[#eca826] fill-[#eca826]" />
          {row.avaliacao > 0 ? row.avaliacao.toFixed(1) : "—"}
        </span>
      ),
    },
    { header: "Trabalhos", accessor: "trabalhos" as const, className: "hidden lg:table-cell" },
    {
      header: "Status",
      accessor: (row: Row) => <StatusBadge status={row.status} />,
    },
    {
      header: "Score",
      accessor: (row: Row) => (
        <span className={`text-sm font-semibold ${row.score >= 80 ? "text-green-500" : row.score >= 60 ? "text-[#eca826]" : "text-red-500"}`}>
          {row.score > 0 ? row.score : "—"}
        </span>
      ),
    },
    {
      header: "Ações",
      accessor: (row: Row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openModal("view", row)} className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors" title="Ver perfil"><Eye className="w-4 h-4" /></button>
          <button onClick={() => openModal("edit", row)} className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors" title="Editar"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => openModal("ban", row)} className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors" title="Bloquear"><Ban className="w-4 h-4" /></button>
          <button onClick={() => openModal("history", row)} className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors" title="Histórico"><History className="w-4 h-4" /></button>
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
              <DialogTitle>Detalhes do Freelancer</DialogTitle>
              <DialogDescription>Informações completas do perfil selecionado.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center text-sm font-bold text-[#eca826]">
                  {selectedItem.nome.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="text-base font-semibold text-[#1d1d1b]">{selectedItem.nome}</p>
                  <p className="text-sm text-[#737373]">{selectedItem.cargo}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <Phone className="w-4 h-4 text-[#737373]" />
                  {selectedItem.telefone}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <MapPin className="w-4 h-4 text-[#737373]" />
                  {selectedItem.cidade}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <Star className="w-4 h-4 text-[#eca826]" />
                  {selectedItem.avaliacao > 0 ? `${selectedItem.avaliacao} / 5.0` : "—"}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <Briefcase className="w-4 h-4 text-[#737373]" />
                  {selectedItem.trabalhos > 0 ? `${selectedItem.trabalhos} trabalhos` : "—"}
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <Award className="w-4 h-4 text-[#737373]" />
                  Score: <span className={selectedItem.score >= 80 ? "text-green-500" : selectedItem.score >= 60 ? "text-[#eca826]" : "text-red-500"}>{selectedItem.score > 0 ? selectedItem.score : "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1d1d1b]">
                  <User className="w-4 h-4 text-[#737373]" />
                  <StatusBadge status={selectedItem.status} />
                </div>
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
              <DialogTitle>Editar Freelancer</DialogTitle>
              <DialogDescription>Altere os dados do freelancer. (Apenas visual)</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" defaultValue={selectedItem.nome} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input id="telefone" defaultValue={selectedItem.telefone} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" defaultValue={selectedItem.cidade} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cargo">Cargo</Label>
                  <Input id="cargo" defaultValue={selectedItem.cargo} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="avaliacao">Avaliação</Label>
                  <Input id="avaliacao" defaultValue={String(selectedItem.avaliacao)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModal} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">Cancelar</Button>
              <Button onClick={closeModal} className="bg-[#eca826] text-white hover:bg-[#d4951e]">Salvar alterações</Button>
            </DialogFooter>
          </>
        );
      case "ban":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Bloquear Freelancer</DialogTitle>
              <DialogDescription>Você está prestes a bloquear este freelancer.</DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
              <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <div className="text-sm text-red-700">
                <p className="font-medium">Confirmação necessária</p>
                <p className="mt-1">Tem certeza que deseja bloquear <strong>{selectedItem.nome}</strong>? Esta ação impedirá que ele receba novos jobs na plataforma.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModal} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">Cancelar</Button>
              <Button onClick={closeModal} className="bg-red-500 text-white hover:bg-red-600">Bloquear</Button>
            </DialogFooter>
          </>
        );
      case "history":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Histórico do Freelancer</DialogTitle>
              <DialogDescription>Jobs anteriores de {selectedItem.nome}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
                </div>
              ) : historyData.length === 0 ? (
                <p className="text-sm text-[#737373] text-center py-6">Nenhum job encontrado.</p>
              ) : (
                historyData.map((job) => (
                  <div key={job.vacancyId} className="p-3 rounded-lg border border-[#e5e5e5] bg-[#f7f7f7] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#1d1d1b]">{job.title}</p>
                      <span className={`text-xs font-medium ${job.status === "COMPLETED" ? "text-green-600" : "text-red-500"}`}>
                        {job.status === "COMPLETED" ? "Concluído" : "Cancelado"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[#737373]">
                      <span>{formatVacancyDate(job.date)}</span>
                      <span className="font-semibold text-[#1d1d1b]">
                        R$ {(job.payment / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {job.rating !== null && (
                      <div className="flex items-center gap-2 pt-1 border-t border-[#e5e5e5]">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3.5 h-3.5 ${i < job.rating! ? "text-[#eca826] fill-[#eca826]" : "text-[#d4d4d4]"}`} />
                          ))}
                        </div>
                        {job.authorName && <span className="text-xs text-[#737373]">por {job.authorName}</span>}
                      </div>
                    )}
                    {job.comment && (
                      <p className="text-xs text-[#525252] italic pl-4 border-l-2 border-[#eca826]/40">&ldquo;{job.comment}&rdquo;</p>
                    )}
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModal} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">Fechar</Button>
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
        title="Freelancers"
        description="Gerencie todos os freelancers cadastrados na plataforma"
        action={
          <Button className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
            <Plus className="w-4 h-4 mr-2" />
            Novo Freelancer
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Buscar freelancer por nome..."
        searchKey="nome"
      />
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="relative">
          <DialogClose onClick={closeModal} />
          {renderModalContent()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

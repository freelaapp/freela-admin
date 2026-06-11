"use client";

import { useEffect, useState } from "react";
import { Plus, Eye, Pencil, Ban, History, Star, Briefcase, MapPin, Phone, User, Award, ShieldAlert, Loader2, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
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
  useAdminProviders,
  useProvidersFilterOptions,
  useAdminHardDeleteProvider,
} from "@/modules/admin/application/use-admin-providers";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import type { ProviderItem, ProviderHistoryItem } from "@/modules/admin/infrastructure/admin-api";
import { getProviderHistory } from "@/modules/admin/infrastructure/admin-api";
import { formatVacancyDate } from "@/lib/date.utils";

type ModalType = "view" | "edit" | "ban" | "history" | "cargos" | "delete" | null;
const DELETE_CONFIRM_WORD = "EXCLUIR";
const PAGE_SIZE = 100;

function formatCargo(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function mapProviderToRow(p: ProviderItem) {
  return {
    id: p.id,
    nome: p.name || (p.jobTitle ? `Profissional (${p.jobTitle})` : "Sem nome"),
    telefone: p.phone || "N/A",
    cidade: p.city || "N/A",
    estado: p.uf || "N/A",
    cargo: p.jobTitle || "N/A",
    cargos: p.services ?? [],
    avaliacao: p.avaliacao ?? 0,
    trabalhos: p.trabalhos,
    status: p.isActive ? ("active" as const) : ("inactive" as const),
    score: p.score,
    raw: p,
  };
}

type Row = ReturnType<typeof mapProviderToRow>;

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
  placeholder: string;
}) {
  const normalized = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt,
  );
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 px-3 pr-8 rounded-lg bg-[#f7f7f7] border-none text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/30 cursor-pointer ${
        value ? "text-[#1d1d1b]" : "text-[#a3a3a3]"
      }`}
    >
      <option value="">{placeholder}</option>
      {normalized.map((opt) => (
        <option key={opt.value} value={opt.value} className="text-[#1d1d1b]">
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export default function FreelancersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 300);
  const [estadoFilter, setEstadoFilter] = useState("");
  const [cidadeFilter, setCidadeFilter] = useState("");
  const [cargoFilter, setCargoFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, estadoFilter, cidadeFilter, cargoFilter, statusFilter]);

  const { data, isLoading, isError, isFetching } = useAdminProviders({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    uf: estadoFilter || undefined,
    city: cidadeFilter || undefined,
    service: cargoFilter || undefined,
    status: (statusFilter as "active" | "inactive") || undefined,
  });
  const { data: filterOptions } = useProvidersFilterOptions();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedItem, setSelectedItem] = useState<Row | null>(null);
  const [historyData, setHistoryData] = useState<ProviderHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const hardDelete = useAdminHardDeleteProvider();

  const rows: Row[] = (data?.data ?? []).map(mapProviderToRow);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toIndex = Math.min(page * PAGE_SIZE, total);

  const estadoOptions = filterOptions?.ufs ?? [];
  const cidadeOptions = filterOptions?.cities ?? [];
  const cargoOptions = (filterOptions?.services ?? []).map((value) => ({
    value,
    label: formatCargo(value),
  }));

  const openModal = async (type: ModalType, item: Row) => {
    setModalType(type);
    setSelectedItem(item);
    setModalOpen(true);
    if (type === "delete") {
      setDeleteReason("");
      setDeleteConfirm("");
    }
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

  const handleHardDelete = async () => {
    if (!selectedItem) return;
    const userId = selectedItem.raw.userId;
    if (!userId) {
      toast.error("Usuário deste freelancer não encontrado.");
      return;
    }
    try {
      await hardDelete.mutateAsync({ userId, reason: deleteReason.trim() });
      toast.success(`${selectedItem.nome} foi excluído permanentemente.`);
      closeModal();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível excluir o freelancer."));
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
    { header: "Nome", accessor: "nome" as const, sortable: true, sortAccessor: (row: Row) => row.nome },
    { header: "Telefone", accessor: "telefone" as const, className: "hidden md:table-cell" },
    { header: "Cidade", accessor: "cidade" as const, className: "hidden lg:table-cell", sortable: true, sortAccessor: (row: Row) => row.cidade },
    { header: "Estado", accessor: "estado" as const, className: "hidden lg:table-cell", sortable: true, sortAccessor: (row: Row) => row.estado },
    {
      header: "Cargos",
      accessor: (row: Row) =>
        row.cargos.length === 0 ? (
          <span className="text-[#a3a3a3]">—</span>
        ) : (
          <button
            onClick={() => openModal("cargos", row)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eca826]/10 text-[#b87d12] text-xs font-medium hover:bg-[#eca826]/20 cursor-pointer transition-colors"
            title="Ver cargos disponíveis"
          >
            <Briefcase className="w-3.5 h-3.5" />
            {row.cargos.length} {row.cargos.length === 1 ? "cargo" : "cargos"}
          </button>
        ),
      sortable: true,
      sortAccessor: (row: Row) => row.cargos.length,
    },
    {
      header: "Avaliação",
      accessor: (row: Row) => (
        <span className="inline-flex items-center gap-1 text-sm">
          <Star className="w-3.5 h-3.5 text-[#eca826] fill-[#eca826]" />
          {row.avaliacao > 0 ? row.avaliacao.toFixed(1) : "—"}
        </span>
      ),
      sortable: true,
      sortAccessor: (row: Row) => row.avaliacao,
    },
    { header: "Trabalhos", accessor: "trabalhos" as const, className: "hidden lg:table-cell", sortable: true, sortAccessor: (row: Row) => row.trabalhos },
    {
      header: "Status",
      accessor: (row: Row) => <StatusBadge status={row.status} />,
      sortable: true,
      sortAccessor: (row: Row) => row.status,
    },
    {
      header: "Score",
      accessor: (row: Row) => (
        <span className={`text-sm font-semibold ${row.score >= 80 ? "text-green-500" : row.score >= 60 ? "text-[#eca826]" : "text-red-500"}`}>
          {row.score > 0 ? row.score : "—"}
        </span>
      ),
      sortable: true,
      sortAccessor: (row: Row) => row.score,
    },
    {
      header: "Ações",
      accessor: (row: Row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openModal("view", row)} className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors" title="Ver perfil"><Eye className="w-4 h-4" /></button>
          <button onClick={() => openModal("edit", row)} className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors" title="Editar"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => openModal("ban", row)} className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors" title="Bloquear"><Ban className="w-4 h-4" /></button>
          <button onClick={() => openModal("history", row)} className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors" title="Histórico"><History className="w-4 h-4" /></button>
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
                  {selectedItem.estado !== "N/A" && ` - ${selectedItem.estado}`}
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
      case "cargos":
        return (
          <>
            <DialogHeader>
              <DialogTitle>Cargos disponíveis</DialogTitle>
              <DialogDescription>
                Tipos de vaga para os quais {selectedItem.nome} se disponibilizou.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto py-1">
              {selectedItem.cargos.length === 0 ? (
                <p className="text-sm text-[#737373]">Nenhum cargo selecionado.</p>
              ) : (
                selectedItem.cargos.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#eca826]/10 text-[#b87d12] text-sm font-medium"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    {formatCargo(c)}
                  </span>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeModal} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">Fechar</Button>
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
      case "delete":
        return (
          <>
            <DialogHeader>
              <DialogTitle><span className="text-red-600">Excluir freelancer permanentemente</span></DialogTitle>
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
        searchPlaceholder="Buscar por nome, email ou telefone..."
        controlledSearch={{ value: search, onChange: setSearch }}
        isFetching={isFetching}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect value={estadoFilter} onChange={setEstadoFilter} options={estadoOptions} placeholder="Estado" />
            <FilterSelect value={cidadeFilter} onChange={setCidadeFilter} options={cidadeOptions} placeholder="Cidade" />
            <FilterSelect value={cargoFilter} onChange={setCargoFilter} options={cargoOptions} placeholder="Cargo" />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "active", label: "Ativo" },
                { value: "inactive", label: "Inativo" },
              ]}
              placeholder="Status"
            />
            {(estadoFilter || cidadeFilter || cargoFilter || statusFilter) && (
              <button
                onClick={() => {
                  setEstadoFilter("");
                  setCidadeFilter("");
                  setCargoFilter("");
                  setStatusFilter("");
                }}
                className="h-9 px-3 rounded-lg text-sm text-[#737373] hover:text-[#1d1d1b] hover:bg-[#f7f7f7] cursor-pointer transition-colors"
              >
                Limpar filtros
              </button>
            )}
          </div>
        }
        footer={
          <div className="flex items-center justify-between text-sm text-[#737373]">
            <span>
              {total === 0
                ? "Nenhum freelancer"
                : `Mostrando ${fromIndex}–${toIndex} de ${total.toLocaleString("pt-BR")}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || isFetching}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#e5e5e5] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f7f7f7] cursor-pointer transition-colors"
                title="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-[#1d1d1b]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || isFetching}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#e5e5e5] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#f7f7f7] cursor-pointer transition-colors"
                title="Próxima página"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
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

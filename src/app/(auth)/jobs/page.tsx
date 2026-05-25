"use client";

import { useState } from "react";
import { Plus, Eye, Pencil, UserPlus, AlertTriangle, Clock, Send, MessageCircle, Star, Check, Loader2, Phone, Mail, XCircle, Link2, Copy, KeyRound, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useAdminVacancies } from "@/modules/admin/application/use-admin-vacancies";
import { useAdminContractors } from "@/modules/admin/application/use-admin-contractors";
import { useVacancyCandidacies } from "@/modules/admin/application/use-vacancy-candidacies";
import { useAdminCancelVacancy, getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useAdminRemoveCandidacy } from "@/modules/admin/application/use-admin-remove-candidacy";
import type { VacancyItem } from "@/modules/admin/infrastructure/admin-api";
import { formatVacancyDate, formatVacancyTime } from "@/lib/date.utils";

const vagasUrgentes = [
  { id: 101, empresa: "Bar do Zé", cidade: "São Paulo", cargo: "Garçom", qtdFaltando: 2, valor: "R$ 180", data: "13/03/2026", horario: "18:00 - 02:00", tempoRestante: "1h 45min", freelancersDisponiveis: 28 },
  { id: 102, empresa: "Churrascaria Gaúcha", cidade: "Porto Alegre", cargo: "Churrasqueiro", qtdFaltando: 2, valor: "R$ 280", data: "13/03/2026", horario: "11:00 - 20:00", tempoRestante: "45min", freelancersDisponiveis: 12 },
  { id: 103, empresa: "Restaurante Sabor & Arte", cidade: "São Paulo", cargo: "Auxiliar de Cozinha", qtdFaltando: 1, valor: "R$ 160", data: "13/03/2026", horario: "17:00 - 23:00", tempoRestante: "1h 20min", freelancersDisponiveis: 35 },
];

const freelancersDisponiveis = [
  { id: 1, nome: "Ana Souza", cidade: "São Paulo", cargo: "Garçom", avaliacao: 4.9 },
  { id: 2, nome: "Carlos Lima", cidade: "São Paulo", cargo: "Garçom", avaliacao: 4.7 },
  { id: 3, nome: "Mariana Costa", cidade: "São Paulo", cargo: "Garçom", avaliacao: 4.8 },
  { id: 4, nome: "Pedro Rocha", cidade: "Rio de Janeiro", cargo: "Cozinheiro", avaliacao: 4.6 },
  { id: 5, nome: "Juliana Mendes", cidade: "Belo Horizonte", cargo: "Recepcionista", avaliacao: 5.0 },
];

const formatDate = formatVacancyDate;
const formatTime = formatVacancyTime;

function formatCents(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

const PIX_KEY_TYPE_LABELS: Record<string, string> = {
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  PHONE: "Telefone",
  EVP: "Chave aleatória",
  RANDOM: "Chave aleatória",
};

function mapVacancyStatus(status: string) {
  switch (status) {
    case "OPEN": return "open" as const;
    case "CLOSED": return "filled" as const;
    case "CANCELLED": return "cancelled" as const;
    default: return "open" as const;
  }
}

function mapVacancyToRow(v: VacancyItem) {
  const start = formatTime(v.startTime);
  const end = formatTime(v.endTime);
  return {
    id: v.id,
    empresa: v.contractorCompanyName || v.contractorName || "Sem nome",
    cidade: v.address || "N/A",
    cargo: v.serviceType,
    qtd: 1,
    preenchidas: v.status === "CLOSED" ? 1 : 0,
    valor: `R$ ${(v.payment / 100).toFixed(2).replace(".", ",")}`,
    data: formatDate(v.date),
    horario: `${start} - ${end}`,
    status: mapVacancyStatus(v.status),
    providerName: v.providerName ?? null,
    raw: v,
  };
}

type Row = ReturnType<typeof mapVacancyToRow>;

const tabs = ["Todas as Vagas", "Vagas Urgentes"] as const;
type Tab = typeof tabs[number];

export default function JobsPage() {
  const { data: vacancies, isLoading, isError } = useAdminVacancies();
  const { data: contractors } = useAdminContractors();
  const [tab, setTab] = useState<Tab>("Todas as Vagas");
  const [enviando, setEnviando] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "filled" | "cancelled">("all");

  const [modalDetalhes, setModalDetalhes] = useState<Row | null>(null);
  const [modalBuscarId, setModalBuscarId] = useState(false);
  const [buscaIdInput, setBuscaIdInput] = useState("");
  const [modalEditar, setModalEditar] = useState<Row | null>(null);
  const [modalConvocar, setModalConvocar] = useState<Row | null>(null);
  const [selecionadosConvocar, setSelecionadosConvocar] = useState<number[]>([]);

  const { data: candidacies, isLoading: loadingCandidacies } = useVacancyCandidacies(
    modalDetalhes?.raw.id ?? null,
  );

  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const cancelMutation = useAdminCancelVacancy();

  const [removeTarget, setRemoveTarget] = useState<{
    vacancyId: string;
    candidacyId: string;
    providerName: string;
  } | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const removeCandidacyMutation = useAdminRemoveCandidacy();

  const allRows: Row[] = vacancies?.map(mapVacancyToRow) ?? [];
  const rows =
    statusFilter === "all"
      ? allRows
      : allRows.filter((r) => r.status === statusFilter);
  const contractorMap = new Map(contractors?.map((c) => [c.id, c]));

  const handleEnviarWhatsApp = (vaga: typeof vagasUrgentes[0]) => {
    setEnviando(vaga.id);
    setTimeout(() => {
      setEnviando(null);
      toast.success(`WhatsApp enviado para ${vaga.freelancersDisponiveis} freelancers de ${vaga.cargo} em ${vaga.cidade}.`);
    }, 1500);
  };

  const handleEnviarTodos = () => {
    toast.info(`WhatsApp sendo enviado para todas as ${vagasUrgentes.length} vagas urgentes.`);
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    if (cancelReason.trim().length < 5) {
      toast.error("Informe um motivo com pelo menos 5 caracteres.");
      return;
    }
    try {
      const result = await cancelMutation.mutateAsync({
        vacancyId: cancelTarget.raw.id,
        reason: cancelReason.trim(),
      });
      const valor = (result.refundAmount / 100).toFixed(2).replace(".", ",");
      const tipo = result.refundType === "FULL" ? "integral" : "parcial (50%)";
      toast.success(`Vaga cancelada. Estorno ${tipo} de R$ ${valor} processado.`);
      setCancelTarget(null);
      setCancelReason("");
      setModalDetalhes(null);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Falha ao cancelar a vaga."));
    }
  };

  const handleConfirmRemoveCandidacy = async () => {
    if (!removeTarget) return;
    try {
      const result = await removeCandidacyMutation.mutateAsync({
        vacancyId: removeTarget.vacancyId,
        candidacyId: removeTarget.candidacyId,
        reason: removeReason.trim() || undefined,
      });
      toast.success(
        result.vacancyReopened
          ? `${removeTarget.providerName} desvinculado. Vaga reaberta para novos candidatos.`
          : `${removeTarget.providerName} desvinculado da vaga.`,
      );
      setRemoveTarget(null);
      setRemoveReason("");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Falha ao desvincular o freelancer."));
    }
  };

  const handleBuscarPorId = () => {
    const id = buscaIdInput.trim();
    if (!id) {
      toast.error("Informe o ID da vaga.");
      return;
    }
    const found = allRows.find((r) => r.id === id);
    if (!found) {
      toast.error("Vaga não encontrada com este ID.");
      return;
    }
    setModalDetalhes(found);
    setModalBuscarId(false);
    setBuscaIdInput("");
  };

  const handleConvocar = () => {
    if (selecionadosConvocar.length === 0) {
      toast.error("Selecione pelo menos um freelancer para convocar.");
      return;
    }
    toast.success(`${selecionadosConvocar.length} freelancer(s) convocado(s) com sucesso!`);
    setSelecionadosConvocar([]);
    setModalConvocar(null);
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
        <p className="text-red-500">Erro ao carregar vagas.</p>
      </div>
    );
  }

  const columns = [
    { header: "Empresa", accessor: "empresa" as const, sortable: true, sortAccessor: (r: Row) => r.empresa },
    { header: "Lugar", accessor: "cidade" as const, className: "hidden md:table-cell", sortable: true, sortAccessor: (r: Row) => r.cidade },
    { header: "Cargo", accessor: "cargo" as const, sortable: true, sortAccessor: (r: Row) => r.cargo },
    { header: "Qtd", accessor: "qtd" as const },
    {
      header: "Valor/FL",
      accessor: "valor" as const,
      className: "hidden lg:table-cell",
      sortable: true,
      sortAccessor: (r: Row) => r.raw.payment,
    },
    {
      header: "Data",
      accessor: "data" as const,
      sortable: true,
      sortAccessor: (r: Row) => new Date(r.raw.date),
    },
    {
      header: "Horário",
      accessor: "horario" as const,
      className: "hidden lg:table-cell",
      sortable: true,
      sortAccessor: (r: Row) => new Date(r.raw.startTime),
    },
    {
      header: "Status",
      accessor: (row: Row) => <StatusBadge status={row.status} />,
    },
    {
      header: "Ações",
      accessor: (row: Row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setModalDetalhes(row)}
            className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors"
            title="Ver"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => setModalEditar(row)}
            className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setModalConvocar(row); setSelecionadosConvocar([]); }}
            className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors"
            title="Convocar"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Vagas / Jobs"
        description="Gerencie as vagas e solicitações de freelancers"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setModalBuscarId(true)}
              className="border-[#e5e5e5] text-[#1d1d1b] hover:bg-[#f7f7f7] font-medium"
            >
              <Search className="w-4 h-4 mr-2" />
              Buscar por ID
            </Button>
            <Button className="bg-[#eca826] text-white hover:bg-[#d4951e] font-medium">
              <Plus className="w-4 h-4 mr-2" />
              Criar Job
            </Button>
          </div>
        }
      />

      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              tab === t
                ? "bg-[#eca826] text-white"
                : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]"
            }`}
          >
            {t}
            {t === "Vagas Urgentes" && vagasUrgentes.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                {vagasUrgentes.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "Todas as Vagas" && (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Buscar por empresa..."
          searchKey="empresa"
          defaultSort={{ index: 5, direction: "desc" }}
          filters={
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { key: "all", label: `Todas (${allRows.length})` },
                  { key: "open", label: `Abertas (${allRows.filter((r) => r.status === "open").length})` },
                  { key: "filled", label: `Preenchidas (${allRows.filter((r) => r.status === "filled").length})` },
                  { key: "cancelled", label: `Canceladas (${allRows.filter((r) => r.status === "cancelled").length})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === f.key
                      ? "bg-[#eca826] text-white"
                      : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          }
        />
      )}

      {tab === "Vagas Urgentes" && (
        <div className="space-y-4">
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold text-sm">
                {vagasUrgentes.length} vagas não preenchidas a menos de 2h do horário
              </span>
            </div>
            <Button
              onClick={handleEnviarTodos}
              size="sm"
              className="sm:ml-auto bg-green-500 text-white hover:bg-green-600 font-medium"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar WhatsApp para todos
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {vagasUrgentes.map((vaga) => (
              <div
                key={vaga.id}
                className="bg-white border border-[#e5e5e5] rounded-xl p-5 space-y-4 hover:border-red-500/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-[#1d1d1b]">{vaga.empresa}</h3>
                    <p className="text-sm text-[#737373]">{vaga.cidade}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-500">
                    <Clock className="w-3 h-3" />
                    {vaga.tempoRestante}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#737373]">Cargo</p>
                    <p className="font-medium text-[#1d1d1b]">{vaga.cargo}</p>
                  </div>
                  <div>
                    <p className="text-[#737373]">Vagas faltando</p>
                    <p className="font-bold text-red-500">{vaga.qtdFaltando}</p>
                  </div>
                  <div>
                    <p className="text-[#737373]">Valor</p>
                    <p className="font-medium text-[#1d1d1b]">{vaga.valor}</p>
                  </div>
                  <div>
                    <p className="text-[#737373]">Horário</p>
                    <p className="font-medium text-[#1d1d1b]">{vaga.horario}</p>
                  </div>
                </div>

                <div className="bg-[#f7f7f7] rounded-lg p-3 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-[#737373]">Freelancers disponíveis: </span>
                    <span className="font-bold text-[#1d1d1b]">{vaga.freelancersDisponiveis}</span>
                  </div>
                  <MessageCircle className="w-4 h-4 text-[#737373]" />
                </div>

                <Button
                  onClick={() => handleEnviarWhatsApp(vaga)}
                  disabled={enviando === vaga.id}
                  className="w-full bg-green-500 text-white hover:bg-green-600 font-medium"
                >
                  {enviando === vaga.id ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Enviar WhatsApp ({vaga.freelancersDisponiveis} freelancers)
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Detalhes da Vaga */}
      <Dialog open={!!modalDetalhes} onOpenChange={(open) => !open && setModalDetalhes(null)}>
        <DialogContent>
          <DialogClose onClick={() => setModalDetalhes(null)} />
          <DialogHeader>
            <DialogTitle>Detalhes da Vaga</DialogTitle>
            <DialogDescription>Informações completas da vaga selecionada.</DialogDescription>
          </DialogHeader>
          {modalDetalhes && (
            <div className="space-y-3 text-sm max-h-[60vh] overflow-y-auto pr-1 -mr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Empresa</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.empresa}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Cidade</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.cidade}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Cargo</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.cargo}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Quantidade</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.qtd}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Preenchidas</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.preenchidas}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Contratante pagou</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.valor}</p>
                  {modalDetalhes.raw?.platformFeeInCents != null && (
                    <p className="text-[10px] text-[#737373] mt-0.5">
                      Plataforma: {formatCents(modalDetalhes.raw.platformFeeInCents)}
                    </p>
                  )}
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-700 text-xs">Freelancer recebe</p>
                  <p className="font-semibold text-green-900">
                    {formatCents(modalDetalhes.raw?.freelancerAmountInCents) ?? "—"}
                  </p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Data</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.data}</p>
                </div>
                <div className="bg-[#f7f7f7] rounded-lg p-3">
                  <p className="text-[#737373]">Horário</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.horario}</p>
                </div>
              </div>
              {(() => {
                const contractor = modalDetalhes.raw?.contractorId
                  ? contractorMap.get(modalDetalhes.raw.contractorId)
                  : undefined;
                if (!contractor) return null;
                return (
                  <div className="bg-[#f7f7f7] rounded-lg p-3 space-y-2">
                    <p className="text-[#737373] text-xs font-medium uppercase tracking-wide">Contato do Contratante</p>
                    <div className="flex flex-col gap-1.5">
                      {contractor.contactPhone && (
                        <a
                          href={`tel:${contractor.contactPhone}`}
                          className="flex items-center gap-2 text-sm text-[#1d1d1b] hover:text-[#eca826] transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5 text-[#737373]" />
                          {contractor.contactPhone}
                        </a>
                      )}
                      {contractor.contactEmail && (
                        <a
                          href={`mailto:${contractor.contactEmail}`}
                          className="flex items-center gap-2 text-sm text-[#1d1d1b] hover:text-[#eca826] transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5 text-[#737373]" />
                          {contractor.contactEmail}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}
              {modalDetalhes.status === "filled" && modalDetalhes.providerName && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-bold">
                      {modalDetalhes.providerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs text-green-700">Freelancer alocado</p>
                      <p className="font-semibold text-green-900">{modalDetalhes.providerName}</p>
                    </div>
                  </div>
                  {(modalDetalhes.raw?.providerPhone || modalDetalhes.raw?.providerEmail) && (
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-green-200">
                      {modalDetalhes.raw.providerPhone && (
                        <a
                          href={`tel:${modalDetalhes.raw.providerPhone}`}
                          className="flex items-center gap-2 text-sm text-green-900 hover:text-green-700 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5 text-green-700" />
                          {modalDetalhes.raw.providerPhone}
                        </a>
                      )}
                      {modalDetalhes.raw.providerEmail && (
                        <a
                          href={`mailto:${modalDetalhes.raw.providerEmail}`}
                          className="flex items-center gap-2 text-sm text-green-900 hover:text-green-700 transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5 text-green-700" />
                          {modalDetalhes.raw.providerEmail}
                        </a>
                      )}
                    </div>
                  )}
                  <div className="pt-2 border-t border-green-200 space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-green-700 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" />
                      Chave PIX
                    </p>
                    {modalDetalhes.raw?.providerPixKeys && modalDetalhes.raw.providerPixKeys.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {modalDetalhes.raw.providerPixKeys.map((pix, i) => (
                          <div
                            key={`${pix.keyType}-${i}`}
                            className="flex items-center justify-between gap-2 bg-white border border-green-200 rounded-md px-2.5 py-1.5"
                          >
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-green-700 flex items-center gap-1.5">
                                {PIX_KEY_TYPE_LABELS[pix.keyType] ?? pix.keyType}
                                {pix.isDefault && (
                                  <span className="text-[9px] font-semibold uppercase tracking-wide bg-green-100 text-green-700 border border-green-200 rounded px-1.5 py-0.5">
                                    Padrão
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-green-900 truncate">{pix.keyValue}</p>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(pix.keyValue);
                                  toast.success("Chave PIX copiada.");
                                } catch {
                                  toast.error("Não foi possível copiar a chave PIX.");
                                }
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-900 transition-colors shrink-0"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Copiar
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-green-700/70">Nenhuma chave PIX cadastrada.</p>
                    )}
                  </div>
                </div>
              )}
              <div className="bg-[#f7f7f7] rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-[#737373]">Status</p>
                  <div className="mt-1"><StatusBadge status={modalDetalhes.status} /></div>
                </div>
              </div>

              {modalDetalhes.raw?.id && (() => {
                const shareUrl = `https://www.freelaservicosapp.com.br/freelancer/vagas/${modalDetalhes.raw.id}`;
                return (
                  <div className="bg-[#f7f7f7] rounded-lg p-3 space-y-2">
                    <p className="text-[#737373] text-xs font-medium uppercase tracking-wide flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" />
                      Link da vaga
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 truncate text-xs text-[#1d1d1b] hover:text-[#eca826] transition-colors"
                      >
                        {shareUrl}
                      </a>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(shareUrl);
                            toast.success("Link da vaga copiado.");
                          } catch {
                            toast.error("Nao foi possivel copiar o link.");
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#eca826] hover:text-[#d4951e] transition-colors shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copiar
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-[#f7f7f7] rounded-lg p-3 space-y-2">
                <p className="text-[#737373] text-xs font-medium uppercase tracking-wide">
                  Candidatos {candidacies ? `(${candidacies.length})` : ""}
                </p>
                {loadingCandidacies && (
                  <div className="flex items-center gap-2 text-xs text-[#737373]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Carregando candidatos...
                  </div>
                )}
                {!loadingCandidacies && candidacies && candidacies.length === 0 && (
                  <p className="text-xs text-[#737373]">Nenhum candidato ainda.</p>
                )}
                {!loadingCandidacies && candidacies && candidacies.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {candidacies.map((c) => {
                      const statusColor =
                        c.status === "ACCEPTED"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : c.status === "REJECTED"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : c.status === "CANCELLED"
                          ? "bg-gray-200 text-gray-600 border-gray-300"
                          : "bg-amber-100 text-amber-700 border-amber-200";
                      const statusLabel =
                        c.status === "ACCEPTED" ? "Aceito"
                          : c.status === "REJECTED" ? "Rejeitado"
                          : c.status === "CANCELLED" ? "Cancelado"
                          : "Pendente";
                      return (
                        <div key={c.id} className="bg-white border border-[#e5e5e5] rounded-md p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-[#1d1d1b]">
                              {c.providerName ?? "Sem nome"}
                            </p>
                            <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-col gap-0.5">
                            {c.providerPhone && (
                              <a href={`tel:${c.providerPhone}`} className="flex items-center gap-1.5 text-xs text-[#1d1d1b] hover:text-[#eca826] transition-colors">
                                <Phone className="w-3 h-3 text-[#737373]" />
                                {c.providerPhone}
                              </a>
                            )}
                            {c.providerEmail && (
                              <a href={`mailto:${c.providerEmail}`} className="flex items-center gap-1.5 text-xs text-[#1d1d1b] hover:text-[#eca826] transition-colors">
                                <Mail className="w-3 h-3 text-[#737373]" />
                                {c.providerEmail}
                              </a>
                            )}
                          </div>
                          {(c.status === "ACCEPTED" || c.status === "PENDING") &&
                            modalDetalhes?.raw.id && (
                              <button
                                onClick={() =>
                                  setRemoveTarget({
                                    vacancyId: modalDetalhes.raw.id,
                                    candidacyId: c.id,
                                    providerName: c.providerName ?? "Freelancer",
                                  })
                                }
                                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Desvincular da vaga
                              </button>
                            )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            {modalDetalhes && modalDetalhes.status !== "cancelled" && (
              <Button
                variant="outline"
                onClick={() => {
                  setCancelTarget(modalDetalhes);
                  setCancelReason("");
                }}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar Vaga
              </Button>
            )}
            <Button variant="outline" onClick={() => setModalDetalhes(null)} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cancelar Vaga (admin) */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open && !cancelMutation.isPending) {
            setCancelTarget(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent>
          <DialogClose
            onClick={() => {
              if (!cancelMutation.isPending) {
                setCancelTarget(null);
                setCancelReason("");
              }
            }}
          />
          <DialogHeader>
            <DialogTitle>Cancelar Vaga</DialogTitle>
            <DialogDescription>
              Esta acao cancela todas as candidaturas e dispara o estorno via Pix conforme a regra:
              100% se faltam 2h ou mais para o inicio, 50% se faltar menos. A acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {cancelTarget && (
            <div className="space-y-3">
              <div className="bg-[#f7f7f7] rounded-lg p-3 text-sm">
                <p className="text-[#737373] text-xs uppercase tracking-wide">Vaga</p>
                <p className="font-semibold text-[#1d1d1b]">{cancelTarget.empresa}</p>
                <p className="text-xs text-[#737373]">
                  {cancelTarget.cargo} • {cancelTarget.data} • {cancelTarget.horario}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1d1d1b] mb-1">
                  Motivo do cancelamento <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  placeholder="Ex.: Fraude detectada no contratante; vaga duplicada por erro; solicitacao formal do contratante via suporte..."
                  className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  disabled={cancelMutation.isPending}
                />
                <p className="text-xs text-[#737373] mt-1">Minimo 5 caracteres. Ficara registrado em auditoria.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelTarget(null);
                setCancelReason("");
              }}
              disabled={cancelMutation.isPending}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Voltar
            </Button>
            <Button
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending || cancelReason.trim().length < 5}
              className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando estorno...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Confirmar cancelamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Desvincular Freelancer (admin) */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open && !removeCandidacyMutation.isPending) {
            setRemoveTarget(null);
            setRemoveReason("");
          }
        }}
      >
        <DialogContent>
          <DialogClose
            onClick={() => {
              if (!removeCandidacyMutation.isPending) {
                setRemoveTarget(null);
                setRemoveReason("");
              }
            }}
          />
          <DialogHeader>
            <DialogTitle>Desvincular freelancer</DialogTitle>
            <DialogDescription>
              O freelancer sera removido desta vaga e notificado. Se a vaga estava preenchida,
              ela volta a ficar aberta para novos candidatos. O pagamento do contratante e o job
              agendado sao mantidos. Bloqueado se ja houve check-in, job iniciado ou repasse.
            </DialogDescription>
          </DialogHeader>
          {removeTarget && (
            <div className="space-y-3">
              <div className="bg-[#f7f7f7] rounded-lg p-3 text-sm">
                <p className="text-[#737373] text-xs uppercase tracking-wide">Freelancer</p>
                <p className="font-semibold text-[#1d1d1b]">{removeTarget.providerName}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#1d1d1b] mb-1">
                  Motivo (opcional)
                </label>
                <textarea
                  value={removeReason}
                  onChange={(e) => setRemoveReason(e.target.value)}
                  rows={3}
                  placeholder="Ex.: freelancer desistiu; troca solicitada pelo contratante..."
                  className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  disabled={removeCandidacyMutation.isPending}
                />
                <p className="text-xs text-[#737373] mt-1">Fica registrado no log.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRemoveTarget(null);
                setRemoveReason("");
              }}
              disabled={removeCandidacyMutation.isPending}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Voltar
            </Button>
            <Button
              onClick={handleConfirmRemoveCandidacy}
              disabled={removeCandidacyMutation.isPending}
              className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {removeCandidacyMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Desvinculando...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Confirmar desvinculo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Vaga */}
      <Dialog open={!!modalEditar} onOpenChange={(open) => !open && setModalEditar(null)}>
        <DialogContent>
          <DialogClose onClick={() => setModalEditar(null)} />
          <DialogHeader>
            <DialogTitle>Editar Vaga</DialogTitle>
            <DialogDescription>Edite os dados da vaga (visual apenas).</DialogDescription>
          </DialogHeader>
          {modalEditar && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Empresa</label>
                <input type="text" defaultValue={modalEditar.empresa} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Cidade</label>
                  <input type="text" defaultValue={modalEditar.cidade} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Cargo</label>
                  <input type="text" defaultValue={modalEditar.cargo} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Quantidade</label>
                  <input type="text" defaultValue={modalEditar.qtd} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Valor/FL</label>
                  <input type="text" defaultValue={modalEditar.valor} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Data</label>
                  <input type="text" defaultValue={modalEditar.data} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1d1d1b] mb-1">Horário</label>
                  <input type="text" defaultValue={modalEditar.horario} className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30" readOnly />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalEditar(null)} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">
              Cancelar
            </Button>
            <Button className="bg-[#eca826] text-white hover:bg-[#d4951e]" onClick={() => { toast.success("Vaga atualizada com sucesso!"); setModalEditar(null); }}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Buscar Vaga por ID */}
      <Dialog
        open={modalBuscarId}
        onOpenChange={(open) => {
          if (!open) {
            setModalBuscarId(false);
            setBuscaIdInput("");
          }
        }}
      >
        <DialogContent>
          <DialogClose
            onClick={() => {
              setModalBuscarId(false);
              setBuscaIdInput("");
            }}
          />
          <DialogHeader>
            <DialogTitle>Buscar vaga por ID</DialogTitle>
            <DialogDescription>
              Informe o ID da vaga para abrir os detalhes completos.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="block text-sm font-medium text-[#1d1d1b] mb-1">
              ID da vaga <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={buscaIdInput}
              onChange={(e) => setBuscaIdInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleBuscarPorId();
              }}
              autoFocus
              placeholder="Cole aqui o ID da vaga"
              className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setModalBuscarId(false);
                setBuscaIdInput("");
              }}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleBuscarPorId}
              className="bg-[#eca826] text-white hover:bg-[#d4951e]"
            >
              <Search className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Convocar Freelancers */}
      <Dialog open={!!modalConvocar} onOpenChange={(open) => !open && setModalConvocar(null)}>
        <DialogContent className="max-w-xl">
          <DialogClose onClick={() => setModalConvocar(null)} />
          <DialogHeader>
            <DialogTitle>Convocar Freelancers</DialogTitle>
            <DialogDescription>
              {modalConvocar ? `Selecione os freelancers disponíveis para ${modalConvocar.cargo} em ${modalConvocar.cidade}.` : "Selecione os freelancers para convocação."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {freelancersDisponiveis.map((fl) => {
              const selecionado = selecionadosConvocar.includes(fl.id);
              return (
                <div
                  key={fl.id}
                  onClick={() => {
                    setSelecionadosConvocar((prev) =>
                      selecionado ? prev.filter((id) => id !== fl.id) : [...prev, fl.id]
                    );
                  }}
                  className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                    selecionado ? "border-[#eca826] bg-[#eca826]/5" : "border-[#e5e5e5] hover:bg-[#f7f7f7]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${selecionado ? "bg-[#eca826] border-[#eca826]" : "border-[#e5e5e5]"}`}>
                      {selecionado && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#1d1d1b]">{fl.nome}</p>
                      <p className="text-xs text-[#737373]">{fl.cidade} • {fl.cargo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-[#eca826]">
                    <Star className="w-3.5 h-3.5 fill-[#eca826]" />
                    {fl.avaliacao}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalConvocar(null)} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">
              Cancelar
            </Button>
            <Button className="bg-[#eca826] text-white hover:bg-[#d4951e]" onClick={handleConvocar}>
              <UserPlus className="w-4 h-4 mr-2" />
              Convocar ({selecionadosConvocar.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

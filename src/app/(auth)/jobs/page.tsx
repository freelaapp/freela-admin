"use client";

import { useState } from "react";
import { Plus, Eye, Clock, Star, Check, Loader2, Phone, Mail, XCircle, Link2, Copy, KeyRound, Search, Users, RefreshCw } from "lucide-react";
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
import { useAdminConsultants } from "@/modules/admin/application/use-admin-consultants";
import { useAuth } from "@/modules/auth/application/use-auth";
import { useVacancyCandidacies } from "@/modules/admin/application/use-vacancy-candidacies";
import { useVacancyFeedbacks } from "@/modules/admin/application/use-vacancy-feedbacks";
import { useAdminCancelVacancy, useAdminRestartVacancy, getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useAdminRemoveCandidacy } from "@/modules/admin/application/use-admin-remove-candidacy";
import { RefundTypeSelector } from "@/components/shared/refund-type-selector";
import type { VacancyItem, VacancyFeedbackEntry, RefundType } from "@/modules/admin/infrastructure/admin-api";
import { formatVacancyDate, formatVacancyTime, formatInstantDate } from "@/lib/date.utils";

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

type VacancyBucket =
  | "open"
  | "awaitingHire"
  | "inProgress"
  | "completedReviewed"
  | "completedAwaitingReview"
  | "cancelled"
  | "lost";

function resolveVacancyBucket(v: VacancyItem, now: Date = new Date()): VacancyBucket {
  const status = v.status?.toUpperCase();
  const jobStatus = v.job?.status?.toUpperCase();

  if (status === "CANCELLED" || status === "CANCELLED_BY_CONTRACTOR") {
    return "cancelled";
  }

  if (jobStatus === "COMPLETED") {
    const reviewedBoth =
      Boolean(v.job?.hasContractorFeedback) && Boolean(v.job?.hasProviderFeedback);
    return reviewedBoth ? "completedReviewed" : "completedAwaitingReview";
  }

  if (jobStatus === "IN_PROGRESS") {
    return "inProgress";
  }

  // CLOSED sem job ainda (aguardando pagamento) OU job SCHEDULED (pago, ainda não começou).
  if (status === "CLOSED") {
    return "awaitingHire";
  }

  // OPEN: só conta como ativa se ainda dentro do prazo; caso contrário a vaga
  // expirou sem candidato aceito (perdida).
  const ref = v.endTime || v.startTime;
  if (ref) {
    const ms = Date.parse(ref);
    if (!Number.isNaN(ms) && ms < now.getTime()) {
      return "lost";
    }
  }

  return "open";
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
    candidatos: v.candidacyCount ?? 0,
    preenchidas: v.status === "CLOSED" ? 1 : 0,
    valor: `R$ ${(v.payment / 100).toFixed(2).replace(".", ",")}`,
    data: formatDate(v.date),
    horario: `${start} - ${end}`,
    status: mapVacancyStatus(v.status),
    bucket: resolveVacancyBucket(v),
    providerName: v.providerName ?? null,
    consultor: v.referringConsultant?.name ?? null,
    raw: v,
  };
}

type Row = ReturnType<typeof mapVacancyToRow>;

// ─── Roadmap da vaga ────────────────────────────────────────────────────────
// Caminho feliz da vaga, derivado apenas dos dados já disponíveis no VacancyItem
// (status da vaga + status do job + feedbacks + candidaturas). Sem chamadas extras.
const ROADMAP_STEPS = [
  { key: "created", label: "Vaga criada", hint: "Publicada e aberta a candidaturas" },
  { key: "candidates", label: "Candidaturas recebidas", hint: "Freelancers se candidataram à vaga" },
  { key: "hired", label: "Freelancer contratado", hint: "Contratante escolheu um freelancer" },
  { key: "paid", label: "Pagamento confirmado · agendada", hint: "Job agendado após o pagamento" },
  { key: "inProgress", label: "Serviço em andamento", hint: "Freelancer fez check-in no local" },
  { key: "completed", label: "Serviço concluído", hint: "Check-out realizado" },
  { key: "reviewed", label: "Avaliações concluídas", hint: "Contratante e freelancer se avaliaram" },
] as const;

// Índice do passo mais avançado que a vaga já alcançou no caminho feliz.
function resolveRoadmapReached(v: VacancyItem): number {
  const status = v.status?.toUpperCase();
  const jobStatus = v.job?.status?.toUpperCase();
  const jobExists = Boolean(jobStatus);
  const hasCandidates = (v.candidacyCount ?? 0) > 0;
  const isClosed = status === "CLOSED";
  const reviewedBoth = Boolean(v.job?.hasContractorFeedback && v.job?.hasProviderFeedback);

  let reached = 0; // sempre criada
  if (hasCandidates || isClosed || jobExists) reached = 1;
  if (isClosed || jobExists) reached = 2;
  if (jobExists) reached = 3; // job só é criado pós-pagamento
  if (jobStatus === "IN_PROGRESS" || jobStatus === "COMPLETED") reached = 4;
  if (jobStatus === "COMPLETED") reached = 5;
  if (reviewedBoth) reached = 6;
  return reached;
}

// Etapa do roadmap → campo de horário correspondente no timeline da vaga.
const STEP_TIMELINE_FIELD: Record<string, keyof NonNullable<VacancyItem["timeline"]>> = {
  created: "createdAt",
  candidates: "firstCandidacyAt",
  hired: "hiredAt",
  paid: "scheduledAt",
  inProgress: "startedAt",
  completed: "endedAt",
  reviewed: "reviewedAt",
};

/** Horário (ISO) da etapa, ou null. "created" cai no createdAt da vaga (vagas abertas não têm timeline). */
function stepTimestamp(vacancy: VacancyItem, key: string): string | null {
  const tl = vacancy.timeline;
  if (key === "created") return tl?.createdAt ?? vacancy.createdAt ?? null;
  const field = STEP_TIMELINE_FIELD[key];
  if (!tl || !field) return null;
  return tl[field] ?? null;
}

/** Formata um instante ISO como "dd/mm/aaaa · HH:MM" no fuso de Brasília. */
function formatStepAt(iso: string): string {
  return `${formatInstantDate(iso)} · ${formatVacancyTime(iso)}`;
}

type RoadmapNodeState = "done" | "current" | "pending" | "cancelled" | "lost";

function VacancyRoadmap({ vacancy }: { vacancy: VacancyItem }) {
  const reached = resolveRoadmapReached(vacancy);
  const bucket = resolveVacancyBucket(vacancy);
  const terminal =
    bucket === "cancelled" ? "cancelled" : bucket === "lost" ? "lost" : null;

  // Caminho terminal (cancelada/perdida) corta o caminho feliz no passo alcançado.
  const lastStep = terminal ? reached : ROADMAP_STEPS.length - 1;

  const nodes: {
    key: string;
    label: string;
    hint: string;
    state: RoadmapNodeState;
    at: string | null;
  }[] = ROADMAP_STEPS.slice(0, lastStep + 1).map((step, i) => ({
    key: step.key,
    label: step.label,
    hint: step.hint,
    state: i < reached ? "done" : i === reached && !terminal ? "current" : "done",
    at: stepTimestamp(vacancy, step.key),
  }));

  if (terminal === "cancelled") {
    nodes.push({
      key: "cancelled",
      label: "Vaga cancelada",
      hint: "Fluxo encerrado · estorno processado",
      state: "cancelled",
      at: null,
    });
  } else if (terminal === "lost") {
    nodes.push({
      key: "lost",
      label: "Expirou sem contratação",
      hint: "O prazo da vaga passou sem freelancer contratado",
      state: "lost",
      at: null,
    });
  }

  return (
    <div className="bg-[#f7f7f7] rounded-lg p-3 space-y-2">
      <p className="text-[#737373] text-xs font-medium uppercase tracking-wide">
        Roadmap da vaga
      </p>
      <ol className="mt-1">
        {nodes.map((node, i) => {
          const isLast = i === nodes.length - 1;
          return (
            <li key={node.key} className="relative flex gap-3 pb-3 last:pb-0">
              {!isLast && (
                <span
                  className={`absolute left-[11px] top-6 bottom-0 w-px ${
                    node.state === "done" ? "bg-[#eca826]" : "bg-[#e5e5e5]"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border ${
                  node.state === "done"
                    ? "bg-[#eca826] border-[#eca826]"
                    : node.state === "current"
                    ? "bg-white border-[#eca826] ring-2 ring-[#eca826]/30"
                    : node.state === "cancelled"
                    ? "bg-red-500 border-red-500"
                    : node.state === "lost"
                    ? "bg-[#a3a3a3] border-[#a3a3a3]"
                    : "bg-white border-[#e5e5e5]"
                }`}
              >
                {node.state === "done" && <Check className="h-3 w-3 text-white" />}
                {node.state === "current" && (
                  <span className="h-2 w-2 rounded-full bg-[#eca826] animate-pulse" />
                )}
                {node.state === "cancelled" && <XCircle className="h-3.5 w-3.5 text-white" />}
                {node.state === "lost" && <Clock className="h-3 w-3 text-white" />}
                {node.state === "pending" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d4d4d4]" />
                )}
              </span>
              <div className="pt-0.5">
                <p
                  className={`text-sm leading-tight ${
                    node.state === "current"
                      ? "font-semibold text-[#1d1d1b]"
                      : node.state === "cancelled"
                      ? "font-semibold text-red-600"
                      : node.state === "lost"
                      ? "font-semibold text-[#737373]"
                      : node.state === "done"
                      ? "font-medium text-[#1d1d1b]"
                      : "text-[#a3a3a3]"
                  }`}
                >
                  {node.label}
                  {node.state === "current" && (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#eca826]">
                      Estágio atual
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-[#737373]">{node.hint}</p>
                {node.at && (
                  <p className="mt-0.5 text-[11px] font-medium tabular-nums text-[#eca826]">
                    {formatStepAt(node.at)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function FeedbackPanel({
  title,
  entry,
  emptyMessage,
}: {
  title: string;
  entry: VacancyFeedbackEntry | null;
  emptyMessage: string;
}) {
  if (!entry) {
    return (
      <div className="bg-white border border-[#e5e5e5] rounded-md p-2.5 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#737373]">{title}</p>
        <p className="text-xs text-[#737373] italic">{emptyMessage}</p>
      </div>
    );
  }

  const ratingRounded = Math.round(entry.rating);
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-md p-2.5 space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#737373]">{title}</p>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`w-3.5 h-3.5 ${
                i <= ratingRounded ? "text-[#eca826] fill-[#eca826]" : "text-[#e5e5e5]"
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-semibold text-[#1d1d1b]">{entry.rating.toFixed(1)}</span>
      </div>
      {entry.comment && entry.comment.trim().length > 0 ? (
        <p className="text-xs text-[#1d1d1b] whitespace-pre-wrap break-words">{entry.comment}</p>
      ) : (
        <p className="text-xs text-[#737373] italic">Sem comentário.</p>
      )}
      <p className="text-[10px] text-[#737373]">
        {entry.authorName ?? "Autor desconhecido"} · {formatDate(entry.createdAt)}
      </p>
    </div>
  );
}

export default function JobsPage() {
  const { isSuperAdmin } = useAuth();
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");
  const { data: vacancies, isLoading, isError } = useAdminVacancies(
    selectedConsultantId || undefined,
  );
  const { data: contractors } = useAdminContractors();
  // Dropdown de consultor é exclusivo do super-admin (mesma regra da tela de consultores).
  const { data: consultants } = useAdminConsultants();
  const [statusFilter, setStatusFilter] = useState<
    | "all"
    | "open"
    | "awaitingHire"
    | "inProgress"
    | "completedReviewed"
    | "completedAwaitingReview"
    | "lost"
    | "cancelled"
  >("all");

  const [modalDetalhes, setModalDetalhes] = useState<Row | null>(null);
  const [modalBuscarId, setModalBuscarId] = useState(false);
  const [buscaIdInput, setBuscaIdInput] = useState("");

  const { data: candidacies, isLoading: loadingCandidacies } = useVacancyCandidacies(
    modalDetalhes?.raw.id ?? null,
  );

  const { data: feedbacks, isLoading: loadingFeedbacks } = useVacancyFeedbacks(
    modalDetalhes?.raw.id ?? null,
  );

  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRefundType, setCancelRefundType] = useState<RefundType>("FULL");
  const cancelMutation = useAdminCancelVacancy();
  const restartMutation = useAdminRestartVacancy();

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
      : allRows.filter((r) => r.bucket === statusFilter);
  const contractorMap = new Map(contractors?.map((c) => [c.id, c]));

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
        refundType: cancelRefundType,
      });
      // Vaga sem pagamento confirmado (ex.: nenhum freelancer aceito) cancela sem
      // estorno — não fala de pagamento. Só mostra o estorno quando houve devolução.
      if (result.refundAmount > 0) {
        const valor = (result.refundAmount / 100).toFixed(2).replace(".", ",");
        const tipo = result.refundType === "FULL" ? "integral" : "parcial (50%)";
        toast.success(`Vaga cancelada. Estorno ${tipo} de R$ ${valor} processado.`);
      } else {
        toast.success("Vaga cancelada com sucesso.");
      }
      setCancelTarget(null);
      setCancelReason("");
      setModalDetalhes(null);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Falha ao cancelar a vaga."));
    }
  };

  const handleRestartVacancy = async () => {
    if (!modalDetalhes) return;
    if (
      !window.confirm(
        "Reabrir esta vaga do ZERO?\n\nO freelancer aceito sai, a vaga volta a aceitar candidatos e o job/check-in são resetados. O valor pago FICA RETIDO (sem estorno) para o substituto. Use quando o freelancer não compareceu/desistiu.",
      )
    ) {
      return;
    }
    try {
      await restartMutation.mutateAsync({
        vacancyId: modalDetalhes.raw.id,
        reason: "Freelancer nao compareceu/desistiu (no-show) — reabrir para substituto",
      });
      toast.success("Vaga reaberta. Aceite um novo freelancer (sem nova cobrança).");
      setModalDetalhes(null);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Falha ao reabrir a vaga."));
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
    ...(isSuperAdmin
      ? [
          {
            header: "Consultor",
            accessor: (row: Row) =>
              row.consultor ? (
                <span className="text-[#1d1d1b]">{row.consultor}</span>
              ) : (
                <span className="text-[#a3a3a3]">—</span>
              ),
            className: "hidden md:table-cell",
            sortable: true,
            sortAccessor: (r: Row) => r.consultor ?? "",
          },
        ]
      : []),
    { header: "Qtd", accessor: "qtd" as const },
    {
      header: "Candidatos",
      accessor: (row: Row) => (
        <span className="inline-flex items-center gap-1.5">
          <Users className="w-4 h-4 text-[#737373]" />
          {row.candidatos}
        </span>
      ),
      sortable: true,
      sortAccessor: (r: Row) => r.candidatos,
    },
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

      <div className="mb-6" />

      <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Buscar por empresa..."
          searchKey="empresa"
          defaultSort={{ index: 5, direction: "desc" }}
          filters={
            <div className="flex flex-col gap-3">
              {isSuperAdmin && (
                <div className="flex items-center gap-2">
                  <label htmlFor="consultor-filter" className="text-xs font-medium text-[#737373]">
                    Consultor:
                  </label>
                  <select
                    id="consultor-filter"
                    value={selectedConsultantId}
                    onChange={(e) => setSelectedConsultantId(e.target.value)}
                    className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-medium text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
                  >
                    <option value="">Todos os consultores</option>
                    {consultants?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
              {(
                [
                  {
                    key: "all",
                    label: `Todas (${allRows.length})`,
                  },
                  {
                    key: "open",
                    label: `Abertas (${allRows.filter((r) => r.bucket === "open").length})`,
                  },
                  {
                    key: "awaitingHire",
                    label: `Aguardando contratação (${allRows.filter((r) => r.bucket === "awaitingHire").length})`,
                  },
                  {
                    key: "inProgress",
                    label: `Em andamento (${allRows.filter((r) => r.bucket === "inProgress").length})`,
                  },
                  {
                    key: "completedReviewed",
                    label: `Concluídas (${allRows.filter((r) => r.bucket === "completedReviewed").length})`,
                  },
                  {
                    key: "completedAwaitingReview",
                    label: `Concluídas s/ avaliação (${allRows.filter((r) => r.bucket === "completedAwaitingReview").length})`,
                  },
                  {
                    key: "lost",
                    label: `Perdidas (${allRows.filter((r) => r.bucket === "lost").length})`,
                  },
                  {
                    key: "cancelled",
                    label: `Canceladas (${allRows.filter((r) => r.bucket === "cancelled").length})`,
                  },
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
            </div>
          }
        />

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

              <VacancyRoadmap vacancy={modalDetalhes.raw} />

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
                      // Nunca rotular status desconhecido como "Pendente": WITHDRAWN e
                      // CANCELLED_BY_CONTRACTOR caíam no fallback e o admin mostrava
                      // candidato "PENDENTE" que o contratante não via (caso Simone).
                      const statusColor =
                        c.status === "ACCEPTED"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : c.status === "REJECTED"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : c.status === "PENDING"
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-gray-200 text-gray-600 border-gray-300";
                      const statusLabel =
                        c.status === "ACCEPTED" ? "Aceito"
                          : c.status === "REJECTED" ? "Rejeitado"
                          : c.status === "CANCELLED" ? "Cancelado"
                          : c.status === "CANCELLED_BY_CONTRACTOR" ? "Desvinculado"
                          : c.status === "WITHDRAWN" ? "Retirado"
                          : c.status === "PENDING" ? "Pendente"
                          : c.status;
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

              {/* Feedbacks — contratante ↔ freelancer */}
              <div className="bg-[#f7f7f7] rounded-lg p-3 space-y-3">
                <p className="text-[#737373] text-xs font-medium uppercase tracking-wide">
                  Avaliações
                </p>
                {loadingFeedbacks ? (
                  <div className="flex items-center gap-2 text-xs text-[#737373]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Carregando avaliações...
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <FeedbackPanel
                      title="Contratante → Freelancer"
                      entry={feedbacks?.contractor ?? null}
                      emptyMessage="Contratante ainda não avaliou o freelancer."
                    />
                    <FeedbackPanel
                      title="Freelancer → Contratante"
                      entry={feedbacks?.provider ?? null}
                      emptyMessage="Freelancer ainda não avaliou o contratante."
                    />
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
                  setCancelRefundType("FULL");
                }}
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar Vaga
              </Button>
            )}
            {modalDetalhes && modalDetalhes.status !== "cancelled" && (
              <Button
                variant="outline"
                onClick={handleRestartVacancy}
                disabled={restartMutation.isPending}
                className="border-[#eca826]/40 text-[#c97b0e] hover:bg-[#eca826]/10"
                title="No-show: reabre a vaga mantendo o valor pago (sem estorno)"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reiniciar (no-show)
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
              Esta ação cancela todas as candidaturas e, quando houver pagamento, aplica o estorno
              que você escolher abaixo. A ação não pode ser desfeita.
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
              <RefundTypeSelector
                value={cancelRefundType}
                onChange={setCancelRefundType}
                disabled={cancelMutation.isPending}
              />
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
    </div>
  );
}

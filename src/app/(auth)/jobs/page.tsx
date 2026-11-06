"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Eye, LayoutGrid, Clock, Check, CheckCircle2, Loader2, Phone, Mail, XCircle, Link2, Copy, KeyRound, Search, Users, Bot, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { VacancyCandidacyList } from "@/components/admin/vacancy/vacancy-candidacy-list";
import { VacancyReservesSection } from "@/components/admin/vacancy/vacancy-reserves-section";
import { VacancySelectionRoundSection } from "@/components/admin/vacancy/vacancy-selection-round-section";
import { CompatibleInviteSection } from "@/components/admin/vacancy/compatible-invite-section";
import { VacancyFeedbacksSection } from "@/components/admin/vacancy/vacancy-feedbacks-section";
import { VacancyPriceHistorySection } from "@/components/admin/vacancy/vacancy-price-history-section";
import { DataTable } from "@/components/shared/data-table";
import { VacancyBoard } from "./_components/vacancy-board";
import { whatsappLink } from "./_components/support-messages";
import { SupportAutoSettingsDialog } from "./_components/support-auto-settings-dialog";
import { VacancyDispatchCell } from "./_components/vacancy-dispatch-cell";
import { VacancyDocumentsCell } from "./_components/vacancy-documents-cell";
import { shortAddress } from "./_components/short-address";
import { vacancyIdFromSearch } from "./_components/vacancy-deep-link";
import {
  useResendVacancyGroupMessage,
  useSendVacancyStageMessage,
  useVacancyOutreach,
} from "@/modules/admin/application/use-vacancy-outreach";
import { GROUP_BROADCAST_STAGE } from "@/modules/admin/infrastructure/vacancy-outreach-api";
import type { OutreachStage } from "@/modules/admin/infrastructure/vacancy-outreach-api";
import { useQueryClient } from "@tanstack/react-query";
import { tickSupportActions } from "@/modules/admin/infrastructure/support-checklist-api";
import { resolveVacancyBucket, type VacancyBucket } from "./_components/vacancy-bucket";
import {
  displayVacancyStatus,
  findGroupBroadcastRecord,
  isRowNotBroadcast,
} from "./_components/vacancy-display-status";
import { NotBroadcastBadge } from "./_components/vacancy-not-broadcast";
import { GroupDispatchBadge } from "./_components/group-dispatch-badge";
import { VacancyGroupBroadcastsSection } from "./_components/vacancy-group-broadcasts-section";
import { grupos, SEGUNDOS_ENTRE_GRUPOS } from "@/modules/admin/domain/group-broadcast";
import { avisarErroDoReenvio } from "@/modules/admin/application/use-vacancy-group-broadcasts";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { repasseHeldOrReviewNotice } from "@/modules/admin/application/repasse-status-presentation";
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
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import {
  useConfirmCandidacy,
  useReinstateCandidacy,
  useAcceptCandidacy,
  useRestoreCandidacy,
  useConfirmPrestartByPhone,
  useVacancyCandidacies,
} from "@/modules/admin/application/use-vacancy-candidacies";
import { useVacancyFeedbacks } from "@/modules/admin/application/use-vacancy-feedbacks";
import { useAdminCancelVacancy, useFinalizeVacancy, getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useAdminRemoveCandidacy } from "@/modules/admin/application/use-admin-remove-candidacy";
import {
  cancelResultMessage,
  RefundTypeSelector,
} from "@/components/shared/refund-type-selector";
import type { VacancyItem, RefundType } from "@/modules/admin/infrastructure/admin-api";
import { computeVacancyMoney } from "@/modules/admin/domain/vacancy-money";
import { isInvoicedVacancy } from "@/modules/admin/application/vacancy-documents-open";
import { formatCents } from "@/lib/money";
import { useCatalogRoles } from "@/modules/admin/application/use-admin-catalog";
import { formatCargo } from "@/modules/admin/application/use-export-providers";
import { IssueReportQueue } from "@/components/admin/vacancy/issue-report-queue";
import { IssueReportResolution } from "@/components/admin/vacancy/issue-report-resolution";
import { useOpenIssueReports } from "@/modules/admin/application/use-issue-reports";
import { formatVacancyDate, formatVacancyTime, formatInstantDateTime, vacancyDayISO } from "@/lib/date.utils";

const formatDate = formatVacancyDate;
const formatTime = formatVacancyTime;


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
    case "CANCELLED_BY_CONTRACTOR": return "cancelled" as const;
    default: return "open" as const;
  }
}

/**
 * Título do valor no detalhe da vaga (AD-0b; textos da UX 2026-10-22 §7). "Pagou"
 * só com o pagamento concluído: em 22/10 uma vaga Aberta da Coco Bambu Osasco, sem
 * pagamento, aparecia como "Contratante pagou à plataforma R$ 141,06".
 */
function contractorPaymentHeading(v: VacancyItem): string {
  if (isInvoicedVacancy(v.paymentMethod, v.nfseInvoice)) return "Entra na fatura da empresa";
  if (v.paymentStatus === "PAID") return "Contratante pagou à plataforma";
  if (v.paymentStatus === "PENDING" || v.paymentStatus === "NONE") {
    return "Contratante vai pagar (quando escolher o freelancer)";
  }
  // API anterior ao campo: não afirma nem que pagou nem que vai pagar.
  return "Contratante paga à plataforma";
}

function mapVacancyToRow(v: VacancyItem) {
  const start = formatTime(v.startTime);
  const end = formatTime(v.endTime);
  const money = computeVacancyMoney(v);
  const bucket = resolveVacancyBucket(v);
  const status = mapVacancyStatus(v.status);
  return {
    id: v.id,
    empresa: v.contractorCompanyName || v.contractorName || "Sem nome",
    cidade: v.address || "N/A",
    cargo: v.serviceType,
    qtd: 1,
    candidatos: v.candidacyCount ?? 0,
    preenchidas: v.status === "CLOSED" ? 1 : 0,
    // "Valor" = o que o contratante paga à plataforma (só o serviço; INSS é recolhido
    // à parte, fora da plataforma). Decomposta ou legado, é sempre o serviço (= base).
    valor: formatCents(money.contractorPaidCents),
    valorTitulo: contractorPaymentHeading(v),
    data: formatDate(v.date),
    // Quando a vaga foi PUBLICADA (≠ `data`, que é o dia do serviço).
    abertaEm: v.createdAt ? formatInstantDateTime(v.createdAt) : "—",
    horario: `${start} - ${end}`,
    status,
    // Vencida é só exibição (aberta no banco, horário já passou) — spec 2026-09-24 §C.
    statusExibido: displayVacancyStatus(status, bucket),
    bucket,
    providerName: v.providerName ?? null,
    consultor: v.referringConsultant?.name ?? null,
    raw: v,
    money,
  };
}

type Row = ReturnType<typeof mapVacancyToRow>;


import { VacancyRoadmap, formatStepAt } from "./_components/vacancy-roadmap";


export default function JobsPage() {
  // Área controlada por permissão; o filtro por consultor segue super-admin.
  const { user, isSuperAdmin } = useAuth();
  const { isChecking, allowed } = useAreaGuard("JOBS");
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");
  // Modo Painel: as vagas em colunas por etapa, para acompanhar na TV. Fica na
  // mesma tela porque é a MESMA lista, só desenhada de outro jeito — separar em
  // outra rota duplicaria a classificação por etapa.
  const [modoPainel, setModoPainel] = useState(false);
  const [autoSettingsOpen, setAutoSettingsOpen] = useState(false);
  // Avisos já enviados + disparo. Uma consulta para o painel inteiro.
  const { enviados: avisosEnviados, registros: registrosDisparo } = useVacancyOutreach();
  const enviarAviso = useSendVacancyStageMessage();
  // Reenvio do anúncio no grupo da cidade — o atalho da primeira ação da etapa
  // "aberta sem candidato" na área de trabalho do suporte.
  const reenviarNoGrupo = useResendVacancyGroupMessage();
  const queryClient = useQueryClient();
  const [avisandoId, setAvisandoId] = useState<string | null>(null);

  // Quando um disparo automático (reenviar no grupo / cobrar etapa) sai pelo
  // botão, a ação correspondente do checklist do suporte é ticada sozinha — o
  // painel passa a mostrar que ela já foi feita. Módulo fixo "bars-restaurants":
  // a área de trabalho só está ligada em Vagas Empresa. Falhar aqui não estraga
  // o disparo que já deu certo, então é silencioso.
  const marcarAcaoDoChecklist = async (vacancyId: string, actionId: string) => {
    try {
      await tickSupportActions(vacancyId, [actionId], "bars-restaurants", user?.name ?? undefined);
      await queryClient.invalidateQueries({ queryKey: ["admin", "support-checklist"] });
    } catch {
      /* silencioso de propósito */
    }
  };
  const { data: vacancies, isLoading, isError, isFetching } = useAdminVacancies(
    selectedConsultantId || undefined,
    // Só o painel repolla: ele fica aberto na TV sem ninguém para atualizar.
    modoPainel ? 60_000 : undefined,
  );
  const { data: contractors } = useAdminContractors();
  // Dropdown de consultor é exclusivo do super-admin (mesma regra da tela de consultores).
  const { data: consultants } = useAdminConsultants();
  // Relatos de problema (F6) abertos — a fila do topo e o aviso dentro do modal.
  const { data: openReports } = useOpenIssueReports();
  const [statusFilter, setStatusFilter] = useState<"all" | VacancyBucket>("all");
  /** Dia do serviço, "YYYY-MM-DD" vindo do `<input type="date">`. "" = todas. */
  const [dataFiltro, setDataFiltro] = useState("");

  // Só o id: a linha do modal é relida da lista a cada render (ver `modalDetalhes`).
  const [modalDetalhesId, setModalDetalhesId] = useState<string | null>(null);
  const [modalBuscarId, setModalBuscarId] = useState(false);
  const [buscaIdInput, setBuscaIdInput] = useState("");

  const { data: candidacies, isLoading: loadingCandidacies } = useVacancyCandidacies(modalDetalhesId);
  const confirmCandidacy = useConfirmCandidacy(modalDetalhesId);
  const reinstateCandidacy = useReinstateCandidacy(modalDetalhesId);
  const acceptCandidacy = useAcceptCandidacy(modalDetalhesId);
  const restoreCandidacy = useRestoreCandidacy(modalDetalhesId);
  const confirmPrestart = useConfirmPrestartByPhone(modalDetalhesId);

  /** "Confirmar por telefone" da confirmação do dia (3 h antes). */
  async function handleConfirmPrestart(candidacyId: string, nome: string) {
    if (!window.confirm(`Você ligou para ${nome} e ele(a) disse que vai?`)) return;
    try {
      const res = await confirmPrestart.mutateAsync(candidacyId);
      if (res.status === "already_confirmed") {
        toast.info(`${nome} já tinha confirmado.`);
        return;
      }
      toast.success(
        res.late
          ? `${nome} confirmado(a). A empresa foi avisada de que vai.`
          : `${nome} confirmado(a) pelo painel.`,
      );
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível confirmar."));
    }
  }

  /**
   * Coloca na vaga um candidato PENDENTE, no lugar do contratante. É o mesmo
   * aceite do cliente, então o aviso diz o que vai acontecer com os outros
   * candidatos e com o pagamento antes de o operador confirmar.
   */
  async function handleAcceptCandidacy(candidacyId: string, nome: string) {
    if (
      !window.confirm(
        `Colocar ${nome} nesta vaga?\n\nÉ o mesmo que o contratante aceitar: quando a vaga completa, os outros candidatos são dispensados, e o contratante é avisado para pagar.`,
      )
    ) {
      return;
    }
    try {
      await acceptCandidacy.mutateAsync(candidacyId);
      toast.success(`${nome} foi colocado(a) na vaga. O contratante foi avisado.`);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível colocar na vaga."));
    }
  }

  /**
   * "Voltar para candidatos": recusado ou não selecionado volta a PENDENTE. Não
   * aprova ninguém — o aviso diz isso, para o operador não achar que já colocou.
   */
  async function handleRestoreCandidacy(candidacyId: string, nome: string) {
    if (
      !window.confirm(
        `Voltar ${nome} para a lista de candidatos?\n\nEla volta como pendente. Para colocá-la na vaga, use "Colocar na vaga" depois.`,
      )
    ) {
      return;
    }
    try {
      await restoreCandidacy.mutateAsync(candidacyId);
      toast.success(`${nome} voltou para a lista de candidatos.`);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível voltar para a lista."));
    }
  }

  /** Devolve a vaga a quem foi desalocado por não confirmar; confirma a presença junto. */
  async function handleReinstateCandidacy(candidacyId: string, nome: string) {
    if (
      !window.confirm(
        `Recolocar ${nome} nesta vaga?\n\nA vaga volta a ficar preenchida por ela e a presença é confirmada pelo painel. Use depois de falar com a pessoa.`,
      )
    ) {
      return;
    }
    try {
      await reinstateCandidacy.mutateAsync(candidacyId);
      toast.success(`${nome} recolocada na vaga, com presença confirmada.`);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível recolocar."));
    }
  }

  /**
   * Confirma a presença no lugar do freelancer.
   *
   * A mensagem separa "confirmei agora" de "já estava confirmada": sem isso, o
   * operador que clica numa candidatura já confirmada acha que foi ele quem
   * resolveu, e o motivo real do problema continua lá.
   */
  async function handleConfirmCandidacy(candidacyId: string, nome: string) {
    try {
      const res = await confirmCandidacy.mutateAsync(candidacyId);
      if (res.status === "already_confirmed") {
        toast.info(`${nome} já havia confirmado presença.`);
        return;
      }
      toast.success(`Presença de ${nome} confirmada pelo painel.`);
    } catch (e) {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(
        err.response?.data?.error?.message ??
          "Não foi possível confirmar. A candidatura precisa estar aceita.",
      );
    }
  }


  const { data: feedbacks, isLoading: loadingFeedbacks } = useVacancyFeedbacks(modalDetalhesId);
  // Cargo pelo NOME do catálogo ("lavagem-de-loucas" → "Lavagem de Louças"),
  // como em Vagas — Casa; sem catálogo, o slug com maiúsculas.
  const { data: catalogRoles } = useCatalogRoles();
  const roleNameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const role of catalogRoles ?? []) {
      map.set(role.slug, role.name);
      for (const alias of role.aliases ?? []) map.set(alias, role.name);
    }
    return map;
  }, [catalogRoles]);
  const cargoLabel = (slug: string) => roleNameBySlug.get(slug) ?? formatCargo(slug);

  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRefundType, setCancelRefundType] = useState<RefundType>("FULL");
  const cancelMutation = useAdminCancelVacancy();
  const finalizeMutation = useFinalizeVacancy();

  const [removeTarget, setRemoveTarget] = useState<{
    vacancyId: string;
    candidacyId: string;
    providerName: string;
  } | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const removeCandidacyMutation = useAdminRemoveCandidacy();

  const allRows: Row[] = vacancies?.map(mapVacancyToRow) ?? [];

  // O modal "Detalhes da vaga" mostra a linha ATUAL da lista, não uma cópia de
  // quando abriu: depois de desvincular A e colocar B, a lista recarrega e o
  // modal passa a mostrar B (e a chave Pix de B). Guardar a linha inteira no
  // estado deixava o modal mostrando A até fechar e abrir de novo.
  const modalDetalhes = modalDetalhesId
    ? (allRows.find((r) => r.id === modalDetalhesId) ?? null)
    : null;
  // A vaga saiu da lista (ex.: trocou o filtro de consultor): fecha o modal em
  // vez de deixá-lo reabrir sozinho quando ela voltar.
  const vagaDoModalSumiu = !!modalDetalhesId && !!vacancies && !modalDetalhes;
  useEffect(() => {
    if (vagaDoModalSumiu) setModalDetalhesId(null);
  }, [vagaDoModalSumiu]);

  // Recorte por DIA DO SERVIÇO. Vem antes do filtro de etapa de propósito: com
  // uma data escolhida, os contadores dos chips passam a ser os daquele dia —
  // "aguardando pagamento (3)" tem que ser 3 naquela data, não 3 no histórico.
  const rowsNoDia = dataFiltro
    ? allRows.filter((r) => vacancyDayISO(r.raw.date) === dataFiltro)
    : allRows;

  const rows =
    statusFilter === "all"
      ? rowsNoDia
      : rowsNoDia.filter((r) => r.bucket === statusFilter);
  // Uma passada só para os contadores dos chips: são nove etapas, e varrer a
  // lista inteira uma vez por chip custa caro numa base de centenas de vagas.
  const contagemPorBucket = rowsNoDia.reduce<Partial<Record<VacancyBucket, number>>>(
    (acc, r) => {
      acc[r.bucket] = (acc[r.bucket] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const contar = (bucket: VacancyBucket) => contagemPorBucket[bucket] ?? 0;
  const contractorMap = new Map(contractors?.map((c) => [c.id, c]));

  const openReportForVacancy = (vacancyId: string) =>
    openReports?.find((r) => r.vacancyId === vacancyId && r.status === "OPEN") ?? null;

  /** Abre o modal de detalhes de uma vaga a partir da fila de relatos. */
  const openVacancyById = (vacancyId: string) => {
    const row = allRows.find((r) => r.raw.id === vacancyId);
    if (row) {
      setModalDetalhesId(row.id);
      return;
    }
    // Vaga fora da lista carregada (outro consultor/período): cai na busca por ID.
    setBuscaIdInput(vacancyId);
    setModalBuscarId(true);
  };

  // "Abrir a vaga" da fila do suporte: `/jobs?vaga=<id>` abre o modal da vaga quando a lista
  // carrega (fora da lista, cai na busca por ID, como acima). Lido de `window.location`, e não
  // de `useSearchParams`, que pediria um <Suspense> em volta da página.
  const [vagaDoLink, setVagaDoLink] = useState<string | null>(null);
  useEffect(() => {
    setVagaDoLink(vacancyIdFromSearch(window.location.search));
  }, []);
  useEffect(() => {
    if (!vagaDoLink || !vacancies) return;
    setVagaDoLink(null);
    window.history.replaceState(null, "", window.location.pathname);
    if (vacancies.some((v) => v.id === vagaDoLink)) {
      setModalDetalhesId(vagaDoLink);
      return;
    }
    setBuscaIdInput(vagaDoLink);
    setModalBuscarId(true);
  }, [vagaDoLink, vacancies]);

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
      // Faturado: nada foi pago por Pix, o aviso diz o efeito na fatura.
      toast.success(
        cancelResultMessage(result, cancelTarget.raw.paymentMethod === "INVOICE", {
          requested: cancelRefundType,
          // Freelancer aceito = pagamento faturado liquidado; sem ele, o aviso é neutro.
          confirmedFreelancer: cancelTarget.raw.providerId ? true : undefined,
        }),
      );
      setCancelTarget(null);
      setCancelReason("");
      setModalDetalhesId(null);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Falha ao cancelar a vaga."));
    }
  };

  /** "Deu tudo certo": conclui a vaga e paga o repasse (PIX) ao freelancer. */
  const handleFinalizeVacancy = async () => {
    if (!modalDetalhes) return;
    if (
      !window.confirm(
        "Finalizar esta vaga e pagar o freelancer?\n\nMarca o serviço como concluído e dispara o repasse (PIX) ao freelancer, junto dos documentos fiscais. Use quando o serviço foi realizado e está tudo certo. Não paga em dobro se já foi pago.\n\nEm vaga de empresa faturada, o Pix pode esperar a fatura da empresa: sai quando ela pagar, ou no teto garantido pela Freela.",
      )
    ) {
      return;
    }
    try {
      const res = await finalizeMutation.mutateAsync({ vacancyId: modalDetalhes.raw.id });
      if (res.repasseStatus === "COMPLETED") {
        toast.success("Vaga finalizada e repasse pago ao freelancer.");
      } else if (res.repasseStatus === "FAILED") {
        toast.warning(
          `Vaga finalizada, mas o repasse falhou: ${res.failureReason ?? "motivo desconhecido"}. Corrija e use "pagar repasse".`,
        );
      } else if (repasseHeldOrReviewNotice(res.repasseStatus)) {
        // Faturado (ADR-017): o Pix espera a fatura; ou o crédito ficou em verificação.
        toast.info(`Vaga finalizada: ${repasseHeldOrReviewNotice(res.repasseStatus)}`);
      } else {
        toast.success("Vaga finalizada. O repasse ainda não foi processado.");
      }
      setModalDetalhesId(null);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Falha ao finalizar a vaga."));
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
      // Fecha o modal mesmo no erro. A lista ja foi recarregada pelo
      // `onSettled` da mutation, entao manter o modal aberto so convida a
      // repetir o clique contra um estado que nao existe mais — foi o que
      // rendeu dez tentativas seguidas em 19/08/2026. Se a falha tiver sido
      // passageira, o botao continua la na lista ja atualizada.
      setRemoveTarget(null);
      setRemoveReason("");
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
    setModalDetalhesId(found.id);
    setModalBuscarId(false);
    setBuscaIdInput("");
  };

  if (isChecking || !allowed) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

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
    {
      header: "Empresa",
      accessor: (row: Row) => (
        <span className="md:max-w-[200px] md:line-clamp-2 font-medium text-[#1d1d1b]" title={row.empresa}>
          {row.empresa}
        </span>
      ),
      sortable: true,
      sortAccessor: (r: Row) => r.empresa,
    },
    {
      header: "Lugar",
      accessor: (row: Row) => {
        const { place, street } = shortAddress(row.cidade);
        return (
          <span className="block max-w-[220px]" title={row.cidade}>
            <span className="block truncate">{place}</span>
            {street && <span className="block truncate text-xs text-[#737373]">{street}</span>}
          </span>
        );
      },
      className: "hidden md:table-cell",
      sortable: true,
      sortAccessor: (r: Row) => r.cidade,
    },
    {
      header: "Cargo",
      accessor: (row: Row) => (
        <span className="max-w-[160px] line-clamp-2" title={row.cargo}>
          {cargoLabel(row.cargo)}
        </span>
      ),
      sortable: true,
      sortAccessor: (r: Row) => cargoLabel(r.cargo),
    },
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
      header: "Aberta em",
      accessor: "abertaEm" as const,
      className: "hidden lg:table-cell",
      sortable: true,
      // Vaga sem createdAt vai para o fim na ordenação decrescente em vez de
      // virar Invalid Date (que compara como NaN e embaralha a coluna toda).
      sortAccessor: (r: Row) => (r.raw.createdAt ? new Date(r.raw.createdAt).getTime() : 0),
    },
    {
      // Dia e horário juntos (eram 2 colunas): a linha fica mais estreita e o
      // Status e o "Ver" cabem na tela.
      header: "Data do serviço",
      accessor: (row: Row) => (
        <span className="block whitespace-nowrap">
          {row.data}
          <span className="block text-xs text-[#737373]">{row.horario}</span>
        </span>
      ),
      sortable: true,
      sortAccessor: (r: Row) => new Date(r.raw.date),
    },
    {
      header: "Disparo",
      accessor: (row: Row) => (
        // O anúncio no grupo da cidade é best-effort: quando a Evolution cai, a
        // vaga entra e ninguém no grupo sabe. Esta coluna é o único lugar em
        // que isso aparece — e ela diz também se saiu sozinho ou na mão.
        <VacancyDispatchCell
          vacancyId={row.id}
          record={registrosDisparo.get(`${row.id}::${GROUP_BROADCAST_STAGE}`)}
          module="empresa"
          broadcastAt={row.raw.groupBroadcastAt}
        />
      ),
      className: "hidden lg:table-cell",
      // No cartão do celular o selo já vai embaixo do Status (e o reenvio fica
      // no modal da vaga): sem isto o selo apareceria duas vezes.
      mobile: "hide" as const,
    },
    {
      // Contrato · Recibo · RPA · NF-e em quatro pastilhas; o motivo vai no
      // tooltip. "—" quando a API ainda não manda o campo.
      header: "Documentos",
      accessor: (row: Row) => (
        <VacancyDocumentsCell documents={row.raw.documents} detail={row.raw.documentsDetail} />
      ),
      className: "hidden lg:table-cell",
    },
    {
      header: "Status",
      // Presa na direita da tabela: com a rolagem para o lado, o Status e o
      // "Ver" continuam à vista (antes ficavam fora da tela).
      className:
        "md:sticky md:right-0 md:z-[1] md:bg-white md:group-hover/row:bg-[#f7f7f7] md:shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]",
      accessor: (row: Row) => {
        const naoDivulgada = isRowNotBroadcast(registrosDisparo, row);
        return (
          <div className="flex items-start justify-end gap-2 md:justify-between">
            <div className="flex flex-col items-end gap-1 md:items-start">
              <div className="flex flex-wrap items-center gap-1">
                <StatusBadge status={row.statusExibido} />
                {naoDivulgada && <NotBroadcastBadge />}
              </div>
              {/* Celular e tablet: a coluna "Disparo" não aparece, então o selo da
                  divulgação vem aqui, em 2ª linha (o reenvio fica no modal). Com
                  "Não divulgada" já ao lado do status, só aparece se houver
                  rodada (falhou / enviando) — senão repetiria a mesma coisa. */}
              {(!naoDivulgada ||
                Boolean(findGroupBroadcastRecord(registrosDisparo, row.id)?.groupBroadcast?.lastRound)) && (
                <GroupDispatchBadge
                  record={findGroupBroadcastRecord(registrosDisparo, row.id)}
                  vacancyBroadcastAt={row.raw.groupBroadcastAt}
                  className="lg:hidden"
                />
              )}
            </div>
            {/* Computador: o "Ver" fica junto do Status (a coluna Ações é só do celular). */}
            <button
              type="button"
              onClick={() => setModalDetalhesId(row.id)}
              className="hidden md:inline-flex shrink-0 items-center gap-1 rounded-md border border-[#e5e5e5] bg-white px-2 py-1 text-xs font-medium text-[#1d1d1b] hover:border-[#eca826] hover:text-[#eca826] cursor-pointer transition-colors"
              title="Ver"
              aria-label={`Ver a vaga de ${row.empresa}`}
            >
              <Eye className="w-3.5 h-3.5" />
              Ver
            </button>
          </div>
        );
      },
    },
    {
      header: "Ações",
      // Só no cartão do celular: no computador o "Ver" está na coluna Status.
      className: "md:hidden",
      accessor: (row: Row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setModalDetalhesId(row.id)}
            className="p-1.5 rounded-md hover:bg-[#eca826]/10 hover:text-[#eca826] cursor-pointer transition-colors"
            title="Ver"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // A tabela abre pela data do serviço, mais recente primeiro. O índice vem do
  // título: um número fixo (era 5) apontava para outra coluna quando entraram
  // "Consultor" (só super-admin), "Aberta em" e "Candidatos".
  const dataDoServicoIndex = columns.findIndex((c) => c.header === "Data do serviço");

  return (
    <div>
      <PageHeader
        title="Vagas Empresa"
        description="Gerencie as vagas e solicitações de freelancers"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setModoPainel((v) => !v)}
              className="border-[#e5e5e5] text-[#1d1d1b] hover:bg-[#f7f7f7] font-medium"
              title="Vagas em colunas por etapa, para acompanhar na TV"
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              {modoPainel ? "Ver tabela" : "Modo painel"}
            </Button>
            {modoPainel ? (
              <Button
                variant="outline"
                onClick={() => setAutoSettingsOpen(true)}
                className="border-[#e5e5e5] text-[#1d1d1b] hover:bg-[#f7f7f7] font-medium"
                title="Ligar/desligar o disparo automático das mensagens do suporte"
              >
                <Bot className="w-4 h-4 mr-2" />
                Automação
              </Button>
            ) : null}
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

      <IssueReportQueue
        reports={openReports?.filter((r) => r.module !== "FREELA_EM_CASA")}
        onOpen={openVacancyById}
      />

      {modoPainel ? (
        <VacancyBoard
          // `allRows` e não `rows`: o painel mostra o fluxo inteiro, ignorando o
          // filtro de status da tabela — as colunas JÁ são o recorte por etapa.
          vacancies={allRows.map((r) => ({
            id: r.id,
            bucket: r.bucket,
            empresa: r.empresa,
            cargo: r.cargo,
            cidade: r.cidade,
            candidatos: r.candidatos,
            // Já formatados aqui: o painel não faz conta nem formata data, para
            // que o card e a linha da tabela nunca divirjam no mesmo número.
            valor: r.valor,
            valorCents: r.money.contractorPaidCents,
            // Resíduo (nossa margem): base − repasse real quando decomposta
            // (= taxa + pix + seguro); no legado, taxa % + taxa fixa.
            residuoCents: r.money.residuoCents,
            data: r.data,
            turno: r.horario,
            freelancer: r.providerName,
            freelancerTelefone: r.raw.providerPhone ?? null,
            // Contato e telefone vêm do cadastro do contratante, não da vaga:
            // é o número que o suporte usa para a saudação e para as cobranças.
            contratanteContato: contractorMap.get(r.raw.contractorId)?.contactName ?? null,
            contratanteTelefone: contractorMap.get(r.raw.contractorId)?.contactPhone ?? null,
            raw: r.raw,
          }))}
          isFetching={isFetching}
          // Vagas Empresa é onde o time de suporte trabalha: o painel aqui não
          // é só o quadro da TV, é a fila de atendimento.
          areaDeTrabalho
          quemTicou={user?.name ?? null}
          onReenviarGrupo={async (vacancyId) => {
            setAvisandoId(vacancyId);
            try {
              const r = await reenviarNoGrupo.mutateAsync({ vacancyId, module: "empresa" });
              // API nova: a rodada vai para todos os grupos no raio, em fila.
              toast.success(
                !r.roundId
                  ? "Vaga reenviada no grupo da cidade."
                  : r.destinations.length > 0
                    ? `Enviando a vaga para ${grupos(r.destinations.length)}, 1 a cada ~${SEGUNDOS_ENTRE_GRUPOS} s. Veja quais receberam em Detalhes da vaga.`
                    : "Envio pedido. Veja quais grupos receberam em Detalhes da vaga.",
              );
              // Auto-tica "Divulgar de novo no grupo de WhatsApp".
              await marcarAcaoDoChecklist(vacancyId, "divulgar_grupo");
            } catch (e) {
              // 409 (vaga não aberta / envio em andamento), 400 e sem resposta:
              // o mesmo aviso do modal e da coluna.
              avisarErroDoReenvio(e);
            } finally {
              setAvisandoId(null);
            }
          }}
          // Mesmo modal da tabela: o quadro devolve só o id e a página resolve
          // a linha, para não haver duas telas de detalhe da vaga.
          onSelect={(vacancyId) => setModalDetalhesId(vacancyId)}
          avisados={avisosEnviados}
          avisando={avisandoId}
          onAvisar={async (vacancyId, stage) => {
            setAvisandoId(vacancyId);
            try {
              const r = await enviarAviso.mutateAsync({
                vacancyId,
                stage: stage as OutreachStage,
              });
              toast.success(`Aviso enviado para ${r.phone}.`);
              // Auto-tica a cobrança correspondente à etapa avisada.
              await marcarAcaoDoChecklist(
                vacancyId,
                stage === "awaitingSelection" ? "cobrar_escolha" : "cobrar_pagamento",
              );
            } catch (e) {
              // A mensagem da API é específica ("contratante sem telefone"),
              // e é ela que diz o que fazer — não pode virar "tente de novo".
              toast.error(getAxiosErrorMessage(e) || "Não foi possível enviar o aviso.");
            } finally {
              setAvisandoId(null);
            }
          }}
        />
      ) : (
      <DataTable
          columns={columns}
          data={rows}
          // Clicar em qualquer ponto da linha abre os detalhes (os botões da
          // linha, como "Reenviar" e as pastilhas de documento, seguem iguais).
          onRowClick={(row) => setModalDetalhesId(row.id)}
          searchPlaceholder="Buscar por empresa..."
          searchKey="empresa"
          defaultSort={
            dataDoServicoIndex >= 0 ? { index: dataDoServicoIndex, direction: "desc" as const } : undefined
          }
          filters={
            <div className="flex flex-col gap-3">
              {/* Data do SERVIÇO (não a de publicação): é por ela que se
                  pergunta "o que tem amanhã". Fica só no modo tabela — o painel
                  tem o próprio recorte, de hoje em diante. */}
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="data-filter" className="text-xs font-medium text-[#737373]">
                  Data do serviço:
                </label>
                <input
                  id="data-filter"
                  type="date"
                  value={dataFiltro}
                  onChange={(e) => setDataFiltro(e.target.value)}
                  className="rounded-lg border border-[#e5e5e5] bg-white px-3 py-1.5 text-xs font-medium text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
                />
                {dataFiltro && (
                  <button
                    type="button"
                    onClick={() => setDataFiltro("")}
                    className="cursor-pointer rounded-lg border border-[#e5e5e5] bg-white px-2.5 py-1.5 text-xs font-medium text-[#737373] hover:bg-[#f5f5f5]"
                  >
                    Limpar
                  </button>
                )}
                {dataFiltro && (
                  <span className="text-xs text-[#737373]">
                    {rowsNoDia.length} vaga(s) em {formatVacancyDate(dataFiltro)}
                  </span>
                )}
              </div>
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
                    label: `Todas (${rowsNoDia.length})`,
                  },
                  // Mesma ordem do funil do Modo Painel: os chips e as colunas
                  // são a mesma classificação, e trocar a ordem entre os dois
                  // faria a tabela e o quadro parecerem coisas diferentes.
                  {
                    key: "open",
                    label: `Abertas s/ candidato (${contar("open")})`,
                  },
                  {
                    key: "awaitingSelection",
                    label: `Aguardando seleção (${contar("awaitingSelection")})`,
                  },
                  {
                    key: "awaitingPayment",
                    label: `Aguardando pagamento (${contar("awaitingPayment")})`,
                  },
                  {
                    key: "confirmed",
                    label: `Freela confirmado (${contar("confirmed")})`,
                  },
                  {
                    key: "inProgress",
                    label: `Em andamento (${contar("inProgress")})`,
                  },
                  {
                    key: "completedAwaitingReview",
                    label: `Concluídas s/ avaliação (${contar("completedAwaitingReview")})`,
                  },
                  {
                    key: "completedReviewed",
                    label: `Concluídas (${contar("completedReviewed")})`,
                  },
                  {
                    key: "lost",
                    label: `Perdidas (${contar("lost")})`,
                  },
                  {
                    key: "cancelled",
                    label: `Canceladas (${contar("cancelled")})`,
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
      )}

      {/* Modal Detalhes da Vaga */}
      <Dialog
        open={!!modalDetalhes}
        onOpenChange={(open) => !open && setModalDetalhesId(null)}
        className="max-w-6xl"
      >
        <DialogContent
          className="flex max-h-[90vh] flex-col overflow-hidden p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Detalhes da Vaga"
        >
          <DialogClose onClick={() => setModalDetalhesId(null)} />
          <DialogHeader>
            <DialogTitle>Detalhes da Vaga</DialogTitle>
          </DialogHeader>
          {modalDetalhes && (
            <div
              data-testid="modal-vaga-corpo"
              className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 -mr-1 text-sm"
            >
              <IssueReportResolution
                vacancy={modalDetalhes.raw}
                report={openReportForVacancy(modalDetalhes.raw.id)}
                onResolved={() => setModalDetalhesId(null)}
                onRequestCancel={() => {
                  setCancelTarget(modalDetalhes);
                  setCancelReason("");
                  setCancelRefundType("FULL");
                }}
              />

              {/* Resumo da vaga: sempre à vista, compacto. O resto das informações fica no
                  bloco "Detalhes da vaga" (fechado), para a lista de candidatos vir primeiro. */}
              <div
                data-testid="resumo-vaga"
                className="flex flex-col gap-2 rounded-lg bg-[#f7f7f7] p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4"
              >
                <p className="min-w-0 font-semibold text-[#1d1d1b]">
                  {modalDetalhes.empresa}
                  <span className="font-normal text-[#737373]">
                    {" · "}
                    {modalDetalhes.cargo}
                    {" · "}
                    {modalDetalhes.data}
                    {" · "}
                    {modalDetalhes.horario}
                  </span>
                </p>
                <StatusBadge status={modalDetalhes.statusExibido} />
                <p className="text-[#1d1d1b]">
                  <span className="text-[#737373]">{modalDetalhes.valorTitulo}: </span>
                  <span className="font-semibold">{modalDetalhes.valor}</span>
                </p>
                {modalDetalhes.status === "filled" && modalDetalhes.providerName && (
                  <p className="text-green-900">
                    <span className="text-green-700">Freelancer alocado: </span>
                    <span className="font-semibold">{modalDetalhes.providerName}</span>
                  </p>
                )}
                {(() => {
                  const contato = modalDetalhes.raw?.contractorId
                    ? contractorMap.get(modalDetalhes.raw.contractorId)
                    : undefined;
                  if (!contato?.contactPhone) return null;
                  const wa = whatsappLink(contato.contactPhone, "");
                  return (
                    <span className="flex flex-wrap items-center gap-3 sm:ml-auto">
                      <a
                        href={`tel:${contato.contactPhone}`}
                        className="inline-flex items-center gap-1.5 text-[#1d1d1b] transition-colors hover:text-[#eca826]"
                      >
                        <Phone className="h-3.5 w-3.5 text-[#737373]" />
                        {contato.contactPhone}
                      </a>
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-8 items-center rounded-md border border-green-200 bg-green-50 px-2.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100"
                        >
                          WhatsApp do contratante
                        </a>
                      )}
                    </span>
                  );
                })()}
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
                <div className="min-w-0 space-y-3">
              <VacancyCandidacyList
                candidacies={candidacies}
                loading={loadingCandidacies}
                scrollable={false}
                onConfirm={handleConfirmCandidacy}
                confirming={confirmCandidacy.isPending}
                onReinstate={handleReinstateCandidacy}
                reinstating={reinstateCandidacy.isPending}
                onAccept={handleAcceptCandidacy}
                accepting={acceptCandidacy.isPending}
                onRestore={handleRestoreCandidacy}
                restoring={restoreCandidacy.isPending}
                onPrestartConfirm={handleConfirmPrestart}
                prestartConfirming={confirmPrestart.isPending}
                vacancyOpen={modalDetalhes?.raw.status === "OPEN"}
                onUnlink={
                  modalDetalhes?.raw.id
                    ? ({ candidacyId, providerName }) =>
                        setRemoveTarget({
                          vacancyId: modalDetalhes.raw.id,
                          candidacyId,
                          providerName,
                        })
                    : undefined
                }
              />

                </div>
                <div className="min-w-0 space-y-3">
              {/* Rodada de seleção (fluxo v2, fatia E, piloto): só leitura. Sem a chave da API
                  (404 FEATURE_DISABLED), a seção não aparece. Chave própria (`selecao-`). */}
              {modalDetalhes.raw?.id && (
                <VacancySelectionRoundSection
                  key={`selecao-${modalDetalhes.raw.id}`}
                  vacancyId={modalDetalhes.raw.id}
                />
              )}

              {/* Reservas: quem está guardado, "Chamar reserva" e o histórico de trocas. */}
              {modalDetalhes.raw?.id && (
                <VacancyReservesSection
                  key={`reservas-${modalDetalhes.raw.id}`}
                  vacancyId={modalDetalhes.raw.id}
                  candidacies={candidacies}
                />
              )}

                </div>
              </div>

              <details data-testid="detalhes-vaga" className="group rounded-lg border border-[#e5e5e5]">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-[#1d1d1b] [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
                  Detalhes da vaga
                  <span className="font-normal text-[#737373]">
                    valores, contato, Pix, divulgação, link, histórico e feedbacks
                  </span>
                </summary>
                <div className="space-y-3 p-3 pt-0">
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
                  <p className="text-[#737373]">{modalDetalhes.valorTitulo}</p>
                  <p className="font-semibold text-[#1d1d1b]">{modalDetalhes.valor}</p>
                  {/* Discriminação (épico INSS por fora, 09/09): o que compõe o pago.
                     Taxa de serviço já líquida do desconto do plano (na fórmula v2,
                     "10% do valor do freelancer", sem desconto); a vaga extra da
                     cota do plano em linha própria (AD-0b); Pix e seguro são fixos;
                     o repasse fecha a conta. Legado: taxa − desconto + Pix. */}
                  <dl className="mt-1.5 space-y-0.5 text-[10px] text-[#737373]">
                    {modalDetalhes.money.intermediationCents != null && (
                      <div className="flex justify-between gap-2">
                        <dt>
                          {modalDetalhes.money.intermediationLabel}
                          {modalDetalhes.money.discountCents > 0 && (
                            <span className="text-green-700">
                              {" "}
                              (plano: −{formatCents(modalDetalhes.money.discountCents)})
                            </span>
                          )}
                        </dt>
                        <dd className="tabular-nums">{formatCents(modalDetalhes.money.intermediationCents)}</dd>
                      </div>
                    )}
                    {modalDetalhes.money.extraJobFeeCents > 0 && (
                      <div className="flex justify-between gap-2">
                        <dt>Vaga extra do mês</dt>
                        <dd className="tabular-nums">{formatCents(modalDetalhes.money.extraJobFeeCents)}</dd>
                      </div>
                    )}
                    {modalDetalhes.money.pixCents != null && (
                      <div className="flex justify-between gap-2">
                        <dt>Taxa Pix</dt>
                        <dd className="tabular-nums">{formatCents(modalDetalhes.money.pixCents)}</dd>
                      </div>
                    )}
                    {modalDetalhes.money.seguroCents != null && (
                      <div className="flex justify-between gap-2">
                        <dt>Seguro</dt>
                        <dd className="tabular-nums">{formatCents(modalDetalhes.money.seguroCents)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-2">
                      <dt>Repasse ao freelancer</dt>
                      <dd className="tabular-nums">{formatCents(modalDetalhes.money.repasseCents)}</dd>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-[#e5e5e5] pt-0.5 font-medium text-[#1d1d1b]">
                      <dt>
                        {modalDetalhes.money.decomposed && modalDetalhes.money.extraJobFeeCents > 0
                          ? "Nosso resíduo (taxa + vaga extra + Pix)"
                          : "Nosso resíduo (taxa + Pix)"}
                      </dt>
                      <dd className="tabular-nums">{formatCents(modalDetalhes.money.residuoCents)}</dd>
                    </div>
                  </dl>
                  {!modalDetalhes.money.reconciles && (
                    <p className="mt-1 text-[10px] font-medium text-red-700">
                      Atenção: taxa + Pix + seguro + repasse não fecham com o valor pago. Conferir a vaga.
                    </p>
                  )}
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-700 text-xs">Freelancer recebe</p>
                  <p className="font-semibold text-green-900">
                    {formatCents(modalDetalhes.money.repasseCents)}
                  </p>
                  {modalDetalhes.money.decomposed && (
                    <p className="text-[10px] text-green-800 mt-0.5">
                      INSS a recolher à parte: {formatCents(modalDetalhes.money.inssCents)} —
                      provisionado em nome do freelancer e recolhido pelo contratante
                      (guia/eSocial), fora da plataforma. Não é cobrado aqui e não sai do
                      repasse.
                    </p>
                  )}
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
                  <div className="mt-1"><StatusBadge status={modalDetalhes.statusExibido} /></div>
                </div>
              </div>

              {/* Para quais grupos de WhatsApp a vaga foi + reenvio (substitui o
                  antigo aviso "Vaga não divulgada": o estado vazio já diz isso). */}
              {/* Chave com prefixo: as seções por vaga (divulgação, convite, reservas e rodada de
                  seleção) são irmãs; com a mesma chave (o id da vaga), o React deixava cópias na
                  tela quando o modal mudava de forma aberto ("Divulgação nos grupos" 2, 3 vezes). */}
              <VacancyGroupBroadcastsSection
                key={`divulgacao-${modalDetalhes.id}`}
                vacancyId={modalDetalhes.id}
                record={findGroupBroadcastRecord(registrosDisparo, modalDetalhes.id)}
              />

              <VacancyRoadmap vacancy={modalDetalhes.raw} />

              {modalDetalhes.raw?.id && (
                <VacancyPriceHistorySection vacancyId={modalDetalhes.raw.id} />
              )}

              <VacancyDocumentsCell
                variant="full"
                vacancyId={modalDetalhes.raw?.id}
                documents={modalDetalhes.raw?.documents}
                detail={modalDetalhes.raw?.documentsDetail}
                paymentMethod={modalDetalhes.raw?.paymentMethod}
                nfseInvoice={modalDetalhes.raw?.nfseInvoice}
              />

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

              {/* Convite só faz sentido enquanto a vaga pode receber candidato:
                  aberta e com o turno ainda por começar (a API recusa o resto). */}
              {modalDetalhes.raw?.id &&
                modalDetalhes.raw.status === "OPEN" &&
                Date.parse(modalDetalhes.raw.startTime) > Date.now() && (
                  <CompatibleInviteSection
                    key={`convite-${modalDetalhes.raw.id}`}
                    vacancyId={modalDetalhes.raw.id}
                  />
                )}

              {/* Feedbacks — contratante ↔ freelancer */}
              <VacancyFeedbacksSection feedbacks={feedbacks} loading={loadingFeedbacks} />
                </div>
              </details>
            </div>
          )}
          <DialogFooter>
            {modalDetalhes && modalDetalhes.status !== "cancelled" && (
              <Button
                variant="outline"
                onClick={handleFinalizeVacancy}
                disabled={finalizeMutation.isPending}
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                title="Marca o serviço como concluído e paga o repasse (PIX) ao freelancer"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Finalizar e pagar
              </Button>
            )}
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
            <Button variant="outline" onClick={() => setModalDetalhesId(null)} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">
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
        {/* Motivo + estorno + avisos passam da altura do celular: rola por dentro. */}
        <DialogContent className="max-h-[88vh] overflow-y-auto">
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
                invoiced={cancelTarget.raw.paymentMethod === "INVOICE"}
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

      {/* Automação de mensagens do suporte (fase 2) */}
      <SupportAutoSettingsDialog
        open={autoSettingsOpen}
        onClose={() => setAutoSettingsOpen(false)}
      />

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

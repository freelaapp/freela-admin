"use client";

import { useState } from "react";
import { Eye, Loader2, RefreshCw, Users, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { VacancyBoard } from "../jobs/_components/vacancy-board";
import { resolveVacancyBucket } from "../jobs/_components/vacancy-bucket";
import { VacancyRoadmap } from "../jobs/_components/vacancy-roadmap";
import { VacancyDispatchCell } from "../jobs/_components/vacancy-dispatch-cell";
import {
  useSendVacancyStageMessage,
  useVacancyOutreach,
} from "@/modules/admin/application/use-vacancy-outreach";
import {
  GROUP_BROADCAST_STAGE,
  type OutreachStage,
} from "@/modules/admin/infrastructure/vacancy-outreach-api";
import { RefundTypeSelector } from "@/components/shared/refund-type-selector";
import { VacancyCandidacyList } from "@/components/admin/vacancy/vacancy-candidacy-list";
import { VacancyFeedbacksSection } from "@/components/admin/vacancy/vacancy-feedbacks-section";
import {
  useAdminRemoveCasaCandidacy,
  useAdminRestartCasaVacancy,
  useCasaVacancyCandidacies,
  useCasaVacancyFeedbacks,
  useConfirmCasaCandidacy,
} from "@/modules/admin/application/use-casa-vacancy-actions";
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
import { useAdminCasaVacancies } from "@/modules/admin/application/use-admin-casa-vacancies";
import { useAdminCancelCasaVacancy } from "@/modules/admin/application/use-admin-cancel-casa-vacancy";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useAdminConsultants } from "@/modules/admin/application/use-admin-consultants";
import { useAuth } from "@/modules/auth/application/use-auth";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import type { CasaVacancyItem } from "@/modules/admin/infrastructure/casa-vacancies-api";
import type { RefundType } from "@/modules/admin/infrastructure/admin-api";
import { formatVacancyDate, formatVacancyTime } from "@/lib/date.utils";

function mapVacancyStatus(status: string) {
  switch (status.toUpperCase()) {
    case "OPEN":
      return "open" as const;
    case "CLOSED":
      return "filled" as const;
    case "CANCELLED":
    case "CANCELLED_BY_CONTRACTOR":
      return "cancelled" as const;
    default:
      return "open" as const;
  }
}

function mapToRow(v: CasaVacancyItem) {
  return {
    id: v.id,
    empresa: v.contractorCompanyName || v.contractorName || "Sem nome",
    cargo: v.serviceType,
    lugar: v.address || "N/A",
    valor: `R$ ${(v.payment / 100).toFixed(2).replace(".", ",")}`,
    data: formatVacancyDate(v.date),
    // TIERED (diarista, piscineiro…): endTime é placeholder (start+1h) — mostrar
    // "12:00 - 13:00" afirmaria uma janela falsa; exibe chegada + faixa.
    horario: v.pricingTierLabel
      ? `Chegada: ${formatVacancyTime(v.startTime)} · ${v.pricingTierLabel}`
      : `${formatVacancyTime(v.startTime)} - ${formatVacancyTime(v.endTime)}`,
    status: mapVacancyStatus(v.status),
    // Mesma régua do módulo Empresa — uma fonte só para os dois painéis.
    bucket: resolveVacancyBucket(v),
    candidatos: v.candidacyCount ?? 0,
    freelancer: v.providerName ?? null,
    consultor: v.referringConsultant?.name ?? null,
    raw: v,
  };
}

type Row = ReturnType<typeof mapToRow>;

const statusFilters = [
  { key: "all", label: "Todas" },
  { key: "open", label: "Abertas" },
  { key: "filled", label: "Fechadas" },
  { key: "cancelled", label: "Canceladas" },
] as const;

type StatusKey = (typeof statusFilters)[number]["key"];

export default function VagasCasaPage() {
  // Área controlada por permissão; o filtro por consultor segue super-admin.
  const { isSuperAdmin } = useAuth();
  const { isChecking, allowed } = useAreaGuard("CASA_VACANCIES");
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("");
  const {
    data: vacancies,
    isLoading,
    isError,
    isFetching,
  } = useAdminCasaVacancies(selectedConsultantId || undefined);
  const { data: consultants } = useAdminConsultants();
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  // Modo Painel: as vagas em colunas por etapa, igual ao de Empresa.
  const [modoPainel, setModoPainel] = useState(false);
  /** Vaga aberta no card de detalhes (pelo painel ou pela tabela). */
  const [detalhe, setDetalhe] = useState<Row | null>(null);

  // Avisos por etapa e disparo no grupo — o mesmo caminho do módulo Empresa: a
  // rota resolve a vaga nos dois schemas.
  const { enviados: avisosEnviados, registros: registrosDisparo } =
    useVacancyOutreach();
  const enviarAviso = useSendVacancyStageMessage();
  const [avisandoId, setAvisandoId] = useState<string | null>(null);

  // Candidatos, avaliações e ações da vaga — as mesmas de Empresa, nas rotas
  // `/v1/home-services/admin` que o backend já servia antes desta tela usá-las.
  const { data: candidacies, isLoading: loadingCandidacies } =
    useCasaVacancyCandidacies(detalhe?.raw.id ?? null);
  const { data: feedbacks, isLoading: loadingFeedbacks } =
    useCasaVacancyFeedbacks(detalhe?.raw.id ?? null);
  const confirmCandidacy = useConfirmCasaCandidacy(detalhe?.raw.id ?? null);
  const restartMutation = useAdminRestartCasaVacancy();
  const removeCandidacyMutation = useAdminRemoveCasaCandidacy();

  const [removeTarget, setRemoveTarget] = useState<{
    vacancyId: string;
    candidacyId: string;
    providerName: string;
  } | null>(null);
  const [removeReason, setRemoveReason] = useState("");

  /**
   * Confirma a presença no lugar do freelancer. A mensagem separa "confirmei
   * agora" de "já estava confirmada": sem isso o operador acha que foi ele quem
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
    } catch (err) {
      toast.error(
        getAxiosErrorMessage(
          err,
          "Não foi possível confirmar. A candidatura precisa estar aceita.",
        ),
      );
    }
  }

  const handleRestartVacancy = async () => {
    if (!detalhe) return;
    if (
      !window.confirm(
        "Reabrir esta vaga do ZERO?\n\nO freelancer aceito sai, a vaga volta a aceitar candidatos e o job/check-in são resetados. O valor pago FICA RETIDO (sem estorno) para o substituto. Use quando o freelancer não compareceu/desistiu.",
      )
    ) {
      return;
    }
    try {
      await restartMutation.mutateAsync({
        vacancyId: detalhe.raw.id,
        reason:
          "Freelancer nao compareceu/desistiu (no-show) — reabrir para substituto",
      });
      toast.success(
        "Vaga reaberta. Aceite um novo freelancer (sem nova cobrança).",
      );
      setDetalhe(null);
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
      toast.error(
        getAxiosErrorMessage(err, "Falha ao desvincular o freelancer."),
      );
    }
  };

  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRefundType, setCancelRefundType] = useState<RefundType>("FULL");
  const cancelMutation = useAdminCancelCasaVacancy();

  const openCancelModal = (row: Row) => {
    setCancelTarget(row);
    setCancelReason("");
    setCancelRefundType("FULL");
  };

  const closeCancelModal = () => {
    if (cancelMutation.isPending) return;
    setCancelTarget(null);
    setCancelReason("");
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
        refundType: cancelRefundType,
      });
      if (result.refundAmount > 0) {
        const valor = (result.refundAmount / 100).toFixed(2).replace(".", ",");
        const tipo =
          result.refundType === "FULL" ? "integral" : "parcial (50%)";
        toast.success(
          `Vaga cancelada. Estorno ${tipo} de R$ ${valor} processado.`,
        );
      } else {
        toast.success("Vaga cancelada com sucesso.");
      }
      setCancelTarget(null);
      setCancelReason("");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Falha ao cancelar a vaga."));
    }
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

  const allRows: Row[] = vacancies?.map(mapToRow) ?? [];
  const rows =
    statusFilter === "all"
      ? allRows
      : allRows.filter((r) => r.status === statusFilter);

  const columns = [
    {
      header: "Empresa",
      accessor: "empresa" as const,
      sortable: true,
      sortAccessor: (r: Row) => r.empresa,
    },
    {
      header: "Serviço",
      accessor: "cargo" as const,
      sortable: true,
      sortAccessor: (r: Row) => r.cargo,
    },
    {
      header: "Lugar",
      accessor: "lugar" as const,
      className: "hidden md:table-cell",
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
      header: "Valor",
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
    },
    {
      header: "Disparo",
      accessor: (row: Row) => (
        // MESMO componente de Empresa: o anúncio no grupo é best-effort, e sem
        // esta coluna ninguém percebe quando ele não sai.
        <VacancyDispatchCell
          vacancyId={row.id}
          record={registrosDisparo.get(`${row.id}::${GROUP_BROADCAST_STAGE}`)}
          module="casa"
        />
      ),
      className: "hidden lg:table-cell",
    },
    {
      header: "Status",
      accessor: (row: Row) => <StatusBadge status={row.status} />,
    },
    {
      header: "Ações",
      accessor: (row: Row) => (
        <div className="flex items-center gap-1">
          {/* O olhinho que faltava: abre o mesmo card de detalhes do painel,
              com o fluxo completo da vaga. */}
          <button
            onClick={() => setDetalhe(row)}
            className="cursor-pointer rounded-md p-1.5 text-[#737373] transition-colors hover:bg-[#eca826]/10 hover:text-[#eca826]"
            title="Ver detalhes e o fluxo da vaga"
          >
            <Eye className="h-4 w-4" />
          </button>
          {row.status !== "cancelled" ? (
            <button
              onClick={() => openCancelModal(row)}
              className="p-1.5 rounded-md text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
              title="Cancelar vaga"
            >
              <XCircle className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Vagas — Freela em Casa"
        description="Vagas de serviços domésticos publicadas pelos contratantes"
      />
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setModoPainel((v) => !v)}
          title="Vagas em colunas por etapa, para acompanhar na TV"
          className="cursor-pointer rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-medium text-[#1d1d1b] transition-colors hover:bg-[#f7f7f7]"
        >
          {modoPainel ? "Ver tabela" : "Modo painel"}
        </button>
      </div>

      {modoPainel ? (
        <VacancyBoard
          // `allRows`: as colunas JÁ são o recorte por etapa, então o filtro de
          // status da tabela não se aplica aqui.
          vacancies={allRows.map((r) => ({
            id: r.id,
            bucket: r.bucket,
            empresa: r.empresa,
            cargo: r.cargo,
            cidade: r.lugar,
            candidatos: r.candidatos,
            valor: r.valor,
            valorCents: r.raw.payment ?? 0,
            lucroCents:
              (r.raw.platformFeeInCents ?? 0) + (r.raw.fixedFeeInCents ?? 0),
            data: r.data,
            turno: r.horario,
            freelancer: r.freelancer,
            raw: r.raw as never,
          }))}
          isFetching={isFetching}
          onSelect={(vacancyId) =>
            setDetalhe(allRows.find((r) => r.id === vacancyId) ?? null)
          }
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
            } catch (e) {
              toast.error(
                getAxiosErrorMessage(e, "Não foi possível enviar o aviso."),
              );
            } finally {
              setAvisandoId(null);
            }
          }}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Buscar por empresa..."
          searchKey="empresa"
          defaultSort={{ index: isSuperAdmin ? 5 : 4, direction: "desc" }}
          filters={
            <div className="flex flex-col gap-3">
              {isSuperAdmin && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="consultor-filter"
                    className="text-xs font-medium text-[#737373]"
                  >
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
                {statusFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === f.key
                        ? "bg-[#eca826] text-white"
                        : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]"
                    }`}
                  >
                    {f.label} (
                    {f.key === "all"
                      ? allRows.length
                      : allRows.filter((r) => r.status === f.key).length}
                    )
                  </button>
                ))}
              </div>
            </div>
          }
          footer={
            <span className="inline-flex items-center gap-1.5 text-xs text-[#737373]">
              <Users className="w-3.5 h-3.5" />
              {rows.length} vaga(s)
            </span>
          }
        />
      )}

      {/* Detalhes da vaga — o mesmo card abre pelo painel e pela tabela. */}
      <Dialog
        open={Boolean(detalhe)}
        onOpenChange={(open) => !open && setDetalhe(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogClose onClick={() => setDetalhe(null)} />
          <DialogHeader>
            <DialogTitle>{detalhe?.cargo ?? "Vaga"}</DialogTitle>
            <DialogDescription>
              {detalhe ? `${detalhe.empresa} · ${detalhe.data}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-1.5 text-sm">
              <LinhaDetalhe
                rotulo="Etapa"
                valor={ETAPA_LABEL[detalhe.bucket] ?? detalhe.bucket}
              />
              <LinhaDetalhe rotulo="Local" valor={detalhe.lugar} />
              <LinhaDetalhe rotulo="Horário" valor={detalhe.horario} />
              <LinhaDetalhe rotulo="Valor" valor={detalhe.valor} />
              <LinhaDetalhe
                rotulo="Custo (freelancer)"
                valor={
                  detalhe.raw.freelancerAmountInCents != null
                    ? `R$ ${(detalhe.raw.freelancerAmountInCents / 100).toFixed(2).replace(".", ",")}`
                    : "—"
                }
              />
              <LinhaDetalhe
                rotulo="Nossa taxa"
                valor={
                  detalhe.raw.platformFeeInCents != null
                    ? `R$ ${(detalhe.raw.platformFeeInCents / 100).toFixed(2).replace(".", ",")}`
                    : "—"
                }
              />
              <LinhaDetalhe
                rotulo="Candidaturas"
                valor={String(detalhe.candidatos)}
              />
              <LinhaDetalhe
                rotulo="Freelancer"
                valor={detalhe.freelancer ?? "—"}
              />
              {detalhe.consultor && (
                <LinhaDetalhe rotulo="Consultor" valor={detalhe.consultor} />
              )}
              <LinhaDetalhe
                rotulo="Id"
                valor={<span className="font-mono text-xs">{detalhe.id}</span>}
              />

              {/* Fluxo completo da vaga — o mesmo componente do módulo Empresa. */}
              <div className="pt-2">
                <VacancyRoadmap vacancy={detalhe.raw} />
              </div>

              <VacancyCandidacyList
                candidacies={candidacies}
                loading={loadingCandidacies}
                onConfirm={handleConfirmCandidacy}
                confirming={confirmCandidacy.isPending}
                onUnlink={({ candidacyId, providerName }) =>
                  setRemoveTarget({
                    vacancyId: detalhe.raw.id,
                    candidacyId,
                    providerName,
                  })
                }
              />

              <VacancyFeedbacksSection
                feedbacks={feedbacks}
                loading={loadingFeedbacks}
              />
            </div>
          )}
          <DialogFooter>
            {detalhe && detalhe.status !== "cancelled" && (
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
            <Button onClick={() => setDetalhe(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cancelar Vaga (admin — Casa) */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) closeCancelModal();
        }}
      >
        <DialogContent>
          <DialogClose onClick={closeCancelModal} />
          <DialogHeader>
            <DialogTitle>Cancelar Vaga</DialogTitle>
            <DialogDescription>
              Esta ação cancela todas as candidaturas e, quando houver
              pagamento, aplica o estorno que você escolher abaixo. A ação não
              pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          {cancelTarget && (
            <div className="space-y-3">
              <div className="bg-[#f7f7f7] rounded-lg p-3 text-sm">
                <p className="text-[#737373] text-xs uppercase tracking-wide">
                  Vaga
                </p>
                <p className="font-semibold text-[#1d1d1b]">
                  {cancelTarget.empresa}
                </p>
                <p className="text-xs text-[#737373]">
                  {cancelTarget.cargo} • {cancelTarget.data} •{" "}
                  {cancelTarget.horario}
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
                  placeholder="Ex.: Fraude detectada no contratante; vaga duplicada por erro; solicitação formal do contratante via suporte..."
                  className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  disabled={cancelMutation.isPending}
                />
                <p className="text-xs text-[#737373] mt-1">
                  Mínimo 5 caracteres. Ficará registrado em auditoria.
                </p>
              </div>
            </div>
          )}
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
                  O freelancer sera removido desta vaga e notificado. Se a vaga
                  estava preenchida, ela volta a ficar aberta para novos
                  candidatos. O pagamento do contratante e o job agendado sao
                  mantidos. Bloqueado se ja houve check-in, job iniciado ou
                  repasse.
                </DialogDescription>
              </DialogHeader>
              {removeTarget && (
                <div className="space-y-3">
                  <div className="bg-[#f7f7f7] rounded-lg p-3 text-sm">
                    <p className="text-[#737373] text-xs uppercase tracking-wide">
                      Freelancer
                    </p>
                    <p className="font-semibold text-[#1d1d1b]">
                      {removeTarget.providerName}
                    </p>
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
                    <p className="text-xs text-[#737373] mt-1">
                      Fica registrado no log.
                    </p>
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

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeCancelModal}
              disabled={cancelMutation.isPending}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Voltar
            </Button>
            <Button
              onClick={handleConfirmCancel}
              disabled={
                cancelMutation.isPending || cancelReason.trim().length < 5
              }
              className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
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
    </div>
  );
}

/** Rótulo em PT de cada etapa do funil, o mesmo vocabulário das colunas. */
const ETAPA_LABEL: Record<string, string> = {
  open: "Aberta · sem candidato",
  awaitingSelection: "Aguardando seleção",
  awaitingPayment: "Aguardando pagamento",
  confirmed: "Freela confirmado",
  inProgress: "Em andamento",
  completedAwaitingReview: "Aguardando avaliação",
  completedReviewed: "Concluída",
  lost: "Expirou sem contratação",
  cancelled: "Cancelada",
};

function LinhaDetalhe({
  rotulo,
  valor,
}: {
  rotulo: string;
  valor: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#f2f2f2] py-1.5 last:border-0">
      <span className="text-[#737373]">{rotulo}</span>
      <span className="text-right text-[#1d1d1b]">{valor}</span>
    </div>
  );
}

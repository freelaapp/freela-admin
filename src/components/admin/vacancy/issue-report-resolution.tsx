"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Loader2,
  Scissors,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCents } from "@/lib/money";
import {
  computeVacancyMoney,
  type VacancyMoneyInput,
} from "@/modules/admin/domain/vacancy-money";
import { brasiliaWallTimeToUtcIso } from "@/modules/admin/infrastructure/admin-vacancies-api";
import {
  JOB_ISSUE_CATEGORY_LABEL,
  type AdminJobIssueReport,
  type EarlyFinalizePartialPlan,
} from "@/modules/admin/infrastructure/issue-reports-api";
import {
  useDismissIssueReport,
  useEarlyFinalizePartial,
  usePreviewEarlyFinalizePartial,
} from "@/modules/admin/application/use-issue-reports";
import {
  getAxiosErrorMessage,
  useFinalizeVacancy,
} from "@/modules/admin/application/use-admin-cancel-vacancy";

/** Campos da vaga que a resolução precisa: id + horários (contexto) + dinheiro. */
type ResolvableVacancy = VacancyMoneyInput & {
  id: string;
  startTime?: string | null;
  endTime?: string | null;
};

/** ISO (UTC) → valor de `<input type="datetime-local">` em hora de Brasília (UTC-3). */
function isoToBrasiliaLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const shifted = new Date(d.getTime() - 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

function LinhaValor({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-2 ${
        destaque ? "border-t border-[#e5e5e5] pt-1 font-medium text-[#1d1d1b]" : ""
      }`}
    >
      <dt>{rotulo}</dt>
      <dd className="tabular-nums">{valor}</dd>
    </div>
  );
}

/**
 * Resolução de um relato de problema com a vaga (F6) pelo suporte.
 *
 * Mostra um aviso dentro do modal de detalhes quando há um relato ABERTO e abre
 * um diálogo com a justificativa do contratante e as opções de resolução:
 *  - **Encerrar mais cedo + pagamento parcial** (só vaga decomposta): calcula a
 *    prévia (`?preview=true`) — quanto o freelancer recebe pelo tempo trabalhado
 *    e quanto volta para a carteira do contratante — antes de confirmar. Fica
 *    atrás da flag `EARLY_FINALIZE_PARTIAL_ENABLED` no backend.
 *  - **Finalizar cheio** (paga 100%, "deu tudo certo").
 *  - **Cancelar + estornar** (reaproveita o fluxo de cancelamento da página).
 *  - **Arquivar relato** (sem ação financeira).
 *
 * NÃO notifica o freelancer (decisão do dono). As decisões de dinheiro/fiscal
 * são todas do admin.
 */
export function IssueReportResolution({
  vacancy,
  report,
  onResolved,
  onRequestCancel,
}: {
  vacancy: ResolvableVacancy;
  report: AdminJobIssueReport | null;
  /** Fecha o modal de detalhes e refresca (após uma resolução que grava). */
  onResolved: () => void;
  /** Abre o fluxo de cancelar + estornar da página (opcional). */
  onRequestCancel?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [actualEndAt, setActualEndAt] = useState("");
  const [overrideReais, setOverrideReais] = useState("");
  const [note, setNote] = useState("");
  const [plan, setPlan] = useState<EarlyFinalizePartialPlan | null>(null);
  const [planSig, setPlanSig] = useState("");

  const money = useMemo(() => computeVacancyMoney(vacancy), [vacancy]);
  const previewMut = usePreviewEarlyFinalizePartial();
  const executeMut = useEarlyFinalizePartial();
  const dismissMut = useDismissIssueReport();
  const finalizeMut = useFinalizeVacancy();

  const busy =
    previewMut.isPending ||
    executeMut.isPending ||
    dismissMut.isPending ||
    finalizeMut.isPending;

  if (!report) return null;
  // O TS não propaga o narrowing do guard acima para dentro dos closures abaixo
  // (buildInput/arquivar); um const não-nulo resolve — é o mesmo relato garantido.
  const activeReport = report;

  const overrideCents = overrideReais.trim()
    ? Math.round(Number(overrideReais.replace(",", ".")) * 100)
    : undefined;
  const currentSig = `${actualEndAt}|${overrideCents ?? ""}`;
  const planFresh = plan != null && planSig === currentSig;

  function abrir() {
    setActualEndAt(isoToBrasiliaLocalInput(vacancy.endTime));
    setOverrideReais("");
    setNote("");
    setPlan(null);
    setPlanSig("");
    setOpen(true);
  }

  function buildInput() {
    if (!actualEndAt) {
      toast.error("Informe o fim real do serviço.");
      return null;
    }
    const [ymd, hhmm] = actualEndAt.split("T");
    let actualEndIso: string;
    try {
      actualEndIso = brasiliaWallTimeToUtcIso(ymd, hhmm);
    } catch {
      toast.error("Fim real do serviço inválido.");
      return null;
    }
    if (overrideCents != null && (Number.isNaN(overrideCents) || overrideCents < 0)) {
      toast.error("Override do repasse inválido.");
      return null;
    }
    return {
      actualEndAt: actualEndIso,
      overrideRepasseLiquidoInCents: overrideCents,
      jobIssueReportId: activeReport.id,
      note: note.trim() || undefined,
    };
  }

  async function calcularPrevia() {
    const input = buildInput();
    if (!input) return;
    try {
      const res = await previewMut.mutateAsync({ vacancyId: vacancy.id, input });
      setPlan(res.plan);
      setPlanSig(currentSig);
    } catch (err) {
      setPlan(null);
      toast.error(getAxiosErrorMessage(err, "Não foi possível calcular a prévia."));
    }
  }

  async function encerrarParcial() {
    if (!plan) return;
    const input = buildInput();
    if (!input) return;
    if (
      !window.confirm(
        `Encerrar a vaga mais cedo com pagamento parcial?\n\n` +
          `Freelancer recebe: ${formatCents(plan.newRepasseLiquidoInCents)} (${Math.round(
            plan.proportion * 100,
          )}% do previsto)\n` +
          `Volta para a carteira do contratante: ${formatCents(plan.refundToContractorInCents)}\n\n` +
          `A vaga é fechada, o repasse é disparado e os documentos fiscais saem pelo valor parcial. Não pode ser desfeito.`,
      )
    ) {
      return;
    }
    try {
      const res = await executeMut.mutateAsync({ vacancyId: vacancy.id, input });
      if (res.repasseStatus === "COMPLETED") {
        toast.success(
          `Vaga encerrada. Repasse de ${formatCents(
            res.plan.newRepasseLiquidoInCents,
          )} pago; ${formatCents(res.refundedToContractorInCents)} na carteira do contratante.`,
        );
      } else if (res.repasseStatus === "FAILED") {
        toast.warning(
          `Vaga encerrada e ${formatCents(
            res.refundedToContractorInCents,
          )} devolvidos, mas o repasse falhou: ${
            res.repasseFailureReason ?? "motivo desconhecido"
          }. Use "pagar repasse".`,
        );
      } else {
        toast.success(
          `Vaga encerrada. ${formatCents(
            res.refundedToContractorInCents,
          )} na carteira; o repasse ainda não foi processado.`,
        );
      }
      setOpen(false);
      onResolved();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Falha ao encerrar a vaga com pagamento parcial."));
    }
  }

  async function finalizarCheio() {
    if (
      !window.confirm(
        "Finalizar esta vaga e pagar o freelancer 100%?\n\nMarca o serviço como concluído e dispara o repasse cheio (PIX) + documentos fiscais. Use quando, apesar do relato, o serviço foi cumprido. Não paga em dobro.",
      )
    ) {
      return;
    }
    try {
      const res = await finalizeMut.mutateAsync({ vacancyId: vacancy.id });
      if (res.repasseStatus === "COMPLETED") {
        toast.success("Vaga finalizada e repasse pago ao freelancer.");
      } else if (res.repasseStatus === "FAILED") {
        toast.warning(
          `Vaga finalizada, mas o repasse falhou: ${
            res.failureReason ?? "motivo desconhecido"
          }. Use "pagar repasse".`,
        );
      } else {
        toast.success("Vaga finalizada. O repasse ainda não foi processado.");
      }
      setOpen(false);
      onResolved();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Falha ao finalizar a vaga."));
    }
  }

  async function arquivar() {
    if (
      !window.confirm(
        "Arquivar este relato sem ação financeira?\n\nMarca o relato como resolvido/arquivado. Nenhum dinheiro é movimentado. Use quando o relato não procede ou já foi resolvido por fora.",
      )
    ) {
      return;
    }
    try {
      await dismissMut.mutateAsync({ id: activeReport.id, note: note.trim() || undefined });
      toast.success("Relato arquivado.");
      setOpen(false);
      onResolved();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível arquivar o relato."));
    }
  }

  const createdAt = new Date(report.createdAt);
  const createdLabel = Number.isNaN(createdAt.getTime())
    ? "—"
    : createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <>
      {/* Aviso dentro do modal de detalhes */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
        <div className="flex items-center gap-2 text-amber-900">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-sm font-semibold">
            Problema relatado pelo contratante
            <span className="font-normal text-amber-800">
              {" "}
              · {JOB_ISSUE_CATEGORY_LABEL[report.category]} · {createdLabel}
            </span>
          </p>
        </div>
        <p className="whitespace-pre-wrap break-words text-sm text-amber-900 max-h-32 overflow-y-auto">
          {report.description}
        </p>
        {report.contractorName && (
          <p className="text-xs text-amber-800">Relatado por {report.contractorName}</p>
        )}
        <Button
          onClick={abrir}
          className="bg-amber-500 text-white hover:bg-amber-600"
        >
          <Scissors className="w-4 h-4 mr-2" />
          Resolver problema
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => !o && !busy && setOpen(false)}
        className="max-w-xl"
      >
        <DialogContent>
          <DialogClose onClick={() => !busy && setOpen(false)} />
          <DialogHeader>
            <DialogTitle>Resolver problema com a vaga</DialogTitle>
            <DialogDescription>
              Justificativa do contratante e opções de resolução. O freelancer não é notificado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm max-h-[62vh] overflow-y-auto pr-1 -mr-1">
            {/* Relato */}
            <div className="rounded-lg bg-[#f7f7f7] p-3 space-y-1">
              <p className="text-xs uppercase tracking-wide text-[#737373]">
                {JOB_ISSUE_CATEGORY_LABEL[report.category]} · {createdLabel}
                {report.contractorName ? ` · ${report.contractorName}` : ""}
              </p>
              <p className="whitespace-pre-wrap break-words text-[#1d1d1b]">
                {report.description}
              </p>
            </div>

            {/* Situação atual */}
            <div className="rounded-lg bg-[#f7f7f7] p-3">
              <p className="text-xs uppercase tracking-wide text-[#737373] mb-1.5">
                Situação atual
              </p>
              <dl className="space-y-0.5 text-xs text-[#737373]">
                {money.taxaServicoCents != null && (
                  <LinhaValor rotulo="Taxa de serviço" valor={formatCents(money.taxaServicoCents)} />
                )}
                {money.pixCents != null && (
                  <LinhaValor rotulo="Taxa Pix" valor={formatCents(money.pixCents)} />
                )}
                {money.seguroCents != null && (
                  <LinhaValor rotulo="Seguro" valor={formatCents(money.seguroCents)} />
                )}
                <LinhaValor rotulo="Repasse ao freelancer" valor={formatCents(money.repasseCents)} />
                <LinhaValor
                  rotulo="Contratante pagou"
                  valor={formatCents(money.contractorPaidCents)}
                  destaque
                />
              </dl>
            </div>

            {/* Encerrar mais cedo (parcial) — só vaga decomposta */}
            {money.decomposed ? (
              <div className="rounded-lg border border-[#eca826]/40 bg-[#eca826]/5 p-3 space-y-2.5">
                <p className="text-sm font-semibold text-[#c97b0e]">
                  Encerrar mais cedo + pagamento parcial
                </p>
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1b] mb-1">
                    Fim real do serviço (quando o freelancer saiu){" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={actualEndAt}
                    onChange={(e) => setActualEndAt(e.target.value)}
                    disabled={busy}
                    className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
                  />
                  <p className="text-[11px] text-[#737373] mt-1">
                    Horário de Brasília. A proporção do tempo trabalhado define o valor.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#1d1d1b] mb-1">
                    Override do repasse (R$) — opcional
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={overrideReais}
                    onChange={(e) => setOverrideReais(e.target.value)}
                    disabled={busy}
                    placeholder="Ex.: 40,00 (só para vaga sem check-in)"
                    className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={calcularPrevia}
                  disabled={busy || !actualEndAt}
                  className="border-[#eca826]/50 text-[#c97b0e] hover:bg-[#eca826]/10"
                >
                  {previewMut.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Calculando...
                    </>
                  ) : (
                    "Calcular prévia"
                  )}
                </Button>

                {plan && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-green-700 mb-1.5">
                      Prévia ({Math.round(plan.proportion * 100)}% do tempo)
                    </p>
                    <dl className="space-y-0.5 text-xs text-green-900">
                      <LinhaValor
                        rotulo="Freelancer recebe"
                        valor={formatCents(plan.newRepasseLiquidoInCents)}
                      />
                      <LinhaValor
                        rotulo="INSS a recolher à parte"
                        valor={formatCents(plan.newInssInCents)}
                      />
                      <LinhaValor rotulo="Novo total da vaga" valor={formatCents(plan.newChargeInCents)} />
                      <LinhaValor
                        rotulo="Volta para a carteira do contratante"
                        valor={formatCents(plan.refundToContractorInCents)}
                        destaque
                      />
                    </dl>
                    {!planFresh && (
                      <p className="mt-1.5 text-[11px] font-medium text-amber-700">
                        Você mudou os dados — clique em “Calcular prévia” de novo antes de confirmar.
                      </p>
                    )}
                  </div>
                )}

                <Button
                  onClick={encerrarParcial}
                  disabled={busy || !planFresh}
                  className="w-full bg-[#eca826] text-[#1d1d1b] hover:bg-[#d4951e] disabled:opacity-50"
                >
                  {executeMut.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Encerrando...
                    </>
                  ) : (
                    <>
                      <Scissors className="w-4 h-4 mr-2" />
                      Encerrar cedo + pagar parcial
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <p className="rounded-lg bg-[#f7f7f7] p-3 text-xs text-[#737373]">
                Encerramento parcial disponível apenas para vagas com decomposição de valores
                (empresa). Para esta vaga, use finalizar cheio, cancelar + estornar ou arquivar.
              </p>
            )}

            {/* Observação do suporte (parcial / arquivar) */}
            <div>
              <label className="block text-xs font-medium text-[#1d1d1b] mb-1">
                Observação do suporte — opcional
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                disabled={busy}
                placeholder="Fica registrado no relato (motivo/decisão)."
                className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
              />
            </div>
          </div>

          <DialogFooter className="flex-wrap">
            <Button
              variant="outline"
              onClick={finalizarCheio}
              disabled={busy}
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              title="Paga o freelancer 100% (deu tudo certo apesar do relato)"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Finalizar cheio
            </Button>
            {onRequestCancel && (
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  onRequestCancel();
                }}
                disabled={busy}
                className="border-red-200 text-red-600 hover:bg-red-50"
                title="Cancela a vaga e escolhe o estorno"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Cancelar + estornar
              </Button>
            )}
            <Button
              variant="outline"
              onClick={arquivar}
              disabled={busy}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
              title="Arquiva o relato sem mexer em dinheiro"
            >
              <Archive className="w-4 h-4 mr-2" />
              Arquivar relato
            </Button>
            <Button
              variant="outline"
              onClick={() => !busy && setOpen(false)}
              disabled={busy}
              className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeSchedule } from "@/app/(auth)/campanhas-automaticas/_lib/describe-schedule";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useCampaignEstimate } from "@/modules/admin/application/use-admin-referrals";
import { useSendMarketingTemplateTest } from "@/modules/admin/application/use-marketing-templates";
import type { MarketingTemplateView } from "@/modules/admin/infrastructure/marketing-templates-api";
import {
  DEFAULT_MARKETING_PRICE_BRL,
  automaticSummary,
  audienceLabel,
  audienceSummary,
  daysLabel,
  dispatchBlocker,
  formatBrl,
  formatPrice,
  pacingLabel,
  scheduleLabel,
  type WizardKind,
  type WizardState,
  type WizardStep,
} from "../_lib/campaign-wizard";
import {
  previewButtons,
  renderMarketingText,
} from "../_lib/marketing-template-rules";
import { MarketingStatusBadge } from "./marketing-status-badge";
import { WhatsAppPreview } from "./whatsapp-preview";

function RecapCard({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-300 p-3 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="font-medium text-[#1d1d1b]">{title}</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11"
          onClick={onEdit}
        >
          Alterar
        </Button>
      </div>
      <div className="space-y-1 break-words text-neutral-700">{children}</div>
    </section>
  );
}

interface Props {
  kind: WizardKind;
  state: WizardState;
  /** Avulsa: a campanha já criada (o resumo vem da API). */
  campaignId: string | null;
  template: MarketingTemplateView | null;
  /** A biblioteca ainda está carregando: trava as ações sem acusar "não encontrado". */
  templateLoading: boolean;
  /** Avulsa criada: o público foi congelado. */
  locked: boolean;
  busy: boolean;
  /** Automática existente. */
  isEdit: boolean;
  /** Automática já ligada (não mostra "Salvar e ligar"). */
  automaticEnabled: boolean;
  onEditStep: (step: WizardStep) => void;
  onDispatch: () => void;
  onSaveAutomatic: (enable: boolean) => void;
}

/**
 * Passo 4 — Revisar (spec 2026-10-01 campanhas parte 1 §8.2): o que foi escolhido nos
 * passos 1–3 e o resumo (pessoas, custo estimado, prazo, prévia), "Enviar teste para mim"
 * e "Disparar/Agendar/Ligar" — estes só com o modelo aprovado pela Meta.
 */
export function WizardReviewStep({
  kind,
  state,
  campaignId,
  template,
  templateLoading,
  locked,
  busy,
  isEdit,
  automaticEnabled,
  onEditStep,
  onDispatch,
  onSaveAutomatic,
}: Props) {
  const estimate = useCampaignEstimate(kind === "avulsa" ? campaignId : null);
  const sendTest = useSendMarketingTemplateTest();
  const whatsapp = kind === "avulsa" || state.channels.includes("WHATSAPP");
  const blocker = templateLoading
    ? null
    : dispatchBlocker(kind, state.channels, template?.status ?? null);
  const actionLocked = templateLoading || Boolean(blocker) || busy;
  const canTest =
    whatsapp && template?.status === "APPROVED" && !sendTest.isPending;
  const autoSummary = kind === "automatica" ? automaticSummary(state) : null;
  const [testPhone, setTestPhone] = useState("");
  const [testError, setTestError] = useState<string | null>(null);
  // Automática já ligada com modelo ainda não aprovado: salvar é permitido, mas o envio espera.
  const enabledNotApproved =
    kind === "automatica" &&
    automaticEnabled &&
    whatsapp &&
    !templateLoading &&
    template?.status !== "APPROVED";

  async function handleTest() {
    if (!template) return;
    setTestError(null);
    try {
      await sendTest.mutateAsync({
        id: template.id,
        ...(campaignId ? { campaignId } : {}),
        ...(testPhone.trim() ? { phone: testPhone.trim() } : {}),
      });
      toast.success("Teste enviado para o WhatsApp. Confira no celular.");
    } catch (err) {
      setTestError(getAxiosErrorMessage(err, "O teste não saiu."));
    }
  }

  return (
    <div
      data-testid="review-layout"
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
    >
      <div className="min-w-0 space-y-3">
        <RecapCard title="1. Público" onEdit={() => onEditStep(1)}>
          <p>
            {locked ? audienceLabel(state.audience) : audienceSummary(state)}
          </p>
          {!locked && state.count && (
            <p className="text-xs text-neutral-500">
              {state.count.total} pessoas na contagem
            </p>
          )}
        </RecapCard>
        <RecapCard title="2. Mensagem" onEdit={() => onEditStep(2)}>
          {whatsapp &&
            (template ? (
              <p className="flex flex-wrap items-center gap-2">
                Modelo: <strong>{template.name}</strong>{" "}
                <MarketingStatusBadge status={template.status} />
              </p>
            ) : (
              <p>Sem modelo escolhido.</p>
            ))}
          {whatsapp &&
            (state.replyText.trim() ? (
              <p>
                Resposta automática a quem responder:{" "}
                <i>“{state.replyText.trim()}”</i>
              </p>
            ) : (
              <p>Sem resposta automática.</p>
            ))}
          {whatsapp && state.replyAlertEmail.trim() && (
            <p>Avisar respostas no e-mail: {state.replyAlertEmail.trim()}</p>
          )}
          {kind === "automatica" && state.channels.includes("PUSH") && (
            <p>
              Push: <strong>{state.pushTitle.trim()}</strong>
            </p>
          )}
        </RecapCard>
        <RecapCard title="3. Quando" onEdit={() => onEditStep(3)}>
          {kind === "avulsa" ? (
            <p>
              {state.when === "now"
                ? "Disparar agora"
                : `Agendar ${scheduleLabel(state.scheduleAt)}`}{" "}
              · {pacingLabel(state)}
            </p>
          ) : (
            <p>
              {describeSchedule({
                scheduleKind: state.scheduleKind,
                weekdays: state.weekdays,
                sendHour: state.sendHour,
                targetMonth: state.targetMonth ?? undefined,
                targetDay: state.targetDay ?? undefined,
                targetYear: state.repeatsAnnually ? null : state.targetYear,
                leadDays: state.leadDays,
              })}
              {state.maxPerRun ? ` · até ${state.maxPerRun} por execução` : ""}
            </p>
          )}
        </RecapCard>
      </div>

      <div
        data-testid="review-summary"
        className="min-w-0 rounded-lg border-2 border-[#f0a72b] p-3 sm:p-4"
      >
        <p className="text-sm font-medium text-neutral-600">Resumo</p>
        {kind === "avulsa" ? (
          estimate.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{" "}
              Calculando…
            </p>
          ) : estimate.data ? (
            <div className="space-y-1 text-sm">
              <p className="text-2xl font-bold text-[#1d1d1b]">
                {estimate.data.whatsappToSend} mensagens
              </p>
              <p>
                Custo estimado na Meta:{" "}
                <strong>~{formatBrl(estimate.data.estimatedCostBrl)}</strong>{" "}
                <span className="text-neutral-500">
                  (marketing, ~{formatPrice(estimate.data.pricePerMessageBrl)}{" "}
                  cada)
                </span>
              </p>
              <p>
                Termina em:{" "}
                <strong>
                  {daysLabel(estimate.data.estimate.days, state.weekdaysOnly)}
                </strong>
              </p>
              {estimate.data.recipients.email > 0 && (
                <p>
                  + {estimate.data.recipients.email} e-mail
                  {estimate.data.recipients.email === 1 ? "" : "s"} para quem
                  não tem telefone
                </p>
              )}
              {estimate.data.excludedByOptOut > 0 && (
                <p className="text-neutral-600">
                  {estimate.data.excludedByOptOut} já pediram para não receber
                  (ficam de fora)
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-600">
              Não deu para calcular o resumo agora.
            </p>
          )
        ) : (
          <div className="space-y-1 text-sm">
            {whatsapp &&
              (autoSummary ? (
                <>
                  <p className="text-2xl font-bold text-[#1d1d1b]">
                    {autoSummary.whatsappToSend} mensagens por execução
                  </p>
                  <p>
                    Custo estimado na Meta:{" "}
                    <strong>~{formatBrl(autoSummary.costBrl)}</strong>{" "}
                    <span className="text-neutral-500">
                      (marketing, ~{formatPrice(DEFAULT_MARKETING_PRICE_BRL)}{" "}
                      cada; contagem de hoje)
                    </span>
                  </p>
                  <p>
                    Cada execução termina em:{" "}
                    <strong>{daysLabel(autoSummary.days, true)}</strong>
                  </p>
                  {autoSummary.excludedByOptOut > 0 && (
                    <p className="text-neutral-600">
                      {autoSummary.excludedByOptOut} já pediram para não receber
                      (ficam de fora)
                    </p>
                  )}
                </>
              ) : (
                <p className="text-neutral-600">
                  Conte o público no passo 1 para ver pessoas e custo.
                </p>
              ))}
            {state.channels.includes("PUSH") && (
              <p>+ push para quem tem o app</p>
            )}
          </div>
        )}

        {whatsapp && template && (
          <div className="mt-3">
            <WhatsAppPreview
              imageUrl={template.imageUrl}
              hasImage={Boolean(template.imageKey)}
              text={renderMarketingText(template.body)}
              buttons={previewButtons(template.buttons)}
            />
          </div>
        )}

        {blocker && (
          <p
            role="alert"
            className="mt-3 rounded-md bg-amber-50 p-2 text-sm text-amber-900"
          >
            {blocker}
          </p>
        )}

        {enabledNotApproved && (
          <p
            role="status"
            className="mt-3 rounded-md bg-amber-50 p-2 text-sm text-amber-900"
          >
            O WhatsApp desta campanha só sai quando o modelo for aprovado.
          </p>
        )}

        {whatsapp && (
          <div className="mt-3 space-y-1">
            <Label htmlFor="wz-test-phone" className="text-xs">
              Celular para o teste (opcional)
            </Label>
            <Input
              id="wz-test-phone"
              type="tel"
              inputMode="tel"
              className="min-h-11"
              placeholder="Em branco = o seu celular cadastrado"
              value={testPhone}
              onChange={(event) => setTestPhone(event.target.value)}
            />
            {testError && (
              <p
                role="alert"
                data-testid="test-error"
                className="text-sm text-red-700"
              >
                {testError}
              </p>
            )}
          </div>
        )}

        <div className="sticky bottom-0 mt-3 flex flex-col gap-2 bg-white py-2 sm:static sm:flex-row sm:flex-wrap">
          {whatsapp && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={!canTest}
              onClick={handleTest}
            >
              {sendTest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Smartphone className="h-4 w-4" aria-hidden />
              )}
              Enviar teste para mim
            </Button>
          )}
          {kind === "avulsa" ? (
            <Button
              type="button"
              className="min-h-11"
              disabled={actionLocked || !campaignId}
              onClick={onDispatch}
            >
              {state.when === "now"
                ? "Disparar agora"
                : `Agendar para ${scheduleLabel(state.scheduleAt)}`}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={busy}
                onClick={() => onSaveAutomatic(false)}
              >
                {isEdit ? "Salvar alterações" : "Salvar desligada"}
              </Button>
              {!automaticEnabled && (
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={actionLocked}
                  onClick={() => onSaveAutomatic(true)}
                >
                  Salvar e ligar
                </Button>
              )}
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {kind === "avulsa"
            ? "Depois de agendada: pausar, retomar ou encerrar a qualquer momento."
            : "Ligada, roda sozinha no agendador; dá para pausar na lista a qualquer momento."}
        </p>
      </div>
    </div>
  );
}

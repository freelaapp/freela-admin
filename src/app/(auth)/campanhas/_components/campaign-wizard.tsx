"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useCreateCampaign,
  usePreviewAudience,
  useScheduleCampaign,
  useSetCampaignState,
  useUpdateCampaign,
} from "@/modules/admin/application/use-admin-referrals";
import {
  useCreateCampaignTemplate,
  useSetCampaignTemplateEnabled,
  useUpdateCampaignTemplate,
} from "@/modules/admin/application/use-campaign-templates";
import { useMarketingTemplates } from "@/modules/admin/application/use-marketing-templates";
import type { CampaignTemplate } from "@/modules/admin/infrastructure/campaign-templates-api";
import type { MarketingTemplateView } from "@/modules/admin/infrastructure/marketing-templates-api";
import type {
  BaseAudience,
  Campaign,
} from "@/modules/admin/infrastructure/referrals-api";
import {
  STEP_LABELS,
  WIZARD_STEPS,
  buildAudienceFilters,
  buildAutomaticPayload,
  buildCreatePayload,
  buildUpdatePayload,
  initialWizardState,
  scheduleIsoFromLocal,
  scheduleLabel,
  stateFromAutomatic,
  stateFromCampaign,
  stepBlockers,
  type WizardAudience,
  type WizardKind,
  type WizardState,
  type WizardStep,
} from "../_lib/campaign-wizard";
import { WizardAudienceStep } from "./wizard-audience-step";
import { WizardMessageStep } from "./wizard-message-step";
import { WizardReviewStep } from "./wizard-review-step";
import { WizardWhenStep } from "./wizard-when-step";

export interface CampaignWizardProps {
  open: boolean;
  kind: WizardKind;
  onOpenChange: (open: boolean) => void;
  /** E-mail do admin logado: padrão de "E-mail que recebe as respostas". */
  adminEmail: string;
  /** Avulsa: público inicial (ex.: "Nova campanha por planilha"). */
  initialAudience?: WizardAudience;
  /** "Usar" na aba Modelos. */
  initialTemplateId?: string | null;
  /** Avulsa em rascunho: abre no passo 4 com a campanha já criada. */
  resumeCampaign?: Campaign | null;
  /** Automática existente: editar. */
  editAutomatic?: CampaignTemplate | null;
  /** Avulsa disparada/agendada (id) ou automática salva. */
  onDone: (result: { campaignId?: string }) => void;
}

/**
 * "Nova campanha em 4 passos" (spec 2026-10-01 campanhas parte 1 §8.2), a mesma para a
 * avulsa e a automática — substitui os dois formulários longos. Avulsa: o passo 3 cria a
 * campanha como rascunho (o público é congelado) e o passo 4 dispara ou agenda. Automática:
 * o passo 4 salva (desligada) ou salva e liga.
 */
export function CampaignWizard({
  open,
  kind,
  onOpenChange,
  adminEmail,
  initialAudience,
  initialTemplateId,
  resumeCampaign,
  editAutomatic,
  onDone,
}: CampaignWizardProps) {
  const templatesQuery = useMarketingTemplates();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();
  const scheduleCampaign = useScheduleCampaign();
  const setCampaignState = useSetCampaignState();
  const createAutomatic = useCreateCampaignTemplate();
  const updateAutomatic = useUpdateCampaignTemplate();
  const setAutomaticEnabled = useSetCampaignTemplateEnabled();
  const previewAudience = usePreviewAudience();

  const [step, setStep] = useState<WizardStep>(1);
  const [state, setState] = useState<WizardState>(() =>
    initialWizardState(kind, { adminEmail }),
  );
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [automaticId, setAutomaticId] = useState<string | null>(null);
  const [extraTemplate, setExtraTemplate] =
    useState<MarketingTemplateView | null>(null);
  const wasOpen = useRef(false);

  // Reinicia só quando ABRE: a página recarrega a lista a cada minuto e entregaria um
  // objeto novo de campanha/automática no meio do preenchimento.
  useEffect(() => {
    if (open && !wasOpen.current) {
      if (kind === "avulsa" && resumeCampaign) {
        setState(stateFromCampaign(resumeCampaign, adminEmail));
        setCampaignId(resumeCampaign.id);
        setStep(4);
      } else if (kind === "automatica" && editAutomatic) {
        setState(stateFromAutomatic(editAutomatic, adminEmail));
        setCampaignId(null);
        setStep(1);
      } else {
        setState(
          initialWizardState(kind, {
            adminEmail,
            audience: initialAudience,
            marketingTemplateId: initialTemplateId ?? null,
          }),
        );
        setCampaignId(null);
        setStep(1);
      }
      setAutomaticId(
        kind === "automatica" && editAutomatic ? editAutomatic.id : null,
      );
      setExtraTemplate(null);
    }
    wasOpen.current = open;
  }, [
    open,
    kind,
    adminEmail,
    initialAudience,
    initialTemplateId,
    resumeCampaign,
    editAutomatic,
  ]);

  // Modelo escrito agora (editor) aparece antes de a lista recarregar.
  const templates = useMemo(() => {
    const list = templatesQuery.data ?? [];
    return extraTemplate && !list.some((t) => t.id === extraTemplate.id)
      ? [extraTemplate, ...list]
      : list;
  }, [templatesQuery.data, extraTemplate]);
  const selectedTemplate =
    templates.find((t) => t.id === state.marketingTemplateId) ?? null;

  const locked = kind === "avulsa" && Boolean(campaignId);
  const patch = (next: Partial<WizardState>) =>
    setState((current) => ({ ...current, ...next }));
  const busy =
    createCampaign.isPending ||
    updateCampaign.isPending ||
    scheduleCampaign.isPending ||
    setCampaignState.isPending ||
    createAutomatic.isPending ||
    updateAutomatic.isPending ||
    setAutomaticEnabled.isPending ||
    previewAudience.isPending;

  // Com a campanha criada, o público ficou congelado: no passo 1 só o nome conta.
  const blockers =
    step === 4
      ? []
      : step === 1 && locked
        ? state.name.trim()
          ? []
          : ["Dê um nome à campanha."]
        : stepBlockers(state, step, kind);

  const title =
    kind === "avulsa"
      ? resumeCampaign
        ? "Revisar campanha"
        : "Nova campanha"
      : editAutomatic
        ? "Editar campanha automática"
        : "Nova campanha automática";
  const continueLabel =
    step === 3 && kind === "avulsa"
      ? campaignId
        ? "Salvar e revisar"
        : "Criar e revisar"
      : "Continuar";

  async function goNext() {
    if (blockers.length > 0) return;
    if (step < 3) {
      setStep((step + 1) as WizardStep);
      return;
    }
    if (kind === "avulsa") {
      try {
        if (campaignId) {
          await updateCampaign.mutateAsync({
            id: campaignId,
            payload: buildUpdatePayload(state),
          });
        } else {
          const created = await createCampaign.mutateAsync(
            buildCreatePayload(state),
          );
          setCampaignId(created.campaign.id);
          toast.success("Campanha criada como rascunho. Revise e dispare.");
        }
        setStep(4);
      } catch (err) {
        toast.error(
          getAxiosErrorMessage(err, "Não foi possível salvar a campanha."),
        );
      }
      return;
    }
    // Automática: conta o público de hoje para o resumo, se ainda não contou.
    if (!state.count && state.channels.includes("WHATSAPP")) {
      try {
        const res = await previewAudience.mutateAsync({
          audience: state.audience as BaseAudience,
          filters: buildAudienceFilters(state, "automatica"),
        });
        patch({
          count: {
            total: res.total,
            whatsapp: res.byChannel.WHATSAPP,
            email: res.byChannel.EMAIL,
            excludedByOptOut: res.excludedByOptOut ?? 0,
            semCoordenada: res.semCoordenada ?? 0,
          },
        });
      } catch (err) {
        toast.error(
          getAxiosErrorMessage(
            err,
            "Não deu para contar o público agora; o resumo fica sem a contagem.",
          ),
        );
      }
    }
    setStep(4);
  }

  async function handleDispatch() {
    if (!campaignId) return;
    try {
      if (state.when === "schedule") {
        await scheduleCampaign.mutateAsync({
          id: campaignId,
          startAt: scheduleIsoFromLocal(state.scheduleAt),
        });
        toast.success(
          `Campanha agendada para ${scheduleLabel(state.scheduleAt)}.`,
        );
      } else {
        await setCampaignState.mutateAsync({ id: campaignId, action: "start" });
        toast.success("Disparo iniciado.");
      }
      onDone({ campaignId });
      onOpenChange(false);
    } catch (err) {
      toast.error(
        getAxiosErrorMessage(err, "Não foi possível disparar a campanha."),
      );
    }
  }

  async function handleSaveAutomatic(enable: boolean) {
    const payload = buildAutomaticPayload(state);
    try {
      // Depois do 1º salvamento, o resto edita a mesma automática (não cria outra).
      const saved = automaticId
        ? await updateAutomatic.mutateAsync({ id: automaticId, payload })
        : await createAutomatic.mutateAsync(payload);
      setAutomaticId(saved.id);
      if (enable) {
        await setAutomaticEnabled.mutateAsync({ id: saved.id, enabled: true });
        toast.success("Campanha automática salva e ligada.");
      } else {
        toast.success(
          editAutomatic
            ? "Campanha automática atualizada."
            : "Campanha automática salva, desligada.",
        );
      }
      onDone({});
      onOpenChange(false);
    } catch (err) {
      toast.error(
        getAxiosErrorMessage(
          err,
          "Não foi possível salvar a campanha automática.",
        ),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-4xl">
      <DialogContent className="max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {kind === "avulsa"
              ? "Um passo por vez, com resumo no final. Nada sai antes de você disparar ou agendar."
              : "Um passo por vez. Depois de ligada, roda sozinha no agendador."}
          </DialogDescription>
        </DialogHeader>

        <ol
          data-testid="wizard-steps"
          className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {WIZARD_STEPS.map((s) => {
            const done = s < step;
            const current = s === step;
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={!done}
                  onClick={() => setStep(s)}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-1.5 rounded-md px-2 text-left text-sm",
                    current
                      ? "bg-[#f0a72b] font-bold text-[#1a1a1a]"
                      : done
                        ? "bg-green-200 text-green-900"
                        : "bg-neutral-100 text-neutral-500",
                  )}
                >
                  {done && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                  {s}. {STEP_LABELS[s]}
                </button>
              </li>
            );
          })}
        </ol>

        {step === 1 && (
          <WizardAudienceStep
            kind={kind}
            state={state}
            onChange={patch}
            locked={locked}
          />
        )}
        {step === 2 && (
          <WizardMessageStep
            kind={kind}
            state={state}
            onChange={patch}
            templates={templates}
            selectedTemplate={selectedTemplate}
            onTemplateCreated={setExtraTemplate}
            templatesLoading={templatesQuery.isLoading}
          />
        )}
        {step === 3 && (
          <WizardWhenStep
            kind={kind}
            state={state}
            onChange={patch}
            created={Boolean(campaignId)}
          />
        )}
        {step === 4 && (
          <WizardReviewStep
            kind={kind}
            state={state}
            campaignId={campaignId}
            template={selectedTemplate}
            templateLoading={templatesQuery.isLoading}
            locked={locked}
            busy={busy}
            isEdit={Boolean(editAutomatic)}
            automaticEnabled={Boolean(editAutomatic?.enabled)}
            onEditStep={setStep}
            onDispatch={handleDispatch}
            onSaveAutomatic={handleSaveAutomatic}
          />
        )}

        {step < 4 ? (
          <div className="mt-6 space-y-2">
            {blockers.length > 0 && (
              <p
                data-testid="step-blocker"
                className="text-xs text-neutral-600"
              >
                {blockers[0]}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  step === 1
                    ? onOpenChange(false)
                    : setStep((step - 1) as WizardStep)
                }
              >
                {step === 1 ? "Cancelar" : "Voltar"}
              </Button>
              <Button
                type="button"
                className="min-h-11"
                disabled={blockers.length > 0 || busy}
                onClick={goNext}
              >
                {busy && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                )}
                {continueLabel}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setStep(3)}
            >
              Voltar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

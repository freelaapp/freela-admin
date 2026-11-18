"use client";

import { AlertTriangle, ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type {
  PipelineMessageKey,
  PipelineSettings,
  PipelineStageMessage,
} from "@/modules/admin/infrastructure/crm-api";
import { stageSummary, type StageDraft, type StageDrafts } from "./stage-messages";

interface Props {
  settings: PipelineSettings;
  stages: PipelineStageMessage[];
  drafts: StageDrafts;
  onChange: (key: PipelineMessageKey, next: StageDraft) => void;
}

/**
 * "Mensagem por etapa" dentro de "Configurar mensagem": para cada coluna do funil (e a aba
 * dos cadastros antigos), o modelo aprovado que sai no botão de enviar. Fechadas por padrão,
 * com um resumo de uma linha — no celular, seis formulários abertos seriam uma parede.
 */
export function StageMessagesSection({ settings, stages, drafts, onChange }: Props) {
  // Opções do seletor: os aprovados + o que já está escolhido em alguma etapa (mesmo pausado).
  const nameById = new Map<string, string>();
  for (const t of settings.availableTemplates) nameById.set(t.id, t.name);
  for (const s of stages) if (s.template) nameById.set(s.template.id, s.template.name);
  const templateName = (id: string) => nameById.get(id) ?? null;

  return (
    <section className="space-y-3" aria-labelledby="pipeline-stage-messages-title">
      <div>
        <h3 id="pipeline-stage-messages-title" className="text-sm font-semibold text-[#1d1d1b]">
          Mensagem por etapa
        </h3>
        <p className="text-xs text-[#737373]">
          Escolha o modelo aprovado que sai em cada etapa quando você aperta o botão de enviar no
          cartão. Etapa sem modelo usa a mensagem geral acima. O envio continua manual.
        </p>
      </div>

      <div className="space-y-2">
        {stages.map((stage) => {
          const draft = drafts[stage.key] ?? { templateId: "" };
          const summary = stageSummary(draft, templateName);
          const chosenPaused =
            !!draft.templateId &&
            stage.template?.id === draft.templateId &&
            stage.template.status !== "APPROVED"
              ? stage.template.statusLabel
              : null;
          const options = [
            ...settings.availableTemplates.map((t) => ({ id: t.id, name: t.name })),
            ...(stage.template && !settings.availableTemplates.some((t) => t.id === stage.template!.id)
              ? [{ id: stage.template.id, name: `${stage.template.name} (${stage.template.statusLabel})` }]
              : []),
          ];
          const selectId = `stage-${stage.key}-template`;
          return (
            <details
              key={stage.key}
              className="group rounded-lg border border-[#e5e5e5] bg-white"
              data-testid={`etapa-${stage.key}`}
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                  {stage.key === "CADASTROS_ANTIGOS" && (
                    <span className="block text-[10px] uppercase tracking-wide text-[#a3a3a3]">
                      Aba Cadastros antigos
                    </span>
                  )}
                  <span className="block text-sm font-medium text-[#1d1d1b]">{stage.label}</span>
                  <span
                    className={`flex items-start gap-1 text-xs ${
                      summary.warn ? "text-[#b45309]" : "text-[#737373]"
                    }`}
                  >
                    {summary.warn && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />}
                    {summary.text}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#737373] transition-transform group-open:rotate-180" />
              </summary>

              <div className="space-y-1 border-t border-[#f1f1f1] px-3 py-3">
                <Label htmlFor={selectId}>Modelo aprovado</Label>
                <NativeSelect
                  id={selectId}
                  value={draft.templateId}
                  onChange={(e) => onChange(stage.key, { templateId: e.target.value })}
                >
                  <option value="">Usar a mensagem geral</option>
                  {options.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
                {chosenPaused && (
                  <p className="flex items-start gap-1 text-xs text-red-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Este modelo está {chosenPaused}: os envios desta etapa são recusados até
                    você escolher outro.
                  </p>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

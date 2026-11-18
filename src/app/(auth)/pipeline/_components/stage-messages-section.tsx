"use client";

import { AlertTriangle, ChevronDown, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type {
  PipelineMessageKey,
  PipelineSettings,
  PipelineStageMessage,
} from "@/modules/admin/infrastructure/crm-api";
import {
  STAGE_FREE_TEXT_MAX_DEFAULT,
  freeTextPreview,
  freeTextProblem,
  stageSummary,
  type StageDraft,
  type StageDrafts,
} from "./stage-messages";

const INSERTABLE = ["{primeiro_nome}", "{cidade}", "{link_marketing}"];

interface Props {
  settings: PipelineSettings;
  stages: PipelineStageMessage[];
  drafts: StageDrafts;
  onChange: (key: PipelineMessageKey, next: StageDraft) => void;
}

/**
 * "Mensagem por etapa" dentro de "Configurar mensagem": para cada coluna do funil (e a aba
 * dos cadastros antigos), o modelo aprovado e um texto livre opcional. Fechadas por padrão,
 * com um resumo de uma linha — no celular, seis formulários abertos seriam uma parede.
 */
export function StageMessagesSection({ settings, stages, drafts, onChange }: Props) {
  const max = settings.stageFreeTextMax ?? STAGE_FREE_TEXT_MAX_DEFAULT;
  const hours = settings.serviceWindowHours ?? 24;
  const sends = settings.stageFreeTextSends === true;

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
          Escolha o que sai em cada etapa quando você aperta o botão de enviar no cartão. Etapa
          sem nada escolhido usa a mensagem geral acima. O envio continua manual.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-[#f7f7f7] p-3 text-xs text-[#525252]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#737373]" />
        <p>
          O texto livre só pode sair se o contratante mandou mensagem para o nosso número oficial
          nas últimas {hours} horas. Fora desse prazo, o WhatsApp só deixa sair modelo aprovado
          pela Meta. Por isso, toda etapa com texto livre precisa de um modelo.
          {!sends && (
            <>
              {" "}
              <strong className="font-semibold text-[#1d1d1b]">
                Por enquanto o painel ainda não envia o texto livre:
              </strong>{" "}
              ele fica salvo, e sai o modelo da etapa.
            </>
          )}
        </p>
      </div>

      <div className="space-y-2">
        {stages.map((stage) => {
          const draft = drafts[stage.key] ?? { templateId: "", freeText: "" };
          const summary = stageSummary(draft, templateName);
          const problem = draft.freeText.trim() ? freeTextProblem(draft.freeText, max) : null;
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
          const textId = `stage-${stage.key}-text`;
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
                  {/* Erro no texto aparece JÁ no resumo: com a etapa fechada, o "Salvar"
                      desligado não teria explicação à vista. */}
                  <span
                    className={`flex items-start gap-1 text-xs ${
                      problem ? "text-red-600" : summary.warn ? "text-[#b45309]" : "text-[#737373]"
                    }`}
                  >
                    {(problem || summary.warn) && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />}
                    {problem ? `Texto livre com erro: ${problem}` : summary.text}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#737373] transition-transform group-open:rotate-180" />
              </summary>

              <div className="space-y-3 border-t border-[#f1f1f1] px-3 py-3">
                <div className="space-y-1">
                  <Label htmlFor={selectId}>Modelo aprovado</Label>
                  <NativeSelect
                    id={selectId}
                    value={draft.templateId}
                    onChange={(e) => onChange(stage.key, { ...draft, templateId: e.target.value })}
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

                <div className="space-y-1">
                  <Label htmlFor={textId}>
                    Texto livre (opcional, só sai dentro das {hours} h)
                  </Label>
                  <textarea
                    id={textId}
                    rows={3}
                    value={draft.freeText}
                    onChange={(e) => onChange(stage.key, { ...draft, freeText: e.target.value })}
                    placeholder="Oi, {primeiro_nome}! ..."
                    className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm text-[#1d1d1b] placeholder:text-[#a3a3a3] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {INSERTABLE.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() =>
                          onChange(stage.key, {
                            ...draft,
                            freeText: `${draft.freeText}${
                              draft.freeText && !draft.freeText.endsWith(" ") ? " " : ""
                            }${variable}`,
                          })
                        }
                        className="min-h-8 rounded-md border border-[#e5e5e5] bg-[#f7f7f7] px-2 text-xs text-[#1d1d1b] hover:bg-[#efefef]"
                      >
                        {variable}
                      </button>
                    ))}
                  </div>
                  {problem ? (
                    <p className="text-xs text-red-600">{problem}</p>
                  ) : (
                    <p className="text-xs text-[#737373]">
                      Em branco, sai o modelo. {draft.freeText.trim().length} de {max} caracteres.
                    </p>
                  )}
                </div>

                {draft.freeText.trim() && !draft.templateId && (
                  <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-[#92400e]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Esta etapa só tem texto livre. Se o contratante não falou com o número oficial
                    nas últimas {hours} h, nada é enviado e a mensagem geral não entra no lugar.
                    Escolha um modelo para garantir o envio.
                  </p>
                )}

                {draft.freeText.trim() && (
                  <div className="rounded-lg bg-[#f7f7f7] p-3">
                    <p className="mb-1 text-[11px] font-medium text-[#737373]">
                      Como a pessoa recebe (exemplo)
                    </p>
                    <p className="whitespace-pre-wrap break-words text-xs text-[#1d1d1b]">
                      {freeTextPreview(draft.freeText, settings.marketingWhatsapp.whatsappUrl)}
                    </p>
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

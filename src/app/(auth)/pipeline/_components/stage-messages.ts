import type {
  PipelineMessageKey,
  PipelineSettings,
  PipelineStageMessage,
  UpdatePipelineSettingsInput,
} from "@/modules/admin/infrastructure/crm-api";

/**
 * Mensagem por etapa do Pipeline — regras puras do formulário. O produto (Denner, 18/11/2026) é
 * "um modelo aprovado salvo para cada etapa": etapa sem modelo usa a mensagem geral. O texto
 * livre por etapa não é enviado; a tela não o mostra e o PUT não o manda (a API guarda o que já
 * estiver salvo).
 */

export interface StageDraft {
  /** "" = usar a mensagem geral. */
  templateId: string;
}

export type StageDrafts = Partial<Record<PipelineMessageKey, StageDraft>>;

/** O formulário nasce com o que está salvo. */
export function draftsFrom(stages: PipelineStageMessage[]): StageDrafts {
  const out: StageDrafts = {};
  for (const stage of stages) {
    out[stage.key] = { templateId: stage.templateId ?? "" };
  }
  return out;
}

/**
 * O que vai no PUT: as 6 etapas, só o modelo ("" vira `null` = mensagem geral). A etapa que
 * ninguém mexeu volta com o modelo salvo, então salvar o diálogo não apaga nada. Nunca leva
 * `freeText`.
 */
export function stageMessagesPayload(
  stages: PipelineStageMessage[],
  drafts: StageDrafts,
): NonNullable<UpdatePipelineSettingsInput["stageMessages"]> {
  const out: NonNullable<UpdatePipelineSettingsInput["stageMessages"]> = {};
  for (const stage of stages) {
    const draft = drafts[stage.key];
    out[stage.key] = { templateId: draft?.templateId.trim() || null };
  }
  return out;
}

/** Resumo de uma linha da etapa, para a lista fechada. */
export function stageSummary(
  draft: StageDraft | undefined,
  templateName: (id: string) => string | null,
): { text: string; warn: boolean } {
  const templateId = draft?.templateId.trim() ?? "";
  if (!templateId) return { text: "Usa a mensagem geral", warn: false };
  const nome = templateName(templateId);
  // Modelo apagado depois de escolhido: o envio seria recusado; diz já na lista fechada.
  if (!nome) return { text: "Modelo não encontrado: escolha outro", warn: true };
  return { text: `Modelo: ${nome}`, warn: false };
}

/** A API devolveu a mensagem por etapa? (API anterior a 18/11/2026 não devolve.) */
export function hasStageMessages(
  settings: PipelineSettings,
): settings is PipelineSettings & { stageMessages: PipelineStageMessage[] } {
  return Array.isArray(settings.stageMessages) && settings.stageMessages.length > 0;
}

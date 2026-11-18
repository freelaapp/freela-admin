import type {
  PipelineMessageKey,
  PipelineSettings,
  PipelineStageMessage,
  UpdatePipelineSettingsInput,
} from "@/modules/admin/infrastructure/crm-api";

/**
 * Mensagem por etapa do Pipeline — regras puras do formulário (espelho da API de 18/11/2026).
 * Etapa sem nada = vale a mensagem geral; modelo é o que sai fora da janela de 24 h; texto
 * livre só dentro dela (e, por enquanto, o painel ainda não o envia).
 */

export interface StageDraft {
  /** "" = usar a mensagem geral. */
  templateId: string;
  freeText: string;
}

export type StageDrafts = Partial<Record<PipelineMessageKey, StageDraft>>;

export const STAGE_FREE_TEXT_MAX_DEFAULT = 1000;
const KNOWN_VARIABLES = ["nome", "primeiro_nome", "cidade", "link_marketing"];

/** O formulário nasce com o que está salvo. */
export function draftsFrom(stages: PipelineStageMessage[]): StageDrafts {
  const out: StageDrafts = {};
  for (const stage of stages) {
    out[stage.key] = { templateId: stage.templateId ?? "", freeText: stage.freeText ?? "" };
  }
  return out;
}

/** O que vai no PUT: as 6 etapas, vazio virando `null` (etapa vazia = mensagem geral). */
export function stageMessagesPayload(
  stages: PipelineStageMessage[],
  drafts: StageDrafts,
): NonNullable<UpdatePipelineSettingsInput["stageMessages"]> {
  const out: NonNullable<UpdatePipelineSettingsInput["stageMessages"]> = {};
  for (const stage of stages) {
    const draft = drafts[stage.key];
    out[stage.key] = {
      templateId: draft?.templateId.trim() || null,
      freeText: draft?.freeText.trim() || null,
    };
  }
  return out;
}

/** Erro do texto livre para mostrar embaixo do campo (a API confere de novo ao salvar). */
export function freeTextProblem(text: string, max = STAGE_FREE_TEXT_MAX_DEFAULT): string | null {
  const value = text.trim();
  if (value.length > max) return `${value.length} de ${max} caracteres: encurte o texto.`;
  const unknown = [...value.matchAll(/\{([^{}]*)\}/g)]
    .map((m) => m[1])
    .filter((name) => !KNOWN_VARIABLES.includes(name));
  if (unknown.length > 0) {
    return `Variável desconhecida: {${[...new Set(unknown)].join("}, {")}}. Use as dos botões abaixo.`;
  }
  return null;
}

/** Resumo de uma linha da etapa, para a lista fechada. */
export function stageSummary(
  draft: StageDraft | undefined,
  templateName: (id: string) => string | null,
): { text: string; warn: boolean } {
  const templateId = draft?.templateId.trim() ?? "";
  const freeText = draft?.freeText.trim() ?? "";
  if (!templateId && !freeText) return { text: "Usa a mensagem geral", warn: false };
  if (!templateId) return { text: "Só texto livre: fora das 24 h não envia", warn: true };
  const nome = templateName(templateId);
  // Modelo apagado depois de escolhido: o envio seria recusado; diz já na lista fechada.
  if (!nome) return { text: "Modelo não encontrado: escolha outro", warn: true };
  return { text: freeText ? `Modelo: ${nome} + texto livre` : `Modelo: ${nome}`, warn: false };
}

/** Prévia do texto livre com valores de exemplo (os mesmos dos modelos). */
export function freeTextPreview(text: string, marketingUrl: string): string {
  return text
    .split("{primeiro_nome}")
    .join("Maria")
    .split("{nome}")
    .join("Maria Souza")
    .split("{cidade}")
    .join("Campinas")
    .split("{link_marketing}")
    .join(marketingUrl)
    .trim();
}

/** A API devolveu a mensagem por etapa? (API anterior a 18/11/2026 não devolve.) */
export function hasStageMessages(
  settings: PipelineSettings,
): settings is PipelineSettings & { stageMessages: PipelineStageMessage[] } {
  return Array.isArray(settings.stageMessages) && settings.stageMessages.length > 0;
}

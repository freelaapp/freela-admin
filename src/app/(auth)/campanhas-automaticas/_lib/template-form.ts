/**
 * Funções puras do diálogo criar/editar de template: montar o recorte de
 * público e o payload da API a partir do formulário, e o caminho inverso
 * (template existente → valores do formulário) para o modo edição. Nada
 * aqui toca DOM, rede ou estado — dá para testar sem montar o componente.
 */
import {
  normalizeTemplatePlaceholders,
  renderPreview,
} from "@/modules/admin/application/spreadsheet-contacts";
import type { AudienceFilters } from "@/modules/admin/infrastructure/referrals-api";
import type {
  CampaignTemplate,
  UpsertCampaignTemplatePayload,
} from "@/modules/admin/infrastructure/campaign-templates-api";
import { DEFAULT_TEMPLATE_FORM_VALUES, type TemplateFormValues } from "./template-schema";

/** A API separa as variantes do WhatsApp por uma linha só com `---` (mesma convenção de `(auth)/campanhas`). */
export const VARIANT_SEPARATOR = "\n---\n";

/**
 * Monta o recorte a partir do formulário. Devolve `undefined` quando não há
 * nenhum filtro — objeto de listas vazias gravaria "filtrado por nada", que
 * é diferente de "sem filtro". Espelha `montarFiltros` de `(auth)/campanhas`
 * (raio e lista de cidades são alternativas; com raio, a lista é ignorada).
 */
export function buildAudienceFilters(f: {
  cities: string[];
  modules: TemplateFormValues["modules"];
  raioCidade: string;
  raioKm: number;
}): AudienceFilters | undefined {
  const raio =
    f.raioCidade.trim() && f.raioKm > 0 ? { city: f.raioCidade.trim(), km: f.raioKm } : undefined;
  const cities = raio ? [] : f.cities;
  if (!cities.length && !f.modules.length && !raio) return undefined;
  return {
    ...(cities.length ? { cities } : {}),
    ...(f.modules.length ? { modules: f.modules } : {}),
    ...(raio ? { radius: raio } : {}),
  };
}

/** Junta as 3 variantes num único texto, no formato que a API espera. */
export function joinWhatsappVariants(variants: readonly string[]): string {
  return variants.map((v) => normalizeTemplatePlaceholders(v).trim()).join(VARIANT_SEPARATOR);
}

/** Caminho inverso: texto salvo → as 3 variantes editáveis (edição). */
export function splitWhatsappVariants(template: string | null | undefined): [string, string, string] {
  if (!template) return ["", "", ""];
  const parts = template.split(VARIANT_SEPARATOR);
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}

/** Prévia de uma variante com um nome de exemplo — mesma função do item #1. */
export function previewVariant(text: string, sampleName = "José da Silva"): string {
  return renderPreview(text, sampleName);
}

/**
 * Formulário validado → payload da API. Só WEEKLY manda `weekdays`+`sendHour`;
 * só DATED manda `targetMonth`+`targetDay`+`leadDays` (e `targetYear` some
 * quando "repetir todo ano" está marcado). Só o canal ligado manda seu
 * conteúdo — desligar PUSH depois de preencher título/corpo não devia
 * mandar lixo pro backend.
 */
export function buildTemplatePayload(values: TemplateFormValues): UpsertCampaignTemplatePayload {
  const audienceFilters = buildAudienceFilters(values);

  const schedule: Partial<UpsertCampaignTemplatePayload> =
    values.scheduleKind === "WEEKLY"
      ? { weekdays: values.weekdays, sendHour: values.sendHour }
      : {
          targetMonth: values.targetMonth,
          targetDay: values.targetDay,
          targetYear: values.repeatsAnnually ? undefined : values.targetYear,
          leadDays: values.leadDays,
        };

  return {
    name: values.name.trim(),
    scheduleKind: values.scheduleKind,
    ...schedule,
    audience: values.audience,
    ...(audienceFilters ? { audienceFilters } : {}),
    channels: values.channels,
    ...(values.channels.includes("WHATSAPP")
      ? { whatsappTemplate: joinWhatsappVariants(values.whatsappVariants) }
      : {}),
    ...(values.channels.includes("PUSH")
      ? { pushTitle: values.pushTitle.trim(), pushBody: values.pushBody.trim() }
      : {}),
    ...(values.imageKey ? { imageKey: values.imageKey } : {}),
    ...(values.deepLink.trim() ? { deepLink: values.deepLink.trim() } : {}),
    messagesPerHour: values.messagesPerHour,
    dailyCap: values.dailyCap,
    windowStartHour: values.windowStartHour,
    windowEndHour: values.windowEndHour,
    weekdaysOnly: values.weekdaysOnly,
    ...(values.maxPerRun ? { maxPerRun: values.maxPerRun } : {}),
  };
}

/** Template existente (edição) → valores do formulário. Caminho inverso de `buildTemplatePayload`. */
export function templateToFormValues(template: CampaignTemplate): TemplateFormValues {
  const filters = template.audienceFilters;
  return {
    ...DEFAULT_TEMPLATE_FORM_VALUES,
    name: template.name,
    scheduleKind: template.scheduleKind,
    weekdays: template.weekdays ?? [],
    sendHour: template.sendHour ?? DEFAULT_TEMPLATE_FORM_VALUES.sendHour,
    targetMonth: template.targetMonth ?? undefined,
    targetDay: template.targetDay ?? undefined,
    repeatsAnnually: !template.targetYear,
    targetYear: template.targetYear ?? undefined,
    leadDays: template.leadDays ?? 0,
    audience: template.audience,
    cities: filters?.cities ?? [],
    modules: filters?.modules ?? [],
    raioCidade: filters?.radius?.city ?? "",
    raioKm: filters?.radius?.km ?? DEFAULT_TEMPLATE_FORM_VALUES.raioKm,
    channels: template.channels,
    whatsappVariants: splitWhatsappVariants(template.whatsappTemplate),
    pushTitle: template.pushTitle ?? "",
    pushBody: template.pushBody ?? "",
    imageKey: template.imageKey ?? "",
    deepLink: template.deepLink ?? "",
    messagesPerHour: template.messagesPerHour ?? DEFAULT_TEMPLATE_FORM_VALUES.messagesPerHour,
    dailyCap: template.dailyCap ?? DEFAULT_TEMPLATE_FORM_VALUES.dailyCap,
    windowStartHour: template.windowStartHour ?? DEFAULT_TEMPLATE_FORM_VALUES.windowStartHour,
    windowEndHour: template.windowEndHour ?? DEFAULT_TEMPLATE_FORM_VALUES.windowEndHour,
    weekdaysOnly: template.weekdaysOnly ?? true,
    maxPerRun: template.maxPerRun ?? undefined,
  };
}

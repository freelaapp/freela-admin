/**
 * Funções puras do diálogo criar/editar de template: montar o recorte de
 * público e o payload da API a partir do formulário, e o caminho inverso
 * (template existente → valores do formulário) para o modo edição. Nada
 * aqui toca DOM, rede ou estado — dá para testar sem montar o componente.
 */
import type { AudienceFilters } from "@/modules/admin/infrastructure/referrals-api";
import type {
  CampaignTemplate,
  UpsertCampaignTemplatePayload,
} from "@/modules/admin/infrastructure/campaign-templates-api";
import { DEFAULT_TEMPLATE_FORM_VALUES, type TemplateFormValues } from "./template-schema";

/**
 * Monta o recorte a partir do formulário. Devolve `undefined` quando não há
 * nenhum filtro — objeto de listas vazias gravaria "filtrado por nada", que
 * é diferente de "sem filtro".
 *
 * Só emite `cities`/`modules` — o recorte geográfico por distância a partir
 * de uma cidade é exclusivo das campanhas avulsas de `(auth)/campanhas`
 * (`montarFiltros`): o DTO de template no backend não tem esse campo, e
 * `forbidNonWhitelisted` rejeitaria o payload inteiro.
 */
export function buildAudienceFilters(f: {
  cities: string[];
  modules: TemplateFormValues["modules"];
}): AudienceFilters | undefined {
  if (!f.cities.length && !f.modules.length) return undefined;
  return {
    ...(f.cities.length ? { cities: f.cities } : {}),
    ...(f.modules.length ? { modules: f.modules } : {}),
  };
}

/**
 * Formulário validado → payload da API. Só WEEKLY manda `weekdays`+`sendHour`;
 * só DATED manda `targetMonth`+`targetDay`+`leadDays` (e `targetYear` some
 * quando "repetir todo ano" está marcado). Só o canal ligado manda seu
 * conteúdo — desligar PUSH depois de preencher título/corpo não devia
 * mandar lixo pro backend. WHATSAPP manda só o link do funil DevZapp: a
 * DevZapp é dona do ritmo de envio, das variantes de mensagem e do disparo
 * em si (mesma migração do item #1, `(auth)/campanhas`).
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
      ? { devzappFunnelUrl: values.devzappFunnelUrl.trim() }
      : {}),
    ...(values.channels.includes("PUSH")
      ? { pushTitle: values.pushTitle.trim(), pushBody: values.pushBody.trim() }
      : {}),
    ...(values.imageKey ? { imageKey: values.imageKey } : {}),
    ...(values.deepLink.trim() ? { deepLink: values.deepLink.trim() } : {}),
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
    channels: template.channels,
    devzappFunnelUrl: template.devzappFunnelUrl ?? "",
    pushTitle: template.pushTitle ?? "",
    pushBody: template.pushBody ?? "",
    imageKey: template.imageKey ?? "",
    deepLink: template.deepLink ?? "",
    maxPerRun: template.maxPerRun ?? undefined,
  };
}

import { z } from "zod";
import type { CampaignTemplateAudience } from "@/modules/admin/infrastructure/campaign-templates-api";

/**
 * As 4 audiências legadas de `referrals-api.ts` + as 2 novas que só existem
 * em templates de campanha (contratante geral / contratante ativo). Fonte
 * única para o `<select>` do diálogo e para o schema — nenhum outro arquivo
 * deveria listar essas 6 chaves de novo.
 */
export const TEMPLATE_AUDIENCES = [
  "CONTRACTORS_NEVER_PUBLISHED",
  "CONTRACTORS_DORMANT_90D",
  "PROVIDERS_NEVER_APPLIED",
  "PROVIDERS_DORMANT_90D",
  "CONTRACTORS_ALL",
  "CONTRACTORS_ACTIVE",
] as const satisfies readonly CampaignTemplateAudience[];

export const TEMPLATE_MODULES = ["bars-restaurants", "home-services"] as const;

/**
 * A DevZapp agora é dona do ritmo de envio, das variantes de mensagem e do
 * disparo em si (mesma migração do item #1, `(auth)/campanhas` — commit
 * "Trocar ritmo/variantes por link do funil DevZapp"). O canal WHATSAPP do
 * template só precisa apontar para o funil certo. Aceita só link https://
 * não vazio: um link http ou vazio travaria o disparo mais tarde, sem aviso
 * na hora de salvar.
 */
export function isValidDevzappFunnelUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    return new URL(trimmed).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Formulário do diálogo criar/editar. É mais "largo" que
 * `UpsertCampaignTemplatePayload`: guarda o recorte de público desmembrado
 * (cidades/módulo), em vez do payload já montado. `buildTemplatePayload`
 * (`template-form.ts`) faz a conversão para o que a API espera.
 *
 * Não inclui o recorte geográfico por distância a partir de uma cidade:
 * esse controle é exclusivo das campanhas avulsas de `(auth)/campanhas` — o
 * DTO de template no backend não aceita esse campo (`forbidNonWhitelisted`
 * rejeita o payload inteiro).
 */
export const templateFormSchema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome à campanha."),

    scheduleKind: z.enum(["WEEKLY", "DATED"]),
    weekdays: z.array(z.number().int().min(0).max(6)),
    sendHour: z.number().int().min(0).max(23),
    targetMonth: z.number().int().min(1).max(12).optional(),
    targetDay: z.number().int().min(1).max(31).optional(),
    /** Só é campo de UI — vira `targetYear: undefined` no payload quando marcado. */
    repeatsAnnually: z.boolean(),
    targetYear: z.number().int().min(2020).max(2100).optional(),
    leadDays: z.number().int().min(0).max(60),

    audience: z.enum(TEMPLATE_AUDIENCES),
    cities: z.array(z.string()),
    modules: z.array(z.enum(TEMPLATE_MODULES)),

    channels: z.array(z.enum(["PUSH", "WHATSAPP"])).min(1, "Escolha pelo menos um canal."),
    devzappFunnelUrl: z.string(),
    pushTitle: z.string(),
    pushBody: z.string(),

    imageKey: z.string(),
    deepLink: z.string(),

    maxPerRun: z.number().int().min(1).optional(),
  })
  .superRefine((values, ctx) => {
    if (values.scheduleKind === "WEEKLY") {
      if (values.weekdays.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["weekdays"],
          message: "Escolha pelo menos um dia da semana.",
        });
      }
    } else {
      if (!values.targetMonth) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetMonth"], message: "Informe o mês." });
      }
      if (!values.targetDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetDay"], message: "Informe o dia." });
      }
      if (!values.repeatsAnnually && !values.targetYear) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["targetYear"],
          message: "Informe o ano (ou marque \"repetir todo ano\").",
        });
      }
    }

    if (values.channels.includes("WHATSAPP") && !isValidDevzappFunnelUrl(values.devzappFunnelUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["devzappFunnelUrl"],
        message: "Cole um link válido, começando com https://.",
      });
    }

    if (values.channels.includes("PUSH")) {
      if (!values.pushTitle.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pushTitle"], message: "Informe o título do push." });
      }
      if (!values.pushBody.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pushBody"], message: "Informe o corpo do push." });
      }
    }
  });

export type TemplateFormValues = z.infer<typeof templateFormSchema>;

/** Valores de partida para "criar" — edição parte de `templateToFormValues`. */
export const DEFAULT_TEMPLATE_FORM_VALUES: TemplateFormValues = {
  name: "",
  scheduleKind: "WEEKLY",
  weekdays: [],
  sendHour: 9,
  targetMonth: undefined,
  targetDay: undefined,
  repeatsAnnually: true,
  targetYear: undefined,
  leadDays: 0,
  audience: "CONTRACTORS_ALL",
  cities: [],
  modules: [],
  channels: [],
  devzappFunnelUrl: "",
  pushTitle: "",
  pushBody: "",
  imageKey: "",
  deepLink: "",
  maxPerRun: undefined,
};

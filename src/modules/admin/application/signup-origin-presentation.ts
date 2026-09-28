/**
 * Coluna "Origem" (spec 2026-09-28 §3) — só funções puras, sem React.
 *
 * Com a API nova (`signupOrigin` presente) vira uma etiqueta por fonte, na
 * ordem da spec; sem nenhuma, "Cadastro normal". Com a API antiga o painel
 * mostra EXATAMENTE o texto de antes (parceria/consultor com código, ou "—") —
 * nunca "Cadastro normal", que seria afirmar algo que a API antiga não sabe.
 */
import type { SignupOrigin, SignupOriginSource } from "../infrastructure/admin-api";

export type SignupOriginTone =
  | "indicacao"
  | "consultor"
  | "parceria"
  | "campanha"
  | "utm"
  | "social"
  | "canal"
  | "normal"
  | "legado";

export interface SignupOriginLabel {
  key: string;
  text: string;
  tone: SignupOriginTone;
  /** Detalhe para o tooltip. */
  title?: string;
}

export const NORMAL_SIGNUP_TEXT = "Cadastro normal";
const LEGACY_EMPTY_TEXT = "—";

const REFERRAL_STATUS_TEXT: Record<string, string> = {
  REGISTERED: "cadastrou",
  QUALIFIED: "qualificou",
  REJECTED: "não contou",
};
const SOCIAL_TEXT = { google: "Google", apple: "Apple" } as const;
const CHANNEL_TEXT = { web: "Site", app: "App", import: "Importação" } as const;

export function signupOriginLabels(source: SignupOriginSource): SignupOriginLabel[] {
  const origin = source.signupOrigin;
  if (!origin) return legacyLabels(source);

  const labels: SignupOriginLabel[] = [];
  if (origin.referral) {
    const who = origin.referral.referrerName?.trim() || origin.referral.code;
    const status = REFERRAL_STATUS_TEXT[origin.referral.status] ?? origin.referral.status;
    labels.push({
      key: "indicacao",
      text: `Indicação: ${who} · ${status}`,
      tone: "indicacao",
      title: `Indique e Ganhe — código ${origin.referral.code}`,
    });
  }
  if (origin.consultant) {
    labels.push({ key: "consultor", text: `Consultor: ${origin.consultant.name}`, tone: "consultor" });
  }
  if (origin.partnership) {
    labels.push({ key: "parceria", text: `Parceria: ${origin.partnership.name}`, tone: "parceria" });
  }
  if (origin.campaign) {
    labels.push({ key: "campanha", text: `Campanha: ${origin.campaign.name}`, tone: "campanha" });
  }
  const utm = utmLabel(origin.utm);
  if (utm) labels.push(utm);
  if (origin.social) {
    labels.push({ key: "social", text: SOCIAL_TEXT[origin.social], tone: "social" });
  }
  if (origin.channel) {
    labels.push({ key: "canal", text: CHANNEL_TEXT[origin.channel], tone: "canal" });
  }

  return labels.length > 0 ? labels : [{ key: "normal", text: NORMAL_SIGNUP_TEXT, tone: "normal" }];
}

/** Texto único (CSV, busca): as etiquetas separadas por " · ". */
export function formatSignupOrigin(source: SignupOriginSource): string {
  return signupOriginLabels(source)
    .map((label) => label.text)
    .join(" · ");
}

function utmLabel(utm: SignupOrigin["utm"]): SignupOriginLabel | null {
  if (!utm) return null;
  const main = [utm.source, utm.campaign].filter((value): value is string => Boolean(value?.trim()));
  const parts = main.length > 0 ? main : utm.medium?.trim() ? [utm.medium] : [];
  if (parts.length === 0) return null;
  return {
    key: "utm",
    text: `UTM: ${parts.join(" / ")}`,
    tone: "utm",
    title: `source: ${utm.source ?? "—"} · medium: ${utm.medium ?? "—"} · campaign: ${utm.campaign ?? "—"}`,
  };
}

/** Comportamento de antes (era `formatReferralOrigin`). */
function legacyLabels(source: SignupOriginSource): SignupOriginLabel[] {
  const labels: SignupOriginLabel[] = [];
  if (source.referredByPartnership) {
    const { name, code } = source.referredByPartnership;
    labels.push({ key: "parceria", text: `Parceria: ${name}${code ? ` (${code})` : ""}`, tone: "legado" });
  }
  if (source.referredByConsultant) {
    const { name, code } = source.referredByConsultant;
    labels.push({ key: "consultor", text: `Consultor: ${name}${code ? ` (${code})` : ""}`, tone: "legado" });
  }
  return labels.length > 0 ? labels : [{ key: "vazio", text: LEGACY_EMPTY_TEXT, tone: "legado" }];
}

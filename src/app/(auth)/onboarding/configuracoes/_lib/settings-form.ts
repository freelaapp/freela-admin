import type {
  OrientationSettingsPatch,
  OrientationSettingsView,
} from "@/modules/admin/infrastructure/orientation-api";

export type BuildResult<T> = { ok: true; payload: T } | { ok: false; error: string };

/** Só os campos numéricos dos padrões; `gateMode` e `gateFixedJobs` têm controles próprios. */
export type NumericSettingKey =
  | "defaultCapacity"
  | "maxCapacity"
  | "defaultDurationMin"
  | "bookingClosesMinBefore"
  | "maxChanges"
  | "maxNoShows"
  | "sessionsShown"
  | "joinOpensMinBefore"
  | "resultGraceMin"
  | "convocationMinDays"
  | "dailyMessageCap";

export type SettingsFormState = Record<NumericSettingKey, string>;

export interface SettingField {
  key: NumericSettingKey;
  label: string;
  min: number;
  max: number;
  hint?: string;
}

/** Faixas = as do DTO da API (`update-orientation-settings.dto.ts`). */
export const SETTING_FIELDS: SettingField[] = [
  { key: "defaultCapacity", label: "Lugares por turma (padrão)", min: 1, max: 100 },
  { key: "maxCapacity", label: "Teto de lugares por turma", min: 1, max: 100 },
  {
    key: "defaultDurationMin",
    label: "Duração da aula (min)",
    min: 5,
    max: 480,
    hint: "Conta Gmail pessoal corta a chamada em grupo aos 60 minutos.",
  },
  { key: "bookingClosesMinBefore", label: "Inscrição fecha quantos minutos antes", min: 0, max: 1000 },
  { key: "maxChanges", label: "Trocas de horário permitidas", min: 1, max: 1000 },
  { key: "maxNoShows", label: "Faltas até travar", min: 1, max: 1000 },
  { key: "sessionsShown", label: "Horários mostrados ao freelancer", min: 1, max: 1000 },
  { key: "joinOpensMinBefore", label: "Botão Entrar libera quantos minutos antes", min: 0, max: 1000 },
  { key: "resultGraceMin", label: "Minutos para reabrir a chamada", min: 0, max: 1000 },
  { key: "convocationMinDays", label: "Dias entre convocações da mesma pessoa", min: 1, max: 1000 },
  { key: "dailyMessageCap", label: "Teto de mensagens por dia", min: 0, max: 100000 },
];

export function settingsToForm(s: OrientationSettingsView): SettingsFormState {
  const form = {} as SettingsFormState;
  for (const f of SETTING_FIELDS) form[f.key] = String(s[f.key]);
  return form;
}

/** Formulário → PUT só com os campos que mudaram. Nunca inclui `gateMode`/`gateFixedJobs`. */
export function buildSettingsPatch(
  form: SettingsFormState,
  current: OrientationSettingsView,
): BuildResult<OrientationSettingsPatch> {
  const next = {} as Record<NumericSettingKey, number>;
  for (const f of SETTING_FIELDS) {
    const raw = form[f.key].trim();
    if (!/^\d+$/.test(raw)) return { ok: false, error: `${f.label}: digite um número inteiro.` };
    const n = Number(raw);
    if (n < f.min || n > f.max) {
      return { ok: false, error: `${f.label}: use um valor entre ${f.min} e ${f.max}.` };
    }
    next[f.key] = n;
  }
  if (next.defaultCapacity > next.maxCapacity) {
    return { ok: false, error: "Lugares por turma (padrão) não pode passar do teto de lugares." };
  }
  const payload: OrientationSettingsPatch = {};
  for (const f of SETTING_FIELDS) {
    if (next[f.key] !== current[f.key]) payload[f.key] = next[f.key];
  }
  if (Object.keys(payload).length === 0) return { ok: false, error: "Nada mudou." };
  return { ok: true, payload };
}

import type {
  PaperworkKey,
  PaperworkOption,
  SettingsChangeChannel,
  SettingsChangeOrigin,
  SettingsHistoryEntry,
} from "@/modules/admin/infrastructure/contractor-settings-api";

/**
 * Textos do modal "Documentos e cobrança" (UX Fase 2, item 5). Funções puras:
 * a tela só junta as peças.
 */

export const PAPERWORK_KEYS: readonly PaperworkKey[] = [
  "signedContractEnabled",
  "rpaEnabled",
  "inssRemindersEnabled",
];

/** Coluna da trilha (`contractor_settings_changes.field`) → chave do GET. */
const FIELD_TO_KEY: Record<string, PaperworkKey> = {
  signed_contract_enabled: "signedContractEnabled",
  rpa_enabled: "rpaEnabled",
  inss_reminders_enabled: "inssRemindersEnabled",
};

/** Nome curto de cada chave, para o histórico e o aviso de "Salvo". */
export const PAPERWORK_SHORT_LABEL: Record<PaperworkKey, string> = {
  signedContractEnabled: "Contrato assinado",
  rpaEnabled: "RPA",
  inssRemindersEnabled: "Lembretes do INSS",
};

/**
 * Título e resumo de reserva. A API manda os textos em `options[]`; isto só
 * evita uma aba em branco se a resposta vier sem eles.
 */
const FALLBACK_OPTIONS: Record<PaperworkKey, Pick<PaperworkOption, "title" | "summary">> = {
  signedContractEnabled: {
    title: "Contrato assinado",
    summary: "Contrato entre a empresa e o freelancer em cada vaga; os dois assinam no app.",
  },
  rpaEnabled: {
    title: "RPA (Recibo de Pagamento a Autônomo)",
    summary: "A Freela emite o RPA de cada serviço em nome da empresa.",
  },
  inssRemindersEnabled: {
    title: "Lembretes e relatório do INSS (eSocial)",
    summary: "Avisos dos prazos do eSocial e da DCTFWeb e o relatório mensal para o contador.",
  },
};

/** As três opções na ordem fixa, com os textos da API quando vierem. */
export function paperworkOptions(
  options: PaperworkOption[] | undefined,
): { key: PaperworkKey; title: string; summary: string }[] {
  return PAPERWORK_KEYS.map((key) => {
    const fromApi = options?.find((o) => o.key === key);
    const fallback = FALLBACK_OPTIONS[key];
    return {
      key,
      title: fromApi?.title || fallback.title,
      summary: fromApi?.summary || fallback.summary,
    };
  });
}

export const ADMIN_REASON_MIN_LENGTH = 5;
export const REASON_ERROR = "Escreva o motivo (pelo menos 5 caracteres).";

export function isValidReason(reason: string): boolean {
  return reason.trim().length >= ADMIN_REASON_MIN_LENGTH;
}

// ─── Datas (horário de Brasília) ──────────────────────────────────────────────

const brtFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function brtParts(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = brtFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: get("day"),
    month: get("month"),
    year: get("year"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** "10/10 14:32" (Brasília). */
export function formatBrtShort(iso: string): string {
  const p = brtParts(iso);
  return p ? `${p.day}/${p.month} ${p.hour}:${p.minute}` : "—";
}

// ─── Origem da última mudança de cada chave ───────────────────────────────────

/** "app", "web", "cadastro, web", "admin" — ou `null` quando não se sabe. */
export function channelLabel(
  origin: SettingsChangeOrigin,
  channel: SettingsChangeChannel | null,
): string | null {
  if (origin === "ADMIN" || channel === "ADMIN") return "admin";
  const base = channel === "APP" ? "app" : channel === "WEB" ? "web" : null;
  if (origin === "SIGNUP") return base ? `cadastro, ${base}` : "cadastro";
  return base;
}

function actorPhrase(entry: SettingsHistoryEntry): string {
  if (entry.actorKind === "ADMIN") {
    return entry.actorName ? `pelo admin ${entry.actorName}` : "pelo admin";
  }
  if (entry.actorKind === "SYSTEM") return "pelo sistema";
  return "pelo contratante";
}

/** A entrada mais nova de cada chave (a trilha vem do mais novo para o mais velho). */
export function lastChangeByKey(
  history: SettingsHistoryEntry[] | undefined,
): Partial<Record<PaperworkKey, SettingsHistoryEntry>> {
  const result: Partial<Record<PaperworkKey, SettingsHistoryEntry>> = {};
  for (const entry of history ?? []) {
    const key = FIELD_TO_KEY[entry.field];
    if (key && !result[key]) result[key] = entry;
  }
  return result;
}

/** "Desligado pelo contratante em 10/10 14:32 (app)." */
export function lastChangeLine(entry: SettingsHistoryEntry): string {
  const state = entry.newValue === "false" ? "Desligado" : "Ligado";
  const channel = channelLabel(entry.origin, entry.channel);
  const where = channel ? ` (${channel})` : "";
  return `${state} ${actorPhrase(entry)} em ${formatBrtShort(entry.createdAt)}${where}.`;
}

/** "Contrato assinado: desligado; RPA: ligado" — vai no aviso de "Salvo". */
export function changeSummary(patch: Partial<Record<PaperworkKey, boolean>>): string {
  return PAPERWORK_KEYS.filter((key) => typeof patch[key] === "boolean")
    .map((key) => `${PAPERWORK_SHORT_LABEL[key]}: ${patch[key] ? "ligado" : "desligado"}`)
    .join("; ");
}

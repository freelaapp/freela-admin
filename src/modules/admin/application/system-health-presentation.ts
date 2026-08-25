/**
 * Apresentação do painel "Verificação de serviços" — só funções puras.
 *
 * A API devolve estados em inglês (`OK`, `DEGRADED`, `DOWN`, `IDLE` para
 * canais/provedores; `OK`/`ERROR`/null para schedulers; `OK`/`PENDING`/
 * `FAILED`/`MISSING`/`NA` para documentos). O painel só precisa de três
 * coisas: um tom (cor), um rótulo em PT e, nos documentos, um símbolo
 * pequeno o bastante para caber na listagem de vagas.
 *
 * Nada aqui importa React: é o que a página e a coluna de documentos
 * compartilham, e o que os testes cobrem.
 */

export type HealthTone = "ok" | "warn" | "down" | "idle";

const TONE_BY_STATUS: Record<string, HealthTone> = {
  OK: "ok",
  DEGRADED: "warn",
  DOWN: "down",
  IDLE: "idle",
  ERROR: "down",
};

const LABEL_BY_STATUS: Record<string, string> = {
  OK: "Operando",
  DEGRADED: "Degradado",
  DOWN: "Fora do ar",
  IDLE: "Sem envios",
  ERROR: "Erro",
};

function normalize(status: string | null | undefined): string | null {
  if (status === null || status === undefined) return null;
  const s = String(status).trim().toUpperCase();
  return s.length > 0 ? s : null;
}

/** Cor do estado. Desconhecido cai em `idle` — nunca pinta de verde o que não entendemos. */
export function statusTone(status: string | null | undefined): HealthTone {
  const key = normalize(status);
  if (key === null) return "idle";
  return TONE_BY_STATUS[key] ?? "idle";
}

/** Rótulo em PT. Estado desconhecido devolve o texto cru para não esconder nada. */
export function statusLabel(status: string | null | undefined): string {
  const key = normalize(status);
  if (key === null) return "Nunca rodou";
  return LABEL_BY_STATUS[key] ?? String(status);
}

export interface ToneClasses {
  /** Fundo + borda + texto do card inteiro. */
  card: string;
  /** Pastilha pequena (badge de documento, selo na tabela). */
  chip: string;
  /** Bolinha de estado. */
  dot: string;
}

const CLASSES_BY_TONE: Record<HealthTone, ToneClasses> = {
  ok: {
    card: "border-green-200 bg-green-50 text-green-900",
    chip: "border-green-200 bg-green-50 text-green-800",
    dot: "bg-green-500",
  },
  warn: {
    card: "border-amber-200 bg-amber-50 text-amber-900",
    chip: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
  },
  down: {
    card: "border-red-200 bg-red-50 text-red-900",
    chip: "border-red-200 bg-red-50 text-red-800",
    dot: "bg-red-500",
  },
  idle: {
    card: "border-[#e5e5e5] bg-[#f7f7f7] text-[#737373]",
    chip: "border-[#e5e5e5] bg-[#f7f7f7] text-[#737373]",
    dot: "bg-[#a3a3a3]",
  },
};

export function toneClasses(tone: HealthTone): ToneClasses {
  return CLASSES_BY_TONE[tone];
}

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "E-mail",
  WHATSAPP: "WhatsApp",
  WHATSAPP_GROUP: "WhatsApp (grupos)",
  PUSH: "Push",
};

export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

// ─── Documentos por vaga ────────────────────────────────────────────────────

export type DocumentKey = "contract" | "receipt" | "rpa" | "nfse";

export interface DocumentBadge {
  label: string;
  tone: HealthTone;
  symbol: string;
}

const DOCUMENT_BADGES: Record<string, DocumentBadge> = {
  OK: { label: "Emitido", tone: "ok", symbol: "✓" },
  PENDING: { label: "Pendente", tone: "warn", symbol: "…" },
  FAILED: { label: "Falhou", tone: "down", symbol: "✗" },
  // Faltando ≠ falhou: ninguém tentou emitir. Mesma cor do pendente, símbolo
  // diferente, para o operador saber que aqui não há erro para ler.
  MISSING: { label: "Faltando", tone: "warn", symbol: "!" },
  NA: { label: "Não se aplica", tone: "idle", symbol: "–" },
};

export function documentBadge(state: string | null | undefined): DocumentBadge {
  const key = normalize(state);
  if (key !== null && DOCUMENT_BADGES[key]) return DOCUMENT_BADGES[key];
  return { label: key ?? "—", tone: "idle", symbol: "?" };
}

/** Ordem fixa dos quatro documentos, com sigla (listagem) e nome (detalhe). */
export const DOCUMENT_KEYS: readonly { key: DocumentKey; short: string; label: string }[] = [
  { key: "contract", short: "C", label: "Contrato" },
  { key: "receipt", short: "R", label: "Recibo" },
  { key: "rpa", short: "RPA", label: "RPA" },
  { key: "nfse", short: "NF", label: "NF-e" },
];

// ─── Auto-refresh ───────────────────────────────────────────────────────────

/** "há 12 s" / "há 3 min" / "há 2 h" — indicador do auto-refresh. */
export function formatAgo(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 5) return "agora";
  if (seconds < 60) return `há ${Math.floor(seconds)} s`;
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`;
  return `há ${Math.floor(seconds / 3600)} h`;
}

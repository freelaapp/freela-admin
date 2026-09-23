import type { VipKanbanBoard, VipKanbanCard, VipStatus } from "../infrastructure/freela-vip-api";

/** Rótulos em PT dos 17 status (o kanban traz os seus; ficha/VIPs usam estes). */
export const VIP_STATUS_LABELS: Record<VipStatus, string> = {
  PRE_SELECTED: "Pré-selecionado",
  INVITED: "Convidado",
  SELF_ENROLLED: "Inscrito pelo link",
  FORM_STARTED: "Formulário iniciado",
  FORM_SUBMITTED: "Formulário enviado",
  SCORED: "Nota calculada",
  WAITLIST: "Lista de espera",
  INTERVIEW_SCHEDULED: "Entrevista",
  REFERENCES_OK: "Referências ok",
  BACKGROUND_PENDING: "Antecedentes pendentes",
  BACKGROUND_OK: "Antecedentes ok",
  TEST_SERVICE: "Serviço-teste",
  VIP_PROVISIONAL: "VIP provisório",
  VIP_ACTIVE: "VIP ativo",
  VIP_SUSPENDED: "VIP suspenso",
  REJECTED: "Reprovado",
  WITHDREW: "Desistiu",
};

export type ScoreBand = "alta" | "media" | "baixa" | "sem";

export function scoreBand(total: number | null | undefined): ScoreBand {
  if (total === null || total === undefined) return "sem";
  if (total >= 70) return "alta";
  if (total >= 50) return "media";
  return "baixa";
}

export function scoreBandClass(band: ScoreBand): string {
  switch (band) {
    case "alta": return "bg-[#DCFCE7] text-[#166534]";
    case "media": return "bg-[#FEF3C7] text-[#92400E]";
    case "baixa": return "bg-[#FEE2E2] text-[#991B1B]";
    default: return "bg-[#F1F5F9] text-[#64748B]";
  }
}

/** Fração (0–1) → "40%"; null → "—". */
export function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

const fold = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function sortCardsByScore(cards: VipKanbanCard[]): VipKanbanCard[] {
  return [...cards].sort((a, b) => {
    if (a.totalScore === null && b.totalScore === null) return a.createdAt.localeCompare(b.createdAt);
    if (a.totalScore === null) return 1;
    if (b.totalScore === null) return -1;
    return b.totalScore - a.totalScore;
  });
}

export function filterKanbanCards(
  cards: VipKanbanCard[],
  f: { city?: string; role?: string; search?: string },
): VipKanbanCard[] {
  const city = fold(f.city);
  const role = fold(f.role);
  const search = fold(f.search);
  return cards.filter(
    (c) =>
      (!city || fold(c.city) === city) &&
      (!role || fold(c.role) === role) &&
      (!search || fold(c.displayName).includes(search)),
  );
}

/** Movimento otimista: devolve um board novo com o card na coluna destino. */
export function moveCardBetweenColumns(board: VipKanbanBoard, cardId: string, toStage: VipStatus): VipKanbanBoard {
  let moved: VipKanbanCard | null = null;
  const columns = board.columns.map((col) => {
    const remaining = col.cards.filter((c) => {
      if (c.id === cardId) { moved = { ...c, status: toStage }; return false; }
      return true;
    });
    return { ...col, cards: remaining, count: remaining.length };
  });
  if (!moved) return board;
  return {
    ...board,
    columns: columns.map((col) =>
      col.stage === toStage ? { ...col, cards: [moved as VipKanbanCard, ...col.cards], count: col.count + 1 } : col,
    ),
  };
}

export function validateScoringConfig(cfg: {
  weights: Record<string, number>;
  cutoffs: { high: number; waitlist: number };
}): string[] {
  const errors: string[] = [];
  const entries = Object.entries(cfg.weights);
  for (const [key, w] of entries) {
    if (!Number.isFinite(w) || w < 0) errors.push(`Peso não pode ser negativo: ${key}.`);
  }
  const sum = entries.reduce((acc, [, w]) => acc + (Number.isFinite(w) ? w : 0), 0);
  if (sum !== 100) errors.push(`Os pesos devem somar 100 (soma atual: ${sum}).`);
  const { high, waitlist } = cfg.cutoffs;
  if ([high, waitlist].some((v) => !Number.isFinite(v) || v < 0 || v > 100)) errors.push("Cortes devem ficar entre 0 e 100.");
  if (Number.isFinite(high) && Number.isFinite(waitlist) && high <= waitlist) errors.push("O corte alto deve ser maior que o de lista de espera.");
  return errors;
}

export function validateQuestionDraft(d: {
  role: string;
  text: string;
  options: string[];
  pointsPerOption: number[];
}): string[] {
  const errors: string[] = [];
  if (!d.role.trim()) errors.push("Informe a função.");
  if (!d.text.trim()) errors.push("Informe o texto da pergunta.");
  if (d.options.length < 2) errors.push("Informe pelo menos 2 opções.");
  d.options.forEach((o, i) => { if (!o.trim()) errors.push(`Opção ${i + 1} está vazia.`); });
  if (d.pointsPerOption.length !== d.options.length) errors.push("Cada opção precisa de um valor de pontos.");
  if (d.pointsPerOption.some((p) => !Number.isFinite(p) || p < 0)) errors.push("Pontos não podem ser negativos.");
  return errors;
}

export type IndicatorKind = "percent" | "days" | "ratio";

const fmtRatio = (n: number) => n.toFixed(1).replace(".", ",");

export function formatIndicator(
  m: { atual: number | null; meta: number | null | undefined },
  kind: IndicatorKind,
): { atual: string; meta: string; ok: boolean | null } {
  const fmt = (n: number) =>
    kind === "percent" ? pct(n) : kind === "days" ? `${Math.round(n)} dias` : fmtRatio(n);
  const metaText = m.meta === null || m.meta === undefined ? "—" : `${kind === "days" ? "≤" : "≥"} ${fmt(m.meta)}`;
  if (m.atual === null || m.atual === undefined) return { atual: "—", meta: metaText, ok: null };
  const ok = m.meta === null || m.meta === undefined ? null : kind === "days" ? m.atual <= m.meta : m.atual >= m.meta;
  return { atual: fmt(m.atual), meta: metaText, ok };
}

export function cycleInviteBudget(c: { targetVacancies: number; invitesPerVacancy: number }): number {
  return c.targetVacancies * c.invitesPerVacancy;
}

/** `scoreBreakdown` é JSON livre: número ou `{ points|score, max? }` por critério. */
export function breakdownRows(
  breakdown: Record<string, unknown> | null | undefined,
): { key: string; value: number; max: number | null }[] {
  if (!breakdown) return [];
  return Object.entries(breakdown).flatMap(([key, raw]) => {
    if (typeof raw === "number") return [{ key, value: raw, max: null }];
    if (raw && typeof raw === "object") {
      const o = raw as { points?: number; score?: number; max?: number };
      const value = typeof o.points === "number" ? o.points : typeof o.score === "number" ? o.score : null;
      if (value === null) return [];
      return [{ key, value, max: typeof o.max === "number" ? o.max : null }];
    }
    return [];
  });
}

const VIP_ALERT_LABELS: Record<string, string> = {
  OVERLAPPING_FULL_TIME_PERIODS: "Períodos em tempo integral sobrepostos",
  DECLARED_TIME_EXCEEDS_AGE: "Tempo declarado maior que a idade permite",
  FORM_TOO_FAST: "Formulário preenchido rápido demais",
  SHARED_REFERENCE_PHONE: "Telefone de referência repetido",
};

export function alertLabel(alert: unknown): string {
  const code = typeof alert === "string" ? alert : (alert as { code?: string } | null)?.code ?? "";
  return VIP_ALERT_LABELS[code] ?? code;
}

export const VIP_CRITERIA_LABELS: Record<string, string> = {
  totalTimeInRole: "Tempo total na função",
  averageTimePerJob: "Tempo médio por emprego",
  highVolume: "Alto movimento",
  practicalQuestions: "Perguntas práticas",
  proof: "Comprovação",
  courseCertificate: "Certificados",
  availabilityTransport: "Disponibilidade e transporte",
};

export const VIP_MOMENT_LABELS: Record<string, string> = {
  INVITE: "Convite",
  REMINDER_DAY3: "Lembrete dia 3",
  REMINDER_DAY6: "Lembrete dia 6",
  FORM_INCOMPLETE: "Formulário incompleto",
  SCORE_PASSED: "Aprovado na nota",
  WAITLIST: "Lista de espera",
  REJECTED_SCORE: "Reprovado na nota",
  BACKGROUND_REQUEST: "Pedido de antecedentes",
  NOT_APT: "Não apto",
  VIP_APPROVED: "Aprovado VIP",
  VIP_ACTIVE: "VIP ativo",
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

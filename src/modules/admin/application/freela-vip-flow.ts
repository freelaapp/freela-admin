import type { VipKanbanBoard, VipKanbanCard, VipKanbanColumn, VipSource, VipStatus } from "../infrastructure/freela-vip-api";

/**
 * Regras de TELA do funil Freela VIP: quem age agora, qual o próximo passo, em
 * que fase o candidato está e a situação do convite. Puras e testadas — as telas
 * (ciclo, funil, ficha) só desenham o que sai daqui.
 */

export type VipActor = "freela" | "sistema" | "voce" | "antecedentes" | "ninguem";
/** Ações da ficha: `approve` = PATCH decision approve; `open_background` = abrir Etapa 6. */
export type VipNextAction = "resend" | "approve" | "open_background";

export interface VipNextStep {
  actor: VipActor;
  text: string;
  action?: VipNextAction;
  actionLabel?: string;
}

export const VIP_ACTOR_LABELS: Record<VipActor, string> = {
  freela: "Com o freela",
  sistema: "Com o sistema",
  voce: "Com você",
  antecedentes: "Antecedentes",
  ninguem: "Concluído",
};

const RESENDABLE: readonly VipStatus[] = ["INVITED", "FORM_STARTED"];

export function vipNextStep(
  app: { status: VipStatus; source: VipSource },
  ctx: { cycleHasBackground: boolean; canAdmin: boolean },
): VipNextStep {
  const step = baseStep(app, ctx.cycleHasBackground);
  if (!ctx.canAdmin) return { actor: step.actor, text: step.text };
  return step;
}

function baseStep(app: { status: VipStatus; source: VipSource }, cycleHasBackground: boolean): VipNextStep {
  const canResend = app.source === "BASE" && RESENDABLE.includes(app.status);
  const resend = canResend ? { action: "resend" as const, actionLabel: "Reenviar convite" } : {};
  switch (app.status) {
    case "PRE_SELECTED":
      return { actor: "voce", text: "Pré-selecionado. Envie o convite na aba Convidar." };
    case "INVITED":
      return { actor: "freela", text: "Convite enviado. Esperando o freela abrir o link e preencher o formulário (leva menos de 8 minutos).", ...resend };
    case "SELF_ENROLLED":
      return { actor: "freela", text: "Entrou pelo link público. Falta preencher o formulário." };
    case "FORM_STARTED":
      return { actor: "freela", text: "Começou o formulário e ainda não terminou.", ...resend };
    case "FORM_SUBMITTED":
    case "SCORED":
      return { actor: "sistema", text: "Formulário enviado. O sistema calcula a nota: 70 ou mais vai para entrevista, 50 a 69 para a lista de espera, abaixo de 50 fica fora." };
    case "WAITLIST":
      return { actor: "voce", text: "Nota entre 50 e 69. Se faltar gente para as vagas, chame para entrevista.", action: "approve", actionLabel: "Chamar para entrevista" };
    case "INTERVIEW_SCHEDULED":
      return { actor: "voce", text: "Entreviste por telefone ou WhatsApp e confirme as experiências e referências abaixo. Depois clique em \"Entrevista e referências ok\".", action: "approve", actionLabel: "Entrevista e referências ok" };
    case "REFERENCES_OK":
      return cycleHasBackground
        ? { actor: "voce", text: "Referências ok. Este ciclo pede antecedentes: peça as certidões ao freela.", action: "open_background", actionLabel: "Pedir antecedentes" }
        : { actor: "voce", text: "Referências ok e o ciclo não pede antecedentes. Aprove como VIP.", action: "approve", actionLabel: "Aprovar como VIP" };
    case "BACKGROUND_PENDING":
      return { actor: "antecedentes", text: "Esperando o freela enviar as certidões. Quem tem a permissão de antecedentes analisa na seção Antecedentes desta ficha." };
    case "BACKGROUND_OK":
      return { actor: "voce", text: "Antecedentes ok. Aprove como VIP.", action: "approve", actionLabel: "Aprovar como VIP" };
    case "VIP_ACTIVE":
      return { actor: "ninguem", text: "É VIP: entrou nos favoritos da loja e na lista VIP dela (e no grupo de WhatsApp, se a loja já tem grupo)." };
    case "VIP_SUSPENDED":
      return { actor: "ninguem", text: "VIP suspenso." };
    case "REJECTED":
      return { actor: "ninguem", text: "Fora do processo (reprovado)." };
    case "WITHDREW":
      return { actor: "ninguem", text: "Desistiu do processo." };
    default:
      return { actor: "ninguem", text: "Etapa da Fase 2 (ainda não usada)." };
  }
}

// ─── Fases do funil ──────────────────────────────────────────────────────────
export interface VipFunnelPhase {
  key: "waiting" | "scoring" | "interview" | "checks" | "vip";
  title: string;
  hint: string;
  stages: readonly VipStatus[];
}

export const VIP_FUNNEL_PHASES: readonly VipFunnelPhase[] = [
  { key: "waiting", title: "Aguardando o freela", hint: "Convite enviado ou formulário em andamento — quem age é o freela.", stages: ["PRE_SELECTED", "INVITED", "SELF_ENROLLED", "FORM_STARTED"] },
  { key: "scoring", title: "Nota automática", hint: "O sistema calcula a nota assim que o formulário chega.", stages: ["FORM_SUBMITTED", "SCORED"] },
  { key: "interview", title: "Com você: entrevista", hint: "Chame da lista de espera e entreviste quem passou na nota.", stages: ["WAITLIST", "INTERVIEW_SCHEDULED"] },
  { key: "checks", title: "Com você: referências e antecedentes", hint: "Referências confirmadas; antecedentes só se o ciclo pedir.", stages: ["REFERENCES_OK", "BACKGROUND_PENDING", "BACKGROUND_OK"] },
  { key: "vip", title: "VIPs", hint: "Aprovados: estão na lista VIP da loja.", stages: ["VIP_ACTIVE", "VIP_SUSPENDED"] },
];

export interface VipPhaseGroup extends VipFunnelPhase {
  count: number;
  columns: VipKanbanColumn[];
}

export function groupColumnsByPhase(board: VipKanbanBoard): VipPhaseGroup[] {
  const byStage = new Map(board.columns.map((c) => [c.stage, c]));
  return VIP_FUNNEL_PHASES.map((phase) => {
    const columns = phase.stages.map((s) => byStage.get(s)).filter((c): c is VipKanbanColumn => !!c);
    return { ...phase, columns, count: columns.reduce((n, c) => n + c.cards.length, 0) };
  });
}

// ─── Convite ─────────────────────────────────────────────────────────────────
export const VIP_RESEND_COOLDOWN_MS = 12 * 60 * 60 * 1000;

export interface VipInviteSituation {
  label: string;
  tone: "muted" | "ok" | "warn";
  canResend: boolean;
  blockedReason?: string;
}

export function vipInviteSituation(card: VipKanbanCard, now: Date = new Date()): VipInviteSituation {
  const resendable = card.source === "BASE" && RESENDABLE.includes(card.status);
  const expired = !!card.inviteExpiresAt && new Date(card.inviteExpiresAt).getTime() <= now.getTime();
  const base: Omit<VipInviteSituation, "canResend"> =
    card.status === "FORM_STARTED"
      ? { label: "Começou o formulário", tone: "ok" }
      : card.source === "LINK"
        ? { label: "Entrou pelo link", tone: "muted" }
        : expired
          ? { label: "Link vencido", tone: "warn" }
          : { label: "Não abriu", tone: "muted" };
  if (!resendable) return { ...base, canResend: false, blockedReason: "Entrou pelo link público — não há convite para reenviar." };
  const last = card.lastInviteSentAt ?? card.invitedAt;
  if (last && now.getTime() - new Date(last).getTime() < VIP_RESEND_COOLDOWN_MS) {
    return { ...base, canResend: false, blockedReason: "Convite enviado há menos de 12 h." };
  }
  return { ...base, canResend: true };
}

// ─── Orçamento de convites ───────────────────────────────────────────────────
/**
 * Quanto falta do orçamento do ciclo (vagas × convites por vaga) e se a seleção
 * atual passa dele. Os já convidados saem da pré-seleção — sem esta conta, dava
 * para convidar o orçamento inteiro de novo a cada visita.
 */
export function vipInviteBudget(
  budget: number,
  alreadyInvited: number | undefined,
  selected: number,
): { remaining: number; over: boolean } {
  const remaining = Math.max(0, budget - (alreadyInvited ?? 0));
  return { remaining, over: selected > remaining };
}

// ─── O que fazer agora ───────────────────────────────────────────────────────
export interface VipTodoCounts {
  invitesWaiting: number;
  waitlist: number;
  interview: number;
  requestBackground: number;
  backgroundPending: number;
  toApprove: number;
}

export function vipTodoCounts(board: VipKanbanBoard, ctx: { cycleHasBackground: boolean }): VipTodoCounts {
  const cardsOf = (stage: VipStatus) => board.columns.find((c) => c.stage === stage)?.cards ?? [];
  const n = (stage: VipStatus) => cardsOf(stage).length;
  const fromBase = (stage: VipStatus) => cardsOf(stage).filter((c) => c.source === "BASE").length;
  const refsOk = n("REFERENCES_OK");
  return {
    // Só convite da base conta como "sem resposta" — inscrito pelo link não foi convidado.
    invitesWaiting: fromBase("INVITED") + fromBase("FORM_STARTED"),
    waitlist: n("WAITLIST"),
    interview: n("INTERVIEW_SCHEDULED"),
    requestBackground: ctx.cycleHasBackground ? refsOk : 0,
    backgroundPending: n("BACKGROUND_PENDING"),
    toApprove: n("BACKGROUND_OK") + (ctx.cycleHasBackground ? 0 : refsOk),
  };
}

// ─── Histórico ───────────────────────────────────────────────────────────────
const EVENT_LABELS: Record<string, string> = {
  INVITED: "Convite enviado",
  INVITE_RESENT: "Convite reenviado",
  SELF_ENROLLED: "Entrou pelo link público",
  FORM_STARTED: "Começou o formulário",
  FORM_BASICS_SAVED: "Salvou os dados básicos",
  FORM_EXPERIENCES_SAVED: "Salvou as experiências",
  FORM_REFERENCES_SAVED: "Salvou as referências",
  FORM_ANSWERS_SAVED: "Respondeu as perguntas",
  FORM_AVAILABILITY_SAVED: "Salvou a disponibilidade",
  FORM_DOCUMENT_UPLOADED: "Enviou um comprovante",
  FORM_SUBMITTED: "Enviou o formulário",
  SCORED: "Nota calculada",
  SCORE_DECIDED: "Faixa da nota definida",
  ELIMINATED: "Eliminado por critério",
  RESCORED: "Nota recalculada",
  EXPERIENCE_CONFIRMED: "Experiência conferida",
  REFERENCE_CHECKED: "Referência conferida",
  APPROVED: "Aprovado pela equipe",
  REJECTED: "Reprovado",
  STAGE_MOVED: "Movido no funil",
  BACKGROUND_OPENED: "Antecedentes pedidos",
  BACKGROUND_DOCUMENT_UPLOADED: "Enviou certidão",
  BACKGROUND_DECIDED: "Antecedentes analisados",
  DOC_OPENED: "Documento aberto",
  DOC_PURGED: "Documento apagado (retenção)",
  APPLICATION_PURGED: "Dados apagados (retenção)",
  WITHDREW: "Desistiu",
};

export function vipEventLabel(action: string): string {
  return EVENT_LABELS[action] ?? action;
}

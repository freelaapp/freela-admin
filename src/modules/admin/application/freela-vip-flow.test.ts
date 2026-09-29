import { describe, expect, it } from "vitest";
import type { VipKanbanBoard, VipKanbanCard, VipStatus } from "../infrastructure/freela-vip-api";
import {
  groupColumnsByPhase,
  vipInviteBudget,
  vipEventLabel,
  vipInviteSituation,
  vipNextStep,
  vipTodoCounts,
} from "./freela-vip-flow";

const ADMIN = { canAdmin: true };
const READER = { canAdmin: false };
const NOW = new Date("2026-09-29T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function card(over: Partial<VipKanbanCard> = {}): VipKanbanCard {
  return {
    id: "a1",
    status: "INVITED",
    providerGlobalId: "pg-1",
    source: "BASE",
    displayName: "Ana",
    city: "Jundiaí",
    role: "cumim",
    totalScore: null,
    alertsCount: 0,
    createdAt: "2026-09-25T12:00:00.000Z",
    invitedAt: "2026-09-25T12:00:00.000Z",
    inviteExpiresAt: "2026-10-02T12:00:00.000Z",
    lastInviteSentAt: "2026-09-25T12:00:00.000Z",
    ...over,
  };
}

function board(stages: Partial<Record<VipStatus, VipKanbanCard[]>>): VipKanbanBoard {
  const order: VipStatus[] = [
    "PRE_SELECTED", "INVITED", "SELF_ENROLLED", "FORM_STARTED", "FORM_SUBMITTED", "SCORED", "WAITLIST",
    "INTERVIEW_SCHEDULED", "REFERENCES_OK", "BACKGROUND_PENDING", "BACKGROUND_OK", "VIP_ACTIVE", "VIP_SUSPENDED",
  ];
  const columns = order.map((stage) => {
    const cards = stages[stage] ?? [];
    return { stage, title: stage, count: cards.length, cards };
  });
  return { columns, totalActive: columns.reduce((n, c) => n + c.count, 0), rejectedCount: 0, withdrewCount: 0 };
}

describe("vipNextStep", () => {
  it("convidado da base: espera o freela e oferece reenviar", () => {
    const s = vipNextStep({ status: "INVITED", source: "BASE" }, { cycleHasBackground: false, ...ADMIN });
    expect(s.actor).toBe("freela");
    expect(s.action).toBe("resend");
    expect(s.actionLabel).toBe("Reenviar convite");
  });

  it("inscrito pelo link não tem convite para reenviar", () => {
    const s = vipNextStep({ status: "FORM_STARTED", source: "LINK" }, { cycleHasBackground: false, ...ADMIN });
    expect(s.actor).toBe("freela");
    expect(s.action).toBeUndefined();
  });

  it("formulário enviado: o sistema calcula a nota", () => {
    expect(vipNextStep({ status: "FORM_SUBMITTED", source: "BASE" }, { cycleHasBackground: false, ...ADMIN }).actor).toBe("sistema");
  });

  it("lista de espera: você decide chamar para entrevista", () => {
    const s = vipNextStep({ status: "WAITLIST", source: "BASE" }, { cycleHasBackground: false, ...ADMIN });
    expect(s).toMatchObject({ actor: "voce", action: "approve", actionLabel: "Chamar para entrevista" });
  });

  it("entrevista: confirmar e seguir", () => {
    const s = vipNextStep({ status: "INTERVIEW_SCHEDULED", source: "BASE" }, { cycleHasBackground: false, ...ADMIN });
    expect(s).toMatchObject({ actor: "voce", action: "approve", actionLabel: "Entrevista e referências ok" });
  });

  it("referências ok COM antecedentes: pedir antecedentes", () => {
    const s = vipNextStep({ status: "REFERENCES_OK", source: "BASE" }, { cycleHasBackground: true, ...ADMIN });
    expect(s).toMatchObject({ actor: "voce", action: "open_background", actionLabel: "Pedir antecedentes" });
  });

  it("referências ok SEM antecedentes: aprovar como VIP", () => {
    const s = vipNextStep({ status: "REFERENCES_OK", source: "BASE" }, { cycleHasBackground: false, ...ADMIN });
    expect(s).toMatchObject({ actor: "voce", action: "approve", actionLabel: "Aprovar como VIP" });
  });

  it("antecedentes pendentes: espera as certidões", () => {
    expect(vipNextStep({ status: "BACKGROUND_PENDING", source: "BASE" }, { cycleHasBackground: true, ...ADMIN }).actor).toBe("antecedentes");
  });

  it("antecedentes ok: aprovar como VIP", () => {
    const s = vipNextStep({ status: "BACKGROUND_OK", source: "BASE" }, { cycleHasBackground: true, ...ADMIN });
    expect(s).toMatchObject({ action: "approve", actionLabel: "Aprovar como VIP" });
  });

  it("VIP, reprovado e desistente: nada a fazer", () => {
    for (const status of ["VIP_ACTIVE", "REJECTED", "WITHDREW"] as VipStatus[]) {
      const s = vipNextStep({ status, source: "BASE" }, { cycleHasBackground: false, ...ADMIN });
      expect(s.actor).toBe("ninguem");
      expect(s.action).toBeUndefined();
    }
  });

  it("quem só lê vê o texto, mas nunca a ação", () => {
    const s = vipNextStep({ status: "WAITLIST", source: "BASE" }, { cycleHasBackground: false, ...READER });
    expect(s.text).toBeTruthy();
    expect(s.action).toBeUndefined();
    expect(s.actionLabel).toBeUndefined();
  });
});

describe("groupColumnsByPhase", () => {
  it("agrupa as colunas em 5 fases na ordem do funil, somando os cards", () => {
    const phases = groupColumnsByPhase(
      board({ INVITED: [card()], FORM_STARTED: [card({ id: "a2", status: "FORM_STARTED" })], WAITLIST: [card({ id: "a3", status: "WAITLIST" })] }),
    );
    expect(phases.map((p) => p.key)).toEqual(["waiting", "scoring", "interview", "checks", "vip"]);
    expect(phases[0].count).toBe(2);
    expect(phases[2].count).toBe(1);
    expect(phases[0].columns.map((c) => c.stage)).toEqual(["PRE_SELECTED", "INVITED", "SELF_ENROLLED", "FORM_STARTED"]);
  });

  it("coluna que a API não mandou simplesmente não aparece", () => {
    const b = board({});
    b.columns = b.columns.filter((c) => c.stage !== "PRE_SELECTED");
    expect(groupColumnsByPhase(b)[0].columns.map((c) => c.stage)).not.toContain("PRE_SELECTED");
  });
});

describe("vipInviteSituation", () => {
  it("convite válido sem resposta: não abriu, pode reenviar (último envio > 12 h)", () => {
    expect(vipInviteSituation(card(), NOW)).toMatchObject({ label: "Não abriu", canResend: true });
  });

  it("link vencido: avisa e deixa reenviar (renova a validade)", () => {
    const s = vipInviteSituation(card({ inviteExpiresAt: new Date(NOW.getTime() - HOUR).toISOString() }), NOW);
    expect(s).toMatchObject({ label: "Link vencido", tone: "warn", canResend: true });
  });

  it("começou o formulário", () => {
    expect(vipInviteSituation(card({ status: "FORM_STARTED" }), NOW).label).toBe("Começou o formulário");
  });

  it("enviado há menos de 12 h: não deixa reenviar e diz por quê", () => {
    const s = vipInviteSituation(card({ lastInviteSentAt: new Date(NOW.getTime() - 2 * HOUR).toISOString() }), NOW);
    expect(s.canResend).toBe(false);
    expect(s.blockedReason).toMatch(/12 h/);
  });

  it("inscrito pelo link: sem convite para reenviar", () => {
    expect(vipInviteSituation(card({ source: "LINK", status: "FORM_STARTED" }), NOW).canResend).toBe(false);
  });

  it("inscrito pelo link que não começou: 'Entrou pelo link', não 'Não abriu'", () => {
    const s = vipInviteSituation(card({ source: "LINK", status: "SELF_ENROLLED", invitedAt: null, inviteExpiresAt: null, lastInviteSentAt: null }), NOW);
    expect(s.label).toBe("Entrou pelo link");
    expect(s.canResend).toBe(false);
  });

  it("reenvio recente (lastInviteSentAt) trava; sem reenvio vale o invitedAt", () => {
    const recent = card({ invitedAt: "2026-09-20T12:00:00.000Z", lastInviteSentAt: new Date(NOW.getTime() - HOUR).toISOString() });
    expect(vipInviteSituation(recent, NOW).canResend).toBe(false);
    const old = card({ invitedAt: "2026-09-20T12:00:00.000Z", lastInviteSentAt: null });
    expect(vipInviteSituation(old, NOW).canResend).toBe(true);
  });

  it("API antiga (sem datas): usa invitedAt ausente como 'pode reenviar'", () => {
    const s = vipInviteSituation(card({ invitedAt: undefined, inviteExpiresAt: undefined, lastInviteSentAt: undefined }), NOW);
    expect(s).toMatchObject({ label: "Não abriu", canResend: true });
  });
});

describe("vipTodoCounts", () => {
  it("conta o que depende de você e os convites sem resposta", () => {
    const b = board({
      INVITED: [card(), card({ id: "a2" })],
      WAITLIST: [card({ id: "w", status: "WAITLIST" })],
      INTERVIEW_SCHEDULED: [card({ id: "i", status: "INTERVIEW_SCHEDULED" })],
      REFERENCES_OK: [card({ id: "r", status: "REFERENCES_OK" })],
      BACKGROUND_OK: [card({ id: "b", status: "BACKGROUND_OK" })],
    });
    expect(vipTodoCounts(b, { cycleHasBackground: true })).toEqual({
      invitesWaiting: 2,
      waitlist: 1,
      interview: 1,
      requestBackground: 1,
      backgroundPending: 0,
      toApprove: 1,
    });
  });

  it("convites sem resposta: só quem veio da base (inscrito pelo link não é convite)", () => {
    const b = board({
      INVITED: [card()],
      FORM_STARTED: [card({ id: "l1", status: "FORM_STARTED", source: "LINK" }), card({ id: "b1", status: "FORM_STARTED" })],
    });
    expect(vipTodoCounts(b, { cycleHasBackground: false }).invitesWaiting).toBe(2);
  });

  it("ciclo sem antecedentes: referências ok contam como 'para aprovar'", () => {
    const b = board({ REFERENCES_OK: [card({ id: "r", status: "REFERENCES_OK" })] });
    expect(vipTodoCounts(b, { cycleHasBackground: false })).toMatchObject({ requestBackground: 0, toApprove: 1 });
  });
});

describe("vipEventLabel", () => {
  it("traduz as ações do histórico e cai no código quando não conhece", () => {
    expect(vipEventLabel("INVITED")).toBe("Convite enviado");
    expect(vipEventLabel("INVITE_RESENT")).toBe("Convite reenviado");
    expect(vipEventLabel("APPROVED")).toBe("Aprovado pela equipe");
    expect(vipEventLabel("ALGO_NOVO")).toBe("ALGO_NOVO");
  });
});

describe("vipInviteBudget", () => {
  it("quanto falta do orçamento e se a seleção passa dele", () => {
    expect(vipInviteBudget(40, 10, 20)).toEqual({ remaining: 30, over: false });
    expect(vipInviteBudget(40, 30, 20)).toEqual({ remaining: 10, over: true });
    expect(vipInviteBudget(40, 45, 0)).toEqual({ remaining: 0, over: false });
    expect(vipInviteBudget(40, 45, 1)).toEqual({ remaining: 0, over: true });
  });

  it("API antiga (sem alreadyInvited) trata como 0 convidados", () => {
    expect(vipInviteBudget(40, undefined, 40)).toEqual({ remaining: 40, over: false });
  });
});

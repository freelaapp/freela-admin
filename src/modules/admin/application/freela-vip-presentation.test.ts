import { describe, expect, it } from "vitest";
import {
  alertLabel,
  breakdownRows,
  cycleInviteBudget,
  filterKanbanCards,
  formatIndicator,
  formatMonth,
  moveCardBetweenColumns,
  pct,
  scoreBand,
  sortCardsByScore,
  validateQuestionDraft,
  validateScoringConfig,
  VIP_APPROVABLE_STATUSES,
  VIP_NON_REJECTABLE_STATUSES,
  VIP_RESCORABLE_STATUSES,
  VIP_STATUS_LABELS,
} from "./freela-vip-presentation";
import type { VipKanbanBoard, VipKanbanCard } from "../infrastructure/freela-vip-api";

const card = (over: Partial<VipKanbanCard>): VipKanbanCard => ({
  id: "a", status: "SCORED", providerGlobalId: "pg", source: "BASE", displayName: "Ana",
  city: "São Paulo", role: "garcom", totalScore: 80, alertsCount: 0, createdAt: "2026-09-20T00:00:00Z",
  ...over,
});

describe("scoreBand / pct", () => {
  it("faixas ≥70 alta, 50–69 média, <50 baixa, null sem", () => {
    expect(scoreBand(70)).toBe("alta");
    expect(scoreBand(69.9)).toBe("media");
    expect(scoreBand(50)).toBe("media");
    expect(scoreBand(49)).toBe("baixa");
    expect(scoreBand(null)).toBe("sem");
  });
  it("pct formata fração em % pt-BR e null em —", () => {
    expect(pct(0.4)).toBe("40%");
    expect(pct(0.356)).toBe("36%");
    expect(pct(null)).toBe("—");
  });
});

describe("kanban helpers", () => {
  const cards = [
    card({ id: "1", totalScore: 55, city: "Campinas" }),
    card({ id: "2", totalScore: null, role: "cozinheiro" }),
    card({ id: "3", totalScore: 91, displayName: "Bruno Lima" }),
  ];
  it("ordena por nota desc com nulos por último", () => {
    expect(sortCardsByScore(cards).map((c) => c.id)).toEqual(["3", "1", "2"]);
  });
  it("filtra por cidade, função e busca (case/acento-insensível)", () => {
    expect(filterKanbanCards(cards, { city: "campinas" }).map((c) => c.id)).toEqual(["1"]);
    expect(filterKanbanCards(cards, { role: "cozinheiro" }).map((c) => c.id)).toEqual(["2"]);
    expect(filterKanbanCards(cards, { search: "bruno" }).map((c) => c.id)).toEqual(["3"]);
    expect(filterKanbanCards(cards, {})).toHaveLength(3);
  });
  it("moveCardBetweenColumns move o card e ajusta contagens sem mutar o original", () => {
    const board: VipKanbanBoard = {
      columns: [
        { stage: "SCORED", title: "Nota calculada", count: 1, cards: [card({ id: "x" })] },
        { stage: "INTERVIEW_SCHEDULED", title: "Entrevista", count: 0, cards: [] },
      ],
      totalActive: 1, rejectedCount: 0, withdrewCount: 0,
    };
    const moved = moveCardBetweenColumns(board, "x", "INTERVIEW_SCHEDULED");
    expect(moved.columns[0].cards).toHaveLength(0);
    expect(moved.columns[0].count).toBe(0);
    expect(moved.columns[1].cards[0]).toMatchObject({ id: "x", status: "INTERVIEW_SCHEDULED" });
    expect(moved.columns[1].count).toBe(1);
    expect(board.columns[0].cards).toHaveLength(1); // original intacto
  });
});

describe("validateScoringConfig", () => {
  const ok = {
    weights: { totalTimeInRole: 30, averageTimePerJob: 20, highVolume: 15, practicalQuestions: 15, proof: 10, courseCertificate: 5, availabilityTransport: 5 },
    cutoffs: { high: 70, waitlist: 50 },
  };
  it("config padrão é válida", () => {
    expect(validateScoringConfig(ok)).toEqual([]);
  });
  it("pesos ≠ 100, negativo, cortes invertidos", () => {
    expect(validateScoringConfig({ ...ok, weights: { ...ok.weights, proof: 20 } })).toContain("Os pesos devem somar 100 (soma atual: 110).");
    expect(validateScoringConfig({ ...ok, weights: { ...ok.weights, proof: -5, totalTimeInRole: 45 } })).toContain("Peso não pode ser negativo: proof.");
    expect(validateScoringConfig({ ...ok, cutoffs: { high: 50, waitlist: 70 } })).toContain("O corte alto deve ser maior que o de lista de espera.");
    expect(validateScoringConfig({ ...ok, cutoffs: { high: 120, waitlist: 50 } })).toContain("Cortes devem ficar entre 0 e 100.");
  });
});

describe("validateQuestionDraft", () => {
  it("válida: texto, ≥2 opções, pontos alinhados", () => {
    expect(validateQuestionDraft({ role: "garcom", text: "Q?", options: ["a", "b"], pointsPerOption: [0, 10] })).toEqual([]);
  });
  it("erros: função vazia, texto vazio, <2 opções, opção vazia, pontos desalinhados/negativos", () => {
    const errs = validateQuestionDraft({ role: "", text: " ", options: ["a", ""], pointsPerOption: [5] });
    expect(errs).toContain("Informe a função.");
    expect(errs).toContain("Informe o texto da pergunta.");
    expect(errs).toContain("Opção 2 está vazia.");
    expect(errs).toContain("Cada opção precisa de um valor de pontos.");
    expect(validateQuestionDraft({ role: "g", text: "t", options: ["a"], pointsPerOption: [1] })).toContain("Informe pelo menos 2 opções.");
    expect(validateQuestionDraft({ role: "g", text: "t", options: ["a", "b"], pointsPerOption: [1, -1] })).toContain("Pontos não podem ser negativos.");
  });
});

describe("formatIndicator", () => {
  it("percentual: ok quando atual ≥ meta", () => {
    expect(formatIndicator({ atual: 0.45, meta: 0.4 }, "percent")).toEqual({ atual: "45%", meta: "≥ 40%", ok: true });
    expect(formatIndicator({ atual: 0.3, meta: 0.4 }, "percent").ok).toBe(false);
  });
  it("dias: ok quando atual ≤ meta; ratio; null → — e ok null", () => {
    expect(formatIndicator({ atual: 18.4, meta: 21 }, "days")).toEqual({ atual: "18 dias", meta: "≤ 21 dias", ok: true });
    expect(formatIndicator({ atual: 1.2, meta: 1.5 }, "ratio")).toEqual({ atual: "1,2", meta: "≥ 1,5", ok: false });
    expect(formatIndicator({ atual: null, meta: 0.7 }, "percent")).toEqual({ atual: "—", meta: "≥ 70%", ok: null });
  });
});

describe("misc", () => {
  it("orçamento de convites = vagas × convites por vaga", () => {
    expect(cycleInviteBudget({ targetVacancies: 5, invitesPerVacancy: 4 })).toBe(20);
  });
  it("breakdownRows aceita número ou objeto com points/score", () => {
    expect(breakdownRows({ proof: 10, highVolume: { points: 7, max: 15 } })).toEqual([
      { key: "proof", value: 10, max: null },
      { key: "highVolume", value: 7, max: 15 },
    ]);
    expect(breakdownRows(null)).toEqual([]);
  });
  it("breakdownRows usa weight como max quando o api não manda max, e preserva detail", () => {
    const rows = breakdownRows({ totalTimeInRole: { weight: 20, fraction: 0.75, points: 15, detail: "3 anos" } });
    expect(rows).toEqual([{ key: "totalTimeInRole", value: 15, max: 20, detail: "3 anos" }]);
    expect(Math.round((rows[0].value / (rows[0].max as number)) * 100)).toBe(75);
  });
  it("breakdownRows gera max null quando o critério não tem weight nem max", () => {
    expect(breakdownRows({ x: { points: 5, detail: "y" } })).toEqual([{ key: "x", value: 5, max: null, detail: "y" }]);
  });
  it("alertLabel traduz código conhecido e mantém desconhecido", () => {
    expect(alertLabel("FORM_TOO_FAST")).toBe("Formulário preenchido rápido demais");
    expect(alertLabel({ code: "SHARED_REFERENCE_PHONE" })).toBe("Telefone de referência repetido");
    expect(alertLabel("X_Y")).toBe("X_Y");
  });
  it("todos os 17 status têm rótulo", () => {
    expect(Object.keys(VIP_STATUS_LABELS)).toHaveLength(17);
  });
  it("formatMonth converte ISO em mm/aaaa em UTC (sem deslocar o mês por fuso); null/invalido em —", () => {
    expect(formatMonth("2024-03-01T00:00:00.000Z")).toBe("03/2024");
    expect(formatMonth(null)).toBe("—");
    expect(formatMonth(undefined)).toBe("—");
    expect(formatMonth("not-a-date")).toBe("—");
  });
});

describe("status legais da ficha (espelham o api)", () => {
  // vip-manual-funnel.service.ts APPROVAL_NEXT: só INTERVIEW_SCHEDULED→REFERENCES_OK
  // e BACKGROUND_OK→VIP_ACTIVE são oferecidos como "Aprovar etapa" na ficha.
  it("VIP_APPROVABLE_STATUSES: só entrevista agendada e antecedentes ok", () => {
    expect([...VIP_APPROVABLE_STATUSES]).toEqual(["INTERVIEW_SCHEDULED", "BACKGROUND_OK"]);
  });
  // vip-scoring.service.ts RESCORABLE_STATUSES — FORM_SUBMITTED NÃO está na lista real do api.
  it("VIP_RESCORABLE_STATUSES: nota calculada, lista de espera, entrevista e referências ok (sem FORM_SUBMITTED)", () => {
    expect([...VIP_RESCORABLE_STATUSES]).toEqual(["SCORED", "WAITLIST", "INTERVIEW_SCHEDULED", "REFERENCES_OK"]);
    expect(VIP_RESCORABLE_STATUSES).not.toContain("FORM_SUBMITTED");
  });
  // vip-status-machine.ts: BACKGROUND_OK só transiciona para VIP_ACTIVE (reprovar é 409); os
  // demais são os status terminais (sem transições de saída).
  it("VIP_NON_REJECTABLE_STATUSES: terminais + antecedentes ok", () => {
    expect([...VIP_NON_REJECTABLE_STATUSES]).toEqual(["VIP_ACTIVE", "VIP_SUSPENDED", "REJECTED", "WITHDREW", "BACKGROUND_OK"]);
  });
});

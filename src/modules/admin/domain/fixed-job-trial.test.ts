import { describe, expect, it } from "vitest";

import {
  TRIAL_STATUS_LABEL,
  saoPauloDayMonth,
  toSaoPauloDateInput,
  todaySaoPauloDateInput,
  trialEditCheck,
  trialListBadge,
  trialUsageLabel,
  type FixedJobTrialSummary,
} from "./fixed-job-trial";

/**
 * Teste de vaga fixa (CLT) liberado pelo admin — rótulos do painel de
 * Assinaturas. Datas sempre no dia de Brasília: a API grava o fim do dia
 * (23:59:59 BRT = 02:59:59Z do dia seguinte), e mostrar em UTC daria um dia a mais.
 */
const ACTIVE: FixedJobTrialSummary = {
  quota: 1,
  used: 0,
  remaining: 1,
  expiresAt: "2026-10-14T02:59:59.999Z",
  status: "ACTIVE",
};

describe("teste de vaga fixa — rótulos do painel", () => {
  it("status em português", () => {
    expect(TRIAL_STATUS_LABEL).toEqual({
      ACTIVE: "Ativo",
      EXHAUSTED: "Esgotado",
      EXPIRED: "Vencido",
      REVOKED: "Encerrado",
    });
  });

  it("uso com plural certo", () => {
    expect(trialUsageLabel({ quota: 1, used: 0 })).toBe("0 de 1 vaga usada");
    expect(trialUsageLabel({ quota: 3, used: 1 })).toBe("1 de 3 vagas usadas");
  });

  it("datas no dia de Brasília", () => {
    expect(saoPauloDayMonth(ACTIVE.expiresAt)).toBe("13/10");
    expect(toSaoPauloDateInput(ACTIVE.expiresAt)).toBe("2026-10-13");
  });

  it("hoje no dia de Brasília (00:30 UTC ainda é o dia anterior)", () => {
    expect(todaySaoPauloDateInput(new Date("2026-09-30T00:30:00.000Z"))).toBe("2026-09-29");
    expect(todaySaoPauloDateInput(new Date("2026-09-29T13:00:00.000Z"))).toBe("2026-09-29");
  });

  /**
   * A coluna "Teste vaga fixa" da listagem: o teste valendo mostra uso e prazo;
   * o que acabou aparece como acabou — sem isso parecia "nunca teve teste".
   */
  it("selo da listagem: ativo com uso e prazo, acabado com o motivo", () => {
    expect(trialListBadge(ACTIVE)).toEqual({ label: "0/1 até 13/10", active: true });
    expect(trialListBadge({ ...ACTIVE, used: 1, remaining: 0, status: "EXHAUSTED" })).toEqual({
      label: "Teste esgotado",
      active: false,
    });
    expect(trialListBadge({ ...ACTIVE, status: "EXPIRED" })).toEqual({
      label: "Teste vencido",
      active: false,
    });
    expect(trialListBadge({ ...ACTIVE, status: "REVOKED" })).toEqual({
      label: "Teste encerrado",
      active: false,
    });
    expect(trialListBadge(null)).toBeNull();
    expect(trialListBadge(undefined)).toBeNull();
  });
});

/**
 * "Salvar alteração" do teste. Vencido só volta a valer com data nova (de hoje
 * em diante): salvar só o total não reativa nada, então o botão fica travado e
 * a tela explica o porquê.
 */
describe("teste de vaga fixa — pode salvar a alteração?", () => {
  const TODAY = "2026-09-29";
  const base = { quotaChanged: false, dateChanged: false, newDate: "2026-10-13", today: TODAY };

  it("ativo ou esgotado: salva quando muda total ou data, sem aviso", () => {
    for (const status of ["ACTIVE", "EXHAUSTED"] as const) {
      expect(trialEditCheck({ ...base, status })).toEqual({ canSave: false, hint: null });
      expect(trialEditCheck({ ...base, status, quotaChanged: true })).toEqual({
        canSave: true,
        hint: null,
      });
      expect(trialEditCheck({ ...base, status, dateChanged: true })).toEqual({
        canSave: true,
        hint: null,
      });
    }
  });

  it("vencido: avisa que precisa de data nova e não salva só o total", () => {
    const expired = { ...base, status: "EXPIRED" as const, newDate: "2026-09-19" };

    const untouched = trialEditCheck(expired);
    expect(untouched.canSave).toBe(false);
    expect(untouched.hint).toMatch(/nova data/i);

    const quotaOnly = trialEditCheck({ ...expired, quotaChanged: true });
    expect(quotaOnly.canSave).toBe(false);
    expect(quotaOnly.hint).toMatch(/nova data/i);
  });

  it("vencido: data movida mas ainda no passado não salva", () => {
    const check = trialEditCheck({
      ...base,
      status: "EXPIRED",
      dateChanged: true,
      newDate: "2026-09-28",
    });
    expect(check.canSave).toBe(false);
    expect(check.hint).toMatch(/nova data/i);
  });

  it("vencido: data de hoje em diante reativa (com ou sem total novo)", () => {
    const expired = { ...base, status: "EXPIRED" as const, dateChanged: true };
    expect(trialEditCheck({ ...expired, newDate: TODAY })).toEqual({ canSave: true, hint: null });
    expect(trialEditCheck({ ...expired, quotaChanged: true, newDate: "2026-10-05" })).toEqual({
      canSave: true,
      hint: null,
    });
  });
});

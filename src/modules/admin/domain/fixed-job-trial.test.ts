import { describe, expect, it } from "vitest";

import {
  TRIAL_STATUS_LABEL,
  saoPauloDayMonth,
  toSaoPauloDateInput,
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

  it("selo da listagem só para teste ativo", () => {
    expect(trialListBadge(ACTIVE)).toBe("0/1 até 13/10");
    expect(trialListBadge({ ...ACTIVE, used: 1, remaining: 0, status: "EXHAUSTED" })).toBeNull();
    expect(trialListBadge(null)).toBeNull();
    expect(trialListBadge(undefined)).toBeNull();
  });
});

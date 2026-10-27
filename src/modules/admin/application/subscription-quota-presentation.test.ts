import { describe, expect, it } from "vitest";
import {
  canAdjustQuota,
  quotaCell,
  quotaSummary,
} from "./subscription-quota-presentation";

const gr = (used: number) => ({
  periodYm: "2026-10",
  limit: 30,
  used,
  remaining: Math.max(0, 30 - used),
  overQuota: "CONTACT_SALES" as const,
});
const semLimite = {
  periodYm: "2026-10",
  limit: null,
  used: 4,
  remaining: null,
  overQuota: null,
};

describe("cota do mês na tela de Assinaturas", () => {
  it('Grátis e Vip (sem limite): nunca "null de null"', () => {
    expect(quotaSummary(semLimite)).toBe("Sem limite · 4 no mês");
    expect(quotaCell(semLimite)).toEqual({ text: "4", flag: null });
    expect(canAdjustQuota(semLimite)).toBe(false);
  });

  it("Grandes Redes: usadas de 30 e quanto resta", () => {
    expect(quotaSummary(gr(12))).toBe("12 de 30 usadas · restam 18");
    expect(quotaCell(gr(12))).toEqual({ text: "12 de 30", flag: null });
    expect(canAdjustQuota(gr(12))).toBe(true);
  });

  it("perto do limite avisa; no limite fica vermelho", () => {
    expect(quotaCell(gr(27)).flag).toEqual({
      label: "faltam 3",
      variant: "warning",
    });
    expect(quotaCell(gr(30)).flag).toEqual({
      label: "no limite",
      variant: "destructive",
    });
  });

  it("sem dado (API antiga ou falha): traço e sem ajuste", () => {
    expect(quotaSummary(null)).toBe("—");
    expect(quotaCell(undefined)).toEqual({ text: "—", flag: null });
    expect(canAdjustQuota(null)).toBe(false);
  });
});

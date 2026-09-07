import { describe, expect, it } from "vitest";

import { computeVacancyMoney, INSS_RATE_PERCENT } from "./vacancy-money";

/**
 * Espelha a decisão do dono (2026-09-05): a plataforma cobra do contratante SÓ o
 * serviço (cobrança = base). O repasse é IMUTÁVEL (= repasseLiquidoInCents
 * decomposto) e o INSS é PROVISÃO recolhida À PARTE pelo contratante (guia/eSocial),
 * fora da plataforma — NÃO entra na cobrança nem sai do repasse. Nossa margem
 * (resíduo) = base − repasse (= taxa de serviço + pix + seguro). Referência 6h
 * Garçom empresa: base 15600, repasse 11995, INSS 1319 (à parte), cobrança 15600,
 * resíduo 3605.
 */
describe("computeVacancyMoney", () => {
  it("decomposto (empresa): usa o repasse real, cobrança = só o serviço, INSS à parte, resíduo = base − repasse", () => {
    const m = computeVacancyMoney({
      payment: 15600,
      freelancerAmountInCents: 12480, // net 80% legado — deve ser IGNORADO
      platformFeeInCents: 3120,
      fixedFeeInCents: 185,
      repasseLiquidoInCents: 11995,
    });

    expect(m.decomposed).toBe(true);
    expect(m.repasseCents).toBe(11995); // repasse real, não o net de 80% (12480)
    expect(m.inssCents).toBe(1319); // round(11995 × 11%) — informativo, a recolher à parte
    expect(m.contractorPaidCents).toBe(15600); // = base (só o serviço; INSS é à parte, fora da plataforma)
    expect(m.residuoCents).toBe(3605); // 15600 − 11995 (= taxa + pix + seguro)

    // Reconciliação: cobrança = resíduo + repasse (o INSS NÃO entra — é recolhido à parte).
    expect(m.residuoCents + m.repasseCents).toBe(m.contractorPaidCents);
  });

  it("legado (Casa / flag OFF / vaga antiga): net de 80%, sem INSS, resíduo = taxa + fixa", () => {
    const m = computeVacancyMoney({
      payment: 15000,
      freelancerAmountInCents: 12000,
      platformFeeInCents: 3000,
      fixedFeeInCents: 185,
      repasseLiquidoInCents: null,
    });

    expect(m.decomposed).toBe(false);
    expect(m.repasseCents).toBe(12000);
    expect(m.inssCents).toBe(0);
    expect(m.contractorPaidCents).toBe(15000); // = base, sem INSS (legado nunca decompõe)
    expect(m.residuoCents).toBe(3185); // 3000 + 185 (taxa % + taxa fixa)
  });

  it("legado com campos ausentes: trata como 0 (sem quebrar)", () => {
    const m = computeVacancyMoney({ payment: 10000 });
    expect(m.decomposed).toBe(false);
    expect(m.repasseCents).toBe(0);
    expect(m.inssCents).toBe(0);
    expect(m.contractorPaidCents).toBe(10000);
    expect(m.residuoCents).toBe(0);
  });

  it("INSS_RATE_PERCENT espelha o backend (11%)", () => {
    expect(INSS_RATE_PERCENT).toBe(11);
  });
});

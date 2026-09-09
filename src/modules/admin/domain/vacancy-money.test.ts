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
    // Sem os campos explícitos da API cai na conta antiga: 15600 − 11995.
    expect(m.residuoCents).toBe(3605);
    expect(m.reconciles).toBe(true);
  });

  it("decomposto com os campos da API: taxa/pix/seguro/INSS vêm de lá e a conta fecha", () => {
    // Vaga real de produção (09/09/2026): 156,06 = 31,21 + 1,85 + 3,00 + 120,00; INSS 13,20 à parte.
    const m = computeVacancyMoney({
      payment: 15606,
      freelancerAmountInCents: 12484, // net legado — ignorado
      platformFeeInCents: 3122, // bruto — ignorado (a taxa decomposta manda)
      fixedFeeInCents: 185,
      repasseLiquidoInCents: 12000,
      taxaServicoInCents: 3121,
      seguroInCents: 300,
      inssInCents: 1320,
      providerTakeInCents: 12000,
      platformMarginInCents: 3121,
      subscriptionDiscountInCents: 0,
    });
    expect(m.repasseCents).toBe(12000);
    expect(m.taxaServicoCents).toBe(3121);
    expect(m.pixCents).toBe(185);
    expect(m.seguroCents).toBe(300);
    expect(m.inssCents).toBe(1320); // o da API, não recalculado
    expect(m.residuoCents).toBe(3121 + 185); // margem + pix; seguro vai à seguradora
    expect(m.reconciles).toBe(true);
    expect(m.taxaServicoCents! + m.pixCents! + m.seguroCents! + m.repasseCents).toBe(15606);
  });

  it("decomposto com plano: a taxa da API já vem líquida do desconto e o desconto aparece", () => {
    // Produção: base 126,00, desconto 12,60 → taxa 12,60 (bruta 25,20); pago 113,40.
    const m = computeVacancyMoney({
      payment: 11340,
      platformFeeInCents: 2520,
      fixedFeeInCents: 185,
      repasseLiquidoInCents: 9595,
      taxaServicoInCents: 1260,
      seguroInCents: 300,
      inssInCents: 1055,
      subscriptionDiscountInCents: 1260,
    });
    expect(m.taxaServicoCents).toBe(1260);
    expect(m.discountCents).toBe(1260);
    expect(m.reconciles).toBe(true);
  });

  it("decomposto que NÃO fecha: sinaliza para o painel alertar", () => {
    const m = computeVacancyMoney({
      payment: 15000,
      fixedFeeInCents: 185,
      repasseLiquidoInCents: 12000,
      taxaServicoInCents: 3121,
      seguroInCents: 300,
    });
    expect(m.reconciles).toBe(false);
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
    expect(m.reconciles).toBe(true);
  });

  it("legado com plano: a margem é a taxa bruta menos o desconto (a bruta sozinha inflava)", () => {
    const m = computeVacancyMoney({
      payment: 14685, // 15000 − 500 + 185
      freelancerAmountInCents: 12000,
      platformFeeInCents: 3000,
      fixedFeeInCents: 185,
      subscriptionDiscountInCents: 500,
    });
    expect(m.taxaServicoCents).toBe(2500);
    expect(m.discountCents).toBe(500);
    expect(m.residuoCents).toBe(2500 + 185);
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

/**
 * Dinheiro de uma vaga no painel, no modelo INSS por cima (spec 2026-09-04) já
 * aplicado em API/web/app. O admin recebe do backend campos legados
 * (`payment`/`freelancerAmountInCents`/`platformFeeInCents`/`fixedFeeInCents`) e,
 * quando a vaga é decomposta (empresa + flag), também o `repasseLiquidoInCents`
 * — o repasse REAL e imutável que o freelancer recebe. Deste helper saem os
 * números que o painel exibe, reconciliando sempre.
 *
 * Modelo novo (repasseLiquidoInCents presente):
 *   • repasse   = repasseLiquidoInCents            (imutável; NÃO o net de 80%)
 *   • INSS      = round(repasse × 11%)             (provisionado, pago por cima)
 *   • cobrança  = payment + INSS                   (o contratante paga o INSS por cima)
 *   • resíduo   = payment − repasse                (nossa margem = taxa + pix + seguro)
 *   e cobrança = resíduo + repasse + INSS.
 *
 * Modelo legado (Casa / flag OFF / vaga antiga): net de 80%, sem INSS, resíduo =
 * taxa % + taxa fixa — byte-idêntico ao que o painel mostrava antes (só o rótulo
 * "lucro" vira "resíduo").
 */

/** Alíquota do INSS provisionado. Espelha INSS_RATE_PERCENT do backend/web/app. */
export const INSS_RATE_PERCENT = 11;

export type VacancyMoneyInput = {
  /** Valor da vaga (total do serviço) em centavos. */
  payment: number;
  freelancerAmountInCents?: number | null;
  platformFeeInCents?: number | null;
  fixedFeeInCents?: number | null;
  /** Repasse líquido decomposto (empresa + flag). Presente = modelo novo. */
  repasseLiquidoInCents?: number | null;
};

export type VacancyMoney = {
  /** true quando a vaga é decomposta (INSS por cima). */
  decomposed: boolean;
  /** O que o freelancer REALMENTE recebe (repasse decomposto, ou net legado). */
  repasseCents: number;
  /** INSS provisionado em nome do freelancer, pago POR CIMA pelo contratante.
   *  0 no legado. */
  inssCents: number;
  /** O que o contratante paga: base + INSS (decomposto) ou base (legado). */
  contractorPaidCents: number;
  /** Nossa margem (resíduo): base − repasse (decomposto) ou taxa % + taxa fixa (legado). */
  residuoCents: number;
};

export function computeVacancyMoney(v: VacancyMoneyInput): VacancyMoney {
  const payment = Math.max(0, Math.trunc(v.payment ?? 0));
  const decomposedRepasse = v.repasseLiquidoInCents;

  if (decomposedRepasse != null) {
    const repasseCents = Math.max(0, Math.trunc(decomposedRepasse));
    const inssCents = Math.round((repasseCents * INSS_RATE_PERCENT) / 100);
    return {
      decomposed: true,
      repasseCents,
      inssCents,
      contractorPaidCents: payment + inssCents, // INSS por cima
      residuoCents: payment - repasseCents, // = taxa de serviço + pix + seguro
    };
  }

  // Legado (Casa / flag OFF / vaga antiga): net de 80%, sem INSS. O resíduo segue
  // a conta antiga (taxa % + taxa fixa) para não mudar nenhum número — só o rótulo.
  return {
    decomposed: false,
    repasseCents: Math.max(0, Math.trunc(v.freelancerAmountInCents ?? 0)),
    inssCents: 0,
    contractorPaidCents: payment,
    residuoCents: (v.platformFeeInCents ?? 0) + (v.fixedFeeInCents ?? 0),
  };
}

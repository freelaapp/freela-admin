/**
 * Dinheiro de uma vaga no painel. Decisão do dono (2026-09-05): a PLATAFORMA cobra
 * do contratante SÓ o valor do serviço. O INSS é PROVISÃO recolhida À PARTE pelo
 * CONTRATANTE (guia/eSocial), em nome do freelancer — NÃO passa pela plataforma,
 * NÃO sai do repasse. Logo, "o que o contratante pagou À PLATAFORMA" = o serviço
 * (payment), SEM somar o INSS; o INSS é uma linha SEPARADA (a recolher fora).
 *
 * O admin recebe do backend campos legados
 * (`payment`/`freelancerAmountInCents`/`platformFeeInCents`/`fixedFeeInCents`) e,
 * quando a vaga é decomposta (empresa + flag), também o `repasseLiquidoInCents`
 * — o repasse REAL e imutável que o freelancer recebe. Deste helper saem os
 * números que o painel exibe, reconciliando sempre.
 *
 * Modelo novo (repasseLiquidoInCents presente):
 *   • repasse   = repasseLiquidoInCents            (imutável; NÃO o net de 80%)
 *   • cobrança  = payment                          (a plataforma cobra só o serviço)
 *   • resíduo   = payment − repasse                (nossa margem = taxa + pix + seguro)
 *   • INSS      = round(repasse × 11%)             (provisão SEPARADA, a recolher FORA
 *                                                   da plataforma pelo contratante;
 *                                                   NÃO entra na cobrança nem no repasse)
 *   e cobrança = resíduo + repasse.
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
  /** true quando a vaga é decomposta (empresa + flag): repasse imutável + INSS à parte. */
  decomposed: boolean;
  /** O que o freelancer REALMENTE recebe (repasse decomposto, ou net legado). */
  repasseCents: number;
  /** INSS provisionado em nome do freelancer, recolhido À PARTE (fora da plataforma)
   *  pelo contratante via guia/eSocial. NÃO entra no que foi pago à plataforma nem
   *  sai do repasse. 0 no legado. */
  inssCents: number;
  /** O que o contratante paga À PLATAFORMA: só o serviço (= payment), decomposto ou
   *  legado. O INSS é recolhido à parte, fora da plataforma, e NÃO entra aqui. */
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
      contractorPaidCents: payment, // a plataforma cobra só o serviço; INSS é à parte, fora da plataforma
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

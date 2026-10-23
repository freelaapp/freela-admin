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
 *
 * Fórmula v2 (`feeBasis: 'NET'`, decisão de 23/10/2026, arquitetura §1.9): a taxa
 * é o % do plano sobre o valor do freelancer, por fora (R$ 100,00 a 10% → 10,00;
 * pago 114,85). Os números são os mesmos campos decompostos; muda só o rótulo
 * ("Taxa de serviço (10% do valor do freelancer)") e não existe desconto do plano.
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
  /** Campos da API (09/09/2026): quando vêm, mandam — a API é a fonte única. */
  subscriptionDiscountInCents?: number | null;
  taxaServicoInCents?: number | null;
  seguroInCents?: number | null;
  inssInCents?: number | null;
  providerTakeInCents?: number | null;
  platformMarginInCents?: number | null;
  /**
   * Vaga extra da cota do plano (API-0b, 22/10/2026). Na vaga decomposta a API
   * já a soma em `taxaServicoInCents` e em `payment`; vem à parte para a tela
   * mostrar em linha própria.
   */
  extraJobFeeInCents?: number | null;
  /** Fórmula da taxa congelada na vaga (api #614). Ausente = `GROSS`. */
  feeBasis?: "GROSS" | "NET" | null;
  /** Taxa do plano congelada na vaga, em %; na `NET`, sobre o valor do freelancer. */
  lockedPlanFeePercent?: number | null;
};

export type VacancyMoney = {
  /** Fórmula da taxa: `NET` (v2) ou `GROSS` (a conta de antes; também sem o campo). */
  feeBasis: "GROSS" | "NET";
  /**
   * Rótulo da linha da taxa: "Taxa de serviço" (GROSS) ou "Taxa de serviço (10% do
   * valor do freelancer)" (NET).
   */
  intermediationLabel: string;
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
  /**
   * Nosso resíduo: margem real + taxa Pix — o que fica conosco antes da taxa do
   * gateway (mesma conta do lucro do financeiro). O seguro NÃO entra: é repassado
   * à seguradora. Sem a decomposição da API, cai na conta antiga (base − repasse
   * no decomposto; taxa % + taxa fixa no legado).
   */
  residuoCents: number;
  /** Taxa de serviço (margem real, já líquida do desconto do plano). null = API sem o campo.
   *  Na vaga decomposta inclui a vaga extra; para mostrar, use `intermediationCents`. */
  taxaServicoCents: number | null;
  /** Vaga extra da cota do plano (0 = sem vaga extra). */
  extraJobFeeCents: number;
  /**
   * A taxa de serviço sem a vaga extra: o que a tela chama de "Taxa de serviço",
   * com a vaga extra em linha própria embaixo. Decomposta: taxa − vaga extra
   * (a API soma as duas). Legado: a margem antiga, que não inclui a vaga extra.
   * null = taxa desconhecida.
   */
  intermediationCents: number | null;
  /** Taxa Pix (fixa por vaga). */
  pixCents: number | null;
  /** Seguro (repassado à seguradora). Só decomposta. */
  seguroCents: number | null;
  /** Desconto do plano já abatido da taxa (0 = sem plano). Sempre 0 na `NET`. */
  discountCents: number;
  /**
   * A conta fecha? Decomposta: taxa + pix + seguro + repasse === pago. Legado
   * (sem os campos) não tem como conferir: true. false = mostrar alerta no painel.
   */
  reconciles: boolean;
};

/** Rótulo da taxa pela fórmula da vaga. */
function intermediationLabelFor(feeBasis: "GROSS" | "NET", lockedPlanFeePercent: number | null | undefined): string {
  if (feeBasis !== "NET") return "Taxa de serviço";
  if (typeof lockedPlanFeePercent !== "number" || !Number.isFinite(lockedPlanFeePercent)) {
    return "Taxa de serviço (sobre o valor do freelancer)";
  }
  const percent = lockedPlanFeePercent.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `Taxa de serviço (${percent}% do valor do freelancer)`;
}

export function computeVacancyMoney(v: VacancyMoneyInput): VacancyMoney {
  const payment = Math.max(0, Math.trunc(v.payment ?? 0));
  const decomposedRepasse = v.repasseLiquidoInCents;
  const feeBasis = v.feeBasis === "NET" ? "NET" : "GROSS";
  const intermediationLabel = intermediationLabelFor(feeBasis, v.lockedPlanFeePercent);
  // A v2 não tem desconto do plano: a taxa já é o % do plano sobre o valor do freelancer.
  const discountCents = feeBasis === "NET" ? 0 : Math.max(0, Math.trunc(v.subscriptionDiscountInCents ?? 0));
  const pixCents = v.fixedFeeInCents ?? null;
  const extraJobFeeCents = Math.max(0, Math.trunc(v.extraJobFeeInCents ?? 0));

  if (decomposedRepasse != null) {
    const repasseCents = Math.max(0, Math.trunc(v.providerTakeInCents ?? decomposedRepasse));
    // INSS: o da API (persistido na publicação) quando vem; senão a mesma regra.
    const inssCents =
      v.inssInCents != null
        ? Math.max(0, Math.trunc(v.inssInCents))
        : Math.round((repasseCents * INSS_RATE_PERCENT) / 100);
    const taxaServicoCents = v.taxaServicoInCents ?? v.platformMarginInCents ?? null;
    const seguroCents = v.seguroInCents ?? null;
    const hasBreakdown = taxaServicoCents != null && pixCents != null && seguroCents != null;
    return {
      feeBasis,
      intermediationLabel,
      decomposed: true,
      repasseCents,
      inssCents,
      contractorPaidCents: payment, // a plataforma cobra só o serviço; INSS é à parte, fora da plataforma
      residuoCents: hasBreakdown ? taxaServicoCents + pixCents : payment - repasseCents,
      taxaServicoCents,
      extraJobFeeCents,
      intermediationCents: taxaServicoCents == null ? null : taxaServicoCents - extraJobFeeCents,
      pixCents,
      seguroCents,
      discountCents,
      reconciles: hasBreakdown
        ? taxaServicoCents + pixCents + seguroCents + repasseCents === payment
        : true,
    };
  }

  // Legado (Casa / flag OFF / vaga antiga): net de 80%, sem INSS. A margem é a
  // taxa bruta MENOS o desconto do plano (ou a `platformMarginInCents` da API);
  // o resíduo soma a taxa fixa, como o financeiro.
  const margin =
    v.platformMarginInCents ??
    (v.platformFeeInCents != null ? Math.max(0, v.platformFeeInCents - discountCents) : null);
  return {
    feeBasis,
    intermediationLabel,
    decomposed: false,
    repasseCents: Math.max(0, Math.trunc(v.providerTakeInCents ?? v.freelancerAmountInCents ?? 0)),
    inssCents: 0,
    contractorPaidCents: payment,
    residuoCents: (margin ?? 0) + (pixCents ?? 0),
    taxaServicoCents: margin,
    extraJobFeeCents,
    intermediationCents: margin,
    pixCents,
    seguroCents: null,
    discountCents,
    reconciles: true,
  };
}

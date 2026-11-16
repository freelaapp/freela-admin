import type { FeedbackItem } from "@/modules/admin/infrastructure/admin-api";

/** Resumo de uma direção das avaliações (quem recebeu a nota). */
export interface RatingSummary {
  /** Quantas avaliações entraram na conta. */
  count: number;
  /** Soma das notas — guardada para a tela poder mostrar a conta inteira. */
  sum: number;
  /** soma ÷ quantidade; `null` sem nenhuma avaliação (zero seria uma nota falsa). */
  average: number | null;
}

export interface ReceivedRatings {
  /** Notas que os CONTRATANTES deram aos freelancers. */
  freelancers: RatingSummary;
  /** Notas que os FREELANCERS deram aos contratantes. */
  contractors: RatingSummary;
}

/**
 * Nota média RECEBIDA por cada lado. Na lista, `role` é quem ESCREVEU a
 * avaliação, então a nota do freelancer está nas linhas de autor CONTRACTOR e a
 * do contratante nas de autor PROVIDER. Papel desconhecido e nota que não é
 * número ficam fora da conta.
 */
export function summarizeReceivedRatings(
  feedbacks: ReadonlyArray<Pick<FeedbackItem, "role" | "rating">>,
): ReceivedRatings {
  const freelancers = { count: 0, sum: 0 };
  const contractors = { count: 0, sum: 0 };

  for (const f of feedbacks) {
    if (typeof f.rating !== "number" || !Number.isFinite(f.rating)) continue;
    const side =
      f.role === "CONTRACTOR" ? freelancers : f.role === "PROVIDER" ? contractors : null;
    if (!side) continue;
    side.count += 1;
    side.sum += f.rating;
  }

  const close = (side: { count: number; sum: number }): RatingSummary => ({
    ...side,
    average: side.count > 0 ? side.sum / side.count : null,
  });
  return { freelancers: close(freelancers), contractors: close(contractors) };
}

/** "4,62" — duas casas com vírgula, igual ao Dashboard; sem média, travessão. */
export function formatAverage(average: number | null): string {
  return average === null ? "—" : average.toFixed(2).replace(".", ",");
}

export function formatReviewCount(count: number): string {
  return `${count} ${count === 1 ? "avaliação" : "avaliações"}`;
}

/** A conta com as parcelas, para o "Ver a conta" do cartão. */
export function describeAverageCalc(summary: RatingSummary): string {
  if (summary.count === 0 || summary.average === null) {
    return "nenhuma avaliação nesta direção ainda, então não há média";
  }
  const soma = String(Number(summary.sum.toFixed(2))).replace(".", ",");
  const notas = summary.count === 1 ? "soma da 1 nota" : `soma das ${summary.count} notas`;
  return `${notas} (${soma}) ÷ ${formatReviewCount(summary.count)} = ${formatAverage(summary.average)}`;
}

import type { VacancyItem } from "@/modules/admin/infrastructure/admin-api";

/**
 * Em que etapa do funil a vaga está.
 *
 * Uma fonte só para a tabela e para o painel: são a MESMA lista desenhada de
 * dois jeitos, e dois vocabulários para o mesmo campo divergiriam na primeira
 * mudança de regra. Vive fora da página porque é a peça que decide em que
 * coluna cada vaga cai — a que mais merece teste isolado.
 */
export type VacancyBucket =
  /** Publicada, ainda sem ninguém se candidatando. */
  | "open"
  /** Tem candidato; falta o contratante escolher. */
  | "awaitingSelection"
  /** Freelancer escolhido; falta o contratante pagar. */
  | "awaitingPayment"
  /** Pago e agendado; freelancer confirmado para o turno. */
  | "confirmed"
  /** Freelancer fez check-in e ainda não fechou. */
  | "inProgress"
  /** Serviço concluído; falta avaliação — é ela que libera o repasse. */
  | "completedAwaitingReview"
  /** Ciclo fechado: concluído e avaliado dos dois lados. */
  | "completedReviewed"
  /** Passou do horário ainda aberta: expirou sem contratação. */
  | "lost"
  | "cancelled";

export function resolveVacancyBucket(v: VacancyItem, now: Date = new Date()): VacancyBucket {
  const status = v.status?.toUpperCase();
  const jobStatus = v.job?.status?.toUpperCase();

  if (status === "CANCELLED" || status === "CANCELLED_BY_CONTRACTOR") {
    return "cancelled";
  }

  if (jobStatus === "COMPLETED") {
    const reviewedBoth =
      Boolean(v.job?.hasContractorFeedback) && Boolean(v.job?.hasProviderFeedback);
    return reviewedBoth ? "completedReviewed" : "completedAwaitingReview";
  }

  if (jobStatus === "IN_PROGRESS") {
    return "inProgress";
  }

  // Job cancelado (vaga fechou mas o serviço foi cancelado) não é "aguardando".
  if (jobStatus === "CANCELLED") {
    return "cancelled";
  }

  // CLOSED = o contratante já escolheu o freelancer. O job só nasce DEPOIS do
  // pagamento, então a mera existência do job é o que separa "falta pagar" de
  // "pago e confirmado" — não há campo de pagamento no VacancyItem.
  if (status === "CLOSED") {
    return jobStatus ? "confirmed" : "awaitingPayment";
  }

  // OPEN: só conta como ativa se ainda dentro do prazo; caso contrário a vaga
  // expirou sem candidato aceito (perdida).
  const ref = v.endTime || v.startTime;
  if (ref) {
    const ms = Date.parse(ref);
    if (!Number.isNaN(ms) && ms < now.getTime()) {
      return "lost";
    }
  }

  // Aberta e no prazo. Ter ou não candidato muda quem está devendo a ação:
  // sem candidato o problema é de alcance (divulgação, preço, cidade); com
  // candidato o problema é o contratante que não escolheu. São filas diferentes.
  return (v.candidacyCount ?? 0) > 0 ? "awaitingSelection" : "open";
}

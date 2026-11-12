import type { HistoryCriteria, HistoryPreview, Readiness } from "../infrastructure/orientation-api";
import { apiErrorOf } from "../infrastructure/api-error";
import { formatCount, orientationErrorMessage } from "./orientation-presentation";

/** 4 → "4,0". */
export function formatRating(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

/**
 * Linhas da prévia do "Aprovar por histórico". Todo número diz o que é, a conta e a fonte
 * (regra do dono). A fonte vem da própria API (`p.source`).
 */
export function historyPreviewLines(
  p: HistoryPreview,
  c: HistoryCriteria,
): Array<{ label: string; value: number; how: string }> {
  const x = c.minCompletedServices;
  const services = `≥ ${formatCount(x)} ${x === 1 ? "serviço concluído" : "serviços concluídos"}`;
  const rating = `nota ≥ ${formatRating(c.minRating)}`;
  const src = `fonte: ${p.source.replace(/ \(.*?\)/, "")}`;
  return [
    {
      label: "Serão aprovados",
      value: p.eligible,
      how: `freelancers com aula pendente, ${services} e ${rating}; ${src}`,
    },
    {
      label: "Com aula marcada (liberam o lugar na turma)",
      value: p.withBooking,
      how: `dos que serão aprovados, quem tem inscrição marcada em turma; fonte: shared.orientation_enrollments`,
    },
    {
      label: "Ficam de fora: serviço mas nenhuma avaliação",
      value: p.noRatings,
      how: `aula pendente, ${services}, nenhuma avaliação (nota 0, abaixo de ${formatRating(c.minRating)}); ${src}`,
    },
    {
      label: "Ficam de fora: nota abaixo do mínimo",
      value: p.lowRating,
      how: `aula pendente, ${services}, com avaliação e nota abaixo de ${formatRating(c.minRating)}; ${src}`,
    },
    {
      label: "Já aprovados (não mudam)",
      value: p.alreadyApproved,
      how: `aula já aprovada, ${services}; ${src}`,
    },
    {
      label: "Reprovados (não mudam)",
      value: p.rejected,
      how: `aula reprovada, ${services}; ${src}`,
    },
  ];
}

export interface ReadinessCheck {
  label: string;
  state: "ok" | "fail" | "unknown";
  detail: string;
  /** A conta e a fonte (aparece em "Ver a conta"). */
  how?: string;
  /** Todas as cidades com falta, da maior para a menor (o `detail` mostra só as 5 primeiras). */
  allCities?: string[];
}

const CITIES_SHOWN = 5;

function plural(n: number, one: string, many: string): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

/**
 * Conferências do modo "Todos". Sem resposta (API velha, erro, 503) = "?" — nunca ✓ por falta de dado.
 * Zero vagas abertas com cidade também não prova nada: fica "?".
 */
export function readinessChecks(r: Readiness | null, error: boolean): ReadinessCheck[] {
  if (error || !r) {
    return [{ label: "Conferências", state: "unknown", detail: "Não deu para conferir agora." }];
  }
  const app = r.appMinimum;
  const appCheck: ReadinessCheck = {
    label: `App mínimo ≥ ${app.required}`,
    state: app.ok ? "ok" : "fail",
    detail: `Hoje: ${app.value ?? "não definido"} (APP_MINIMUM_VERSION no servidor)`,
  };

  const s = r.supply;
  const label = `Aprovados com candidatura nos últimos ${s.recentDays} dias ≥ vagas abertas nos próximos ${s.windowDays} dias, em cada cidade`;
  const how = `${s.formula} Fonte: ${s.source}`;
  const warn =
    s.openWithoutCity > 0 ? ` ${plural(s.openWithoutCity, "vaga", "vagas")} sem cidade não entram na conferência.` : "";
  const line = (c: Readiness["supply"]["cities"][number]) =>
    `${[c.city, c.uf].filter(Boolean).join("/") || "Sem nome"}: ${plural(c.openVacancies, "vaga aberta", "vagas abertas")}, ${plural(c.approvedRecentApplicants, "aprovado ativo", "aprovados ativos")}`;
  const gaps = [...s.cities]
    .filter((c) => !c.ok)
    .sort((a, b) => b.openVacancies - b.approvedRecentApplicants - (a.openVacancies - a.approvedRecentApplicants));

  let supplyCheck: ReadinessCheck;
  if (s.cities.length === 0) {
    supplyCheck = {
      label,
      state: "unknown",
      detail: `Nenhuma vaga aberta com cidade nos próximos ${s.windowDays} dias: não há o que conferir.${warn}`,
      how,
    };
  } else if (gaps.length > 0) {
    const all = gaps.map(line);
    supplyCheck = {
      label,
      state: "fail",
      detail: `${all.slice(0, CITIES_SHOWN).join("; ")}${warn}`,
      how,
      allCities: all,
    };
  } else {
    supplyCheck = {
      label,
      state: "ok",
      detail: `${plural(s.cities.length, "cidade conferida", "cidades conferidas")}, todas cobertas.${warn}`,
      how,
    };
  }
  return [appCheck, supplyCheck];
}

/** Texto do erro do "Aprovar por histórico". Os outros erros caem na tabela geral do Onboarding. */
export function historyErrorMessage(err: unknown, fallback: string): string {
  const { code, extra, message } = apiErrorOf(err);
  switch (code) {
    case "HISTORY_COUNT_MISMATCH":
      return typeof extra.eligible === "number"
        ? `A contagem mudou para ${formatCount(extra.eligible)}. Veja a prévia de novo.`
        : "A contagem mudou. Veja a prévia de novo.";
    case "HISTORY_TOO_MANY":
      return message || "São pessoas demais de uma vez. Aperte os critérios.";
    case "HISTORY_EMPTY":
      return "Ninguém com esses critérios.";
    case "REASON_REQUIRED":
      return "Escreva o motivo.";
    case "HISTORY_APPLY_FAILED": {
      const done = typeof extra.approved === "number" ? `${formatCount(extra.approved)} já foram aprovadas. ` : "";
      return `A aprovação parou no meio. ${done}Rode de novo: só quem ainda está pendente será aprovado.`;
    }
    default:
      return orientationErrorMessage(err, fallback);
  }
}

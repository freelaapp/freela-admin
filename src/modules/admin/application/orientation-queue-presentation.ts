import type {
  ConvocationPreview,
  QueueCounters,
  QueueRow,
  QueueStatus,
} from "../infrastructure/orientation-api";
import { brasiliaDateKey, formatCount } from "./orientation-presentation";

/** "2026-10-07" → "07/10/2026". */
function dayBr(key: string): string {
  const [y, m, d] = key.split("-");
  return y && m && d ? `${d}/${m}/${y}` : key;
}

/**
 * Contadores do topo da Fila. Todo número diz o que é, a conta e a fonte.
 * Ordem: pendentes, pendentes ativos, lugares livres, semanas para atender, aprovados.
 */
export function queueCounterLines(
  c: QueueCounters,
): Array<{ label: string; value: string; explanation: string }> {
  const p = c.pending;
  const since = c.pendingActive30.measuredSince;
  const weeks = c.weeksToServe;
  return [
    {
      label: "Pendentes",
      value: formatCount(p.value),
      explanation: `Freelancers ativos sem aula marcada e ainda não aprovados nem reprovados: ${formatCount(p.active)} ativos − ${formatCount(p.approved)} aprovados − ${formatCount(p.rejected)} reprovados − ${formatCount(p.booked)} com aula marcada. Fonte: cadastro de freelancers + aulas.`,
    },
    {
      label: "Pendentes ativos",
      value: since ? formatCount(c.pendingActive30.value) : "sem medida",
      explanation: since
        ? `Dos pendentes, quem abriu o app ou o site nos últimos 30 dias. Fonte: registro de acessos (desde ${dayBr(since)}).`
        : "Dos pendentes, quem abriu o app ou o site nos últimos 30 dias. Ainda não há registro de acessos para medir.",
    },
    {
      label: "Lugares livres",
      value: formatCount(c.freeSeats4w.value),
      explanation: `Soma de (capacidade − inscritos) das ${formatCount(c.freeSeats4w.sessions)} turmas abertas que começam nas próximas 4 semanas e ainda aceitam inscrição. Fonte: turmas do Onboarding.`,
    },
    {
      label: "Semanas para atender",
      value: !since ? "sem medida" : weeks.value === null ? "sem conta" : `${formatCount(weeks.value)} semanas`,
      explanation: !since
        ? "Depende dos pendentes ativos, que ainda não têm registro de acessos para medir."
        : weeks.value === null
          ? "Não há lugar livre nas próximas 4 semanas, então não dá para calcular. Crie turmas."
          : `${formatCount(c.pendingActive30.value)} ÷ ${formatCount(weeks.perWeek)} por semana = ${formatCount(weeks.value)} semanas (arredondado para cima). ${formatCount(weeks.perWeek)} = ${formatCount(c.freeSeats4w.value)} lugares livres nas próximas 4 semanas ÷ 4.`,
    },
    {
      label: "Aprovados",
      value: formatCount(c.approved.value),
      explanation:
        "Freelancers ativos que já fizeram a aula, foram aprovados sem aula ou já tinham histórico. Fonte: cadastro de freelancers + aulas.",
    },
  ];
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Teto de pessoas por convocação quando ninguém digita "no máximo" (CONVOCATION_MAX_PEOPLE da API). */
export const CONVOCATION_MAX_PEOPLE = 10_000;

/** De onde vem o público da prévia: as pessoas marcadas ou o grupo que o filtro mostra. */
export type ConvocationAudience =
  | { kind: "picked"; picked: number; minDays?: number }
  | { kind: "filtered"; listTotal?: number; limit?: number };

/** Texto da prévia da convocação: quantos, de onde saiu a conta, onde, lugares, prazo de envio e carga por lugar. */
export function convocationSummary(
  p: ConvocationPreview,
  placeLabel: string,
  audience?: ConvocationAudience,
): string[] {
  const who = `${formatCount(p.people)} ${plural(p.people, "pessoa", "pessoas")} de ${placeLabel}`;
  const lines: string[] = [];
  if (audience?.kind === "picked") {
    const n = audience.picked;
    const out = Math.max(0, n - p.people);
    const days =
      audience.minDays !== undefined
        ? `convocadas há menos de ${formatCount(audience.minDays)} ${plural(audience.minDays, "dia", "dias")}`
        : "convocadas há pouco tempo";
    const head = `${formatCount(n)} ${plural(n, "selecionada", "selecionadas")}`;
    const left =
      out > 0
        ? `; ${formatCount(out)} ${plural(out, "fica", "ficam")} de fora (${days}, já na fila de envio ou no limite de faltas)`
        : "";
    lines.push(`${head}${left}; vai mandar para ${who}.`);
  } else if (audience?.kind === "filtered") {
    const list =
      audience.listTotal !== undefined ? `${formatCount(audience.listTotal)} na lista; ` : "";
    const cut = p.people < p.matching;
    const why = cut
      ? audience.limit
        ? " (limite digitado)"
        : ` (limite de ${formatCount(CONVOCATION_MAX_PEOPLE)} por convocação)`
      : "";
    lines.push(
      `${list}${formatCount(p.matching)} ${plural(p.matching, "pode ser convocada", "podem ser convocadas")} agora; vai mandar para ${who}${why}.`,
    );
  } else {
    lines.push(`Vai mandar para ${who}.`);
  }
  if (p.freeSeats14d > 0) {
    lines.push(`Lugares livres para elas nas próximas 2 semanas: ${formatCount(p.freeSeats14d)}.`);
  } else {
    lines.push("Não há lugar livre para elas nas próximas 2 semanas. Crie turmas antes de convocar.");
  }
  const queue =
    p.pendingInQueue > 0
      ? `, somando ${formatCount(p.pendingInQueue)} ${plural(p.pendingInQueue, "que já está", "que já estão")} na fila de envio`
      : "";
  lines.push(
    `Envio em cerca de ${formatCount(p.plan.days)} ${plural(p.plan.days, "dia", "dias")}${queue}; teto de ${formatCount(p.dailyCap)} por dia (${formatCount(p.pendingInQueue + p.people)} ÷ ${formatCount(p.dailyCap)}, arredondado para cima).`,
  );
  if (p.plan.perSeat !== null) {
    const n = new Intl.NumberFormat("pt-BR").format(p.plan.perSeat);
    lines.push(
      `São ${n} ${p.plan.perSeat === 1 ? "convocado" : "convocados"} por lugar (${formatCount(p.people)} ${plural(p.people, "pessoa", "pessoas")} ÷ ${formatCount(p.freeSeats14d)} ${plural(p.freeSeats14d, "lugar livre", "lugares livres")} em 14 dias)${p.plan.overbooked ? ", acima de 3" : ""}.`,
    );
  }
  if (p.withoutGlobal > 0) {
    lines.push(
      `${formatCount(p.withoutGlobal)} ${plural(p.withoutGlobal, "pessoa aparece", "pessoas aparecem")} na Fila mas ${plural(p.withoutGlobal, "não recebe", "não recebem")} convite (sem cadastro global de freelancer).`,
    );
  }
  return lines;
}

const STATUS_TEXT: Record<QueueStatus, string> = {
  PENDING: "Pendente",
  BOOKED: "Aula marcada",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
};

function dateBr(iso: string | null): string {
  if (!iso) return "";
  const key = brasiliaDateKey(iso);
  return key ? dayBr(key) : "";
}

/** Linhas para `downloadCsv` (lib/csv.ts): datas em dd/mm/aaaa de Brasília. */
export function queueCsv(rows: QueueRow[]): {
  header: string[];
  rows: (string | number | null)[][];
} {
  return {
    header: [
      "Nome",
      "Telefone",
      "Cidade",
      "UF",
      "Funções",
      "Cadastro",
      "Serviços concluídos",
      "Último acesso",
      "Faltas",
      "Convocado em",
      "Pediu aviso em",
      "Situação",
    ],
    rows: rows.map((r) => [
      r.name ?? "",
      r.phone ?? "",
      r.city ?? "",
      r.uf ?? "",
      r.roles.join(", "),
      dateBr(r.signedUpAt),
      r.totalCompletedServices,
      r.lastActiveDay ? dayBr(r.lastActiveDay) : "",
      r.noShows,
      dateBr(r.lastConvokedAt),
      dateBr(r.notifyRequestedAt),
      STATUS_TEXT[r.status] ?? r.status,
    ]),
  };
}

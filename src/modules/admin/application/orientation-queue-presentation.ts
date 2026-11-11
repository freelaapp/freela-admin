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

/** Texto da prévia da convocação: quantos, onde, lugares, prazo de envio e carga por lugar. */
export function convocationSummary(p: ConvocationPreview, placeLabel: string): string[] {
  const lines = [
    `Vai mandar para ${formatCount(p.people)} ${plural(p.people, "pessoa", "pessoas")} de ${placeLabel}.`,
  ];
  if (p.freeSeats14d > 0) {
    lines.push(`Lugares livres para elas nas próximas 2 semanas: ${formatCount(p.freeSeats14d)}.`);
  } else {
    lines.push("Não há lugar livre para elas nas próximas 2 semanas. Crie turmas antes de convocar.");
  }
  lines.push(
    `Envio em cerca de ${formatCount(p.plan.days)} ${plural(p.plan.days, "dia", "dias")} (teto de ${formatCount(p.dailyCap)} por dia).`,
  );
  if (p.plan.perSeat !== null) {
    const n = new Intl.NumberFormat("pt-BR").format(p.plan.perSeat);
    lines.push(
      `São ${n} ${p.plan.perSeat === 1 ? "convocado" : "convocados"} por lugar${p.plan.overbooked ? " (acima de 3)" : ""}.`,
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

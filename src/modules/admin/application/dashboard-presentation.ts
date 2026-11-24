import type {
  AdminDashboard,
  DashboardChange,
  DashboardCountIndicator,
  DashboardRatingIndicator,
  DashboardRatio,
  DashboardRatioIndicator,
  DashboardShareIndicator,
  DashboardNoShowSummary,
  DashboardOutcomeSummary,
  DashboardServiceDateGroup,
  DashboardVacanciesByServiceDate,
  VacancyOutcomeKey,
  VacancyStageKey,
} from "../infrastructure/dashboard-api";

/**
 * Apresentação do dashboard novo (spec de 16/11/2026). Só formata o que a API já calculou:
 * nenhuma divisão acontece aqui. Regras da spec que moram nesta camada:
 * - sem número (denominador zero, bloco ausente na API antiga) o card mostra "—";
 * - P7/P8 mostram numerador e denominador ("12 de 37");
 * - avaliação sempre com a quantidade, e "amostra pequena" abaixo de 5;
 * - todo card diz o período e a variação contra o período anterior de mesma duração;
 * - todo número tem "Ver a conta" (o que é, a conta com os números e de onde veio).
 */

export const DASH = "—";

const isNumber = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function formatInteger(value: number | null | undefined): string {
  return isNumber(value) ? Math.round(value).toLocaleString("pt-BR") : DASH;
}

export function formatDecimal(value: number | null | undefined, digits = 1): string {
  return isNumber(value)
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : DASH;
}

/** Fração (0,324) → "32,4%". */
export function formatPercent(fraction: number | null | undefined): string {
  return isNumber(fraction) ? `${formatDecimal(fraction * 100, 1)}%` : DASH;
}

export function formatCurrencyCents(cents: number | null | undefined): string {
  return isNumber(cents)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100)
    : DASH;
}

/** "12 de 37" (P7/P8). */
export function ratioCaption(ratio: DashboardRatio | undefined): string {
  if (!ratio) return DASH;
  return `${formatInteger(ratio.numerator)} de ${formatInteger(ratio.denominator)}`;
}

/** Como a variação é lida: contagem e média em %, taxa em pontos percentuais, nota em pontos. */
export type ChangeKind = "count" | "decimal" | "percent" | "rating";

const signed = (text: string, value: number) => (value > 0 ? `+${text}` : text);

/**
 * "+12% vs. outubro/2026" · "+3,1 p.p. vs. …" · "+0,2 vs. …". Sem número de um dos lados:
 * "sem comparação". Anterior zero numa contagem: mostra a diferença absoluta ("+5; antes 0").
 */
export function changeText(
  kind: ChangeKind,
  change: DashboardChange | undefined,
  previousLabel: string | undefined,
): string {
  const vs = previousLabel ? ` vs. ${previousLabel}` : "";
  if (!change) return `sem comparação${vs}`;
  const { absolute, percent } = change;
  if (kind === "percent") {
    return `${signed(formatDecimal(absolute * 100, 1), absolute)} p.p.${vs}`;
  }
  if (kind === "rating") {
    return `${signed(formatDecimal(absolute, 1), absolute)}${vs}`;
  }
  if (percent === null) {
    const text = kind === "count" ? formatInteger(absolute) : formatDecimal(absolute, 1);
    return `${signed(text, absolute)}; antes 0${vs}`;
  }
  return `${signed(formatDecimal(percent, 0), percent)}%${vs}`;
}

/** Verde quando melhora, vermelho quando piora, cinza no empate ou sem comparação. */
export function changeTone(change: DashboardChange | undefined, higherIsBetter = true): string {
  if (!change || change.absolute === 0) return "text-[#737373]";
  const up = change.absolute > 0;
  return up === higherIsBetter ? "text-green-600" : "text-red-600";
}

// ─── Cards do período ───────────────────────────────────────────────────────

export interface DashboardCardModel {
  id: string;
  title: string;
  value: string;
  /** Linha logo abaixo do número ("12 de 37", "12 avaliações", "75,0% das vagas criadas"). */
  caption?: string;
  /** Aviso curto ("amostra pequena"). */
  badge?: string;
  /** "novembro/2026 até agora · +12% vs. 01/10/2026 a 17/10/2026, até a mesma hora". */
  meta: string;
  metaColor: string;
  details: { calc: string; source: string };
}

export interface DashboardCardGroup {
  id: "signups" | "vacancies" | "conversion" | "ratings";
  title: string;
  /** Linha explicativa logo abaixo do título da seção (base de contagem, o que fica de fora). */
  note?: string;
  cards: DashboardCardModel[];
}

const EXCLUSION_NOTE = "contas internas e vagas de QA (cargo Teste) ficam fora";
const OFFICIAL_NOTE = "Só vagas oficiais: as vagas falsas ficam fora (desde 18/11/2026).";

/** Junta uma frase à conta do card ("Ver a conta"), sem mexer no resto. */
function withExtraCalc(card: DashboardCardModel, extra: string | undefined): DashboardCardModel {
  return extra
    ? { ...card, details: { ...card.details, calc: `${card.details.calc} ${extra}` } }
    : card;
}

const pluralize = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function buildPeriodGroups(data: AdminDashboard): DashboardCardGroup[] {
  const label = data.period?.label ?? "o período";
  const previousLabel = data.period?.previousLabel;
  const prevText = previousLabel ?? "o período anterior";
  const i = data.indicators;
  const vo = data.vacancyOutcomes;
  const svc = data.vacanciesByServiceDate;
  const official = vo ? ` ${OFFICIAL_NOTE}` : "";

  const meta = (kind: ChangeKind, change: DashboardChange | undefined, higherIsBetter = true) => ({
    meta: `${label} · ${changeText(kind, change, previousLabel)}`,
    metaColor: changeTone(change, higherIsBetter),
  });

  const count = (
    id: string,
    title: string,
    indicator: DashboardCountIndicator | undefined,
    what: string,
    source: string,
  ): DashboardCardModel => ({
    id,
    title,
    value: formatInteger(indicator?.current),
    ...meta("count", indicator?.change ?? undefined),
    details: {
      calc: indicator
        ? `${formatInteger(indicator.current)} ${what} em ${label}; ${formatInteger(indicator.previous)} em ${prevText}.`
        : "Esta versão da API ainda não devolve este número.",
      source,
    },
  });

  const share = (
    id: string,
    title: string,
    indicator: DashboardShareIndicator | undefined,
    what: string,
    source: string,
    higherIsBetter: boolean,
  ): DashboardCardModel => {
    const cur = indicator?.shareOfCreated.current;
    return {
      id,
      title,
      value: formatInteger(indicator?.current),
      caption: cur ? `${formatPercent(cur.value)} das vagas criadas` : undefined,
      ...meta("count", indicator?.change ?? undefined, higherIsBetter),
      details: {
        calc: indicator && cur
          ? `${formatInteger(indicator.current)} ${what} em ${label}. ${formatInteger(cur.numerator)} ÷ ${formatInteger(cur.denominator)} vagas criadas no período = ${formatPercent(cur.value)}. Em ${prevText}: ${formatInteger(indicator.previous)}.`
          : "Esta versão da API ainda não devolve este número.",
        source,
      },
    };
  };

  const ratioCard = (
    id: string,
    title: string,
    indicator: DashboardRatioIndicator | undefined,
    kind: "percent" | "decimal",
    calc: (r: DashboardRatio) => string,
    source: string,
    caption: (r: DashboardRatio) => string,
  ): DashboardCardModel => {
    const cur = indicator?.current;
    const value = kind === "percent" ? formatPercent(cur?.value) : formatDecimal(cur?.value, 1);
    const prev = indicator?.previous;
    const prevValue = kind === "percent" ? formatPercent(prev?.value) : formatDecimal(prev?.value, 1);
    return {
      id,
      title,
      value,
      caption: cur ? caption(cur) : undefined,
      ...meta(kind, indicator?.change ?? undefined),
      details: {
        calc: cur && prev
          ? `${calc(cur)} Em ${prevText}: ${prevValue} (${caption(prev)}).`
          : "Esta versão da API ainda não devolve este número.",
        source,
      },
    };
  };

  const ratingCard = (
    id: string,
    title: string,
    indicator: DashboardRatingIndicator | undefined,
    what: string,
    source: string,
  ): DashboardCardModel => {
    const cur = indicator?.current;
    const prev = indicator?.previous;
    return {
      id,
      title,
      value: formatDecimal(cur?.average, 1),
      caption: cur
        ? `${formatInteger(cur.count)} ${pluralize(cur.count, "avaliação", "avaliações")}`
        : undefined,
      badge: cur?.smallSample ? "amostra pequena" : undefined,
      ...meta("rating", indicator?.change ?? undefined),
      details: {
        calc: cur && prev
          ? `Média de ${formatInteger(cur.count)} ${pluralize(cur.count, "nota", "notas")} ${what} em ${label} = ${formatDecimal(cur.average, 2)}. Em ${prevText}: ${formatDecimal(prev.average, 2)} (${formatInteger(prev.count)}). Menos de 5 avaliações = amostra pequena.`
          : "Esta versão da API ainda não devolve este número.",
        source,
      },
    };
  };

  return [
    {
      id: "signups",
      title: "Cadastros",
      cards: [
        count(
          "P1",
          "Cadastro de freelancers",
          i.freelancerSignups,
          "contas de freelancer criadas",
          `Cadastro global de freelancers (Empresa + Casa), pela data de criação da conta; ${EXCLUSION_NOTE}.`,
        ),
        count(
          "P2",
          "Cadastro de contratantes",
          i.contractorSignups,
          "contas de contratante criadas",
          `Cadastros de contratante ativos (Empresa + Casa), cada usuário uma vez, pela data do primeiro cadastro de contratante; ${EXCLUSION_NOTE}.`,
        ),
      ],
    },
    {
      id: "vacancies",
      title: "Vagas",
      ...(svc ? { note: serviceDateNote(svc) } : {}),
      cards: svc
        ? buildServiceDateCards(svc, data.generatedAt)
        : [
        withExtraCalc(
          count(
            "P3",
            vo ? "Vagas criadas (sem vagas falsas)" : "Vagas criadas",
            i.vacanciesCreated,
            vo ? "vagas oficiais criadas" : "vagas publicadas",
            vo
              ? `Vagas de Empresa + Casa pela data de criação, sem as vagas falsas e as de teste (cada tipo está em "Destino das vagas criadas", logo abaixo); ${EXCLUSION_NOTE}.`
              : `Vagas de Empresa + Casa pela data de criação, sem as apagadas; ${EXCLUSION_NOTE}.`,
          ),
          vo
            ? `${formatInteger(vo.current.official)} oficiais = ${formatInteger(vo.current.total)} criadas no total − ${formatInteger(vo.current.fake)} falsas − ${formatInteger(vo.current.test)} de teste. Pela regra de antes (só sem as apagadas, as de QA e as das contas internas): ${formatInteger(vo.previousRule.vacanciesCreated)}. A vaga apagada depois de a empresa já ter escolhido alguém agora conta como oficial (antes ficava fora).`
            : undefined,
        ),
        share(
          "P4",
          "Vagas concluídas",
          i.vacanciesCompleted,
          "vagas com o serviço finalizado",
          `Serviço da vaga concluído, pela data do check-out (sem ele, a última atualização do serviço). Conta vagas: uma vaga com 3 freelancers conta 1. Conta pela data de conclusão, não pela de criação: não é uma fatia das vagas criadas e a soma não fecha com elas.${official} Empresa + Casa; ${EXCLUSION_NOTE}.`,
          true,
        ),
        withExtraCalc(
          share(
            "P5",
            "Abertas e não fechadas por falta de freelancer",
            i.vacanciesEndedWithoutProvider,
            "vagas criadas no período encerraram sem freelancer",
            vo
              ? `Vagas oficiais criadas no período, na situação de agora: ninguém se candidatou (ou todos os candidatos desistiram ou foram recusados) e a vaga passou do horário ou foi cancelada pela empresa ou pelo sistema. Vaga ainda aberta e no prazo não entra. Empresa + Casa; ${EXCLUSION_NOTE}.`
              : `Vagas criadas no período, na situação de agora: canceladas ou com o horário de fim já passado (expiradas), sem nenhum freelancer escolhido. Vaga ainda aberta e no prazo não entra. Empresa + Casa; ${EXCLUSION_NOTE}.`,
            false,
          ),
          vo
            ? `Pela regra de antes (toda vaga encerrada sem escolhido no fim): ${formatInteger(vo.previousRule.endedWithoutProvider)}. Saíram deste número: as vagas falsas (a empresa tinha candidato esperando e não escolheu, ou apagou/cancelou rápido), as canceladas pelo suporte, e as que chegaram a ter alguém escolhido (agora em "Escolheu e não pagou", "Empresa cancelou depois de escolher" ou "Canceladas pelo sistema").`
            : undefined,
        ),
        ratioCard(
          "P9",
          "Média de freelancers por vaga",
          i.candidatesPerVacancy,
          "decimal",
          (r) =>
            `${formatInteger(r.numerator)} candidatos ÷ ${formatInteger(r.denominator)} vagas criadas em ${label} = ${formatDecimal(r.value, 1)}.`,
          `Candidatos = freelancers distintos que se candidataram a cada vaga criada no período, em qualquer situação (inclusive quem desistiu ou não foi escolhido).${official} Empresa + Casa; ${EXCLUSION_NOTE}.`,
          (r) => `${formatInteger(r.numerator)} candidatos em ${formatInteger(r.denominator)} vagas`,
        ),
      ],
    },
    {
      id: "conversion",
      title: "Conversão e recorrência",
      cards: [
        ratioCard(
          "P7",
          "% de contratantes que abrem a 1ª vaga",
          i.contractorActivation,
          "percent",
          (r) =>
            `Dos ${formatInteger(r.denominator)} contratantes cadastrados em ${label}, ${formatInteger(r.numerator)} já publicaram ao menos uma vaga = ${formatPercent(r.value)}. Quem se cadastrou nos últimos dias ainda pode publicar.`,
          `Contratantes cadastrados no período (data do primeiro cadastro de contratante) com ao menos uma vaga publicada até agora, em qualquer produto. A safra do período anterior teve mais tempo para publicar, então a variação tende a sair menor; ${EXCLUSION_NOTE}.`,
          (r) => `${ratioCaption(r)} cadastrados`,
        ),
        ratioCard(
          "P8",
          "% de freelancers que se candidatam a uma vaga",
          i.freelancerActivation,
          "percent",
          (r) =>
            `Dos ${formatInteger(r.denominator)} freelancers cadastrados em ${label}, ${formatInteger(r.numerator)} já se candidataram a ao menos uma vaga = ${formatPercent(r.value)}. Quem se cadastrou nos últimos dias ainda pode se candidatar.`,
          `Freelancers cadastrados no período com ao menos uma candidatura até agora, em qualquer produto e em qualquer situação. A safra do período anterior teve mais tempo para se candidatar, então a variação tende a sair menor; ${EXCLUSION_NOTE}.`,
          (r) => `${ratioCaption(r)} cadastrados`,
        ),
        ratioCard(
          "P6",
          "Contratação média por contratante",
          i.hiresPerContractor,
          "decimal",
          (r) =>
            `${formatInteger(r.numerator)} contratações concluídas ÷ ${formatInteger(r.denominator)} contratantes que contrataram em ${label} = ${formatDecimal(r.value, 1)}.`,
          `Contratação = freelancer escolhido numa vaga com o serviço concluído no período (uma vaga com 3 freelancers conta 3). Divide só pelos contratantes com ao menos uma contratação concluída no período. Empresa + Casa; ${EXCLUSION_NOTE}.`,
          (r) =>
            `${formatInteger(r.numerator)} contratações ÷ ${formatInteger(r.denominator)} ${pluralize(r.denominator, "contratante", "contratantes")}`,
        ),
      ],
    },
    {
      id: "ratings",
      title: "Avaliações",
      cards: [
        ratingCard(
          "P11",
          "Avaliação da plataforma",
          i.platformRating,
          "que os contratantes deram ao Freela",
          "Nota do sistema: a 5ª pergunta da avaliação do contratante (0 a 5), a mesma da tela Avaliações. Empresa + Casa, média ponderada pela quantidade, pela data da avaliação; contas internas e vagas de QA ficam fora.",
        ),
        ratingCard(
          "P12",
          "Avaliação média dos freelancers",
          i.freelancerRating,
          "que os contratantes deram aos freelancers",
          "Avaliações escritas pelos contratantes (nota geral), pela data da avaliação. Empresa + Casa, média ponderada pela quantidade; contas internas e vagas de QA ficam fora.",
        ),
        ratingCard(
          "P13",
          "Avaliação média dos contratantes",
          i.contractorRating,
          "que os freelancers deram aos contratantes",
          "Avaliações escritas pelos freelancers, pela data da avaliação. Empresa + Casa, média ponderada pela quantidade; contas internas e vagas de QA ficam fora.",
        ),
      ],
    },
  ];
}


// ─── Vagas pela data do serviço (pedido do Denner, 23/11/2026) ──────────────

const SERVICE_SOURCE =
  "Vagas de Empresa + Casa pela data do serviço (o dia, em Brasília, em que o turno começa), na situação de agora; sem as vagas falsas e as de teste; contas internas e vagas de QA (cargo Teste) ficam fora.";

/** Período de um dia só (Hoje, Ontem, personalizado de 1 dia): a API manda janela [00h, 00h). */
export function isSingleDayPeriod(period: { start: string; end: string }): boolean {
  const ms = new Date(period.end).getTime() - new Date(period.start).getTime();
  return Number.isFinite(ms) && ms > 0 && ms <= 25 * 3_600_000;
}

/** Como cada grupo entra na soma ("6 concluídas + 1 confirmou e não foi + ..."). */
const GROUP_SUM_NAMES: Record<string, [one: string, many: string]> = {
  COMPLETED: ["concluída", "concluídas"],
  NO_SHOW: ["confirmou e não foi", "confirmaram e não foram"],
  NO_FREELANCER: ["sem freelancer", "sem freelancer"],
  CANCELLED: ["cancelada", "canceladas"],
  HAPPENING_OR_CLOSING: ["em andamento ou aguardando encerrar", "em andamento ou aguardando encerrar"],
  UPCOMING: ["ainda vai acontecer", "ainda vão acontecer"],
  OUT_OF_PATTERN: ["fora do padrão", "fora do padrão"],
};

/** Mais é bom (true), mais é ruim (false) ou sem juízo de valor (undefined). */
const GROUP_GOOD_DIRECTION: Record<string, boolean | undefined> = {
  COMPLETED: true,
  NO_SHOW: false,
  NO_FREELANCER: false,
  CANCELLED: false,
};

const outcomeTitle = (key: string) =>
  VACANCY_OUTCOME_DEFINITIONS[key as VacancyOutcomeKey]?.title ?? key;

function serviceDateNote(svc: DashboardVacanciesByServiceDate): string {
  return `Vagas pela data do serviço (o dia em que o turno começa, horário de Brasília): ${svc.period.label}, comparado com ${svc.period.previousLabel}. Cada vaga conta uma vez, na situação de agora, e os grupos abaixo somam o total. Vagas falsas e de teste ficam de fora (estão em "Destino das vagas do período").`;
}

/** Total do período pela data do serviço, um card por grupo (somam o total) e a média de candidatos. */
function buildServiceDateCards(
  svc: DashboardVacanciesByServiceDate,
  generatedAt: string,
): DashboardCardModel[] {
  const label = svc.period.label;
  const prevLabel = svc.period.previousLabel;
  const total = svc.total;
  const shareText = (n: number, of: number) => (of > 0 ? formatPercent(n / of) : DASH);
  // Período que ainda não terminou (Hoje, Este mês): comparar com um período fechado mostraria
  // calendário, não desempenho. Sem bom/ruim: cinza e o número anterior seco.
  const now = Number.isNaN(Date.parse(generatedAt)) ? Date.now() : Date.parse(generatedAt);
  const inProgress = Date.parse(svc.period.end) > now;
  const metaFor = (
    change: DashboardChange | undefined,
    higherIsBetter: boolean | undefined,
    previousText: string,
  ) =>
    inProgress
      ? {
          meta: `${label} · período em andamento · ${previousText} em ${prevLabel}`,
          metaColor: "text-[#737373]",
        }
      : {
          meta: `${label} · ${changeText("count", change, prevLabel)}`,
          metaColor:
            higherIsBetter === undefined ? "text-[#737373]" : changeTone(change, higherIsBetter),
        };
  const inProgressNote = inProgress
    ? " Período ainda em andamento: a comparação com o período fechado não diz se foi melhor ou pior, por isso não tem seta verde ou vermelha."
    : "";

  const sumParts = svc.groups.map((g) => {
    const [one, many] = GROUP_SUM_NAMES[g.key] ?? [g.label.toLowerCase(), g.label.toLowerCase()];
    return `${formatInteger(g.current)} ${g.current === 1 ? one : many}`;
  });
  const sumMismatch =
    svc.groupsSum.current !== total.current || svc.groupsSum.previous !== total.previous;
  const fake = svc.fake.current;
  const test = svc.test.current;

  const totalCard: DashboardCardModel = {
    id: "SD-TOTAL",
    title: isSingleDayPeriod(svc.period) ? "Vagas do dia" : "Vagas do período",
    value: formatInteger(total.current),
    caption: `Pela data do serviço, sem ${formatInteger(fake)} ${pluralize(fake, "falsa", "falsas")} e ${formatInteger(test)} de teste`,
    ...metaFor(total.change ?? undefined, true, formatInteger(total.previous)),
    details: {
      calc: `${formatInteger(total.current)} vagas oficiais com serviço em ${label}. A soma dos grupos: ${sumParts.join(" + ")} = ${formatInteger(total.current)}.${sumMismatch ? ` Atenção: a soma dos grupos (${formatInteger(svc.groupsSum.current)}) não fecha com o total; avise o time técnico.` : ""} Em ${prevLabel}: ${formatInteger(total.previous)}. Fora desta conta: ${formatInteger(fake)} ${pluralize(fake, "falsa", "falsas")} e ${formatInteger(test)} de teste (com elas, ${formatInteger(svc.grossTotal.current)}).${inProgressNote}`,
      source: SERVICE_SOURCE,
    },
  };

  const covered = svc.coveredNoShows;
  const groupCard = (g: DashboardServiceDateGroup): DashboardCardModel => {
    const cur = g.shareOfTotal?.current;
    const prev = g.shareOfTotal?.previous;
    const curShare = cur ? formatPercent(cur.value) : shareText(g.current, total.current);
    const prevShare = prev ? formatPercent(prev.value) : shareText(g.previous, total.previous);
    const isNoShow = g.key === "NO_SHOW";
    const coveredText =
      isNoShow && covered
        ? `${formatInteger(covered.current)} ${pluralize(covered.current, "falta coberta", "faltas cobertas")} por suplente`
        : undefined;
    return {
      id: `SD-${g.key}`,
      title: g.label,
      value: formatInteger(g.current),
      caption: [`${curShare} do total`, coveredText].filter(Boolean).join(" · "),
      ...metaFor(g.change ?? undefined, GROUP_GOOD_DIRECTION[g.key], formatInteger(g.previous)),
      details: {
        calc: `${formatInteger(g.current)} de ${formatInteger(total.current)} vagas oficiais com serviço em ${label} = ${curShare}. Entram: ${g.outcomes.map(outcomeTitle).join("; ")}. Em ${prevLabel}: ${formatInteger(g.previous)} de ${formatInteger(total.previous)} (${prevShare}).${
          isNoShow && covered
            ? ` Faltas cobertas por suplente: ${formatInteger(covered.current)} em ${label} (${formatInteger(covered.previous)} em ${prevLabel}). Nelas o titular faltou e um suplente fez o serviço: a vaga foi concluída, então já contadas em Concluídas e não somam neste card.`
            : ""
        }${inProgressNote}`,
        source: SERVICE_SOURCE,
      },
    };
  };

  const avg = svc.candidatesPerVacancy;
  const avgCard: DashboardCardModel = {
    id: "SD-AVG",
    title: "Média de freelancers por vaga",
    value: formatDecimal(avg?.current.value, 1),
    caption: avg
      ? `${formatInteger(avg.current.numerator)} candidatos em ${formatInteger(avg.current.denominator)} vagas`
      : undefined,
    ...metaFor(avg?.change ?? undefined, undefined, formatDecimal(avg?.previous.value, 1)),
    details: {
      calc: avg
        ? `${formatInteger(avg.current.numerator)} candidatos ÷ ${formatInteger(avg.current.denominator)} vagas oficiais com serviço em ${label} (pela data do serviço) = ${formatDecimal(avg.current.value, 1)}. Em ${prevLabel}: ${formatDecimal(avg.previous.value, 1)} (${formatInteger(avg.previous.numerator)} candidatos em ${formatInteger(avg.previous.denominator)} vagas).${inProgressNote}`
        : "Esta versão da API ainda não devolve este número.",
      source: `Candidatos = freelancers distintos que se candidataram a cada vaga, em qualquer situação (inclusive quem desistiu ou não foi escolhido). ${SERVICE_SOURCE}`,
    },
  };

  return [totalCard, ...svc.groups.map(groupCard), avgCard];
}

/**
 * Frase abaixo da barra de período, em pedaços (`bold` vira negrito na tela). Sem o bloco da data
 * do serviço (API antiga) é a frase de sempre.
 */
export function periodSentenceParts(data: AdminDashboard): { text: string; bold?: boolean }[] {
  const label = data.period?.label ?? "o período escolhido";
  const previousLabel = data.period?.previousLabel ?? "o período anterior";
  const svc = data.vacanciesByServiceDate;
  if (!svc) {
    return [
      { text: "Os números abaixo medem " },
      { text: label, bold: true },
      { text: " e comparam com " },
      { text: previousLabel, bold: true },
      { text: ", cada indicador pela data do próprio evento (horário de Brasília)." },
    ];
  }
  return [
    { text: "Vagas: pela data do serviço", bold: true },
    { text: `, ${svc.period.label} contra ${svc.period.previousLabel}. Demais indicadores: pela data do próprio evento (cadastro, avaliação etc.), ` },
    { text: label, bold: true },
    { text: ` contra ${previousLabel}. Horário de Brasília.` },
  ];
}

export const periodSentence = (data: AdminDashboard): string =>
  periodSentenceParts(data)
    .map((part) => part.text)
    .join("");

// ─── Totais do topo (T1–T3) ─────────────────────────────────────────────────

export function buildTotalCards(data: AdminDashboard): Omit<DashboardCardModel, "metaColor">[] {
  const t = data.totals;
  return [
    {
      id: "T1",
      title: "Total de freelancers cadastrados",
      value: formatInteger(t.freelancers),
      meta: "Desde o início",
      details: {
        calc: `${formatInteger(t.freelancers)} contas de freelancer ativas (não banidas nem excluídas), criadas desde o início.`,
        source: `Cadastro global de freelancers (Empresa + Casa); ${EXCLUSION_NOTE}.`,
      },
    },
    {
      id: "T2",
      title: "Total de contratantes cadastrados",
      value: formatInteger(t.contractors),
      meta: "Desde o início",
      details: {
        calc: `${formatInteger(t.contractors)} contas de contratante ativas, cada usuário uma vez mesmo se usar os dois produtos.`,
        source: `Cadastros de contratante de Empresa + Casa; ${EXCLUSION_NOTE}.`,
      },
    },
    {
      id: "T3",
      title: "Faturamento total do app",
      value: formatCurrencyCents(t.platformRevenueCents),
      meta: "Desde o início",
      details: {
        calc: `${formatCurrencyCents(t.platformRevenueCents)} = soma da receita da plataforma de cada vaga paga: taxa da plataforma + taxa fixa (no Empresa, menos o desconto do plano e mais a vaga avulsa). Não é o valor total movimentado (GMV).`,
        source: `Pagamentos concluídos (estornado sai da soma) × composição de preço gravada na vaga. Mesma conta do "Faturamento Total" da página Operação; ${EXCLUSION_NOTE}.`,
      },
    },
  ];
}

// ─── Status das vagas (S1–S7) ───────────────────────────────────────────────

export const STAGE_DEFINITIONS: Record<
  VacancyStageKey,
  { title: string; enters: string; leaves: string }
> = {
  S1: {
    title: "Total de vagas abertas",
    enters: "Publicada e ainda não concluída nem cancelada: a soma de S2 a S6 (cada vaga conta uma vez).",
    leaves: "É concluída, cancelada ou passa do horário de fim sem o serviço começar.",
  },
  S2: {
    title: "Vagas sem freelancer candidato",
    enters: "Publicada, sem ninguém escolhido e sem candidatura pendente (quem desistiu ou foi recusado não conta).",
    leaves: "Recebe a primeira candidatura.",
  },
  S3: {
    title: "Vagas faltando escolher o freela",
    enters: "Tem ao menos uma candidatura pendente e o contratante ainda não escolheu. Vaga de várias posições com parte escolhida fica aqui (etapa mais atrasada).",
    leaves: "O contratante escolhe o freelancer de todas as posições.",
  },
  S4: {
    title: "Vagas aguardando pagamento",
    enters: "Todas as posições com freelancer escolhido e o pagamento ainda não confirmado.",
    leaves: "O pagamento é confirmado (o serviço é agendado).",
  },
  S5: {
    title: "Vagas pagas, aguardando início",
    enters: "Pagamento confirmado e serviço agendado, ainda sem check-in.",
    leaves: "O serviço é iniciado.",
  },
  S6: {
    title: "Vagas em andamento",
    enters: "Serviço iniciado (check-in) e ainda não finalizado, mesmo depois do horário previsto.",
    leaves: "O serviço é finalizado (check-out).",
  },
  S7: {
    title: "Vagas concluídas",
    enters: "O serviço foi finalizado hoje.",
    leaves: "Vira o dia.",
  },
};

export const STAGE_SCOPE_LABELS: Record<"today" | "upcoming", { label: string; description: string }> = {
  today: {
    label: "Hoje",
    description: "vagas com serviço hoje (inclusive o turno que começou ontem e ainda não terminou)",
  },
  upcoming: { label: "A acontecer", description: "vagas de hoje em diante que ainda não terminaram" },
};

const BRASILIA_OFFSET_MS = 3 * 3_600_000;

/** ISO → "17/11 19:00" no fuso de Brasília. */
export function shortDateTimeBrasilia(iso: string): string {
  const d = new Date(new Date(iso).getTime() - BRASILIA_OFFSET_MS);
  if (Number.isNaN(d.getTime())) return DASH;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

/** Texto da exclusão de contas de teste, para o rodapé do dashboard. */
export function exclusionText(data: AdminDashboard): string {
  const n = data.exclusions?.excludedAccounts;
  if (n === undefined) return "Contas internas e de teste: esta versão da API ainda não diz quais ficam fora.";
  const accounts =
    n === 0
      ? "nenhuma conta na lista de contas internas (variável ADMIN_DASHBOARD_EXCLUDED_USER_IDS vazia)"
      : `${formatInteger(n)} ${pluralize(n, "conta interna", "contas internas")} da lista`;
  return `Fora de todos os números: vagas de QA (cargo "Teste") e ${accounts}.`;
}

// ─── Destino das vagas criadas (pedidos 14259e7a e 684928c5) ────────────────

/**
 * O que é cada categoria, em linguagem simples. A regra exata está na API
 * (`classifyVacancyOutcome`): cada vaga criada no período cai em UMA categoria, pela situação de
 * agora, e a primeira regra que casa vale. `{X}` vira o limite do "rápido" em minutos.
 */
export const VACANCY_OUTCOME_DEFINITIONS: Record<
  VacancyOutcomeKey,
  { title: string; what: string }
> = {
  TEST_QA: {
    title: "Vagas de QA (cargo Teste)",
    what: 'Vaga interna de teste do app (cargo "Teste").',
  },
  TEST_INTERNAL_ACCOUNT: {
    title: "Vagas de contas internas",
    what: "Vaga publicada por uma conta da lista de contas internas (variável ADMIN_DASHBOARD_EXCLUDED_USER_IDS).",
  },
  FAKE_QUICK: {
    title: "Abertas e fechadas rápido",
    what: "A empresa apagou ou cancelou a vaga até {X} min depois de criar, sem ter escolhido ninguém.",
  },
  FAKE_DELETED: {
    title: "Apagadas pela empresa",
    what: "A empresa apagou a vaga depois de {X} min, sem nunca ter escolhido ninguém. O app só deixa apagar vaga sem freelancer aceito e sem pagamento.",
  },
  FAKE_CANCELLED_WITH_CANDIDATES: {
    title: "Tinha candidatos e a empresa cancelou sem escolher",
    what: "A empresa cancelou a vaga antes do início, depois de {X} min, com ao menos um freelancer candidato esperando a escolha (não desistiu nem foi recusado), sem escolher ninguém. A candidatura repetida do lote (a mesma pessoa em todas as vagas iguais) não conta como candidato.",
  },
  FAKE_EXPIRED_WITH_CANDIDATES: {
    title: "Tinha candidatos e a empresa deixou passar",
    what: "O horário da vaga passou com ao menos um freelancer candidato esperando a escolha (não desistiu nem foi recusado), sem ninguém escolhido (a vaga ficou aberta ou o sistema a cancelou depois do início).",
  },
  COMPLETED: {
    title: "Concluídas",
    what: "O serviço foi finalizado. Conta também a vaga em que o titular faltou e um suplente trabalhou; a falta aparece no card de faltas.",
  },
  IN_PROGRESS: {
    title: "Em andamento",
    what: "O serviço começou e o horário de fim ainda não chegou.",
  },
  SHIFT_ENDED_AWAITING_CLOSE: {
    title: "Turno acabou, falta encerrar",
    what: 'O horário de fim passou há menos de 7 dias e o serviço ainda não foi encerrado (esperando a empresa responder "compareceu?" ou o check-out).',
  },
  PAID_AWAITING_START: {
    title: "Pagas, aguardando o dia",
    what: "Freelancer escolhido e pagamento confirmado; o serviço ainda não começou.",
  },
  CHOSEN_AWAITING_PAYMENT: {
    title: "Escolhidas, aguardando pagamento",
    what: "Todas as posições com freelancer escolhido; o pagamento ainda não foi confirmado.",
  },
  OPEN_WITH_CANDIDATES: {
    title: "Abertas com candidatos",
    what: "No prazo, com candidatura esperando a escolha. Vaga de várias posições com só parte escolhida fica aqui.",
  },
  OPEN_NO_CANDIDATES: {
    title: "Abertas sem candidato",
    what: "No prazo, sem ninguém esperando a escolha.",
  },
  NO_SHOW: {
    title: "Freelancer chamado e não foi",
    what: 'Teve freelancer escolhido e pago, há falta registrada (infração "não compareceu" não anulada) e o serviço não aconteceu.',
  },
  NO_FREELANCER: {
    title: "Sem freelancer",
    what: "Ninguém se candidatou, ou todos os candidatos desistiram ou foram recusados pela empresa, e a vaga passou do horário ou foi cancelada.",
  },
  CHOSEN_NOT_PAID: {
    title: "Escolheu e não pagou",
    what: "Teve freelancer escolhido, o pagamento não saiu e o horário passou.",
  },
  COMPANY_CANCELLED_AFTER_CHOOSING: {
    title: "Empresa cancelou depois de escolher",
    what: "A empresa cancelou (ou cancelou e depois apagou) a vaga depois de já ter escolhido alguém, com ou sem pagamento.",
  },
  CANCELLED_BY_SUPPORT: {
    title: "Canceladas pelo suporte",
    what: "Um admin cancelou a vaga pelo painel (fica registrado com o motivo). Nunca conta como vaga falsa.",
  },
  CANCELLED_BY_SYSTEM: {
    title: "Canceladas pelo sistema",
    what: "Cancelamento automático: contrato não assinado a tempo, ou a vaga ainda aberta cancelada depois do início quando já tinha alguém escolhido.",
  },
  OTHER: {
    title: "Fora do padrão",
    what: "Situação que não devia durar: serviço pago e não encerrado mais de 7 dias depois do fim, ou serviço cancelado e o horário da vaga passou. Conta nas oficiais; vale alguém olhar.",
  },
};

export const OUTCOME_GROUPS: Array<{
  id: string;
  title: string;
  keys: VacancyOutcomeKey[];
}> = [
  {
    id: "happened",
    title: "Aconteceram ou estão acontecendo",
    keys: ["COMPLETED", "IN_PROGRESS", "SHIFT_ENDED_AWAITING_CLOSE"],
  },
  {
    id: "upcoming",
    title: "Ainda vão acontecer",
    keys: [
      "PAID_AWAITING_START",
      "CHOSEN_AWAITING_PAYMENT",
      "OPEN_WITH_CANDIDATES",
      "OPEN_NO_CANDIDATES",
    ],
  },
  {
    id: "not-happened",
    title: "Não aconteceram",
    keys: [
      "NO_SHOW",
      "NO_FREELANCER",
      "CHOSEN_NOT_PAID",
      "COMPANY_CANCELLED_AFTER_CHOOSING",
      "CANCELLED_BY_SUPPORT",
      "CANCELLED_BY_SYSTEM",
    ],
  },
  { id: "other", title: "Fora do padrão", keys: ["OTHER"] },
];

const FAKE_KEYS: VacancyOutcomeKey[] = [
  "FAKE_QUICK",
  "FAKE_DELETED",
  "FAKE_CANCELLED_WITH_CANDIDATES",
  "FAKE_EXPIRED_WITH_CANDIDATES",
];
const TEST_KEYS: VacancyOutcomeKey[] = ["TEST_QA", "TEST_INTERNAL_ACCOUNT"];

export interface OutcomeRow {
  id: VacancyOutcomeKey;
  title: string;
  value: string;
  /** Fatia das vagas oficiais ("12,5%"); só nas linhas oficiais. */
  share?: string;
  /** O "?" da linha: o que é, a conta com os números e a fonte. */
  help: string;
}

export interface VacancyOutcomeView {
  /** `created`: vagas criadas no período (safra); `service`: vagas pela data do serviço. */
  base: "created" | "service";
  /** Cards do topo: total bruto, oficiais, falsas e teste. */
  summary: DashboardCardModel[];
  /** Grupos das oficiais, cada um com as linhas das categorias. */
  officialGroups: Array<{
    id: string;
    title: string;
    total: string;
    rows: OutcomeRow[];
  }>;
  /** Um card por tipo de vaga falsa (pedido do Diego: "cards separados"). */
  fakeCards: DashboardCardModel[];
  /** Faltas: o card oficial e os dois de detalhe. */
  noShowCards: DashboardCardModel[];
}

const SOURCE_OUTCOMES =
  "Vagas de Empresa + Casa criadas no período (inclusive as apagadas, as de QA e as das contas internas), na situação de agora; cada vaga em uma categoria só.";

function outcomeWhat(key: VacancyOutcomeKey, quickMinutes: number | undefined): string {
  const what = VACANCY_OUTCOME_DEFINITIONS[key].what;
  return quickMinutes === undefined
    ? what.split("{X} min").join('o limite de minutos do "rápido"')
    : what.split("{X}").join(formatInteger(quickMinutes));
}

/**
 * Destino das vagas criadas no período e faltas. `null` quando a API ainda não manda os blocos
 * (a tela mostra um aviso). Só formata: toda conta vem pronta da API.
 */
export function buildVacancyOutcomeView(data: AdminDashboard): VacancyOutcomeView | null {
  const svc = data.vacanciesByServiceDate;
  if (svc) return buildServiceDateOutcomeView(data, svc);
  const vo = data.vacancyOutcomes;
  if (!vo) return null;
  const label = data.period?.label ?? "o período";
  const previousLabel = data.period?.previousLabel;
  const prevText = previousLabel ?? "o período anterior";
  const cur: DashboardOutcomeSummary = vo.current;
  const prev: DashboardOutcomeSummary = vo.previous;
  const x = vo.quickCancelMinutes;
  const share = (n: number, of: number) => (of > 0 ? formatPercent(n / of) : DASH);
  const neutral = "text-[#737373]";
  const prevCount = (n: number) => `${label} · em ${prevText}: ${formatInteger(n)}`;

  const sumOf = (keys: VacancyOutcomeKey[], s: DashboardOutcomeSummary) =>
    keys.reduce((acc, key) => acc + (s.byOutcome[key] ?? 0), 0);

  const summary: DashboardCardModel[] = [
    {
      id: "VO-TOTAL",
      title: "Vagas criadas no período (todas)",
      value: formatInteger(cur.total),
      caption: `${formatInteger(cur.official)} oficiais · ${formatInteger(cur.fake)} falsas · ${formatInteger(cur.test)} de teste`,
      meta: prevCount(prev.total),
      metaColor: neutral,
      details: {
        calc: `${formatInteger(cur.total)} = ${formatInteger(cur.official)} oficiais + ${formatInteger(cur.fake)} falsas + ${formatInteger(cur.test)} de teste. Cada vaga entra em uma categoria só, então a soma sempre fecha.`,
        source: SOURCE_OUTCOMES,
      },
    },
    {
      id: "VO-OFFICIAL",
      title: "Vagas oficiais",
      value: formatInteger(cur.official),
      caption: `${share(cur.official, cur.total)} das criadas`,
      meta: prevCount(prev.official),
      metaColor: neutral,
      details: {
        calc: `${formatInteger(cur.official)} = ${formatInteger(cur.total)} criadas − ${formatInteger(cur.fake)} falsas − ${formatInteger(cur.test)} de teste. É o número que vale no card "Vagas criadas" e nas contas do período. Na dúvida, a vaga fica aqui.`,
        source: SOURCE_OUTCOMES,
      },
    },
    {
      id: "VO-FAKE",
      title: "Vagas falsas (fora dos números oficiais)",
      value: formatInteger(cur.fake),
      caption: `${share(cur.fake, cur.total)} das criadas`,
      meta: prevCount(prev.fake),
      metaColor: neutral,
      details: {
        calc: `${formatInteger(cur.fake)} = ${FAKE_KEYS.map((k) => `${formatInteger(cur.byOutcome[k] ?? 0)} ${VACANCY_OUTCOME_DEFINITIONS[k].title.toLowerCase()}`).join(" + ")}. "Rápido" = até ${formatInteger(x)} min depois de criar (variável ADMIN_DASHBOARD_QUICK_CANCEL_MINUTES).`,
        source: `${SOURCE_OUTCOMES} Só a empresa gera vaga falsa: cancelamento do suporte ou do sistema nunca entra aqui.`,
      },
    },
    {
      id: "VO-TEST",
      title: "Vagas de teste",
      value: formatInteger(cur.test),
      caption: TEST_KEYS.map(
        (k) =>
          `${formatInteger(cur.byOutcome[k] ?? 0)} ${k === "TEST_QA" ? "de QA" : "de contas internas"}`,
      ).join(" · "),
      meta: prevCount(prev.test),
      metaColor: neutral,
      details: {
        calc: `${formatInteger(cur.test)} = ${formatInteger(cur.byOutcome.TEST_QA ?? 0)} de QA (cargo Teste) + ${formatInteger(cur.byOutcome.TEST_INTERNAL_ACCOUNT ?? 0)} de contas internas.`,
        source: `${SOURCE_OUTCOMES} Ficam fora de todos os números do dashboard.`,
      },
    },
  ];

  const officialGroups = OUTCOME_GROUPS.map((group) => {
    const rows: OutcomeRow[] = group.keys.map((key) => {
      const n = cur.byOutcome[key] ?? 0;
      const p = prev.byOutcome[key] ?? 0;
      return {
        id: key,
        title: VACANCY_OUTCOME_DEFINITIONS[key].title,
        value: formatInteger(n),
        share: share(n, cur.official),
        help: `${outcomeWhat(key, x)} Conta: ${formatInteger(n)} de ${formatInteger(cur.official)} vagas oficiais criadas em ${label} = ${share(n, cur.official)}. Em ${prevText}: ${formatInteger(p)}. Fonte: ${SOURCE_OUTCOMES}`,
      };
    });
    return {
      id: group.id,
      title: group.title,
      total: formatInteger(sumOf(group.keys, cur)),
      rows,
    };
  });

  const fakeCards: DashboardCardModel[] = FAKE_KEYS.map((key) => {
    const n = cur.byOutcome[key] ?? 0;
    return {
      id: key,
      title: VACANCY_OUTCOME_DEFINITIONS[key].title,
      value: formatInteger(n),
      caption: `${share(n, cur.total)} das criadas`,
      meta: prevCount(prev.byOutcome[key] ?? 0),
      metaColor: neutral,
      details: {
        calc: `${outcomeWhat(key, x)} ${formatInteger(n)} de ${formatInteger(cur.total)} vagas criadas em ${label}.`,
        source: `${SOURCE_OUTCOMES} Fica fora dos números oficiais.`,
      },
    };
  });

  return {
    base: "created",
    summary,
    officialGroups,
    fakeCards,
    noShowCards: buildNoShowCards(data),
  };
}

const SOURCE_OUTCOMES_SERVICE =
  "Vagas de Empresa + Casa com serviço no período (inclusive as falsas, as de QA e as das contas internas), na situação de agora; cada vaga em uma categoria só.";

/**
 * Destino pela data do serviço: o detalhe por categoria dentro de cada um dos grupos que a seção
 * Vagas já mostra (os mesmos números, abertos), mais um card por tipo de vaga falsa e o total bruto.
 */
function buildServiceDateOutcomeView(
  data: AdminDashboard,
  svc: DashboardVacanciesByServiceDate,
): VacancyOutcomeView {
  const label = svc.period.label;
  const prevText = svc.period.previousLabel;
  const cur = svc.byOutcome.current;
  const prev = svc.byOutcome.previous;
  const x = data.vacancyOutcomes?.quickCancelMinutes;
  const official = svc.total.current;
  const gross = svc.grossTotal.current;
  const share = (n: number, of: number) => (of > 0 ? formatPercent(n / of) : DASH);
  const neutral = "text-[#737373]";
  const prevCount = (n: number) => `${label} · em ${prevText}: ${formatInteger(n)}`;

  const summary: DashboardCardModel[] = [
    {
      id: "VO-GROSS",
      title: "Todas as vagas do período (com falsas e de teste)",
      value: formatInteger(gross),
      caption: `${formatInteger(official)} oficiais · ${formatInteger(svc.fake.current)} falsas · ${formatInteger(svc.test.current)} de teste`,
      meta: prevCount(svc.grossTotal.previous),
      metaColor: neutral,
      details: {
        calc: `${formatInteger(gross)} = ${formatInteger(official)} oficiais + ${formatInteger(svc.fake.current)} falsas + ${formatInteger(svc.test.current)} de teste, todas com serviço em ${label}. As oficiais são o total da seção Vagas; as falsas estão nos cards abaixo.`,
        source: SOURCE_OUTCOMES_SERVICE,
      },
    },
  ];

  const officialGroups = svc.groups.map((group) => {
    const keys = group.outcomes.filter((k): k is VacancyOutcomeKey => k in VACANCY_OUTCOME_DEFINITIONS);
    const rows: OutcomeRow[] = keys.map((key) => {
      const n = cur[key] ?? 0;
      const p = prev[key] ?? 0;
      return {
        id: key,
        title: VACANCY_OUTCOME_DEFINITIONS[key].title,
        value: formatInteger(n),
        share: share(n, official),
        help: `${outcomeWhat(key, x)} Conta: ${formatInteger(n)} de ${formatInteger(official)} vagas oficiais com serviço em ${label} = ${share(n, official)}. Em ${prevText}: ${formatInteger(p)}. Fonte: ${SOURCE_OUTCOMES_SERVICE}`,
      };
    });
    return { id: group.key, title: group.label, total: formatInteger(group.current), rows };
  });

  const fakeCards: DashboardCardModel[] = FAKE_KEYS.map((key) => {
    const n = cur[key] ?? 0;
    return {
      id: key,
      title: VACANCY_OUTCOME_DEFINITIONS[key].title,
      value: formatInteger(n),
      caption: `${share(n, gross)} das vagas do período`,
      meta: prevCount(prev[key] ?? 0),
      metaColor: neutral,
      details: {
        calc: `${outcomeWhat(key, x)} ${formatInteger(n)} de ${formatInteger(gross)} vagas (com falsas e de teste) com serviço em ${label}.`,
        source: `${SOURCE_OUTCOMES_SERVICE} Fica fora dos números oficiais.`,
      },
    };
  });

  return { base: "service", summary, officialGroups, fakeCards, noShowCards: buildNoShowCards(data) };
}

function buildNoShowCards(data: AdminDashboard): DashboardCardModel[] {
  const ns = data.noShows;
  if (!ns) return [];
  const label = data.period?.label ?? "o período";
  const previousLabel = data.period?.previousLabel;
  const prevText = previousLabel ?? "o período anterior";
  const cur: DashboardNoShowSummary = ns.current;
  const prev: DashboardNoShowSummary = ns.previous;
  const source =
    "Registros de falta e desistência do freelancer (infrações), pela data do evento; as anuladas pelo suporte saem. Uma por pessoa e vaga. Vagas de QA e de contas internas ficam fora.";
  return [
    {
      id: "NS-OFFICIAL",
      title: "Freelancer chamado e não foi",
      value: formatInteger(cur.occurrences),
      caption: `${formatInteger(cur.people)} ${pluralize(cur.people, "pessoa", "pessoas")} em ${formatInteger(cur.vacancies)} ${pluralize(cur.vacancies, "vaga", "vagas")}`,
      badge: cur.contested > 0 ? `${formatInteger(cur.contested)} em contestação` : undefined,
      meta: `${label} · ${changeText("count", ns.change ?? undefined, previousLabel)}`,
      metaColor: changeTone(ns.change ?? undefined, false),
      details: {
        calc: `${formatInteger(cur.occurrences)} = ${formatInteger(cur.noWarning)} faltaram sem avisar (a empresa disse "não chegou", o que o freelancer pode contestar, ou o "compareceu? NÃO" foi confirmado) + ${formatInteger(cur.lateWithdrawal)} desistiram a menos de 6 h do início, com o serviço pago. ${formatInteger(cur.contested)} ainda em contestação. Em ${prevText}: ${formatInteger(prev.occurrences)}. É a mesma base do card "não compareceu" da página Operação, contada por pessoa e vaga.`,
        source,
      },
    },
    {
      id: "NS-WARNED",
      title: "Desistiu avisando (fora das faltas)",
      value: formatInteger(cur.warnedWithdrawals),
      meta: `${label} · em ${prevText}: ${formatInteger(prev.warnedWithdrawals)}`,
      metaColor: "text-[#737373]",
      details: {
        calc: `${formatInteger(cur.warnedWithdrawals)} desistências avisadas com antecedência (perdem 2 pontos). Não entram no "chamado e não foi".`,
        source,
      },
    },
    {
      id: "NS-NOT-CONFIRMED",
      title: "Trocado por não confirmar (fora das faltas)",
      value: formatInteger(cur.notConfirmed),
      meta: `${label} · em ${prevText}: ${formatInteger(prev.notConfirmed)}`,
      metaColor: "text-[#737373]",
      details: {
        calc: `${formatInteger(cur.notConfirmed)} freelancers trocados pela reserva porque a empresa marcou "não confirmou presença" (perdem 3 pontos). Não entram no "chamado e não foi": esse motivo já veio marcado por padrão no app e houve troca de quem tinha confirmado (caso de 09/11).`,
        source,
      },
    },
  ];
}

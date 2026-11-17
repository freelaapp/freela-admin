import type {
  AdminDashboard,
  DashboardChange,
  DashboardCountIndicator,
  DashboardRatingIndicator,
  DashboardRatio,
  DashboardRatioIndicator,
  DashboardShareIndicator,
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
  cards: DashboardCardModel[];
}

const EXCLUSION_NOTE = "contas internas e vagas de QA (cargo Teste) ficam fora";

const pluralize = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function buildPeriodGroups(data: AdminDashboard): DashboardCardGroup[] {
  const label = data.period?.label ?? "o período";
  const previousLabel = data.period?.previousLabel;
  const prevText = previousLabel ?? "o período anterior";
  const i = data.indicators;

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
      cards: [
        count(
          "P3",
          "Vagas criadas",
          i.vacanciesCreated,
          "vagas publicadas",
          `Vagas de Empresa + Casa pela data de criação, sem as apagadas; ${EXCLUSION_NOTE}.`,
        ),
        share(
          "P4",
          "Vagas concluídas",
          i.vacanciesCompleted,
          "vagas com o serviço finalizado",
          `Serviço da vaga concluído, pela data do check-out (sem ele, a última atualização do serviço). Conta vagas: uma vaga com 3 freelancers conta 1. Empresa + Casa; ${EXCLUSION_NOTE}.`,
          true,
        ),
        share(
          "P5",
          "Abertas e não fechadas por falta de freelancer",
          i.vacanciesEndedWithoutProvider,
          "vagas criadas no período encerraram sem freelancer",
          `Vagas criadas no período, na situação de agora: canceladas ou com o horário de fim já passado (expiradas), sem nenhum freelancer escolhido. Vaga ainda aberta e no prazo não entra. Empresa + Casa; ${EXCLUSION_NOTE}.`,
          false,
        ),
        ratioCard(
          "P9",
          "Média de freelancers por vaga",
          i.candidatesPerVacancy,
          "decimal",
          (r) =>
            `${formatInteger(r.numerator)} candidatos ÷ ${formatInteger(r.denominator)} vagas criadas em ${label} = ${formatDecimal(r.value, 1)}.`,
          `Candidatos = freelancers distintos que se candidataram a cada vaga criada no período, em qualquer situação (inclusive quem desistiu ou não foi escolhido). Empresa + Casa; ${EXCLUSION_NOTE}.`,
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

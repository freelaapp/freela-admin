import { formatInstantDate } from "@/lib/date.utils";
import type { OrientationGateMode, OrientationSummary } from "../infrastructure/orientation-api";
import { formatCount } from "./orientation-presentation";

export interface ModeCard {
  mode: OrientationGateMode;
  title: string;
  effect: string;
  /** Quantos freelancers ativos veem vagas neste modo. */
  seeing: number;
  /** Quantos ficam sem ver vagas neste modo (`blockedByMode`). */
  blocked: number;
  calc: string;
  isCurrent: boolean;
}

export interface ModeChangeDialog {
  title: string;
  lines: string[];
  confirmLabel: string;
  requiresTyping: "TODOS" | null;
  /** Quantos passam a NÃO ver vagas com a mudança (0 = ninguém perde). */
  losing: number;
}

export const MODE_TITLES: Record<OrientationGateMode, string> = {
  OFF: "Desligado",
  NEW_ONLY: "Só cadastros novos",
  ALL: "Todos",
};

const COUNT_UNAVAILABLE = "Não consegui contar quem perde as vagas agora. Tente de novo.";

function people(n: number): string {
  return `${formatCount(n)} ${n === 1 ? "pessoa" : "pessoas"}`;
}

export function modeCards(summary: OrientationSummary, current: OrientationGateMode): ModeCard[] {
  const { active, approved, rejected, pendingSinceCutoff } = summary.freelancers;
  const blocked = summary.blockedByMode;
  const a = formatCount(active);
  return [
    {
      mode: "OFF",
      title: MODE_TITLES.OFF,
      effect: "Todos veem vagas, menos os reprovados.",
      seeing: active - blocked.OFF,
      blocked: blocked.OFF,
      calc: `${a} ativos − ${formatCount(rejected)} reprovados`,
      isCurrent: current === "OFF",
    },
    {
      mode: "NEW_ONLY",
      title: MODE_TITLES.NEW_ONLY,
      effect: `Quem virar freelancer a partir de ${formatInstantDate(summary.cutoff)} precisa da aula.`,
      seeing: active - blocked.NEW_ONLY,
      blocked: blocked.NEW_ONLY,
      calc: `${a} ativos − ${formatCount(rejected)} reprovados − ${formatCount(pendingSinceCutoff)} cadastros novos sem aprovação`,
      isCurrent: current === "NEW_ONLY",
    },
    {
      mode: "ALL",
      title: MODE_TITLES.ALL,
      effect: "Só os aprovados veem vagas.",
      seeing: approved,
      blocked: blocked.ALL,
      calc: `${formatCount(approved)} aprovados de ${a} ativos`,
      isCurrent: current === "ALL",
    },
  ];
}

/** Fonte dos números dos cartões (mostrada em todos). */
export function summarySource(summary: OrientationSummary): string {
  const time = new Date(summary.generatedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Sao_Paulo",
  });
  return `Freelancers ativos do Empresa (perfil e conta ativos) e situação da aula; contado às ${time}.`;
}

/**
 * O que a mudança de modo causa. Desligar é a saída de emergência e nunca
 * depende dos números; ligar exige a contagem (senão a consequência seria inventada).
 */
export function modeChangeDialog(
  from: OrientationGateMode,
  to: OrientationGateMode,
  summary: OrientationSummary | null,
  today: Date,
): ModeChangeDialog | { blocked: string } {
  if (to === "OFF") {
    const back = summary ? summary.blockedByMode[from] - summary.blockedByMode.OFF : null;
    return {
      title: "Desligar o bloqueio das vagas?",
      lines: [
        back === null || back <= 0
          ? "Voltam a ver vagas em até 1 minuto."
          : `Voltam a ver vagas em até 1 minuto: ${people(back)}.`,
      ],
      confirmLabel: "Desligar o bloqueio",
      requiresTyping: null,
      losing: 0,
    };
  }
  if (!summary) return { blocked: COUNT_UNAVAILABLE };

  const delta = summary.blockedByMode[to] - summary.blockedByMode[from];
  const losing = Math.max(0, delta);
  const lines: string[] = [];
  if (delta > 0) {
    lines.push(
      `Deixam de ver vagas em até 1 minuto: ${people(delta)} (${formatCount(summary.blockedByMode[to])} no total, contra ${formatCount(summary.blockedByMode[from])} hoje).`,
    );
  } else if (delta < 0) {
    lines.push(`Voltam a ver vagas em até 1 minuto: ${people(-delta)}.`);
  } else {
    lines.push("Ninguém muda de situação com essa troca.");
  }
  if (!summary.cutoffStamped) {
    lines.push(`A data de corte será hoje, ${formatInstantDate(today)}, e não muda depois.`);
  } else {
    lines.push(`A data de corte continua ${formatInstantDate(summary.cutoff)}.`);
  }
  if (to === "ALL") {
    lines.push("Antes de ligar, confira: o app mínimo já é 1.0.50 e há aprovados nas cidades com vaga aberta.");
  }
  const target = MODE_TITLES[to].toLowerCase();
  return {
    title: `Mudar para "${MODE_TITLES[to]}"?`,
    lines,
    confirmLabel: losing > 0 ? `Esconder vagas de ${people(losing)}` : `Mudar para ${target}`,
    requiresTyping: to === "ALL" && losing > 0 ? "TODOS" : null,
    losing,
  };
}

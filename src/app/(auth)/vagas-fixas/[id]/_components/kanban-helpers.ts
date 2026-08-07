import type {
  FixedJobKanbanBoard,
  FixedJobKanbanStage,
} from "@/modules/admin/infrastructure/fixed-jobs-api";

/**
 * Ordem canônica do funil de seleção — mesma ordem que a API devolve as
 * colunas. Vive fora do componente porque é a peça que decide as opções do
 * seletor "mover para" — a parte que mais merece teste isolado.
 */
export const KANBAN_STAGES: FixedJobKanbanStage[] = [
  "CANDIDATE",
  "PRE_SELECTED",
  "SELECTED",
  "INTERVIEW",
  "TEST",
  "FINAL_SELECTED",
];

/**
 * As outras 5 etapas do funil (todas menos a atual), na ordem canônica —
 * popula o seletor "mover para →" de cada card.
 */
export function otherStages(current: FixedJobKanbanStage): FixedJobKanbanStage[] {
  return KANBAN_STAGES.filter((stage) => stage !== current);
}

/**
 * Título em PT de uma etapa a partir das colunas do board — a API é a fonte
 * do texto (ver `columns[].title`); aqui só existe o fallback para quando o
 * board ainda não carregou.
 */
export function stageTitle(
  board: FixedJobKanbanBoard | undefined,
  stage: FixedJobKanbanStage,
): string {
  return board?.columns.find((c) => c.stage === stage)?.title ?? stage;
}

/** Faixa de cor do score total: verde acima do corte usual, âmbar no meio, cinza no baixo. */
export type ScoreBand = "high" | "medium" | "low";

export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

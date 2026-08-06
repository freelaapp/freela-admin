"use client";

import { useState, type DragEvent } from "react";
import { Loader2, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  FixedJobKanbanBoard,
  FixedJobKanbanCard,
  FixedJobKanbanStage,
} from "@/modules/admin/infrastructure/fixed-jobs-api";
import { formatInstantDate } from "@/lib/date.utils";

/**
 * Kanban de seleção da vaga fixa/CLT — mesma linguagem visual do Modo Painel
 * das vagas Jobs (colunas com cabeçalho colorido + contador), mas aqui os cards
 * são CANDIDATOS de uma vaga e podem ser arrastados entre as etapas.
 *
 * As colunas vêm prontas da API (`/posts/:id/kanban`): título em PT, ordem do
 * funil e cards já com o score da triagem por IA. O componente só desenha e
 * emite eventos — mover card e rodar a triagem são mutations da página.
 */

/** Cor de cada etapa: frio no começo do funil, quente/verde na contratação. */
const ESTILO_COLUNA: Record<FixedJobKanbanStage, { cor: string; corFundo: string; chamada: string }> = {
  CANDIDATE: {
    cor: "#64748B",
    corFundo: "#F8FAFC",
    chamada: "todo mundo que se candidatou entra aqui",
  },
  PRE_SELECTED: {
    cor: "#7C3AED",
    corFundo: "#F5F3FF",
    chamada: "triagem por IA: compatibilidade acima do corte",
  },
  SELECTED: {
    cor: "#D97706",
    corFundo: "#FFFBEB",
    chamada: "escolhidos pelo contratante",
  },
  INTERVIEW: {
    cor: "#2563EB",
    corFundo: "#EFF6FF",
    chamada: "agendar/realizar entrevista",
  },
  TEST: {
    cor: "#0D9488",
    corFundo: "#F0FDFA",
    chamada: "agendar/realizar teste prático",
  },
  FINAL_SELECTED: {
    cor: "#16A34A",
    corFundo: "#F0FDF4",
    chamada: "candidato selecionado para a vaga",
  },
};

/** Verde no que passou do corte, âmbar no meio, cinza no baixo. */
function corDoScore(score: number): { texto: string; fundo: string } {
  if (score >= 70) return { texto: "#15803D", fundo: "#DCFCE7" };
  if (score >= 40) return { texto: "#B45309", fundo: "#FEF3C7" };
  return { texto: "#64748B", fundo: "#F1F5F9" };
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eca826] text-[11px] font-bold text-white">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="size-full rounded-full object-cover" />
      ) : (
        initials || <User size={14} />
      )}
    </div>
  );
}

function CardCandidato({
  card,
  cor,
  disabled,
  onOpenProfile,
  onDragStart,
}: {
  card: FixedJobKanbanCard;
  cor: string;
  disabled: boolean;
  onOpenProfile: (card: FixedJobKanbanCard) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>, card: FixedJobKanbanCard) => void;
}) {
  const score = card.aiScore;
  const scoreCor = score != null ? corDoScore(score) : null;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!disabled}
      onDragStart={(e) => onDragStart(e, card)}
      onClick={() => onOpenProfile(card)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenProfile(card);
        }
      }}
      style={{ borderLeftColor: cor }}
      className={`w-full rounded-[10px] border border-[#E2E8F0] border-l-[3px] bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,.04)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#94A3B8] ${
        disabled
          ? "opacity-60"
          : "cursor-grab hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(15,23,42,.08)] active:cursor-grabbing"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Avatar name={card.applicantName} url={card.provider?.avatarUrl ?? null} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-[#0F172A]">
            {card.applicantName || "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-[#94A3B8]">
            Candidatou-se em {formatInstantDate(card.createdAt)}
          </p>
        </div>
        {score != null && scoreCor ? (
          <span
            title={card.aiSummary ?? undefined}
            style={{ color: scoreCor.texto, background: scoreCor.fundo }}
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
          >
            {score}%
          </span>
        ) : null}
      </div>

      {/* Resumo da IA no próprio card: é o que o admin lê para entender por que
          o candidato subiu (ou não) — sem precisar abrir o perfil. */}
      {card.aiSummary ? (
        <p className="mt-2 line-clamp-2 border-t border-[#F1F5F9] pt-2 text-[11.5px] leading-snug text-[#64748B]">
          {card.aiSummary}
        </p>
      ) : null}
    </div>
  );
}

export function SelectionKanban({
  board,
  isFetching,
  isMoving,
  isScreening,
  onMove,
  onOpenProfile,
  onRunScreening,
}: {
  board: FixedJobKanbanBoard;
  isFetching: boolean;
  /** Uma movimentação em voo — trava o drag para não disparar duas de uma vez. */
  isMoving: boolean;
  isScreening: boolean;
  onMove: (card: FixedJobKanbanCard, stage: FixedJobKanbanStage) => void;
  onOpenProfile: (card: FixedJobKanbanCard) => void;
  onRunScreening: () => void;
}) {
  const [dragOverStage, setDragOverStage] = useState<FixedJobKanbanStage | null>(null);
  // O card arrastado fica no estado (e não só no dataTransfer): o dado do
  // dataTransfer não é legível durante o dragover, e o drop precisa do card
  // inteiro para ignorar soltar na própria coluna.
  const [dragging, setDragging] = useState<FixedJobKanbanCard | null>(null);

  const totalCandidatos = board.columns.find((c) => c.stage === "CANDIDATE")?.count ?? 0;

  function handleDragStart(e: DragEvent<HTMLDivElement>, card: FixedJobKanbanCard) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.id);
    setDragging(card);
  }

  function handleDrop(stage: FixedJobKanbanStage) {
    setDragOverStage(null);
    if (!dragging || dragging.kanbanStage === stage) {
      setDragging(null);
      return;
    }
    onMove(dragging, stage);
    setDragging(null);
  }

  return (
    <div className="rounded-xl bg-[#F8FAFC] p-4 text-[#0F172A]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-[#64748B]">
          {board.totalApplications} candidatura(s) no funil
          {isFetching ? (
            <Loader2 className="ml-2 inline size-3.5 animate-spin text-[#94A3B8]" aria-hidden />
          ) : null}
        </p>
        <Button
          size="sm"
          onClick={onRunScreening}
          disabled={isScreening || totalCandidatos === 0}
          title={
            totalCandidatos === 0
              ? "Não há candidatos na primeira coluna para avaliar"
              : "Avalia com IA os currículos de “Candidatos” e move quem tem compatibilidade acima de 70% para “Pré-selecionados”"
          }
        >
          {isScreening ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles size={15} aria-hidden />
          )}
          {isScreening ? "Avaliando currículos…" : "Triagem com IA"}
        </Button>
      </div>

      <div className="flex items-start gap-3 overflow-x-auto pb-2">
        {board.columns.map((coluna) => {
          const estilo = ESTILO_COLUNA[coluna.stage];
          const emFoco = dragOverStage === coluna.stage;

          return (
            <section
              key={coluna.stage}
              aria-label={`${coluna.title}: ${coluna.count}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverStage(coluna.stage);
              }}
              onDragLeave={(e) => {
                // Só limpa quando sair da seção de verdade (não ao passar por um filho).
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverStage((s) => (s === coluna.stage ? null : s));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(coluna.stage);
              }}
              className={`flex min-w-[230px] flex-1 flex-col rounded-xl transition-colors ${
                emFoco ? "bg-[#E2E8F0] ring-2 ring-[#94A3B8]/40" : "bg-[#F1F5F9]"
              }`}
            >
              <div
                style={{ background: estilo.corFundo }}
                className="flex items-center gap-2 rounded-t-xl px-3 py-2.5"
                title={estilo.chamada}
              >
                <span
                  style={{ background: estilo.cor }}
                  className="h-2 w-2 shrink-0 rounded-full"
                  aria-hidden
                />
                <span className="flex-1 text-[12.5px] font-semibold leading-tight">
                  {coluna.title}
                </span>
                <span
                  style={{ color: estilo.cor }}
                  className="rounded-full bg-white px-2 py-0.5 text-[12px] font-bold tabular-nums"
                >
                  {coluna.count}
                </span>
              </div>

              <div className="flex min-h-[80px] flex-col gap-2 p-2.5">
                {coluna.cards.map((card) => (
                  <CardCandidato
                    key={card.id}
                    card={card}
                    cor={estilo.cor}
                    disabled={isMoving}
                    onOpenProfile={onOpenProfile}
                    onDragStart={handleDragStart}
                  />
                ))}

                {coluna.cards.length === 0 ? (
                  <p className="rounded-[10px] border-[1.5px] border-dashed border-[#CBD5E1] py-6 text-center text-[12px] text-[#94A3B8]">
                    {emFoco ? "Solte aqui" : "Nenhum candidato"}
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-2 text-[11.5px] text-[#94A3B8]">
        Arraste um card para mudar o candidato de etapa.
        {board.rejectedCount > 0
          ? ` ${board.rejectedCount} candidato(s) recusado(s) fora do funil — veja na aba Lista.`
          : ""}
      </p>
    </div>
  );
}

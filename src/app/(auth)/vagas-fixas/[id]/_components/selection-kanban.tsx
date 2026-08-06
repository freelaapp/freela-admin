"use client";

import { useState } from "react";
import { ArrowRight, FileText, FileWarning, Gauge, Loader2, Mail, Phone, User, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import type {
  FixedJobKanbanBoard,
  FixedJobKanbanCard,
  FixedJobKanbanStage,
  FixedJobMatchAxis,
} from "@/modules/admin/infrastructure/fixed-jobs-api";
import { formatInstantDate } from "@/lib/date.utils";
import { otherStages, scoreBand, stageTitle } from "./kanban-helpers";

/**
 * Kanban de seleção da vaga fixa/CLT — mesma linguagem visual do Modo Painel
 * das vagas Jobs (colunas com cabeçalho colorido + contador), mas aqui os
 * cards são CANDIDATOS de uma vaga e o score vem do cálculo determinístico de
 * compatibilidade (substituiu a triagem por IA, que nunca chegou a rodar).
 *
 * As colunas vêm prontas da API (`/posts/:id/kanban`): título em PT, ordem do
 * funil e cards já com o score. Mover um card é por SELETOR ("mover para →"),
 * não por arrastar — sem biblioteca de drag & drop.
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
    chamada: "compatibilidade acima do corte (e sem precisar de revisão manual)",
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

/** Rótulos em PT dos eixos do score — a API não devolve título para eles (só para as colunas). */
const AXIS_LABELS: Record<FixedJobMatchAxis, string> = {
  experience: "Experiência",
  distance: "Distância",
  profile: "Perfil",
  availability: "Disponibilidade",
};

const AXIS_ORDER: FixedJobMatchAxis[] = ["experience", "distance", "profile", "availability"];

/** Verde no que passou do corte, âmbar no meio, cinza no baixo. Eixo não avaliado usa a cor "neutra". */
const SCORE_COLORS = {
  high: { texto: "#15803D", fundo: "#DCFCE7" },
  medium: { texto: "#B45309", fundo: "#FEF3C7" },
  low: { texto: "#64748B", fundo: "#F1F5F9" },
  neutral: { texto: "#94A3B8", fundo: "#F1F5F9" },
} as const;

function corDoScore(score: number) {
  return SCORE_COLORS[scoreBand(score)];
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

/**
 * Decomposição do score no próprio card — o ponto central do recurso é
 * entender POR QUE o candidato tem aquela nota, não só ver o número. Eixo com
 * `applicable: false` é ausência de dado (não foi avaliado), nunca aparece
 * como nota zero.
 */
export function ScoreBreakdown({
  card,
  bordered = true,
}: {
  card: FixedJobKanbanCard;
  /** `false` quando o container que envolve já tem sua própria borda (ex.: dentro do diálogo de perfil). */
  bordered?: boolean;
}) {
  const breakdown = card.matchBreakdown;
  const spacing = bordered ? "mt-2 border-t border-[#F1F5F9] pt-2" : "";

  if (card.matchScore == null || !breakdown) {
    return <p className={`${spacing} text-[11px] italic text-[#94A3B8]`}>Compatibilidade ainda não calculada.</p>;
  }

  return (
    <div className={`${spacing} space-y-1.5`}>
      <p className="text-[11px] font-semibold text-[#64748B]">Composição do score</p>
      {AXIS_ORDER.map((axis) => {
        const res = breakdown.axes[axis];
        if (!res) return null;
        const cor = res.applicable ? corDoScore(res.score) : SCORE_COLORS.neutral;
        return (
          <div key={axis}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-[#334155]">{AXIS_LABELS[axis]}</span>
              <span
                style={{ color: cor.texto, background: cor.fundo }}
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums"
              >
                {res.applicable ? `${res.score} pts` : "não avaliado"}
              </span>
            </div>
            {res.detail ? (
              <p className="mt-0.5 text-[10.5px] leading-snug text-[#94A3B8]">{res.detail}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Controle "mover para →" — seletor com as outras 5 etapas, sem drag & drop. */
function MoveSelect({
  card,
  board,
  disabled,
  onMove,
}: {
  card: FixedJobKanbanCard;
  board: FixedJobKanbanBoard;
  disabled: boolean;
  onMove: (card: FixedJobKanbanCard, stage: FixedJobKanbanStage) => void;
}) {
  // Valor local (não controlado pelo card): a ação já foi disparada no onChange,
  // então o seletor volta ao placeholder em vez de "ficar preso" na opção escolhida.
  const [value, setValue] = useState("");

  return (
    <div
      className="mt-2 flex items-center gap-1.5 border-t border-[#F1F5F9] pt-2"
      onClick={(e) => e.stopPropagation()}
    >
      <ArrowRight size={12} className="shrink-0 text-[#94A3B8]" aria-hidden />
      <NativeSelect
        aria-label={`Mover ${card.applicantName || "candidato"} para outra etapa`}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const stage = e.target.value as FixedJobKanbanStage | "";
          setValue("");
          if (stage) onMove(card, stage);
        }}
        className="h-7 flex-1 py-0 text-[11px]"
      >
        <option value="">Mover para outra etapa…</option>
        {otherStages(card.kanbanStage).map((stage) => (
          <option key={stage} value={stage}>
            {stageTitle(board, stage)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function CardCandidato({
  card,
  board,
  cor,
  disabled,
  onOpenProfile,
  onMove,
}: {
  card: FixedJobKanbanCard;
  board: FixedJobKanbanBoard;
  cor: string;
  disabled: boolean;
  onOpenProfile: (card: FixedJobKanbanCard) => void;
  onMove: (card: FixedJobKanbanCard, stage: FixedJobKanbanStage) => void;
}) {
  const score = card.matchScore;
  const scoreCor = score != null ? corDoScore(score) : null;
  const videoUrl = card.provider?.presentationVideoUrl ?? null;

  return (
    <div
      style={{ borderLeftColor: cor }}
      className="w-full rounded-[10px] border border-[#E2E8F0] border-l-[3px] bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,.04)]"
    >
      <button
        type="button"
        onClick={() => onOpenProfile(card)}
        className="flex w-full items-center gap-2.5 rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#94A3B8]"
      >
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
            style={{ color: scoreCor.texto, background: scoreCor.fundo }}
            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
          >
            {score}%
          </span>
        ) : null}
      </button>

      {card.needsManualReview ? (
        <div className="mt-2">
          <Badge
            variant="warning"
            title="Currículo só em PDF — revisar à mão. É pontuado, mas nunca promovido automaticamente."
            className="inline-flex items-center gap-1"
          >
            <FileWarning size={11} aria-hidden />
            Revisar à mão
          </Badge>
        </div>
      ) : null}

      {card.message ? (
        <p className="mt-2 line-clamp-2 border-t border-[#F1F5F9] pt-2 text-[11.5px] leading-snug text-[#64748B]">
          {card.message}
        </p>
      ) : null}

      {/* Contato — o admin usa isso para triagem manual sem precisar abrir o perfil. */}
      <div className="mt-2 space-y-0.5 text-[11px] text-[#64748B]">
        <p className="flex items-center gap-1.5 truncate">
          <Mail size={11} className="shrink-0 text-[#CBD5E1]" aria-hidden />
          <span className="truncate">{card.applicantEmail || "Sem e-mail"}</span>
        </p>
        <p className="flex items-center gap-1.5 truncate">
          <Phone size={11} className="shrink-0 text-[#CBD5E1]" aria-hidden />
          <span className="truncate">{card.applicantPhone || "Sem telefone"}</span>
        </p>
      </div>

      {card.curriculumPdfUrl || videoUrl ? (
        <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
          {card.curriculumPdfUrl ? (
            <a
              href={card.curriculumPdfUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 font-medium text-[#2563EB] hover:underline"
            >
              <FileText size={12} aria-hidden />
              Currículo (PDF)
            </a>
          ) : null}
          {videoUrl ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenProfile(card);
              }}
              className="inline-flex items-center gap-1 font-medium text-[#2563EB] hover:underline"
            >
              <Video size={12} aria-hidden />
              Vídeo de apresentação
            </button>
          ) : null}
        </div>
      ) : null}

      <ScoreBreakdown card={card} />

      <MoveSelect card={card} board={board} disabled={disabled} onMove={onMove} />
    </div>
  );
}

export function SelectionKanban({
  board,
  isFetching,
  isMoving,
  isCalculating,
  onMove,
  onOpenProfile,
  onCalculateMatchScore,
}: {
  board: FixedJobKanbanBoard;
  isFetching: boolean;
  /** Uma movimentação em voo — trava o seletor para não disparar duas de uma vez. */
  isMoving: boolean;
  isCalculating: boolean;
  onMove: (card: FixedJobKanbanCard, stage: FixedJobKanbanStage) => void;
  onOpenProfile: (card: FixedJobKanbanCard) => void;
  onCalculateMatchScore: () => void;
}) {
  const totalCandidatos = board.columns.find((c) => c.stage === "CANDIDATE")?.count ?? 0;

  return (
    <div className="rounded-xl bg-[#F8FAFC] p-4 text-[#0F172A]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] text-[#64748B]">
            {board.totalApplications} candidatura(s) no funil
            {isFetching ? (
              <Loader2 className="ml-2 inline size-3.5 animate-spin text-[#94A3B8]" aria-hidden />
            ) : null}
          </p>
          {board.needsManualReviewCount > 0 ? (
            <Badge
              variant="warning"
              title="Currículo só em PDF (ou outro motivo de baixa confiança) — pontuados, mas nunca promovidos automaticamente. Revise à mão."
              className="inline-flex items-center gap-1"
            >
              <FileWarning size={11} aria-hidden />
              {board.needsManualReviewCount} para revisão manual
            </Badge>
          ) : null}
        </div>
        <Button
          size="sm"
          onClick={onCalculateMatchScore}
          disabled={isCalculating || totalCandidatos === 0}
          title={
            totalCandidatos === 0
              ? "Não há candidatos na primeira coluna para avaliar"
              : "Calcula a compatibilidade determinística dos currículos em “Candidatos” e move quem passou do corte (e não precisa de revisão manual) para “Pré-selecionados”"
          }
        >
          {isCalculating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Gauge size={15} aria-hidden />
          )}
          {isCalculating ? "Calculando…" : "Calcular compatibilidade"}
        </Button>
      </div>

      <div className="flex items-start gap-3 overflow-x-auto pb-2">
        {board.columns.map((coluna) => {
          const estilo = ESTILO_COLUNA[coluna.stage];

          return (
            <section
              key={coluna.stage}
              aria-label={`${coluna.title}: ${coluna.count}`}
              className="flex min-w-[260px] flex-1 flex-col rounded-xl bg-[#F1F5F9]"
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
                    board={board}
                    cor={estilo.cor}
                    disabled={isMoving}
                    onOpenProfile={onOpenProfile}
                    onMove={onMove}
                  />
                ))}

                {coluna.cards.length === 0 ? (
                  <p className="rounded-[10px] border-[1.5px] border-dashed border-[#CBD5E1] py-6 text-center text-[12px] text-[#94A3B8]">
                    Nenhum candidato
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-2 text-[11.5px] text-[#94A3B8]">
        Use o seletor &quot;mover para&quot; em cada card para mudar o candidato de etapa.
        {board.rejectedCount > 0
          ? ` ${board.rejectedCount} candidato(s) recusado(s) fora do funil — veja na aba Lista.`
          : ""}
      </p>
    </div>
  );
}

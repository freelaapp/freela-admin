"use client";

import { Check, Clock, XCircle } from "lucide-react";

import { resolveVacancyBucket, type ClassifiableVacancy } from "./vacancy-bucket";
import { formatInstantDate, formatVacancyTime } from "@/lib/date.utils";

/**
 * Roadmap da vaga — o caminho dela do anúncio à avaliação.
 *
 * Vive fora da página porque os DOIS módulos usam: Empresa e Freela em Casa
 * mostram o mesmo fluxo, e duplicar faria os dois divergirem na primeira
 * mudança de etapa.
 *
 * Estruturalmente tipado (`RoadmapVacancy`) em vez de amarrado ao `VacancyItem`
 * de Empresa, pela mesma razão.
 */
export type RoadmapVacancy = ClassifiableVacancy & {
  createdAt?: string | null;
  timeline?: {
    createdAt?: string | null;
    firstCandidacyAt?: string | null;
    hiredAt?: string | null;
    scheduledAt?: string | null;
    startedAt?: string | null;
    endedAt?: string | null;
    reviewedAt?: string | null;
    /** Quando o freelancer confirmou presença. */
    providerConfirmedAt?: string | null;
    /** Até quando ele podia confirmar. */
    providerConfirmDeadlineAt?: string | null;
  } | null;
  /** Campos avulsos, para o Casa, que não monta o objeto `timeline`. */
  providerConfirmedAt?: string | null;
  providerConfirmDeadlineAt?: string | null;
};

/** Quando o freelancer confirmou presença — o Casa manda solto, Empresa manda
 *  dentro de `timeline`. */
export function providerConfirmedAt(v: RoadmapVacancy): string | null {
  return v.timeline?.providerConfirmedAt ?? v.providerConfirmedAt ?? null;
}

/** Até quando ele pode confirmar. Passado o prazo sem confirmar, a vaga volta
 *  ao mural — por isso o prazo importa tanto quanto a confirmação. */
export function providerConfirmDeadlineAt(v: RoadmapVacancy): string | null {
  return v.timeline?.providerConfirmDeadlineAt ?? v.providerConfirmDeadlineAt ?? null;
}

/** Formata um instante ISO como "dd/mm/aaaa · HH:MM" no fuso de Brasília. */
export function formatStepAt(iso: string): string {
  return `${formatInstantDate(iso)} · ${formatVacancyTime(iso)}`;
}

// ─── Roadmap da vaga ────────────────────────────────────────────────────────
// Caminho feliz da vaga, derivado apenas dos dados já disponíveis no VacancyItem
// (status da vaga + status do job + feedbacks + candidaturas). Sem chamadas extras.
const ROADMAP_STEPS = [
  { key: "created", label: "Vaga criada", hint: "Publicada e aberta a candidaturas" },
  { key: "candidates", label: "Candidaturas recebidas", hint: "Freelancers se candidataram à vaga" },
  { key: "hired", label: "Freelancer contratado", hint: "Contratante escolheu um freelancer" },
  { key: "paid", label: "Pagamento confirmado · agendada", hint: "Job agendado após o pagamento" },
  {
    key: "confirmed",
    label: "Presença confirmada pelo freelancer",
    hint: "Ele confirma que vai; sem isso a vaga volta ao mural",
  },
  { key: "inProgress", label: "Serviço em andamento", hint: "Freelancer fez check-in no local" },
  { key: "completed", label: "Serviço concluído", hint: "Check-out realizado" },
  { key: "reviewed", label: "Avaliações concluídas", hint: "Contratante e freelancer se avaliaram" },
] as const;

// Índice do passo mais avançado que a vaga já alcançou no caminho feliz.
function resolveRoadmapReached(v: RoadmapVacancy): number {
  const status = v.status?.toUpperCase();
  const jobStatus = v.job?.status?.toUpperCase();
  const jobExists = Boolean(jobStatus);
  const hasCandidates = (v.candidacyCount ?? 0) > 0;
  const isClosed = status === "CLOSED";
  const reviewedBoth = Boolean(v.job?.hasContractorFeedback && v.job?.hasProviderFeedback);

  const confirmedAt = providerConfirmedAt(v);

  let reached = 0; // sempre criada
  if (hasCandidates || isClosed || jobExists) reached = 1;
  if (isClosed || jobExists) reached = 2;
  if (jobExists) reached = 3; // job só é criado pós-pagamento
  if (confirmedAt) reached = 4;
  // Check-in implica presença: se o freelancer chegou, ele confirmou de fato,
  // mesmo que o handshake não tenha sido registrado.
  if (jobStatus === "IN_PROGRESS" || jobStatus === "COMPLETED") reached = 5;
  if (jobStatus === "COMPLETED") reached = 6;
  if (reviewedBoth) reached = 7;
  return reached;
}

// Etapa do roadmap → campo de horário correspondente no timeline da vaga.
const STEP_TIMELINE_FIELD: Record<string, keyof NonNullable<RoadmapVacancy["timeline"]>> = {
  created: "createdAt",
  candidates: "firstCandidacyAt",
  hired: "hiredAt",
  paid: "scheduledAt",
  confirmed: "providerConfirmedAt",
  inProgress: "startedAt",
  completed: "endedAt",
  reviewed: "reviewedAt",
};

/** Horário (ISO) da etapa, ou null. "created" cai no createdAt da vaga (vagas abertas não têm timeline). */
function stepTimestamp(vacancy: RoadmapVacancy, key: string): string | null {
  const tl = vacancy.timeline;
  if (key === "created") return tl?.createdAt ?? vacancy.createdAt ?? null;
  const field = STEP_TIMELINE_FIELD[key];
  if (!tl || !field) return null;
  return tl[field] ?? null;
}


type RoadmapNodeState = "done" | "current" | "pending" | "cancelled" | "lost";

/** "Pode confirmar até 12/08 · 14:30" — ou o aviso de prazo vencido. */
function confirmHint(vacancy: RoadmapVacancy): string {
  const deadline = providerConfirmDeadlineAt(vacancy);
  if (!deadline) return "Ele confirma que vai; sem isso a vaga volta ao mural";

  const ms = Date.parse(deadline);
  if (Number.isNaN(ms)) return "Ele confirma que vai; sem isso a vaga volta ao mural";

  return ms < Date.now()
    ? `Prazo vencido em ${formatStepAt(deadline)} — não confirmou`
    : `Pode confirmar até ${formatStepAt(deadline)}`;
}

export function VacancyRoadmap({ vacancy }: { vacancy: RoadmapVacancy }) {
  const reached = resolveRoadmapReached(vacancy);
  const bucket = resolveVacancyBucket(vacancy);
  const terminal =
    bucket === "cancelled" ? "cancelled" : bucket === "lost" ? "lost" : null;

  // Caminho terminal (cancelada/perdida) corta o caminho feliz no passo alcançado.
  const lastStep = terminal ? reached : ROADMAP_STEPS.length - 1;

  const nodes: {
    key: string;
    label: string;
    hint: string;
    state: RoadmapNodeState;
    at: string | null;
  }[] = ROADMAP_STEPS.slice(0, lastStep + 1).map((step, i) => ({
    key: step.key,
    label: step.label,
    // i > reached (só existe no caminho não-terminal) = etapa FUTURA → pending.
    // Antes caía em "done" e o roadmap marcava etapas que nunca aconteceram.
    state: i < reached ? "done" : i === reached ? (terminal ? "done" : "current") : "pending",
    at: stepTimestamp(vacancy, step.key),
    // Na etapa de confirmação o que interessa, enquanto ela não acontece, é ATÉ
    // QUANDO dá para confirmar: é o dado que decide se alguém precisa correr
    // atrás do freelancer agora.
    hint:
      step.key === "confirmed" && !providerConfirmedAt(vacancy)
        ? confirmHint(vacancy)
        : step.hint,
  }));

  if (terminal === "cancelled") {
    nodes.push({
      key: "cancelled",
      label: "Vaga cancelada",
      hint: "Fluxo encerrado (estorno, se houver, na aba Financeiro)",
      state: "cancelled",
      at: null,
    });
  } else if (terminal === "lost") {
    nodes.push({
      key: "lost",
      label: "Expirou sem contratação",
      hint: "O prazo da vaga passou sem freelancer contratado",
      state: "lost",
      at: null,
    });
  }

  return (
    <div className="bg-[#f7f7f7] rounded-lg p-3 space-y-2">
      <p className="text-[#737373] text-xs font-medium uppercase tracking-wide">
        Roadmap da vaga
      </p>
      <ol className="mt-1">
        {nodes.map((node, i) => {
          const isLast = i === nodes.length - 1;
          return (
            <li key={node.key} className="relative flex gap-3 pb-3 last:pb-0">
              {!isLast && (
                <span
                  className={`absolute left-[11px] top-6 bottom-0 w-px ${
                    node.state === "done" ? "bg-[#eca826]" : "bg-[#e5e5e5]"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border ${
                  node.state === "done"
                    ? "bg-[#eca826] border-[#eca826]"
                    : node.state === "current"
                    ? "bg-white border-[#eca826] ring-2 ring-[#eca826]/30"
                    : node.state === "cancelled"
                    ? "bg-red-500 border-red-500"
                    : node.state === "lost"
                    ? "bg-[#a3a3a3] border-[#a3a3a3]"
                    : "bg-white border-[#e5e5e5]"
                }`}
              >
                {node.state === "done" && <Check className="h-3 w-3 text-white" />}
                {node.state === "current" && (
                  <span className="h-2 w-2 rounded-full bg-[#eca826] animate-pulse" />
                )}
                {node.state === "cancelled" && <XCircle className="h-3.5 w-3.5 text-white" />}
                {node.state === "lost" && <Clock className="h-3 w-3 text-white" />}
                {node.state === "pending" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#d4d4d4]" />
                )}
              </span>
              <div className="pt-0.5">
                <p
                  className={`text-sm leading-tight ${
                    node.state === "current"
                      ? "font-semibold text-[#1d1d1b]"
                      : node.state === "cancelled"
                      ? "font-semibold text-red-600"
                      : node.state === "lost"
                      ? "font-semibold text-[#737373]"
                      : node.state === "done"
                      ? "font-medium text-[#1d1d1b]"
                      : "text-[#a3a3a3]"
                  }`}
                >
                  {node.label}
                  {node.state === "current" && (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[#eca826]">
                      Estágio atual
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-[#737373]">{node.hint}</p>
                {node.at && (
                  <p className="mt-0.5 text-[11px] font-medium tabular-nums text-[#eca826]">
                    {formatStepAt(node.at)}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

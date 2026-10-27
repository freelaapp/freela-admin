"use client";

import { Loader2, PhoneCall } from "lucide-react";
import type { VacancyPrestartCheck } from "@/modules/admin/infrastructure/admin-api";
import { formatVacancyTime } from "@/lib/date.utils";

/** Por onde veio a resposta à confirmação do dia. */
export function prestartChannelLabel(channel: string | null): string | null {
  if (channel === "in_app") return "pelo app";
  if (channel === "magic_link") return "pelo link";
  if (channel === "whatsapp_button") return "pelo WhatsApp";
  if (channel === "admin") return "pelo painel (telefone)";
  return null;
}

const SKIP_REASON: Record<string, string> = {
  RECENT_CONFIRMATION: "confirmou o aceite há pouco",
  TOO_CLOSE: "aceite muito perto do início",
  NIGHT: "turno da madrugada sem tempo para perguntar",
};

const VOID_REASON: Record<string, string> = {
  PRINCIPAL_LEFT: "saiu da vaga",
  VACANCY_CANCELLED: "vaga cancelada",
  JOB_STARTED: "o serviço começou",
  RELEASED: "a empresa liberou a vaga",
};

const DECISION: Record<string, string> = {
  KEEP: "A empresa decidiu manter.",
  RELEASE: "A empresa liberou a vaga.",
};

/** Precisa de ligação: perguntado e sem resposta. */
export function prestartNeedsCall(status: string): boolean {
  return status === "SENT" || status === "NO_RESPONSE";
}

/**
 * Situação da confirmação do dia ("Você vai mesmo?", 3 h antes) de uma
 * candidatura, com o "Confirmar por telefone" quando ainda não respondeu.
 * Pergunta diferente do handshake do aceite — por isso um bloco à parte.
 */
export function PrestartCheckStatus({
  check,
  onConfirm,
  confirming = false,
}: {
  check: VacancyPrestartCheck;
  /** Ausente ⇒ sem botão (área sem permissão). */
  onConfirm?: () => void;
  confirming?: boolean;
}) {
  const channel = prestartChannelLabel(check.answerChannel);
  const at = (iso: string | null) => (iso ? formatVacancyTime(iso) : "—");

  let tone = "border-gray-200 bg-gray-50 text-gray-700";
  let title: string;
  let detail: string | null = null;
  switch (check.status) {
    case "SENT":
      tone = "border-amber-200 bg-amber-50 text-amber-900";
      title = "Confirmação do dia: aguardando resposta";
      detail = `Perguntado às ${at(check.sentAt)} · prazo ${at(check.deadlineAt)}`;
      break;
    case "NO_RESPONSE":
      tone = "border-red-200 bg-red-50 text-red-900";
      title = "Confirmação do dia: não respondeu";
      detail = `Prazo era ${at(check.deadlineAt)}. A empresa foi avisada.`;
      break;
    case "CONFIRMED":
      tone = "border-emerald-200 bg-emerald-50 text-emerald-900";
      title = check.answeredLate
        ? "Confirmou que vai (depois do prazo)"
        : "Confirmou que vai";
      detail = `${at(check.answeredAt)}${channel ? ` · ${channel}` : ""}`;
      break;
    case "DECLINED":
      tone = "border-red-200 bg-red-50 text-red-900";
      title = "Avisou que não vai";
      detail = `${at(check.answeredAt)}${channel ? ` · ${channel}` : ""}`;
      break;
    case "SKIPPED":
      title = "Confirmação do dia: não perguntado";
      detail = check.skipReason ? (SKIP_REASON[check.skipReason] ?? null) : null;
      break;
    case "VOID":
      title = "Confirmação do dia encerrada";
      detail = check.voidReason ? (VOID_REASON[check.voidReason] ?? null) : null;
      break;
    default:
      title = `Confirmação do dia: ${check.status}`;
  }
  const decision = check.contractorDecision ? DECISION[check.contractorDecision] : null;

  return (
    <div className={`mt-2 rounded-md border px-2 py-1.5 ${tone}`}>
      <p className="text-[11px] leading-tight">
        <span className="font-semibold">{title}</span>
        {detail && <span className="block opacity-80">{detail}</span>}
        {decision && <span className="block font-medium">{decision}</span>}
      </p>
      {onConfirm && prestartNeedsCall(check.status) && (
        <>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
          >
            {confirming ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <PhoneCall className="h-3 w-3" />
            )}
            Confirmar por telefone
          </button>
          <p className="mt-1 text-[10px] leading-tight opacity-80">
            Use depois de ligar e ele dizer que vai. Fica registrado que foi o painel.
          </p>
        </>
      )}
    </div>
  );
}

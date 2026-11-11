"use client";

import Link from "next/link";
import { memo, type KeyboardEvent } from "react";
import { AlertTriangle, MessageCircle, Phone } from "lucide-react";
import {
  formatSessionClock,
  formatSessionShort,
  whatsappUrlFromPhone,
} from "@/modules/admin/application/orientation-presentation";
import type {
  AttendanceResult,
  OrientationEnrollee,
} from "@/modules/admin/infrastructure/orientation-api";

export interface FutureVacancy {
  vacancyId: string;
  startTime: string;
  contractorName: string | null;
}

export const RESULT_BUTTONS: { result: AttendanceResult; label: string; active: string }[] = [
  { result: "APPROVED", label: "Aprovado", active: "border-emerald-600 bg-emerald-600 text-white" },
  { result: "REJECTED", label: "Reprovado", active: "border-red-600 bg-red-600 text-white" },
  { result: "NO_SHOW", label: "Faltou", active: "border-amber-600 bg-amber-600 text-white" },
];

/** "Tocou em Entrar às 9h03" / "Não tocou em Entrar" (sempre o segundo até a etapa 5). */
export function joinText(iso: string | null): string {
  return iso ? `Tocou em Entrar às ${formatSessionClock(iso)}` : "Não tocou em Entrar";
}

function vacancyLabel(v: FutureVacancy): string {
  const when = formatSessionShort(v.startTime);
  return v.contractorName ? `${when} · ${v.contractorName}` : when;
}

function VacancyLink({ href, canOpen }: { href: string; canOpen: boolean }) {
  if (!canOpen) return <span>ver na área de Vagas</span>;
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" className="font-medium underline">
      ver
    </Link>
  );
}

function VacancyWarning({ vacancies, canOpen }: { vacancies: FutureVacancy[]; canOpen: boolean }) {
  if (vacancies.length === 0) return null;
  const href = (v: FutureVacancy) => `/jobs?vaga=${encodeURIComponent(v.vacancyId)}`;
  const box = "mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900";
  if (vacancies.length === 1) {
    const [v] = vacancies;
    return (
      <p role="status" className={box}>
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Esta pessoa tem 1 vaga aceita ({vacancyLabel(v)}) —{" "}
          <VacancyLink href={href(v)} canOpen={canOpen} />
        </span>
      </p>
    );
  }
  return (
    <div role="status" className={box}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p>Esta pessoa tem {vacancies.length} vagas aceitas:</p>
        <ul className="mt-1 space-y-0.5">
          {vacancies.map((v) => (
            <li key={v.vacancyId}>
              {vacancyLabel(v)} —{" "}
              <VacancyLink href={href(v)} canOpen={canOpen} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

interface Props {
  enrollee: OrientationEnrollee;
  mark: { result: AttendanceResult; notes: string } | undefined;
  vacancies: FutureVacancy[];
  canOpenVacancy: boolean;
  disabled: boolean;
  onMark: (enrollmentId: string, result: AttendanceResult) => void;
  onNotes: (enrollmentId: string, notes: string) => void;
  onKey: (e: KeyboardEvent<HTMLElement>, enrollmentId: string) => void;
  registerRow: (enrollmentId: string, el: HTMLElement | null) => void;
  registerNotes: (enrollmentId: string, el: HTMLTextAreaElement | null) => void;
}

function AttendanceRowImpl({
  enrollee: e,
  mark,
  vacancies,
  canOpenVacancy,
  disabled,
  onMark,
  onNotes,
  onKey,
  registerRow,
  registerNotes,
}: Props) {
  const name = e.name ?? "Sem nome";
  const wa = whatsappUrlFromPhone(e.phone);
  const place = [e.city, e.uf].filter(Boolean).join("/");
  const noteRequired = mark?.result === "REJECTED";
  const missingNote = mark?.result === "REJECTED" && mark.notes.trim() === "";

  return (
    <li
      ref={(el) => registerRow(e.enrollmentId, el)}
      tabIndex={0}
      aria-label={`${name}. Teclas A aprova, R reprova, F marca falta.`}
      onKeyDown={(ev) => onKey(ev, e.enrollmentId)}
      className="rounded-xl border border-[#e5e5e5] bg-white p-4 focus:outline-none focus:ring-2 focus:ring-[#eca826]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-base font-semibold text-[#1d1d1b]">{name}</p>
        <div className="flex gap-2">
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 text-sm text-[#1d1d1b] md:min-h-9"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              WhatsApp
              <span className="sr-only"> de {name}</span>
            </a>
          )}
          {e.phone && (
            <a
              href={`tel:${e.phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 text-sm text-[#1d1d1b] md:min-h-9"
            >
              <Phone className="h-4 w-4" aria-hidden />
              Ligar
              <span className="sr-only"> para {name}</span>
            </a>
          )}
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-0.5 text-sm text-[#525252] md:grid-cols-2">
        <div>
          <dt className="sr-only">Telefone</dt>
          <dd>{e.phone ?? "Sem telefone"}</dd>
        </div>
        <div>
          <dt className="sr-only">Cidade</dt>
          <dd>{place || "—"}</dd>
        </div>
        <div>
          <dt className="inline text-[#737373]">Funções: </dt>
          <dd className="inline">{e.roles.length > 0 ? e.roles.join(", ") : "—"}</dd>
        </div>
        <div>
          <dt className="inline text-[#737373]">Faltas anteriores: </dt>
          <dd className="inline">{e.previousNoShows}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="sr-only">Entrada na aula</dt>
          <dd>{joinText(e.firstJoinClickAt)}</dd>
        </div>
      </dl>

      <div role="group" aria-label={`Resultado de ${name}`} className="mt-3 grid grid-cols-3 gap-2">
        {RESULT_BUTTONS.map((b) => {
          const pressed = mark?.result === b.result;
          return (
            <button
              key={b.result}
              type="button"
              aria-pressed={pressed}
              disabled={disabled}
              onClick={() => onMark(e.enrollmentId, b.result)}
              className={`min-h-11 rounded-lg border px-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                pressed ? b.active : "border-[#d4d4d4] bg-white text-[#1d1d1b] hover:bg-[#f5f5f5]"
              }`}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {mark && (
        <div className="mt-3 space-y-1">
          <label htmlFor={`note-${e.enrollmentId}`} className="text-sm font-medium text-[#1d1d1b]">
            {noteRequired ? "Anotação (obrigatória para reprovar)" : "Anotação (opcional)"}
          </label>
          <textarea
            id={`note-${e.enrollmentId}`}
            ref={(el) => registerNotes(e.enrollmentId, el)}
            rows={2}
            maxLength={500}
            value={mark.notes}
            disabled={disabled}
            aria-invalid={missingNote || undefined}
            onChange={(ev) => onNotes(e.enrollmentId, ev.target.value)}
            className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
          />
          {missingNote && <p className="text-sm text-red-700">Escreva por que a pessoa não foi aprovada.</p>}
        </div>
      )}

      {mark?.result === "REJECTED" && <VacancyWarning vacancies={vacancies} canOpen={canOpenVacancy} />}
    </li>
  );
}

export const AttendanceRow = memo(AttendanceRowImpl);

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Copy, Loader2, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  enrollmentStatusLabel,
  formatSessionClock,
  formatSessionDay,
  formatSessionShort,
  formatSessionTimeRange,
  orientationErrorMessage,
  whatsappUrlFromPhone,
} from "@/modules/admin/application/orientation-presentation";
import {
  useFinishAttendance,
  useOrientationSession,
  useOrientationSettings,
  usePreviewAttendance,
  useReopenAttendance,
} from "@/modules/admin/application/use-orientation";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import type {
  AttendanceResult,
  OrientationEnrollee,
} from "@/modules/admin/infrastructure/orientation-api";
import { AttendanceRow, type FutureVacancy } from "./_components/attendance-row";
import { CorrectionDialog, type CorrectionKind } from "./_components/correction-dialog";
import { FinishDialog } from "./_components/finish-dialog";
import {
  approveJoined,
  bookedEnrollees,
  clearDraft,
  finishBlockers,
  finishSummary,
  loadDraft,
  markRestNoShow,
  pruneMarks,
  saveDraft,
  toFinishPayload,
  type Marks,
} from "./_lib/attendance";

const KEY_RESULT: Record<string, AttendanceResult> = { a: "APPROVED", r: "REJECTED", f: "NO_SHOW" };
const DEFAULT_REOPEN_MINUTES = 10;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Relógio que anda sozinho: o botão de encerrar destrava quando a aula começa, sem recarregar. */
function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

function unchangedText(n: number): string {
  return n === 1
    ? "1 pessoa já estava aprovada ou reprovada por outro caminho; a situação dela não mudou."
    : `${n} pessoas já estavam aprovadas ou reprovadas por outro caminho; a situação delas não mudou.`;
}

export default function ChamadaPage() {
  const { id } = useParams<{ id: string }>();
  const session = useOrientationSession(id);
  const settings = useOrientationSettings();
  const preview = usePreviewAttendance(id);
  const finish = useFinishAttendance(id);
  const reopen = useReopenAttendance(id);
  const now = useNow();

  const detail = session.data;
  const open = detail?.status === "OPEN";
  const booked = useMemo(() => (detail ? bookedEnrollees(detail) : []), [detail]);

  const [marks, setMarks] = useState<Marks>(() => {
    const s = storage();
    return s ? loadDraft(s, id) : {};
  });
  const [vacancies, setVacancies] = useState<Record<string, FutureVacancy[]>>({});
  const [finishing, setFinishing] = useState(false);
  const [changedNotice, setChangedNotice] = useState<string | null>(null);
  const [unchangedCount, setUnchangedCount] = useState(0);
  const [correcting, setCorrecting] = useState<{ kind: CorrectionKind; enrollee: OrientationEnrollee } | null>(null);

  // Refetch (inclusive depois de "a lista mudou"): some só a marca de quem saiu.
  useEffect(() => {
    if (open) setMarks((prev) => pruneMarks(prev, booked));
  }, [open, booked]);

  // Rascunho no aparelho: celular que bloqueia ou recarrega não perde as marcas.
  useEffect(() => {
    const s = storage();
    if (open && s) saveDraft(s, id, marks);
  }, [open, id, marks]);

  // Reprovado com vaga futura aceita: pergunta à API (uma vez por pessoa) e avisa na linha.
  const previewed = useRef(new Set<string>());
  useEffect(() => {
    if (!open) return;
    const ids = Object.entries(marks)
      .filter(([eid, m]) => m.result === "REJECTED" && !previewed.current.has(eid))
      .map(([eid]) => eid);
    if (ids.length === 0) return;
    ids.forEach((eid) => previewed.current.add(eid));
    preview
      .mutateAsync(ids.map((enrollmentId) => ({ enrollmentId, result: "REJECTED" as const })))
      .then((r) =>
        setVacancies((prev) => {
          const next = { ...prev };
          for (const eid of ids) {
            next[eid] = r.warnings.find((w) => w.enrollmentId === eid)?.futureAcceptedVacancies ?? [];
          }
          return next;
        }),
      )
      // O aviso é um extra: se falhar, deixa tentar de novo na próxima marcação.
      .catch(() => ids.forEach((eid) => previewed.current.delete(eid)));
    // `preview` muda a cada render; só as marcas disparam a consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, marks]);

  // ----- foco e atalhos -----
  const rowEls = useRef(new Map<string, HTMLElement>());
  const noteEls = useRef(new Map<string, HTMLTextAreaElement>());
  const [focusReq, setFocusReq] = useState<{ id: string; target: "row" | "notes" } | null>(null);
  useEffect(() => {
    if (!focusReq) return;
    const el = focusReq.target === "notes" ? noteEls.current.get(focusReq.id) : rowEls.current.get(focusReq.id);
    el?.focus();
    setFocusReq(null);
  }, [focusReq]);

  const registerRow = useCallback((eid: string, el: HTMLElement | null) => {
    if (el) rowEls.current.set(eid, el);
    else rowEls.current.delete(eid);
  }, []);
  const registerNotes = useCallback((eid: string, el: HTMLTextAreaElement | null) => {
    if (el) noteEls.current.set(eid, el);
    else noteEls.current.delete(eid);
  }, []);

  const setResult = useCallback((eid: string, result: AttendanceResult) => {
    setMarks((prev) => ({ ...prev, [eid]: { result, notes: prev[eid]?.notes ?? "" } }));
  }, []);
  const setNotes = useCallback((eid: string, notes: string) => {
    setMarks((prev) => (prev[eid] ? { ...prev, [eid]: { ...prev[eid], notes } } : prev));
  }, []);

  const onKey = useCallback(
    (ev: KeyboardEvent<HTMLElement>, eid: string) => {
      const tag = (ev.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const result = KEY_RESULT[ev.key.toLowerCase()];
      if (!result) return;
      ev.preventDefault();
      setResult(eid, result);
      if (result === "REJECTED") {
        setFocusReq({ id: eid, target: "notes" });
        return;
      }
      const next = booked[booked.findIndex((b) => b.enrollmentId === eid) + 1];
      if (next) setFocusReq({ id: next.enrollmentId, target: "row" });
    },
    [booked, setResult],
  );

  // ----- encerrar -----
  const blockers = useMemo(
    () => (detail ? finishBlockers(marks, booked, detail.startsAt, now) : []),
    [marks, booked, detail, now],
  );
  const reopenMinutes = settings.data?.resultGraceMin ?? DEFAULT_REOPEN_MINUTES;

  const confirmFinish = () => {
    if (finish.isPending) return;
    setChangedNotice(null);
    finish.mutate(toFinishPayload(pruneMarks(marks, booked)), {
      onSuccess: (r) => {
        const s = storage();
        if (s) clearDraft(s, id);
        setMarks({});
        setFinishing(false);
        setUnchangedCount(r.unchanged.length);
        toast.success("Chamada encerrada.");
      },
      onError: (err) => {
        if (apiErrorOf(err).code === "ATTENDANCE_CHANGED") {
          // A lista é relida sozinha (onSettled); as marcas de quem saiu somem e as outras ficam.
          setFinishing(false);
          setChangedNotice(orientationErrorMessage(err, "A lista da turma mudou."));
          return;
        }
        toast.error(orientationErrorMessage(err, "Não foi possível encerrar a chamada."));
      },
    });
  };

  const doReopen = () => {
    if (reopen.isPending) return;
    setUnchangedCount(0);
    reopen.mutate(undefined, {
      onSuccess: () => toast.success("Chamada reaberta. Marque de novo e encerre."),
      onError: (err) => toast.error(orientationErrorMessage(err, "Não foi possível reabrir a chamada.")),
    });
  };

  const copyLink = async () => {
    if (!detail?.meetUrl) return;
    try {
      await navigator.clipboard.writeText(detail.meetUrl);
      toast.success("Link do Meet copiado.");
    } catch {
      toast.error("Não consegui copiar o link. Selecione e copie o endereço do Meet.");
    }
  };

  // ----- telas de espera -----
  if (session.isLoading) {
    return (
      <div role="status" aria-label="Carregando a turma" className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }
  if (session.isError || !detail) {
    return (
      <div className="mx-auto max-w-3xl py-8 text-center">
        <p className="text-sm text-[#1d1d1b]">
          {orientationErrorMessage(session.error, "Não foi possível carregar a turma.")}
        </p>
        <Button variant="outline" className="mt-3 min-h-11" onClick={() => void session.refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const cancelled = detail.status === "CANCELLED";
  const finished = detail.status === "FINISHED";
  const reopenUntil = detail.reopenUntil ? new Date(detail.reopenUntil) : null;
  const canReopen = finished && reopenUntil !== null && reopenUntil.getTime() > now.getTime();
  const marked = booked.filter((b) => marks[b.enrollmentId]).length;
  const joinedPending = booked.filter((b) => b.firstJoinClickAt && !marks[b.enrollmentId]).length;
  const unmarked = booked.length - marked;

  const statusBadge = cancelled
    ? { label: "Cancelada", variant: "destructive" as const }
    : finished
      ? { label: "Encerrada", variant: "muted" as const }
      : { label: "Aberta", variant: "success" as const };

  const cancelledList = cancelled
    ? (() => {
        const all = detail.enrollees.filter((e) => e.status === "CANCELLED");
        const known = all.some((e) => e.cancelledReason != null);
        return known ? all.filter((e) => e.cancelledReason === "SESSION_CANCELLED") : all;
      })()
    : [];

  return (
    <div className="mx-auto max-w-3xl py-4">
      <Link
        href="/onboarding"
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm text-[#525252] md:min-h-9"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Voltar para as turmas
      </Link>

      <header className="rounded-xl border border-[#e5e5e5] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-[#1d1d1b]">
            {formatSessionDay(detail.startsAt)}, {formatSessionTimeRange(detail.startsAt, detail.endsAt)}
          </h1>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
        <dl className="mt-2 grid grid-cols-1 gap-y-1 text-sm text-[#525252] md:grid-cols-3 md:gap-x-6">
          <div>
            <dt className="inline text-[#737373]">Dá a aula: </dt>
            <dd className="inline">{detail.hostName ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline text-[#737373]">Inscritos: </dt>
            <dd className="inline">
              {detail.bookedCount}/{detail.capacity}
            </dd>
          </div>
          <div>
            <dt className="inline text-[#737373]">Início: </dt>
            <dd className="inline">{formatSessionClock(detail.startsAt)}</dd>
          </div>
        </dl>
        {detail.meetUrl && (
          <Button variant="outline" size="sm" className="mt-3 min-h-11 md:min-h-9" onClick={() => void copyLink()}>
            <Copy className="mr-1.5 h-4 w-4" aria-hidden />
            Copiar link do Meet
          </Button>
        )}
      </header>

      {changedNotice && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {changedNotice}
        </p>
      )}
      {unchangedCount > 0 && (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {unchangedText(unchangedCount)}
        </p>
      )}

      {cancelled && (
        <section className="mt-4">
          <p role="status" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
            Turma cancelada
            {detail.cancelledAt ? ` em ${formatSessionShort(detail.cancelledAt)}` : ""}
            {detail.cancelReason ? `: ${detail.cancelReason}` : "."}
          </p>
          <h2 className="mt-4 text-base font-semibold text-[#1d1d1b]">Quem estava inscrito</h2>
          <p className="text-sm text-[#525252]">
            Ninguém recebe aviso automático por enquanto. Avise cada pessoa pelo WhatsApp.
          </p>
          {cancelledList.length === 0 ? (
            <p className="mt-2 text-sm text-[#525252]">Ninguém estava inscrito.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {cancelledList.map((e) => {
                const wa = whatsappUrlFromPhone(e.phone);
                return (
                  <li
                    key={e.enrollmentId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e5e5e5] bg-white p-3"
                  >
                    <div className="text-sm">
                      <p className="font-medium text-[#1d1d1b]">{e.name ?? "Sem nome"}</p>
                      <p className="text-[#525252]">
                        {e.phone ?? "Sem telefone"} · {enrollmentStatusLabel(e.status, e.cancelledReason)}
                      </p>
                    </div>
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 text-sm text-[#1d1d1b]"
                      >
                        <MessageCircle className="h-4 w-4" aria-hidden />
                        WhatsApp
                        <span className="sr-only"> de {e.name ?? "Sem nome"}</span>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {finished && (
        <section className="mt-4">
          {canReopen && reopenUntil ? (
            <div className="mb-3 rounded-xl border border-[#e5e5e5] bg-white p-4">
              <p className="text-sm text-[#525252]">
                A chamada está encerrada. Se marcou errado, dá para reabrir e refazer.
              </p>
              <Button className="mt-2 min-h-11" onClick={doReopen} disabled={reopen.isPending}>
                {reopen.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
                {`Reabrir chamada (até ${formatSessionClock(reopenUntil.toISOString())})`}
              </Button>
            </div>
          ) : (
            <p className="mb-3 text-sm text-[#525252]">
              O prazo para reabrir acabou. Para mudar um resultado, use o botão da pessoa.
            </p>
          )}
          <h2 className="text-base font-semibold text-[#1d1d1b]">Resultado da chamada</h2>
          <ul className="mt-2 space-y-2">
            {detail.enrollees
              .filter((e) => ["APPROVED", "REJECTED", "NO_SHOW"].includes(e.status))
              .map((e) => (
                <li key={e.enrollmentId} className="rounded-xl border border-[#e5e5e5] bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <p className="font-medium text-[#1d1d1b]">{e.name ?? "Sem nome"}</p>
                      <p className="text-[#525252]">
                        {enrollmentStatusLabel(e.status)}
                        {e.notes ? ` · ${e.notes}` : ""}
                      </p>
                    </div>
                    {!canReopen && e.status === "APPROVED" && (
                      <Button
                        variant="outline"
                        className="min-h-11"
                        onClick={() => setCorrecting({ kind: "correct-result", enrollee: e })}
                      >
                        Corrigir resultado
                        <span className="sr-only"> de {e.name ?? "Sem nome"}</span>
                      </Button>
                    )}
                    {!canReopen && e.status === "REJECTED" && (
                      <Button
                        variant="outline"
                        className="min-h-11"
                        onClick={() => setCorrecting({ kind: "allow-new-class", enrollee: e })}
                      >
                        Permitir nova aula
                        <span className="sr-only"> para {e.name ?? "Sem nome"}</span>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}

      {open && (
        <section className="mt-4">
          <div className="mb-3 flex flex-col gap-2 md:flex-row">
            <Button
              variant="outline"
              className="min-h-11 md:min-h-9"
              disabled={joinedPending === 0}
              onClick={() => setMarks((m) => approveJoined(m, booked))}
            >
              {`Aprovar quem tocou em Entrar (${joinedPending})`}
            </Button>
            <Button
              variant="outline"
              className="min-h-11 md:min-h-9"
              disabled={unmarked === 0}
              onClick={() => setMarks((m) => markRestNoShow(m, booked))}
            >
              {`Marcar o resto como Faltou (${unmarked})`}
            </Button>
          </div>
          {booked.length === 0 ? (
            <p className="rounded-xl border border-[#e5e5e5] bg-white p-4 text-sm text-[#525252]">
              Ninguém inscrito nesta turma.
            </p>
          ) : (
            <ul className="space-y-3">
              {booked.map((e) => (
                <AttendanceRow
                  key={e.enrollmentId}
                  enrollee={e}
                  mark={marks[e.enrollmentId]}
                  vacancies={vacancies[e.enrollmentId] ?? []}
                  disabled={finish.isPending}
                  onMark={setResult}
                  onNotes={setNotes}
                  onKey={onKey}
                  registerRow={registerRow}
                  registerNotes={registerNotes}
                />
              ))}
            </ul>
          )}

          <div className="sticky bottom-0 -mx-4 mt-4 border-t border-[#e5e5e5] bg-white p-4 md:mx-0 md:rounded-xl md:border">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm">
                <p className="font-semibold text-[#1d1d1b]">
                  {marked}/{booked.length} marcados
                </p>
                {blockers.length > 0 && <p className="text-[#737373]">{blockers.join(" · ")}</p>}
              </div>
              <Button
                className="min-h-11"
                disabled={blockers.length > 0 || finish.isPending}
                onClick={() => setFinishing(true)}
              >
                Encerrar chamada
              </Button>
            </div>
          </div>
        </section>
      )}

      {open && finishing && (
        <FinishDialog
          summary={finishSummary(detail.startsAt, marks)}
          reopenMinutes={reopenMinutes}
          pending={finish.isPending}
          onConfirm={confirmFinish}
          onClose={() => setFinishing(false)}
        />
      )}
      {correcting && (
        <CorrectionDialog kind={correcting.kind} enrollee={correcting.enrollee} onClose={() => setCorrecting(null)} />
      )}
    </div>
  );
}


"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OrientationStatusBadge } from "@/components/admin/orientation/orientation-status-badge";
import { ReasonPrompt } from "@/components/admin/orientation/reason-prompt";
import { SessionPicker } from "@/components/admin/orientation/session-picker";
import {
  approvedViaLabel,
  brasiliaDateKey,
  enrollmentStatusLabel,
  formatSessionClock,
  formatSessionDay,
  orientationErrorMessage,
  orientationEventLabel,
} from "@/modules/admin/application/orientation-presentation";
import {
  useBookingLink,
  useOrientationProvider,
  useOrientationProviderAction,
  type OrientationProviderActionInput,
} from "@/modules/admin/application/use-orientation";
import type {
  OrientationEventRow,
  OrientationProviderDetail,
  OrientationStatus,
} from "@/modules/admin/infrastructure/orientation-api";
import { useAuth } from "@/modules/auth/application/use-auth";

interface Props {
  providerGlobalId: string | null | undefined;
  listStatus: OrientationStatus | null | undefined;
}

type ReasonKind = "approve-manual" | "correct-result" | "allow-new-class" | "reset-no-shows" | "reset-changes";
type Panel = null | { type: "book" } | { type: "reschedule" } | { type: "reason"; kind: ReasonKind };

const REASON_TEXTS: Record<ReasonKind, { title: string; consequence: string; done: string }> = {
  "approve-manual": {
    title: "Aprovar sem aula",
    consequence:
      "A pessoa passa a contar como aprovada sem ter feito a aula. Ninguém é avisado. Fica registrado quem aprovou e o motivo.",
    done: "Pessoa aprovada sem aula.",
  },
  "correct-result": {
    title: "Corrigir resultado",
    consequence:
      "A pessoa deixa de estar aprovada: quando a trava de vagas estiver ligada, ela não vê vagas até fazer a aula de novo. Ninguém é avisado. Fica registrado quem corrigiu e o motivo.",
    done: "Resultado corrigido.",
  },
  "allow-new-class": {
    title: "Permitir nova aula",
    consequence:
      "A pessoa deixa de estar reprovada e pode marcar outra aula. Ninguém é avisado; avise pelo WhatsApp se precisar. Fica registrado quem permitiu e o motivo.",
    done: "Pronto: a pessoa pode marcar outra aula.",
  },
  "reset-no-shows": {
    title: "Zerar faltas",
    consequence: "A contagem de faltas volta a zero. Fica registrado quem zerou e o motivo.",
    done: "Faltas zeradas.",
  },
  "reset-changes": {
    title: "Zerar trocas",
    consequence: "A contagem de trocas desta rodada volta a zero. Fica registrado quem zerou e o motivo.",
    done: "Trocas zeradas.",
  },
};

/** "11/12/2026" (Brasília) */
function formatDate(iso: string): string {
  const key = brasiliaDateKey(iso);
  if (!key) return "—";
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

/** "10/11/2026, 10h30" (Brasília) */
function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatSessionClock(iso)}`;
}

function actorOf(e: OrientationEventRow): string {
  if (e.actorName) return e.actorName;
  if (e.actorType === "PROVIDER") return "Freelancer";
  if (e.actorType === "SYSTEM") return "Sistema";
  return "Admin";
}

/** Bloco "Onboarding" (aula obrigatória) dentro do detalhe do freelancer. Tudo inline, sem diálogo por cima. */
export function OrientationProviderSection({ providerGlobalId, listStatus }: Props) {
  const { hasPermission, isSuperAdmin } = useAuth();
  const canOrient = hasPermission("ORIENTATION");
  const pgId = providerGlobalId ?? null;
  const detailQ = useOrientationProvider(pgId, canOrient);
  const action = useOrientationProviderAction();
  const link = useBookingLink();
  const [panel, setPanel] = useState<Panel>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [fallbackLink, setFallbackLink] = useState<string | null>(null);

  const wrap = (children: React.ReactNode) => (
    <section className="space-y-3 rounded-xl border border-[#e5e5e5] bg-white p-4" aria-label="Onboarding">
      <h3 className="text-sm font-semibold text-[#1d1d1b]">Onboarding (aula obrigatória)</h3>
      {children}
    </section>
  );

  if (!canOrient) {
    return wrap(
      <div className="flex flex-wrap items-center gap-2 text-sm text-[#525252]">
        <OrientationStatusBadge status={listStatus} />
        <span>Você não tem acesso ao Onboarding.</span>
      </div>,
    );
  }

  if (!pgId) {
    return wrap(
      <p className="text-sm text-[#525252]">
        Este cadastro não tem identidade global (cadastro antigo). Não dá para agendar aula por aqui.
      </p>,
    );
  }

  if (detailQ.isLoading) return wrap(<p className="text-sm text-[#737373]">Carregando…</p>);
  const d: OrientationProviderDetail | undefined = detailQ.data;
  if (detailQ.isError || !d) {
    return wrap(<p className="text-sm text-red-600">Não deu para carregar o Onboarding desta pessoa.</p>);
  }

  const pending = action.isPending || link.isPending;
  const booked = d.current?.status === "BOOKED" ? d.current : null;
  const historyCount = d.enrollments.length + d.events.length;

  const run = async (input: Omit<OrientationProviderActionInput, "providerGlobalId">, done: string) => {
    try {
      await action.mutateAsync({ ...input, providerGlobalId: pgId });
      toast.success(done);
      setPanel(null);
    } catch (err) {
      toast.error(orientationErrorMessage(err, "Não deu para concluir. Tente de novo."));
    }
  };

  const copyLink = async () => {
    setFallbackLink(null);
    try {
      const { url, expiresAt } = await link.mutateAsync(pgId);
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          toast.success(`Link copiado. Vale até ${formatDate(expiresAt)}.`);
          return;
        } catch {
          /* cai no campo só de leitura */
        }
      }
      setFallbackLink(url);
      toast.info(`Copie o link abaixo. Vale até ${formatDate(expiresAt)}.`);
    } catch (err) {
      toast.error(orientationErrorMessage(err, "Não deu para gerar o link."));
    }
  };

  const reason = panel?.type === "reason" ? REASON_TEXTS[panel.kind] : null;

  return wrap(
    <div className="space-y-3 text-sm text-[#1d1d1b]">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <OrientationStatusBadge status={d.status} />
          <span className="text-[#525252]">
            {d.statusAt ? `desde ${formatDateTime(d.statusAt)}` : ""}
            {d.status === "APPROVED" ? ` · ${approvedViaLabel(d.approvedVia)}` : ""}
          </span>
        </div>
        <p className="text-[#525252]">{`Faltas: ${d.noShows} · Trocas nesta rodada: ${d.changes}`}</p>
        {booked && (
          <p className="font-medium">
            {`Aula marcada: ${formatSessionDay(booked.session.startsAt)} · ${formatSessionClock(booked.session.startsAt)}`}
          </p>
        )}
      </div>

      {panel?.type === "book" && (
        <SessionPicker
          pending={pending}
          onPick={(sessionId) => void run({ kind: "book", sessionId }, "Aula marcada.")}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel?.type === "reschedule" && (
        <SessionPicker
          excludeSessionId={booked?.sessionId}
          pending={pending}
          onPick={(sessionId) => void run({ kind: "reschedule", sessionId }, "Turma trocada.")}
          onCancel={() => setPanel(null)}
        />
      )}
      {panel?.type === "reason" && reason && (
        <ReasonPrompt
          title={reason.title}
          consequence={reason.consequence}
          confirmLabel={reason.title}
          pending={pending}
          onConfirm={(text) => void run({ kind: panel.kind, reason: text }, reason.done)}
          onCancel={() => setPanel(null)}
        />
      )}

      {panel === null && (
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
          {d.status === "PENDING" && !booked && (
            <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => setPanel({ type: "book" })}>
              Agendar por ele
            </Button>
          )}
          {d.status === "PENDING" && booked && (
            <>
              <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => setPanel({ type: "reschedule" })}>
                Trocar turma
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                disabled={pending}
                onClick={() => void run({ kind: "cancel-booking" }, "Aula desmarcada. Avise a pessoa pelo WhatsApp.")}
              >
                Desmarcar aula
              </Button>
            </>
          )}
          {d.status === "PENDING" && (
            <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => void copyLink()}>
              Copiar link de agendamento
            </Button>
          )}
          {d.status === "PENDING" && isSuperAdmin && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={() => setPanel({ type: "reason", kind: "approve-manual" })}
            >
              Aprovar sem aula
            </Button>
          )}
          {d.status === "APPROVED" && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={() => setPanel({ type: "reason", kind: "correct-result" })}
            >
              Corrigir resultado
            </Button>
          )}
          {d.status === "REJECTED" && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={() => setPanel({ type: "reason", kind: "allow-new-class" })}
            >
              Permitir nova aula
            </Button>
          )}
          {d.noShows > 0 && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={() => setPanel({ type: "reason", kind: "reset-no-shows" })}
            >
              {`Zerar faltas (${d.noShows})`}
            </Button>
          )}
          {d.changes > 0 && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={pending}
              onClick={() => setPanel({ type: "reason", kind: "reset-changes" })}
            >
              {`Zerar trocas (${d.changes})`}
            </Button>
          )}
        </div>
      )}

      {fallbackLink && (
        <input
          readOnly
          aria-label="Link de agendamento"
          value={fallbackLink}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-lg border border-[#e5e5e5] bg-[#f7f7f7] px-3 py-2 text-xs"
        />
      )}

      {historyCount > 0 && (
        <div className="space-y-2">
          <Button
            variant="outline"
            className="min-h-11"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? "Esconder histórico" : `Ver histórico (${historyCount})`}
          </Button>
          {showHistory && (
            <div data-testid="orientation-history" className="space-y-3">
              {d.enrollments.length > 0 && (
                <div>
                  <p className="font-semibold">Aulas</p>
                  <ul className="space-y-1">
                    {d.enrollments.map((en) => (
                      <li key={en.id} className="text-[#525252]">
                        {formatSessionDay(en.session.startsAt)} · {formatSessionClock(en.session.startsAt)} —{" "}
                        {enrollmentStatusLabel(en.status, en.cancelledReason)}
                        {en.notes ? ` — ${en.notes}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {d.events.length > 0 && (
                <div>
                  <p className="font-semibold">Movimentos</p>
                  <ul className="space-y-1">
                    {d.events.map((e) => (
                      <li key={e.id} className="text-[#525252]">
                        {orientationEventLabel(e)} — {actorOf(e)} — {formatDateTime(e.createdAt)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>,
  );
}

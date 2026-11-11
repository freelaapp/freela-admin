"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useOrientationSessions,
  useOrientationSettings,
} from "@/modules/admin/application/use-orientation";
import type { OrientationSessionView } from "@/modules/admin/infrastructure/orientation-api";
import { CancelSeriesDialog } from "./_components/cancel-series-dialog";
import { CancelSessionDialog } from "./_components/cancel-session-dialog";
import { SeriesDialog } from "./_components/series-dialog";
import { SessionCard } from "./_components/session-card";
import { SessionFormDialog, type SessionFormMode } from "./_components/session-form-dialog";
import { brasiliaWeek, groupByBrasiliaDay } from "./_lib/week";

export default function TurmasOnboardingPage() {
  const [now] = useState(() => new Date());
  const [offset, setOffset] = useState(0);
  const week = useMemo(() => brasiliaWeek(now, offset), [now, offset]);
  const sessions = useOrientationSessions({ from: week.fromIso, to: week.toIso });
  const settings = useOrientationSettings();

  const [form, setForm] = useState<SessionFormMode | null>(null);
  const [series, setSeries] = useState(false);
  const [cancelling, setCancelling] = useState<OrientationSessionView | null>(null);
  const [cancellingSeries, setCancellingSeries] = useState<string | null>(null);

  const groups = useMemo(() => groupByBrasiliaDay(sessions.data ?? []), [sessions.data]);
  // A turma em edição acompanha a lista relida; se ela sair da semana (mudou de dia), vale a última cópia.
  const editingLive =
    form?.kind === "edit"
      ? ({ kind: "edit", session: sessions.data?.find((s) => s.id === form.session.id) ?? form.session } as const)
      : form;

  return (
    <div className="mx-auto max-w-5xl py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#1d1d1b]">Turmas</h1>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11 md:min-h-9" onClick={() => setForm({ kind: "create" })}>
            Nova turma
          </Button>
          <Button variant="outline" className="min-h-11 md:min-h-9" onClick={() => setSeries(true)}>
            Turmas em série
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => setOffset((o) => o - 1)}>
          Semana anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 md:min-h-9"
          onClick={() => setOffset(0)}
          disabled={offset === 0}
        >
          Esta semana
        </Button>
        <Button variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => setOffset((o) => o + 1)}>
          Próxima semana
        </Button>
        <span className="text-sm font-medium text-[#525252]" aria-live="polite">
          {week.label}
        </span>
      </div>

      {sessions.isLoading ? (
        <div role="status" aria-label="Carregando" className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
        </div>
      ) : !sessions.data ? (
        <p className="py-8 text-sm text-[#737373]">
          Não consegui carregar as turmas.{" "}
          <button type="button" className="underline" onClick={() => void sessions.refetch()}>
            Tentar de novo
          </button>
        </p>
      ) : groups.length === 0 ? (
        <p className="py-8 text-sm text-[#737373]">Nenhuma turma nesta semana.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.dayKey} aria-labelledby={`day-${g.dayKey}`}>
              <h2 id={`day-${g.dayKey}`} className="mb-2 text-sm font-semibold capitalize text-[#1d1d1b]">
                {g.label}
              </h2>
              <ul className="space-y-3">
                {g.sessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    onEdit={(x) => setForm({ kind: "edit", session: x })}
                    onCancel={setCancelling}
                    onCancelSeries={setCancellingSeries}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editingLive && (
        <SessionFormDialog
          mode={editingLive}
          settings={settings.data}
          now={now}
          onClose={() => setForm(null)}
        />
      )}
      {series && <SeriesDialog settings={settings.data} now={now} onClose={() => setSeries(false)} />}
      {cancelling && <CancelSessionDialog session={cancelling} onClose={() => setCancelling(null)} />}
      {cancellingSeries && (
        <CancelSeriesDialog seriesId={cancellingSeries} onClose={() => setCancellingSeries(null)} />
      )}
    </div>
  );
}

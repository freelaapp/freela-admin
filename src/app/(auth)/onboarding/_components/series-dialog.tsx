"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  brasiliaDateKey,
  formatSessionShort,
  orientationErrorMessage,
} from "@/modules/admin/application/orientation-presentation";
import { useCreateOrientationSeries } from "@/modules/admin/application/use-orientation";
import type {
  OrientationSeriesResult,
  OrientationSettingsView,
} from "@/modules/admin/infrastructure/orientation-api";
import { buildSeriesPayload, type SeriesFormState } from "../_lib/session-form";
import { AudiencePicker } from "./audience-picker";
import { HostSelect, MeetField, NumberField, useDefaultHostId } from "./common-fields";

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

interface Props {
  settings: OrientationSettingsView | undefined;
  now: Date;
  onClose: () => void;
}

export function SeriesDialog({ settings, now, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} className="max-w-2xl">
      <DialogContent role="dialog" aria-modal="true" className="max-h-[55vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Turmas em série</DialogTitle>
          <DialogDescription>Cria várias turmas de uma vez. Os horários são de Brasília.</DialogDescription>
        </DialogHeader>
        {settings ? (
          <SeriesBody settings={settings} now={now} onClose={onClose} />
        ) : (
          <p className="text-sm text-[#737373]">Carregando os padrões das turmas…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SeriesBody({
  settings,
  now,
  onClose,
}: {
  settings: OrientationSettingsView;
  now: Date;
  onClose: () => void;
}) {
  const today = brasiliaDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString());
  const [form, setForm] = useState<SeriesFormState>({
    weekdays: [1, 2, 3, 4, 5],
    time: "09:00",
    fromDate: today,
    toDate: today,
    durationMin: String(settings.defaultDurationMin),
    capacity: String(settings.defaultCapacity),
    hostAdminId: "",
    meetUrl: "",
    audienceUfs: [],
    audienceCities: [],
  });
  const [preview, setPreview] = useState<OrientationSeriesResult | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  // O id vale para um plano exato (campos + datas puladas + quem dá a aula já resolvido): a API só
  // compara o id, então plano diferente com o mesmo id seria dado como "já criado".
  const idRef = useRef<{ key: string; id: string }>({ key: "", id: "" });
  const idFor = (skipDates: string[]): string => {
    const key = JSON.stringify([{ ...form, hostAdminId: form.hostAdminId || defaultHost }, skipDates]);
    if (idRef.current.key !== key) idRef.current = { key, id: crypto.randomUUID() };
    return idRef.current.id;
  };
  const sending = useRef(false);
  const defaultHost = useDefaultHostId();
  const previewMutation = useCreateOrientationSeries();
  const createMutation = useCreateOrientationSeries();
  const limits = { maxCapacity: settings.maxCapacity };

  const change = (patch: Partial<SeriesFormState>) => {
    setPreview(null);
    setSkipped(new Set());
    setForm((f) => ({ ...f, ...patch }));
  };

  const planForm = () => ({ ...form, hostAdminId: form.hostAdminId || defaultHost });

  const showPreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (previewMutation.isPending) return;
    const built = buildSeriesPayload(planForm(), limits, {
      dryRun: true,
      skipDates: [],
      seriesId: idFor([]),
    });
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    previewMutation.mutate(built.payload, {
      onSuccess: (r) => {
        setPreview(r);
        setSkipped(new Set());
      },
      onError: (err) => toast.error(orientationErrorMessage(err, "Não foi possível calcular as datas.")),
    });
  };

  const toggleDate = (key: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const total = preview?.sessions.length ?? 0;
  const count = total - skipped.size;

  const create = () => {
    if (!preview || sending.current || createMutation.isPending) return;
    const skipDates = [...skipped].sort();
    const built = buildSeriesPayload(planForm(), limits, {
      dryRun: false,
      skipDates,
      seriesId: idFor(skipDates),
    });
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    sending.current = true;
    createMutation.mutate(built.payload, {
      onSuccess: (r) => {
        toast.success(
          r.alreadyCreated
            ? "Estas turmas já tinham sido criadas."
            : `${count} ${count === 1 ? "turma criada" : "turmas criadas"}.`,
        );
        onClose();
      },
      onError: (err) => toast.error(orientationErrorMessage(err, "Não foi possível criar as turmas.")),
      onSettled: () => {
        sending.current = false;
      },
    });
  };

  const toggleWeekday = (d: number) =>
    change({ weekdays: form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d] });

  if (preview) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#1d1d1b]">
          Estas são as datas. Desmarque as que não devem ter aula.
        </p>
        <ul className="divide-y divide-[#e5e5e5] rounded-lg border border-[#e5e5e5]">
          {preview.sessions.map((s) => {
            const key = brasiliaDateKey(s.startsAt);
            return (
              <li key={s.startsAt}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={!skipped.has(key)}
                    onChange={() => toggleDate(key)}
                  />
                  <span>{formatSessionShort(s.startsAt)}</span>
                  {s.isHoliday && <Badge variant="warning">Feriado nacional</Badge>}
                </label>
              </li>
            );
          })}
        </ul>
        <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 mt-4 rounded-b-xl border-t border-[#e5e5e5] bg-white p-4">
          <Button variant="outline" onClick={() => setPreview(null)} disabled={createMutation.isPending}>
            Voltar
          </Button>
          <Button className="min-h-11" onClick={create} disabled={createMutation.isPending || count === 0}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {`Criar ${count} ${count === 1 ? "turma" : "turmas"}`}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={showPreview} className="space-y-4">
      <div className="space-y-1">
        <span className="text-sm font-medium text-[#1d1d1b]" id="series-weekdays">
          Dias da semana
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="series-weekdays">
          {WEEKDAYS.map((d) => {
            const on = form.weekdays.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggleWeekday(d.value)}
                className={cn(
                  "min-h-11 min-w-11 rounded-lg border px-2 text-sm font-medium",
                  on
                    ? "border-[#eca826] bg-[#eca826]/15 text-[#1d1d1b]"
                    : "border-[#e5e5e5] bg-white text-[#525252]",
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="series-from">De</Label>
          <Input id="series-from" type="date" value={form.fromDate} onChange={(e) => change({ fromDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="series-to">Até</Label>
          <Input id="series-to" type="date" value={form.toDate} onChange={(e) => change({ toDate: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="series-time">Horário</Label>
          <Input id="series-time" type="time" value={form.time} onChange={(e) => change({ time: e.target.value })} />
        </div>
        <NumberField
          id="series-duration"
          label="Duração (min)"
          value={form.durationMin}
          onChange={(v) => change({ durationMin: v })}
        />
        <NumberField
          id="series-capacity"
          label="Lugares"
          value={form.capacity}
          onChange={(v) => change({ capacity: v })}
          hint={`No máximo ${settings.maxCapacity}.`}
        />
      </div>
      <HostSelect value={form.hostAdminId} onChange={(v) => change({ hostAdminId: v })} />
      <MeetField value={form.meetUrl} onChange={(v) => change({ meetUrl: v })} />
      <AudiencePicker
        ufs={form.audienceUfs}
        cities={form.audienceCities}
        onChange={(a) => change({ audienceUfs: a.ufs, audienceCities: a.cities })}
      />
      <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 mt-4 rounded-b-xl border-t border-[#e5e5e5] bg-white p-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={previewMutation.isPending}>
          Fechar
        </Button>
        <Button type="submit" className="min-h-11" disabled={previewMutation.isPending}>
          {previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Ver as datas
        </Button>
      </DialogFooter>
    </form>
  );
}

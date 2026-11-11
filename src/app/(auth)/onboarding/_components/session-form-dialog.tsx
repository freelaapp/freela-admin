"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { brasiliaDateKey, orientationErrorMessage } from "@/modules/admin/application/orientation-presentation";
import {
  useCreateOrientationSession,
  useUpdateOrientationSession,
} from "@/modules/admin/application/use-orientation";
import type {
  OrientationSessionView,
  OrientationSettingsView,
} from "@/modules/admin/infrastructure/orientation-api";
import {
  buildCreateSessionPayload,
  buildUpdateSessionPayload,
  sessionToForm,
  type SessionFormState,
} from "../_lib/session-form";
import { AudiencePicker } from "./audience-picker";
import { HostSelect, MeetField, NumberField, useDefaultHostId } from "./common-fields";

export type SessionFormMode = { kind: "create" } | { kind: "edit"; session: OrientationSessionView };

interface Props {
  mode: SessionFormMode;
  settings: OrientationSettingsView | undefined;
  now: Date;
  onClose: () => void;
}

function emptyForm(settings: OrientationSettingsView, now: Date): SessionFormState {
  return {
    date: brasiliaDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()),
    time: "09:00",
    durationMin: String(settings.defaultDurationMin),
    capacity: String(settings.defaultCapacity),
    hostAdminId: "",
    meetUrl: "",
    audienceUfs: [],
    audienceCities: [],
    notes: "",
  };
}

export function SessionFormDialog({ mode, settings, now, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} className="max-w-2xl">
      <DialogContent role="dialog" aria-modal="true" className="max-h-[55vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode.kind === "create" ? "Nova turma" : "Editar turma"}</DialogTitle>
          <DialogDescription>Os horários são de Brasília.</DialogDescription>
        </DialogHeader>
        {settings ? (
          <SessionFormBody mode={mode} settings={settings} now={now} onClose={onClose} />
        ) : (
          <p className="text-sm text-[#737373]">Carregando os padrões das turmas…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SessionFormBody({
  mode,
  settings,
  now,
  onClose,
}: {
  mode: SessionFormMode;
  settings: OrientationSettingsView;
  now: Date;
  onClose: () => void;
}) {
  const editing = mode.kind === "edit" ? mode.session : null;
  const [base, setBase] = useState<OrientationSessionView | null>(editing);
  const [form, setForm] = useState<SessionFormState>(() =>
    editing ? sessionToForm(editing) : emptyForm(settings, now),
  );
  const [moved, setMoved] = useState<{ booked: number; sessionId: string } | null>(null);
  const defaultHost = useDefaultHostId();
  const create = useCreateOrientationSession();
  const update = useUpdateOrientationSession();
  const pending = create.isPending || update.isPending;
  const limits = { maxCapacity: settings.maxCapacity };

  // A turma da lista é relida de tempos em tempos: o que a pessoa não mexeu acompanha o servidor,
  // o que ela editou fica. O PUT/PATCH compara com a última leitura (`base`) e só leva as edições.
  if (editing && base && editing !== base) {
    const oldForm = sessionToForm(base);
    const newForm = sessionToForm(editing);
    setBase(editing);
    setForm(
      Object.fromEntries(
        (Object.keys(newForm) as (keyof SessionFormState)[]).map((k) => [
          k,
          JSON.stringify(form[k]) === JSON.stringify(oldForm[k]) ? newForm[k] : form[k],
        ]),
      ) as unknown as SessionFormState,
    );
  }

  const set = <K extends keyof SessionFormState>(key: K, value: SessionFormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (base) {
      const built = buildUpdateSessionPayload(form, base, limits);
      if (!built.ok) {
        toast.error(built.error);
        return;
      }
      update.mutate(
        { id: base.id, patch: built.payload },
        {
          onSuccess: (saved) => {
            if (saved.scheduleChanged) {
              setMoved({ booked: saved.bookedCount, sessionId: saved.id });
              return;
            }
            toast.success("Turma atualizada.");
            onClose();
          },
          onError: (err) => toast.error(orientationErrorMessage(err, "Não foi possível salvar a turma.")),
        },
      );
      return;
    }
    const built = buildCreateSessionPayload(
      { ...form, hostAdminId: form.hostAdminId || defaultHost },
      limits,
      new Date(),
    );
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    create.mutate(built.payload, {
      onSuccess: () => {
        toast.success("Turma criada.");
        onClose();
      },
      onError: (err) => toast.error(orientationErrorMessage(err, "Não foi possível criar a turma.")),
    });
  };

  if (moved) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {moved.booked > 0
            ? `O horário mudou. Avise os ${moved.booked} inscritos pelo WhatsApp: a lista está na página da turma.`
            : "O horário mudou. Ninguém estava inscrito."}
        </p>
        <DialogFooter>
          {moved.booked > 0 && (
            <Button asChild variant="outline">
              <Link href={`/onboarding/turmas/${moved.sessionId}`}>Abrir a turma</Link>
            </Button>
          )}
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="session-date">Dia</Label>
          <Input id="session-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="session-time">Horário</Label>
          <Input id="session-time" type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
        </div>
        <NumberField
          id="session-duration"
          label="Duração (min)"
          value={form.durationMin}
          onChange={(v) => set("durationMin", v)}
        />
        <NumberField
          id="session-capacity"
          label="Lugares"
          value={form.capacity}
          onChange={(v) => set("capacity", v)}
          hint={`No máximo ${settings.maxCapacity}.`}
        />
      </div>
      <HostSelect value={form.hostAdminId} onChange={(v) => set("hostAdminId", v)} />
      <MeetField value={form.meetUrl} onChange={(v) => set("meetUrl", v)} />
      <AudiencePicker
        ufs={form.audienceUfs}
        cities={form.audienceCities}
        onChange={(a) => setForm((f) => ({ ...f, audienceUfs: a.ufs, audienceCities: a.cities }))}
      />
      <div className="space-y-1">
        <Label htmlFor="session-notes">Observações (só o time vê)</Label>
        <textarea
          id="session-notes"
          rows={2}
          maxLength={1000}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
        />
      </div>
      <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 mt-4 rounded-b-xl border-t border-[#e5e5e5] bg-white p-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Fechar
        </Button>
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {base ? "Salvar" : "Criar turma"}
        </Button>
      </DialogFooter>
    </form>
  );
}

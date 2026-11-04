"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChoicePills } from "@/components/ui/choice-pills";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import { getAdminProviders, type ProviderItem } from "@/modules/admin/infrastructure/admin-api";
import {
  useCreateSuspension,
  useKeepInfraction,
  useLiftSuspension,
  useRegisterConversation,
} from "@/modules/admin/application/use-suspensions";
import {
  LIFT_REASON_OPTIONS,
  MANUAL_SUSPENSION_DAYS,
  liftReasonHint,
  reasonLabel,
} from "@/modules/admin/application/suspensions-presentation";
import type {
  SuspensionItem,
  SuspensionLiftReason,
} from "@/modules/admin/infrastructure/suspensions-api";

const FIELD =
  "w-full rounded-md border border-[#e5e5e5] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/30";
const LABEL = "mb-1.5 block text-xs font-semibold text-[#1d1d1b]";

function who(item: SuspensionItem): string {
  return item.person.name ?? item.person.email ?? "o freelancer";
}

/** "Levantar suspensão" (motivo obrigatório: Contestação aceita · Erro do sistema · Outro). */
export function LiftSuspensionDialog({
  item,
  onClose,
}: {
  item: SuspensionItem;
  onClose: () => void;
}) {
  const lift = useLiftSuspension();
  const [reason, setReason] = useState<SuspensionLiftReason>(
    item.source?.status === "CONTESTED" ? "CONTEST_ACCEPTED" : "SYSTEM_ERROR",
  );
  const [note, setNote] = useState("");
  const missingNote = reason === "OTHER" && !note.trim();

  async function submit() {
    if (missingNote) return;
    try {
      await lift.mutateAsync({ id: item.id, reason, ...(note.trim() ? { note: note.trim() } : {}) });
      toast.success("Suspensão levantada.");
      onClose();
    } catch (err) {
      toast.error(apiErrorOf(err).message ?? "Não foi possível levantar a suspensão.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-label="Levantar suspensão?">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>Levantar a suspensão de {who(item)}?</DialogTitle>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          <p className="text-sm text-[#737373]">{reasonLabel(item)}</p>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#1d1d1b]">Motivo</p>
            <ChoicePills
              aria-label="Motivo"
              options={LIFT_REASON_OPTIONS}
              value={reason}
              onChange={setReason}
            />
            <p className="mt-2 text-xs text-[#737373]">{liftReasonHint(reason, Boolean(item.source))}</p>
          </div>
          <div>
            <label htmlFor="lift-note" className={LABEL}>
              {reason === "OTHER" ? "O que aconteceu (obrigatório)" : "Nota (opcional)"}
            </label>
            <textarea
              id="lift-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={missingNote || undefined}
              className={FIELD}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={submit} disabled={lift.isPending || missingNote}>
            {lift.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Levantar suspensão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Registrar conversa": a volta passa a depender só do prazo (se houver). */
export function RegisterConversationDialog({
  item,
  onClose,
}: {
  item: SuspensionItem;
  onClose: () => void;
}) {
  const register = useRegisterConversation();
  const [note, setNote] = useState("");

  async function submit() {
    try {
      await register.mutateAsync({ id: item.id, ...(note.trim() ? { note: note.trim() } : {}) });
      toast.success("Conversa registrada.");
      onClose();
    } catch (err) {
      toast.error(apiErrorOf(err).message ?? "Não foi possível registrar a conversa.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-label="Registrar conversa">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>Registrar a conversa com {who(item)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-[#737373]">
            Depois da conversa, a pessoa volta a poder se candidatar no fim do prazo (ou já, se não
            houver prazo).
          </p>
          <div>
            <label htmlFor="conversation-note" className={LABEL}>
              O que foi combinado (opcional)
            </label>
            <textarea
              id="conversation-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={FIELD}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={submit} disabled={register.isPending}>
            {register.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Registrar conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Manter a ocorrência" (contestação negada): a suspensão continua e a pessoa é avisada. */
export function KeepOccurrenceDialog({
  item,
  onClose,
}: {
  item: SuspensionItem;
  onClose: () => void;
}) {
  const keep = useKeepInfraction();
  const [note, setNote] = useState("");
  const missingNote = !note.trim();

  async function submit() {
    if (missingNote || !item.source) return;
    try {
      await keep.mutateAsync({ infractionId: item.source.infractionId, note: note.trim() });
      toast.success("Ocorrência mantida. O freelancer foi avisado.");
      onClose();
    } catch (err) {
      toast.error(apiErrorOf(err).message ?? "Não foi possível manter a ocorrência.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-label="Manter a ocorrência?">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>Manter a ocorrência de {who(item)}?</DialogTitle>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {item.source?.justification && (
            <p className="rounded-md bg-[#f7f7f7] p-3 text-sm text-[#1d1d1b]">
              “{item.source.justification}”
            </p>
          )}
          <p className="text-sm text-[#737373]">
            A suspensão continua e o freelancer recebe &quot;Mantivemos a ocorrência&quot;.
          </p>
          <div>
            <label htmlFor="keep-note" className={LABEL}>
              Por que mantém (obrigatório)
            </label>
            <textarea
              id="keep-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={missingNote || undefined}
              className={FIELD}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={submit} disabled={keep.isPending || missingNote}>
            {keep.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Manter a ocorrência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Suspender" (motivo obrigatório): dias sem se candidatar (1 a 90, sempre) e a conversa opcional. */
export function SuspendDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateSuspension();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProviderItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [person, setPerson] = useState<ProviderItem | null>(null);
  const [days, setDays] = useState("7");
  const [conversation, setConversation] = useState(true);
  const [reason, setReason] = useState("");
  const parsedDays = days.trim() ? Number(days) : null;
  const daysInvalid =
    parsedDays === null ||
    !Number.isInteger(parsedDays) ||
    parsedDays < MANUAL_SUSPENSION_DAYS.min ||
    parsedDays > MANUAL_SUSPENSION_DAYS.max;
  const missing = !person?.providerGlobalId || reason.trim().length < 5 || daysInvalid;

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const page = await getAdminProviders({ search: query.trim(), limit: 5 });
      setResults(page.data);
    } catch (err) {
      toast.error(apiErrorOf(err).message ?? "Não foi possível buscar o freelancer.");
    } finally {
      setSearching(false);
    }
  }

  async function submit() {
    if (missing || !person?.providerGlobalId || parsedDays === null) return;
    try {
      await create.mutateAsync({
        providerGlobalId: person.providerGlobalId,
        days: parsedDays,
        requiresConversation: conversation,
        reason: reason.trim(),
      });
      toast.success("Suspensão registrada. O freelancer foi avisado.");
      onClose();
    } catch (err) {
      toast.error(apiErrorOf(err).message ?? "Não foi possível suspender.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-label="Suspender freelancer">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>Suspender freelancer</DialogTitle>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label htmlFor="suspend-search" className={LABEL}>
              Freelancer (nome, e-mail ou telefone)
            </label>
            <div className="flex gap-2">
              <input
                id="suspend-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void search();
                }}
                className={FIELD}
              />
              <Button variant="outline" onClick={() => void search()} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Buscar"}
              </Button>
            </div>
            {results && results.length === 0 && (
              <p className="mt-2 text-xs text-[#737373]">Ninguém encontrado.</p>
            )}
            {results && results.length > 0 && (
              <div role="radiogroup" aria-label="Freelancer" className="mt-2 space-y-1">
                {results.map((p) => (
                  <label key={p.id} className="flex min-h-10 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="suspend-person"
                      checked={person?.id === p.id}
                      disabled={!p.providerGlobalId}
                      onChange={() => setPerson(p)}
                    />
                    <span>
                      {p.name ?? "Sem nome"}
                      <span className="text-[#737373]"> · {p.phone ?? p.email ?? "sem contato"}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label htmlFor="suspend-days" className={LABEL}>
              Dias sem se candidatar ({MANUAL_SUSPENSION_DAYS.min} a {MANUAL_SUSPENSION_DAYS.max})
            </label>
            <input
              id="suspend-days"
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              aria-invalid={daysInvalid || undefined}
              aria-describedby="suspend-days-hint"
              className={FIELD}
            />
            <p id="suspend-days-hint" className="mt-1 text-xs text-[#737373]">
              A suspensão sempre tem fim. Com a conversa marcada, a volta também espera a conversa.
            </p>
          </div>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={conversation}
              onChange={(e) => setConversation(e.target.checked)}
            />
            Só volta depois de uma conversa com o suporte
          </label>
          <div>
            <label htmlFor="suspend-reason" className={LABEL}>
              Motivo (obrigatório; não vai para o freelancer)
            </label>
            <textarea
              id="suspend-reason"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={FIELD}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={submit} disabled={create.isPending || missing}>
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Suspender
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

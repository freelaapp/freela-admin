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
import { useCloseSupportCase } from "@/modules/admin/application/use-support-cases";
import { CLOSE_OUTCOME_OPTIONS } from "@/modules/admin/application/support-queue-presentation";
import type { SupportCaseCloseOutcome } from "@/modules/admin/infrastructure/support-cases-api";

/**
 * "Fechar o caso?" (designer §5.3): como terminou e o motivo (obrigatório em "Não conseguimos"),
 * com o lembrete do Guia antes do botão.
 */
export function CloseCaseDialog({
  caseId,
  onClose,
}: {
  caseId: string;
  onClose: () => void;
}) {
  const close = useCloseSupportCase();
  const [outcome, setOutcome] = useState<SupportCaseCloseOutcome>("SAVED");
  const [note, setNote] = useState("");
  const noteRequired = outcome === "NOT_SAVED";
  const missingNote = noteRequired && !note.trim();

  async function submit() {
    if (missingNote) return;
    try {
      await close.mutateAsync({
        id: caseId,
        body: { outcome, ...(note.trim() ? { note: note.trim() } : {}) },
      });
      toast.success("Caso fechado.");
      onClose();
    } catch (err) {
      toast.error(apiErrorOf(err).message ?? "Não foi possível fechar o caso.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-label="Fechar o caso?">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>Fechar o caso?</DialogTitle>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-[#1d1d1b]">
              Como terminou?
            </p>
            <ChoicePills
              aria-label="Como terminou?"
              options={CLOSE_OUTCOME_OPTIONS}
              value={outcome}
              onChange={setOutcome}
            />
          </div>
          <div>
            <label
              htmlFor="close-note"
              className="mb-1.5 block text-xs font-semibold text-[#1d1d1b]"
            >
              {noteRequired ? "Motivo (obrigatório)" : "Motivo (opcional)"}
            </label>
            <textarea
              id="close-note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={missingNote || undefined}
              className="w-full rounded-md border border-[#e5e5e5] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
            />
          </div>
          <p className="rounded-md bg-[#f7f7f7] p-3 text-xs text-[#737373]">
            O freelancer confirmou pelo app? A empresa recebeu a mensagem C ou
            D? Se foi falta, a falta está marcada?
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="secondary"
            onClick={submit}
            disabled={close.isPending || missingNote}
          >
            {close.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Fechar caso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import { useRevokeOccurrenceDecision } from "@/modules/admin/application/use-occurrences";
import {
  REVOKE_SUCCESS_TEXT,
  revokeHint,
} from "@/modules/admin/application/occurrences-presentation";
import type {
  OccurrenceDecisionRecord,
  OccurrenceItem,
} from "@/modules/admin/infrastructure/occurrences-api";

const FIELD =
  "w-full rounded-md border border-[#e5e5e5] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/30";

/** "Desfazer a decisão" (motivo obrigatório; anular não tem volta e não chega aqui). */
export function RevokeDecisionDialog({
  decision,
  item,
  onClose,
}: {
  decision: OccurrenceDecisionRecord;
  item: OccurrenceItem;
  onClose: () => void;
}) {
  const revoke = useRevokeOccurrenceDecision();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const missing = reason.trim().length < 5;

  async function submit() {
    setTouched(true);
    if (missing) return;
    try {
      await revoke.mutateAsync({ decisionId: decision.id, reason: reason.trim() });
      toast.success(REVOKE_SUCCESS_TEXT);
      onClose();
    } catch (err) {
      toast.error(apiErrorOf(err).message ?? "Não foi possível desfazer a decisão.");
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent role="dialog" aria-label="Desfazer a decisão?">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>Desfazer a decisão?</DialogTitle>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          <p className="text-sm text-[#737373]">{revokeHint(decision, item)}</p>
          <div>
            <label htmlFor="oc-revoke" className="mb-1.5 block text-xs font-semibold text-[#1d1d1b]">
              Por que desfazer?
            </label>
            <textarea
              id="oc-revoke"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={(touched && missing) || undefined}
              className={FIELD}
            />
            {touched && missing && (
              <p className="mt-1 text-xs font-medium text-red-700">Escreva pelo menos 5 letras.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Voltar
          </Button>
          <Button variant="secondary" onClick={submit} disabled={revoke.isPending}>
            {revoke.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Desfazer a decisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

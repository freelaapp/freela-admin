"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVipApplicationMutations } from "@/modules/admin/application/use-freela-vip";
import type { VipApplicationDetail } from "@/modules/admin/infrastructure/freela-vip-api";

const TERMINAL = new Set(["VIP_ACTIVE", "VIP_SUSPENDED", "REJECTED", "WITHDREW"]);

export function ApplicationActions({ detail, cycleHasJustification }: { detail: VipApplicationDetail; cycleHasJustification: boolean }) {
  const m = useVipApplicationMutations(detail.id, detail.cycleId);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const busy = m.decide.isPending || m.rescore.isPending || m.openBackground.isPending;
  const terminal = TERMINAL.has(detail.status);
  const canOpenBackground = detail.status === "REFERENCES_OK";

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy || terminal} onClick={() => m.decide.mutate({ action: "approve" })}>
        {m.decide.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : detail.status === "BACKGROUND_OK" ? "Aprovar como VIP" : "Aprovar etapa"}
      </Button>
      <Button size="sm" variant="outline" disabled={busy || terminal} onClick={() => setRejectOpen(true)}>Reprovar</Button>
      <Button size="sm" variant="outline" disabled={busy || !["FORM_SUBMITTED", "SCORED", "WAITLIST", "INTERVIEW_SCHEDULED", "REFERENCES_OK"].includes(detail.status)} onClick={() => m.rescore.mutate()}>Recalcular nota</Button>
      <span title={!cycleHasJustification ? "O ciclo não tem justificativa de antecedentes" : undefined}>
        <Button size="sm" variant="outline" disabled={busy || !canOpenBackground || !cycleHasJustification} onClick={() => m.openBackground.mutate()}>Abrir antecedentes</Button>
      </span>

      <Dialog open={rejectOpen} onOpenChange={(o) => !o && setRejectOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar candidato</DialogTitle>
            <DialogDescription>O motivo é interno (nunca vai ao candidato e nunca cita antecedentes). A mensagem enviada é a genérica.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            <label htmlFor="reject-reason" className="sr-only">Motivo interno da reprovação</label>
            <textarea
              id="reject-reason"
              className="min-h-[90px] w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-sm"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo interno (obrigatório, até 500 caracteres)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button
              disabled={!reason.trim() || m.decide.isPending}
              onClick={() => m.decide.mutate({ action: "reject", rejectionReason: reason.trim() }, { onSuccess: () => { setRejectOpen(false); setReason(""); } })}
            >
              Confirmar reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

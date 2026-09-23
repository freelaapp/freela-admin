"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVipApplicationMutations } from "@/modules/admin/application/use-freela-vip";
import { VIP_APPROVABLE_STATUSES, VIP_REJECTABLE_STATUSES, VIP_RESCORABLE_STATUSES } from "@/modules/admin/application/freela-vip-presentation";
import type { VipApplicationDetail } from "@/modules/admin/infrastructure/freela-vip-api";

export function ApplicationActions({ detail, cycleHasJustification }: { detail: VipApplicationDetail; cycleHasJustification: boolean }) {
  const m = useVipApplicationMutations(detail.id, detail.cycleId);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const busy = m.decide.isPending || m.rescore.isPending || m.openBackground.isPending;
  const canApprove = VIP_APPROVABLE_STATUSES.includes(detail.status);
  const canReject = VIP_REJECTABLE_STATUSES.includes(detail.status);
  const canRescore = VIP_RESCORABLE_STATUSES.includes(detail.status);
  const canOpenBackground = detail.status === "REFERENCES_OK";

  return (
    <div className="flex flex-wrap gap-2">
      <span title={!canApprove ? "Só é possível aprovar a partir de Lista de espera, Entrevista agendada ou Antecedentes OK." : undefined}>
        <Button size="sm" disabled={busy || !canApprove} onClick={() => m.decide.mutate({ action: "approve" })}>
          {m.decide.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : detail.status === "BACKGROUND_OK" ? "Aprovar como VIP" : "Aprovar etapa"}
        </Button>
      </span>
      <span title={!canReject ? "Só é possível reprovar entre Pontuado e Antecedentes pendentes" : undefined}>
        <Button size="sm" variant="outline" disabled={busy || !canReject} onClick={() => setRejectOpen(true)}>Reprovar</Button>
      </span>
      <span title={!canRescore ? "Recalcular só é possível com a candidatura em Nota calculada, Lista de espera, Entrevista ou Referências ok." : undefined}>
        <Button size="sm" variant="outline" disabled={busy || !canRescore} onClick={() => m.rescore.mutate()}>Recalcular nota</Button>
      </span>
      <span title={!cycleHasJustification ? "O ciclo não tem justificativa de antecedentes" : undefined}>
        <Button size="sm" variant="outline" disabled={busy || !canOpenBackground || !cycleHasJustification} onClick={() => m.openBackground.mutate()}>Abrir antecedentes</Button>
      </span>

      <Dialog open={rejectOpen} onOpenChange={(o) => { if (!o) { setRejectOpen(false); setReason(""); } }}>
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
            <Button variant="outline" onClick={() => { setRejectOpen(false); setReason(""); }}>Cancelar</Button>
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

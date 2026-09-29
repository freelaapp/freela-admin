"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useResendVipInvites, useVipApplicationMutations } from "@/modules/admin/application/use-freela-vip";
import { VIP_REJECTABLE_STATUSES, VIP_RESCORABLE_STATUSES } from "@/modules/admin/application/freela-vip-presentation";
import { VIP_ACTOR_LABELS, vipNextStep } from "@/modules/admin/application/freela-vip-flow";
import type { VipApplicationDetail, VipResendResult } from "@/modules/admin/infrastructure/freela-vip-api";

function resendToast(r: VipResendResult) {
  const sent = r.resent[0];
  if (sent?.whatsapp === "SENT") return toast.success("Convite reenviado pelo WhatsApp (link vale mais 7 dias).");
  if (sent?.whatsapp === "NO_PHONE") return toast.error("Convite renovado, mas o cadastro não tem telefone para o WhatsApp.");
  if (sent?.whatsapp === "FAILED") return toast.error("Convite renovado, mas o WhatsApp recusou o envio. Tente mais tarde.");
  const reason = r.skipped[0]?.reason;
  if (reason === "RECENTLY_SENT") return toast.error("Convite enviado há menos de 12 h — espere um pouco para reenviar.");
  return toast.error("Este candidato não tem convite para reenviar.");
}

/**
 * Caixa "Próximo passo" da ficha: o que falta, com quem está e o botão da ação
 * certa (nome do que ela faz). Reprovar e recalcular ficam como ações secundárias.
 */
export function ApplicationActions({ detail, cycleHasJustification, canAdmin = true }: {
  detail: VipApplicationDetail;
  cycleHasJustification: boolean;
  canAdmin?: boolean;
}) {
  const m = useVipApplicationMutations(detail.id, detail.cycleId);
  const resend = useResendVipInvites(detail.cycleId);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveVipOpen, setApproveVipOpen] = useState(false);
  const [reason, setReason] = useState("");
  const step = vipNextStep({ status: detail.status, source: detail.source }, { cycleHasBackground: cycleHasJustification, canAdmin });
  const busy = m.decide.isPending || m.rescore.isPending || m.openBackground.isPending || resend.isPending;
  const canReject = canAdmin && VIP_REJECTABLE_STATUSES.includes(detail.status);
  const canRescore = canAdmin && VIP_RESCORABLE_STATUSES.includes(detail.status);
  const approvesVip = step.action === "approve" && step.actionLabel === "Aprovar como VIP";

  const runPrimary = () => {
    if (step.action === "resend") resend.mutate([detail.id], { onSuccess: resendToast });
    else if (step.action === "open_background") m.openBackground.mutate();
    else if (approvesVip) setApproveVipOpen(true);
    else if (step.action === "approve") m.decide.mutate({ action: "approve" });
  };

  return (
    <section className="rounded-xl border border-[#F59E0B]/40 bg-[#FFFBEB] p-4">
      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[#92400E]">Próximo passo · {VIP_ACTOR_LABELS[step.actor]}</p>
      <p className="mt-1 text-[13px] text-[#0F172A]">{step.text}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {step.action && step.actionLabel && (
          <Button size="sm" disabled={busy} onClick={runPrimary}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : step.actionLabel}
          </Button>
        )}
        {canReject && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejectOpen(true)}>Reprovar</Button>
        )}
        {canRescore && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => m.rescore.mutate()} title="Recalcula a nota com as experiências e referências já conferidas.">
            Recalcular nota
          </Button>
        )}
      </div>

      <Dialog open={approveVipOpen} onOpenChange={setApproveVipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar como VIP?</DialogTitle>
            <DialogDescription>
              O freela recebe a mensagem de VIP ativo, entra nos favoritos da loja e na lista VIP dela (e no grupo de WhatsApp, se a
              loja tiver grupo).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveVipOpen(false)}>Cancelar</Button>
            <Button
              disabled={m.decide.isPending}
              onClick={() => m.decide.mutate({ action: "approve" }, { onSuccess: () => setApproveVipOpen(false) })}
            >
              Aprovar como VIP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </section>
  );
}

"use client";

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
import { Label } from "@/components/ui/label";
import {
  formatSessionDay,
  formatSessionTimeRange,
  orientationErrorMessage,
} from "@/modules/admin/application/orientation-presentation";
import {
  useCancelOrientationSession,
  useOrientationSession,
} from "@/modules/admin/application/use-orientation";
import type { OrientationSessionView } from "@/modules/admin/infrastructure/orientation-api";

interface Props {
  session: OrientationSessionView;
  onClose: () => void;
}

export function CancelSessionDialog({ session, onClose }: Props) {
  const [reason, setReason] = useState("");
  const cancel = useCancelOrientationSession();
  const detail = useOrientationSession(session.id);
  const booked = (detail.data?.enrollees ?? []).filter((e) => e.status === "BOOKED");

  const confirm = () => {
    if (cancel.isPending) return;
    cancel.mutate(
      { id: session.id, reason: reason.trim() || undefined },
      {
        onSuccess: (r) => {
          toast.success(
            r.cancelledEnrollments > 0
              ? `Turma cancelada. Avise os ${r.cancelledEnrollments} inscritos pelo WhatsApp.`
              : "Turma cancelada.",
          );
          onClose();
        },
        onError: (err) => toast.error(orientationErrorMessage(err, "Não foi possível cancelar a turma.")),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !cancel.isPending && onClose()}>
      <DialogContent role="dialog" aria-modal="true" className="max-h-[55vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cancelar turma</DialogTitle>
          <DialogDescription>
            {formatSessionDay(session.startsAt)}, {formatSessionTimeRange(session.startsAt, session.endsAt)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-[#1d1d1b]">
          <p>
            Ninguém recebe aviso automático por enquanto. A lista de inscritos continua na página da turma, com o
            botão do WhatsApp.
          </p>
          {booked.length > 0 && (
            <div>
              <p className="font-medium">Inscritos que você precisa avisar:</p>
              <ul className="mt-1 list-disc pl-5 text-[#525252]">
                {booked.map((e) => (
                  <li key={e.enrollmentId}>
                    {e.name ?? "Sem nome"}
                    {e.phone ? ` — ${e.phone}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="cancel-session-reason">Motivo (opcional)</Label>
            <textarea
              id="cancel-session-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
            />
          </div>
        </div>
        <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 mt-4 rounded-b-xl border-t border-[#e5e5e5] bg-white p-4">
          <Button variant="outline" onClick={onClose} disabled={cancel.isPending}>
            Voltar
          </Button>
          <Button variant="destructive" className="min-h-11" onClick={confirm} disabled={cancel.isPending}>
            {cancel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {`Cancelar turma (${session.bookedCount} ${session.bookedCount === 1 ? "inscrito" : "inscritos"})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

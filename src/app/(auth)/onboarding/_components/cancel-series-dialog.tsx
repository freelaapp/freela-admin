"use client";

import { useEffect } from "react";
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
import { orientationErrorMessage } from "@/modules/admin/application/orientation-presentation";
import { useCancelOrientationSeries, useCountSeriesCancellation } from "@/modules/admin/application/use-orientation";

interface Props {
  seriesId: string;
  onClose: () => void;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Primeiro pede a conta (`dryRun`), depois cancela de verdade. */
export function CancelSeriesDialog({ seriesId, onClose }: Props) {
  const count = useCountSeriesCancellation();
  const run = useCancelOrientationSeries();
  const { mutate: countMutate } = count;

  useEffect(() => {
    countMutate(seriesId);
  }, [countMutate, seriesId]);

  const counts = count.data;

  const confirm = () => {
    if (run.isPending) return;
    run.mutate(
      { seriesId, dryRun: false },
      {
        onSuccess: (r) => {
          toast.success(
            r.cancelledEnrollments > 0
              ? `Série cancelada. Avise os ${r.cancelledEnrollments} inscritos pelo WhatsApp.`
              : "Série cancelada.",
          );
          onClose();
        },
        onError: (err) => toast.error(orientationErrorMessage(err, "Não foi possível cancelar a série.")),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !run.isPending && onClose()}>
      <DialogContent role="dialog" aria-modal="true" className="max-h-[55vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cancelar série</DialogTitle>
          <DialogDescription>Cancela as turmas que ainda não aconteceram.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-[#1d1d1b]">
          {count.isError ? (
            <p role="alert" className="text-red-700">
              {orientationErrorMessage(count.error, "Não consegui contar as turmas da série.")}
            </p>
          ) : !counts ? (
            <p role="status" className="flex items-center gap-2 text-[#737373]">
              <Loader2 className="h-4 w-4 animate-spin" /> Contando as turmas…
            </p>
          ) : (
            <p>
              Ninguém recebe aviso automático por enquanto. Quem estava inscrito fica sem turma: avise pelo
              WhatsApp, a lista está na página de cada turma.
            </p>
          )}
        </div>
        <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 mt-4 rounded-b-xl border-t border-[#e5e5e5] bg-white p-4">
          <Button variant="outline" onClick={onClose} disabled={run.isPending}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            className="min-h-11"
            onClick={confirm}
            disabled={!counts || counts.sessions === 0 || run.isPending}
          >
            {run.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {counts
              ? `Cancelar ${plural(counts.sessions, "turma futura", "turmas futuras")} (${plural(counts.cancelledEnrollments, "inscrito", "inscritos")})`
              : "Cancelar série"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

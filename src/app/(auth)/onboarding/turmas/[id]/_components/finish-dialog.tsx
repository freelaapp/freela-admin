"use client";

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

interface Props {
  summary: string;
  reopenMinutes: number;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function FinishDialog({ summary, reopenMinutes, pending, onConfirm, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent role="dialog" aria-modal="true" className="max-h-[55vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Encerrar chamada</DialogTitle>
          <DialogDescription>Confira antes de encerrar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm text-[#1d1d1b]">
          <p className="font-medium">{summary}</p>
          <p className="text-[#525252]">
            Os resultados valem na hora. Dá para reabrir a chamada por {reopenMinutes} minutos.
          </p>
        </div>
        <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 mt-4 rounded-b-xl border-t border-[#e5e5e5] bg-white p-4">
          <Button variant="outline" className="min-h-11" onClick={onClose} disabled={pending}>
            Voltar
          </Button>
          <Button className="min-h-11" onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Encerrar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

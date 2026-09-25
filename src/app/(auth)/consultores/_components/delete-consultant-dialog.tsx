"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useDeleteAdminConsultant } from "@/modules/admin/application/use-admin-consultants";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import type { ConsultantItem } from "@/modules/admin/infrastructure/consultants-api";

/**
 * Só consultor sem indicações pode ser excluído — com indicações o apagar levaria
 * junto o "indicado por" de todos os cadastros dele. A API recusa com 409 de
 * qualquer jeito; aqui só evitamos oferecer o botão.
 */
export function canDeleteConsultant(consultant: Pick<ConsultantItem, "referralsCount">): boolean {
  return consultant.referralsCount === 0;
}

export function deleteBlockedReason(consultant: Pick<ConsultantItem, "referralsCount">): string {
  const n = consultant.referralsCount;
  return `Tem ${n} ${n === 1 ? "indicação" : "indicações"} — desative em vez de excluir`;
}

interface DeleteConsultantDialogProps {
  consultant: ConsultantItem | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteConsultantDialog({
  consultant,
  onOpenChange,
  onDeleted,
}: DeleteConsultantDialogProps) {
  const deleteMutation = useDeleteAdminConsultant();

  async function handleDelete() {
    if (!consultant) return;
    try {
      await deleteMutation.mutateAsync(consultant.id);
      toast.success(`Consultor ${consultant.name} excluído.`);
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível excluir o consultor."));
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={!!consultant}
      onOpenChange={(v) => {
        if (!v && !deleteMutation.isPending) onOpenChange(false);
      }}
    >
      <DialogContent>
        <DialogClose onClick={() => !deleteMutation.isPending && onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Excluir consultor</DialogTitle>
          <DialogDescription>
            Excluir <strong className="text-[#1d1d1b]">{consultant?.name}</strong>? Isso não pode
            ser desfeito.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">
            O consultor perde o acesso ao painel e o link de indicação{" "}
            <span className="font-mono font-semibold">{consultant?.code}</span> deixa de funcionar.
          </p>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteMutation.isPending}
            className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-red-600 text-white hover:bg-red-700 font-medium"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir consultor
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

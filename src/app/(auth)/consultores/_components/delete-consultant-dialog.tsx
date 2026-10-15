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
import { useCommissionBalances } from "@/modules/admin/application/use-admin-consultant-commissions";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import type {
  ConsultantItem,
  DeleteConsultantResult,
} from "@/modules/admin/infrastructure/consultants-api";
import { consultantDeleteCopy } from "../_lib/consultant-delete";

interface DeleteConsultantDialogProps {
  consultant: ConsultantItem | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: (result: DeleteConsultantResult) => void;
}

/**
 * Qualquer consultor pode ser excluído (pedido do dono, 29/09/2026). Sem
 * indicações nem comissão a API apaga; com histórico faz exclusão lógica — o
 * texto diz qual dos dois vai acontecer ANTES de confirmar, e avisa o saldo de
 * comissão a pagar.
 */
export function DeleteConsultantDialog({
  consultant,
  onOpenChange,
  onDeleted,
}: DeleteConsultantDialogProps) {
  const deleteMutation = useDeleteAdminConsultant();
  // A lista traz o saldo a pagar; o detalhe (`GET /consultants/:id`) não. Sem
  // ele, o saldo vem do extrato da comissão (o mesmo "A pagar" da aba Extrato).
  // Enquanto confere, nada de texto nem de botão: "definitivo" com saldo
  // desconhecido seria afirmar o que não sabemos.
  const balanceLookupId = consultant && consultant.openBalanceInCents == null ? consultant.id : null;
  const balances = useCommissionBalances(balanceLookupId);
  const checkingBalance = balanceLookupId !== null && balances.isPending;
  const balanceUnavailable = balanceLookupId !== null && !checkingBalance && !balances.data;
  const copy =
    consultant && !checkingBalance
      ? consultantDeleteCopy(
          {
            ...consultant,
            openBalanceInCents: consultant.openBalanceInCents ?? balances.data?.openInCents,
          },
          { balanceUnavailable },
        )
      : null;
  const tone =
    copy?.mode === "HARD"
      ? "bg-red-50 border-red-100 text-red-700"
      : "bg-amber-50 border-amber-100 text-amber-800";

  async function handleDelete() {
    if (!consultant) return;
    try {
      const result = await deleteMutation.mutateAsync(consultant.id);
      toast.success(
        result.mode === "SOFT"
          ? `Consultor ${consultant.name} excluído — ${result.referralsCount} indicação(ões) mantida(s).`
          : `Consultor ${consultant.name} excluído.`,
      );
      onOpenChange(false);
      onDeleted?.(result);
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível excluir o consultor."));
    }
  }

  return (
    <Dialog
      open={!!consultant}
      onOpenChange={(v) => {
        if (!v && !deleteMutation.isPending) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto">
        <DialogClose onClick={() => !deleteMutation.isPending && onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{copy?.title ?? "Excluir consultor"}</DialogTitle>
          <DialogDescription>
            Excluir <strong className="text-[#1d1d1b]">{consultant?.name}</strong>?
          </DialogDescription>
        </DialogHeader>
        {checkingBalance ? (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-[#e5e5e5] bg-[#faf9f7] p-3 text-sm text-[#525252]"
          >
            <Loader2 className="h-4 w-4 animate-spin text-[#eca826]" aria-hidden="true" />
            Conferindo saldo de comissão…
          </div>
        ) : (
          <div className={`flex items-start gap-3 p-3 rounded-lg border ${tone}`}>
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <ul className="text-sm list-disc pl-4 space-y-1">
              {copy?.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}
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
            disabled={deleteMutation.isPending || checkingBalance}
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
                {copy?.confirmLabel ?? "Excluir"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useId } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import type {
  BillingMode,
  BillingModeSettings,
} from "@/modules/admin/infrastructure/billing-mode-api";
import { confirmCopy } from "../_lib/billing-presentation";

/**
 * Confirmação da troca do modo de cobrança (UX 5.3): ligar o faturado, voltar
 * para pré-pago ou trocar de ciclo. As datas e os valores vêm do servidor
 * (`previews`, `openPreview`, `extraordinaryInvoice`). O botão diz o verbo e o
 * modo. Abre por cima do modal "Documentos e cobrança".
 */
export function BillingModeConfirmDialog({
  open,
  view,
  next,
  companyName,
  blockEnabled,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  view: BillingModeSettings;
  next: BillingMode;
  companyName: string;
  /** Ausente: a tela não sabe se o bloqueio está ligado e não fala dele. */
  blockEnabled: boolean | undefined;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const copy = confirmCopy(view, next, companyName, blockEnabled);
  // A conta do valor da fatura extra (regra: todo número com a conta e a fonte).
  const openLines =
    next === "PREPAID" && view.openPreview?.lineCount ? view.openPreview : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !pending) onCancel();
      }}
      className="max-w-md"
    >
      <DialogContent
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[88vh] overflow-y-auto"
      >
        <h2
          id={titleId}
          className="text-lg font-bold text-[#1d1d1b]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {copy.title}
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[#1d1d1b]">
          {copy.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {openLines && (
          <p className="mt-2 text-xs text-[#525252]">
            {`Conta (débitos − créditos): ${openLines.calc}. Fonte: lançamentos do faturado ainda sem fatura.`}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={pending}
            className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending}
            className="bg-[#eca826] text-white hover:bg-[#d4951e]"
          >
            {pending ? (
              <>
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Salvando...
              </>
            ) : (
              copy.action
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

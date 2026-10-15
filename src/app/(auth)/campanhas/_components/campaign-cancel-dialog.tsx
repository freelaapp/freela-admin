"use client";

import { useId } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import type { Campaign } from "@/modules/admin/infrastructure/referrals-api";

/**
 * Confirmação do "Encerrar" campanha. Encerrar é definitivo: a API marca a
 * campanha como CANCELADA e não existe "retomar" a partir daí — quem está na
 * fila não recebe mais. Os números são os da própria lista (`stats` por
 * situação do destinatário).
 */
export function CampaignCancelDialog({
  campaign,
  pending,
  onCancel,
  onConfirm,
}: {
  campaign: Campaign | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const stats = campaign?.stats;

  return (
    <Dialog
      open={!!campaign}
      onOpenChange={(open) => {
        if (!open && !pending) onCancel();
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
          Encerrar a campanha?
        </h2>
        <p className="mt-1 break-words text-sm text-[#737373]">{campaign?.name}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-[#1d1d1b]">
          <li>
            <strong>É definitivo:</strong> a campanha encerrada não volta a disparar. Para pausar e
            retomar depois, use &quot;Pausar&quot;.
          </li>
          {stats && (
            <li data-testid="campaign-cancel-counts">
              {`${stats.SENT} já saíram e ${stats.PENDING} ainda estão na fila — esses ${stats.PENDING} não recebem mais.`}
            </li>
          )}
        </ul>
        {stats && (
          <p className="mt-2 text-xs text-[#525252]">
            Fonte: situação dos destinatários desta campanha (enviados e na fila), a mesma da coluna
            &quot;Enviados&quot;.
          </p>
        )}
        <DialogFooter className="flex-col-reverse sm:flex-row">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={pending}
            className="min-h-11 border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
          >
            Voltar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending}
            className="min-h-11 bg-red-600 text-white hover:bg-red-700"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Encerrando...
              </>
            ) : (
              "Encerrar campanha"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

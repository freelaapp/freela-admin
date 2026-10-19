"use client";

import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { retryWithdrawalErrorOf } from "@/modules/admin/application/held-repasses-presentation";
import { formatBrl } from "@/modules/admin/application/invoice-presentation";
import { useFailedWithdrawals, useRetryWithdrawal } from "@/modules/admin/application/use-held-repasses";
import type { FailedWithdrawalItem } from "@/modules/admin/infrastructure/held-repasses-api";
import { Button } from "@/components/ui/button";
import { ActionDialog, ReasonField, useReason } from "./invoice-action-dialogs";

const REASON_SHORTCUTS = ["Bloqueio da Woovi liberado", "Chave Pix corrigida"];

/**
 * "Reenviar saque": o crédito na subconta do freelancer saiu, mas o saque para o
 * banco foi recusado pela Woovi (16–18/10/2026: TOO_MANY_REQUESTS). O dinheiro está
 * na subconta e o freelancer não recebe no banco até alguém reenviar. Diz o que
 * acontece antes de confirmar, pede o motivo (fica no histórico, com o seu nome) e
 * trava o clique duplo.
 */
function RetryWithdrawalDialog({ item, onClose }: { item: FailedWithdrawalItem; onClose: () => void }) {
  const mutation = useRetryWithdrawal();
  const { reason, setReason, valid } = useReason();
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const value = formatBrl(item.amountInCents);
  const who = item.freelancerName ?? "o freelancer";

  const submit = async () => {
    if (!valid || submitting.current) return;
    submitting.current = true;
    setError(null);
    try {
      const result = await mutation.mutateAsync({ repasseId: item.repasseId, reason: reason.trim() });
      if (result.withdrawalStatus === "FAILED") {
        toast.warning(
          `A Woovi recusou de novo o saque de ${value} para ${who}. O dinheiro continua na subconta. Não insista: cada tentativa gasta o limite.`,
        );
      } else {
        toast.success(`Saque de ${value} pedido. O Pix de ${who} cai em alguns minutos.`);
      }
      onClose();
    } catch (err) {
      setError(retryWithdrawalErrorOf(err).text);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <ActionDialog
      title={`Reenviar o saque de ${value} para ${who}?`}
      description={
        <p>{`Vaga #${item.vacancyId.slice(0, 8)}. O crédito já está na subconta; falta o Pix para o banco.`}</p>
      }
      submitLabel={`Reenviar ${value}`}
      pendingLabel="Enviando…"
      canSubmit={valid}
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="rounded-lg bg-[#f7f7f7] p-3 text-sm text-[#1d1d1b]">
        <p className="font-medium">O que acontece:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-[#525252]">
          <li>{`Pedimos à Woovi o Pix de ${value} da subconta para a chave cadastrada de ${who}.`}</li>
          <li>Só envia se a subconta ainda tiver o valor (se foi sacado por fora, nada sai).</li>
          <li>Se a Woovi ainda estiver bloqueando, ela recusa e o dinheiro continua na subconta.</li>
        </ul>
      </div>
      <div className="space-y-2">
        <div role="group" aria-label="Motivos comuns" className="flex flex-wrap gap-1.5">
          {REASON_SHORTCUTS.map((shortcut) => (
            <button
              key={shortcut}
              type="button"
              onClick={() => setReason(shortcut)}
              className="min-h-9 rounded-full bg-[#f7f7f7] px-3 py-1.5 text-xs font-medium text-[#525252] hover:text-[#1d1d1b]"
            >
              {shortcut}
            </button>
          ))}
        </div>
        <ReasonField
          value={reason}
          onChange={setReason}
          label="Por que reenviar? (obrigatório)"
          savedHint="Fica no histórico deste pagamento, com o seu nome."
          autoFocus
        />
      </div>
    </ActionDialog>
  );
}

/** Painel no topo de Pagamentos aos freelancers. Só aparece quando há saque parado. */
export function FailedWithdrawalsPanel() {
  const query = useFailedWithdrawals();
  const [retrying, setRetrying] = useState<FailedWithdrawalItem | null>(null);
  const items = query.data ?? [];
  if (items.length === 0) return null;
  const total = items.reduce((sum, item) => sum + item.amountInCents, 0);

  return (
    <section
      aria-label="Saques parados"
      className="rounded-lg border border-[#fcd34d] bg-[#fffbeb] p-4"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#b45309]" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#1d1d1b]">
            {items.length === 1 ? "1 saque parado" : `${items.length} saques parados`} · {formatBrl(total)}
          </h2>
          <p className="text-sm text-[#525252]">
            O dinheiro já está na subconta do freelancer, mas o Pix para o banco foi recusado pela Woovi. Reenvie quando o
            motivo for resolvido.
          </p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-[#fde68a]">
        {items.map((item) => (
          <li key={item.repasseId} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="font-medium text-[#1d1d1b]">
                {item.freelancerName ?? "Freelancer"} · {formatBrl(item.amountInCents)}
              </p>
              <p className="truncate text-xs text-[#737373]" title={item.failureReason ?? undefined}>
                {`Vaga #${item.vacancyId.slice(0, 8)}`}
                {item.failureReason ? ` · ${item.failureReason}` : ""}
              </p>
            </div>
            <Button
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
              aria-label={`Reenviar saque de ${formatBrl(item.amountInCents)} para ${item.freelancerName ?? "o freelancer"}`}
              onClick={() => setRetrying(item)}
            >
              Reenviar saque
            </Button>
          </li>
        ))}
      </ul>
      {retrying && <RetryWithdrawalDialog key={retrying.repasseId} item={retrying} onClose={() => setRetrying(null)} />}
    </section>
  );
}

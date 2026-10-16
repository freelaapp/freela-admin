"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  firstName,
  releaseErrorOf,
  releaseOutcomeOf,
} from "@/modules/admin/application/held-repasses-presentation";
import { dayLabel, formatBrl, instantWithWeekday } from "@/modules/admin/application/invoice-presentation";
import { useReleaseHeldRepasse } from "@/modules/admin/application/use-held-repasses";
import type { HeldRepasseItem } from "@/modules/admin/infrastructure/held-repasses-api";
import { ActionDialog, ReasonField, useReason } from "./invoice-action-dialogs";

/** Motivos comuns: um toque preenche o campo (dá para editar depois). */
const REASON_SHORTCUTS = ["Freelancer pediu", "Empresa vai atrasar", "Correção de erro"];

/**
 * "Pagar agora" (ADR-017; UX 2026-10-15 §6.4): paga um pagamento retido antes de
 * a empresa pagar a fatura. Diz o que acontece com o dinheiro antes de
 * confirmar, pede o motivo (5+ caracteres, fica no histórico do pagamento com o
 * admin do token) e trava o clique duplo: um pedido só, mesmo com dois cliques.
 */
export function ReleasePayoutDialog({ item, onClose }: { item: HeldRepasseItem; onClose: () => void }) {
  const mutation = useReleaseHeldRepasse();
  const { reason, setReason, valid } = useReason();
  const [error, setError] = useState<string | null>(null);
  // `isPending` só muda no próximo render: o ref segura o 2º clique do mesmo instante.
  const submitting = useRef(false);

  const value = formatBrl(item.amountInCents);
  const who = item.freelancer.name ?? "o freelancer";
  const first = firstName(item.freelancer.name);
  const company = item.company.name ?? "a empresa";
  const deadline = instantWithWeekday(item.effectiveDeadlineAt);
  const service = [
    item.vacancyTitle ?? "Serviço",
    item.serviceDate ? dayLabel(item.serviceDate) : null,
    item.company.name,
  ]
    .filter(Boolean)
    .join(" · ");

  const submit = async () => {
    if (!valid || submitting.current) return;
    submitting.current = true;
    setError(null);
    try {
      const result = await mutation.mutateAsync({ repasseId: item.repasseId, reason: reason.trim() });
      const outcome = releaseOutcomeOf(result, { name: item.freelancer.name, amountInCents: item.amountInCents });
      if (outcome.kind === "success") toast.success(outcome.text);
      else toast.warning(outcome.text);
      onClose();
    } catch (err) {
      setError(releaseErrorOf(err).text);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <ActionDialog
      title={`Pagar agora ${value} para ${who}?`}
      description={
        <p>
          {`${service} (vaga #${item.vacancyId.slice(0, 8)}). Sem esta ação, o Pix sai quando `}
          {item.invoice
            ? `a fatura ${item.invoice.number} for paga`
            : "a fatura da empresa com este serviço for paga (o serviço ainda não está numa fatura fechada)"}
          {`, ou no máximo em ${deadline}.`}
        </p>
      }
      submitLabel={`Pagar ${value} agora`}
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
          <li>{`Enviamos ${value} agora para a chave Pix cadastrada de ${first}.`}</li>
          <li>{`O dinheiro sai do saldo da Freela (Woovi) e entra em "Adiantado aos freelancers" até ${company} pagar a fatura.`}</li>
          <li>
            {item.invoice
              ? `A fatura ${item.invoice.number} da empresa não muda (vencimento ${dayLabel(item.invoice.dueDate)}).`
              : "A fatura da empresa não muda: o serviço entra no próximo fechamento, como sempre."}
          </li>
          <li>{`${first === "o freelancer" ? "O freelancer" : first} recebe o aviso de pagamento.`}</li>
          <li>Não dá para desfazer.</li>
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
          label="Por que pagar agora? (obrigatório)"
          savedHint="Fica no histórico deste pagamento, com o seu nome."
          autoFocus
        />
      </div>
    </ActionDialog>
  );
}

"use client";

import { useId, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  firstName,
  paidExternallyDifferenceText,
  paidExternallyErrorOf,
  paidExternallyMinDateKey,
  paidExternallyOutcomeOf,
  todayBrtKey,
} from "@/modules/admin/application/held-repasses-presentation";
import {
  centsToInput,
  dayLabel,
  formatBrl,
  instantWithWeekday,
  parseBrlToCents,
} from "@/modules/admin/application/invoice-presentation";
import { useMarkRepassePaidExternally } from "@/modules/admin/application/use-held-repasses";
import type { DateKey } from "@/modules/admin/infrastructure/billing-mode-api";
import { ActionDialog, ReasonField, useReason } from "./invoice-action-dialogs";

/** O pagamento que vai ser marcado, de qualquer tela (retidos, todos os repasses, vaga). */
export interface PaidExternallyTarget {
  repasseId: string;
  vacancyId: string;
  /** O valor do repasse (o que o sistema ia pagar). */
  amountInCents: number;
  freelancerName: string | null;
  /** "Garçom · sáb 22/11 · Coco Bambu" (sem a vaga). */
  service: string;
  companyName: string | null;
  /** Retido até a fatura (`held`) ou Pix da Freela que falhou (`failed`). */
  kind: "held" | "failed";
  /** `null` = ainda sem fatura; ausente = não sabemos (o texto fica genérico). */
  invoice?: { number: string; dueDate: DateKey } | null;
  /** Teto (instante), só no retido. */
  deadlineAt?: string | null;
  /** Motivo da falha, só no `failed`. */
  failureReason?: string | null;
}

/**
 * "Marcar como pago por fora" (23/11/2026; UX: abaixo do "Pagar agora", botão de
 * texto neutro, nunca laranja). Ação rara e irreversível: o dono pagou do bolso.
 */
export function MarkPaidExternallyButton({
  amountInCents,
  name,
  onClick,
}: {
  amountInCents: number;
  name: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Marcar como pago por fora o pagamento de ${formatBrl(amountInCents)} para ${name ?? "o freelancer"}`}
      onClick={onClick}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-md px-2 text-xs font-medium text-[#525252] underline underline-offset-2 hover:text-[#1d1d1b] sm:w-auto sm:justify-start"
    >
      Marcar como pago por fora
    </button>
  );
}

const SHORTCUTS: Record<PaidExternallyTarget["kind"], string[]> = {
  held: [
    "Empresa vai atrasar a fatura",
    "Freelancer precisava receber antes",
    "Sem chave Pix: paguei em dinheiro",
  ],
  failed: ["Pix da Freela falhou", "Sem chave Pix: paguei em dinheiro", "Freelancer precisava receber antes"],
};

const MAX_PROOF = 200;

/**
 * "Marcar como pago por fora" (23/11/2026; UX: botão neutro, nunca laranja). O
 * dono pagou o freelancer do próprio bolso (Pix pessoal, dinheiro): a Freela NÃO
 * envia nada e nunca mais paga este repasse. Motivo obrigatório (5+), dia e valor
 * pagos (padrão: hoje e o valor do repasse; diferente só avisa, com a conta) e o
 * comprovante opcional. Trava o clique duplo; repetir depois de erro de rede é
 * seguro (a API responde "já marcado").
 */
export function MarkPaidExternallyDialog({
  target,
  onClose,
}: {
  target: PaidExternallyTarget;
  onClose: () => void;
}) {
  const mutation = useMarkRepassePaidExternally();
  const { reason, setReason, valid } = useReason();
  const today = todayBrtKey();
  const [paidAt, setPaidAt] = useState(today);
  const [amount, setAmount] = useState(centsToInput(target.amountInCents));
  const [proof, setProof] = useState("");
  const [error, setError] = useState<string | null>(null);
  // `isPending` só muda no próximo render: o ref segura o 2º clique do mesmo instante.
  const submitting = useRef(false);
  const dateId = useId();
  const amountId = useId();
  const proofId = useId();

  const value = formatBrl(target.amountInCents);
  const who = target.freelancerName ?? "o freelancer";
  const first = firstName(target.freelancerName);
  const First = first === "o freelancer" ? "O freelancer" : first;
  const company = target.companyName ?? "a empresa";
  const minDate = paidExternallyMinDateKey();

  const cents = parseBrlToCents(amount);
  const amountError = cents === null || cents <= 0 ? "Informe o valor pago, por exemplo 120,00." : null;
  const dateError =
    !paidAt || paidAt > today || paidAt < minDate ? "Escolha o dia em que você pagou: até hoje." : null;
  const difference = !amountError ? paidExternallyDifferenceText(cents as number, target.amountInCents) : null;

  const submit = async () => {
    if (!valid || amountError || dateError || submitting.current) return;
    submitting.current = true;
    setError(null);
    try {
      const result = await mutation.mutateAsync({
        repasseId: target.repasseId,
        reason: reason.trim(),
        paidAt,
        amountPaidInCents: cents as number,
        proof: proof.trim() || null,
      });
      const outcome = paidExternallyOutcomeOf(result, {
        name: target.freelancerName,
        amountInCents: target.amountInCents,
      });
      if (outcome.kind === "success") toast.success(outcome.text);
      else toast.warning(outcome.text);
      onClose();
    } catch (err) {
      setError(paidExternallyErrorOf(err, { name: target.freelancerName, amountInCents: target.amountInCents }).text);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <ActionDialog
      title={`Marcar ${value} de ${who} como pago por fora?`}
      description={
        <p>
          {target.kind === "failed"
            ? `O Pix da Freela falhou${target.failureReason ? `: ${target.failureReason}` : ""}. `
            : ""}
          {`${target.service} (vaga #${target.vacancyId.slice(0, 8)}). Use só se ${first} já recebeu de você fora da Freela (Pix pessoal, dinheiro). `}
          <strong className="font-semibold text-[#1d1d1b]">A Freela não envia nada.</strong>
        </p>
      }
      submitLabel="Marcar como pago por fora"
      pendingLabel="Registrando…"
      submitTone="neutral"
      canSubmit={valid && !amountError && !dateError}
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-[#1d1d1b]">
        <p className="flex items-center gap-1.5 font-medium text-[#b45309]">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          O que acontece:
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-[#525252]">
          <li>Nenhum Pix sai da Freela. O pagamento fica registrado como pago por fora, com o seu nome.</li>
          {target.kind === "held" ? (
            <li>
              {`Ele sai de "Aguardando fatura" e a Freela nunca mais paga: nem quando a fatura for paga, nem no teto${
                target.deadlineAt ? ` (${instantWithWeekday(target.deadlineAt)})` : ""
              }, nem pelo "Pagar agora".`}
            </li>
          ) : (
            <li>A Freela nunca mais tenta pagar este repasse (nem pelo &quot;pagar repasse&quot;).</li>
          )}
          {target.kind === "held" && (
            <li>
              {target.invoice
                ? `A fatura ${target.invoice.number} de ${company} não muda e continua sendo cobrada (vence ${dayLabel(target.invoice.dueDate)}).`
                : target.invoice === null
                  ? "A fatura da empresa não muda: o serviço entra na próxima fatura, como sempre."
                  : `A fatura de ${company} não muda e continua sendo cobrada.`}
            </li>
          )}
          <li>{`${First} vê o pagamento como "Pago" no app.`}</li>
          <li>
            <strong className="font-semibold text-[#1d1d1b]">Não dá para desfazer pelo painel.</strong>
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={amountId}>Valor que você pagou (R$)</Label>
          <Input
            id={amountId}
            inputMode="decimal"
            value={amount}
            aria-invalid={amountError ? true : undefined}
            aria-describedby={`${amountId}-help`}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={dateId}>Dia em que você pagou</Label>
          <Input
            id={dateId}
            type="date"
            value={paidAt}
            min={minDate}
            max={today}
            aria-invalid={dateError ? true : undefined}
            aria-describedby={dateError ? `${dateId}-help` : undefined}
            onChange={(e) => setPaidAt(e.target.value)}
          />
          {dateError && (
            <p id={`${dateId}-help`} className="text-xs text-[#b45309]">
              {dateError}
            </p>
          )}
        </div>
      </div>
      <p id={`${amountId}-help`} aria-live="polite" className="-mt-2 text-xs text-[#b45309]">
        {amountError ?? difference ?? ""}
      </p>

      <div className="space-y-1.5">
        <Label htmlFor={proofId}>Comprovante (opcional)</Label>
        <Input
          id={proofId}
          value={proof}
          maxLength={MAX_PROOF}
          aria-describedby={`${proofId}-help`}
          onChange={(e) => setProof(e.target.value)}
        />
        <p id={`${proofId}-help`} className="text-xs text-[#737373]">
          Código do Pix (E2E) ou &quot;dinheiro, recibo assinado&quot;. Ajuda a conferir depois.
        </p>
      </div>

      <div className="space-y-2">
        <div role="group" aria-label="Motivos comuns" className="flex flex-wrap gap-1.5">
          {SHORTCUTS[target.kind].map((shortcut) => (
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
          label="Por que foi pago por fora? (obrigatório)"
          savedHint="Fica no histórico deste pagamento, com o seu nome."
          autoFocus
        />
      </div>
    </ActionDialog>
  );
}

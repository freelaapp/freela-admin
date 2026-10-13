"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  centsToInput,
  channelText,
  dayLabel,
  ddmm,
  formatBrl,
  parseBrlToCents,
} from "@/modules/admin/application/invoice-presentation";
import {
  useBillingAdjustment,
  useCloseInvoiceNow,
  useIssueSecondCopy,
  useMarkInvoicePaid,
  useResendInvoice,
  useWaiveInvoiceBlock,
} from "@/modules/admin/application/use-admin-billing";
import { useAdminBillingMode } from "@/modules/admin/application/use-admin-billing-mode";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import type {
  ActionState,
  AdminInvoiceDetail,
  ResendChannel,
} from "@/modules/admin/infrastructure/billing-api";

/** Mesmo mínimo da API (`REASON_REQUIRED`). */
const REASON_MIN = 5;
const REASON_HINT = "Escreva o motivo (pelo menos 5 caracteres).";
/** Teto de valor digitado (API `MANUAL_MAX_CENTS`): R$ 1.000.000,00. */
const MANUAL_MAX_CENTS = 100_000_000;

type ActionKey = "resend" | "secondCopy" | "markPaid" | "waiveBlock" | "adjust" | "closeNow";

const ALWAYS: ActionState = { enabled: true, reason: null };

/** O texto de cada código de erro das rotas de faturas (API-3e), em português comum. */
const ERROR_TEXT: Record<string, string> = {
  INVOICE_NOT_OPEN: "Esta fatura já foi paga ou cancelada. Recarregue a página.",
  CHARGE_PROVIDER_UNAVAILABLE: "O código Pix ainda não está disponível.",
  NOTHING_TO_INVOICE: "Não há serviços a faturar para esta empresa.",
  FEATURE_DISABLED: "O faturamento está desligado: esta ação não está disponível agora.",
  REASON_REQUIRED: REASON_HINT,
  PAID_AT_INVALID: "A data do pagamento precisa estar entre o fechamento da fatura e hoje.",
  WAIVE_UNTIL_INVALID: "Escolha uma data de hoje até 30 dias à frente.",
  INVALID_AMOUNT: "Informe um valor maior que zero e até R$ 1.000.000,00.",
  CHANNELS_REQUIRED: "Escolha pelo menos um canal: push ou e-mail.",
  ALREADY_CLOSED_TODAY:
    "Esta empresa já teve uma fatura fechada hoje. Os lançamentos novos entram no próximo fechamento.",
  IDEMPOTENCY_KEY_CONFLICT:
    "Este ajuste já foi lançado com outros dados. Feche e abra o diálogo de novo.",
};

/**
 * O texto de cada erro da API, perto de quem precisa agir (UX 7.6). Código
 * conhecido → texto fixo; desconhecido → a mensagem da API; sem ela, um geral.
 */
export function actionErrorMessage(err: unknown): string {
  const { status, code, message } = apiErrorOf(err);
  if (code && ERROR_TEXT[code]) return ERROR_TEXT[code];
  if (status === 503) return ERROR_TEXT.CHARGE_PROVIDER_UNAVAILABLE;
  return message ?? "Não foi possível concluir. Tente de novo.";
}

/** Id do pedido do ajuste (uuid v4), gerado uma vez por abertura do diálogo. */
function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Ações da fatura (UX 7.6): seis diálogos, todos com motivo obrigatório e o
 * efeito escrito no botão. Ação que a API desabilita mostra o porquê.
 */
export function InvoiceActions({ detail }: { detail: AdminInvoiceDetail }) {
  const [open, setOpen] = useState<ActionKey | null>(null);
  // Cada abertura remonta o diálogo: campos limpos e um `requestId` novo.
  const [opening, setOpening] = useState(0);
  const buttons: Array<{ key: ActionKey; label: string; state: ActionState }> = [
    { key: "resend", label: "Reenviar cobrança", state: detail.actions.resend },
    { key: "secondCopy", label: "Gerar 2ª via do Pix", state: detail.actions.secondCopy },
    { key: "markPaid", label: "Dar baixa manual", state: detail.actions.markPaid },
    { key: "waiveBlock", label: "Liberar bloqueio até…", state: detail.actions.waiveBlock },
    { key: "adjust", label: "Lançar ajuste", state: ALWAYS },
    { key: "closeNow", label: "Fechar agora", state: ALWAYS },
  ];
  const disabled = buttons.filter((b) => !b.state.enabled && b.state.reason);
  const close = () => setOpen(null);
  const props = { detail, onClose: close };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {buttons.map(({ key, label, state }) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            disabled={!state.enabled}
            onClick={() => {
              setOpening((n) => n + 1);
              setOpen(key);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {disabled.length > 0 && (
        <ul className="space-y-0.5 text-xs text-[#737373]">
          {disabled.map((b) => (
            <li key={b.key}>{`${b.label}: ${b.state.reason}`}</li>
          ))}
        </ul>
      )}
      {open === "resend" && <ResendDialog key={opening} {...props} />}
      {open === "secondCopy" && <SecondCopyDialog key={opening} {...props} />}
      {open === "markPaid" && <MarkPaidDialog key={opening} {...props} />}
      {open === "waiveBlock" && <WaiveBlockDialog key={opening} {...props} />}
      {open === "adjust" && <AdjustmentDialog key={opening} {...props} />}
      {open === "closeNow" && <CloseNowDialog key={opening} {...props} />}
    </div>
  );
}

type DialogProps = { detail: AdminInvoiceDetail; onClose: () => void };

const companyOf = (detail: AdminInvoiceDetail) => detail.invoice.company.name ?? "a empresa";

// ─── Casca comum ──────────────────────────────────────────────────────────────

function useReason() {
  const [reason, setReason] = useState("");
  return { reason, setReason, valid: reason.trim().length >= REASON_MIN };
}

function ReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  const valid = value.trim().length >= REASON_MIN;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Motivo (obrigatório)</Label>
      <textarea
        id={id}
        value={value}
        rows={2}
        maxLength={500}
        aria-describedby={`${id}-help`}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
      />
      <p id={`${id}-help`} className={cn("text-xs", valid ? "text-[#737373]" : "text-[#b45309]")}>
        {valid ? "Fica na trilha da fatura, com o seu nome." : REASON_HINT}
      </p>
    </div>
  );
}

function ActionDialog({
  title,
  description,
  children,
  submitLabel,
  canSubmit,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  submitLabel: string;
  canSubmit: boolean;
  pending: boolean;
  error: string | null;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
      className="max-w-md"
    >
      <DialogContent
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[88vh] overflow-y-auto"
      >
        <h2
          id={titleId}
          className="text-lg font-bold text-[#1d1d1b]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
        {description && <div className="mt-1 text-sm text-[#525252]">{description}</div>}
        <div className="mt-4 space-y-4">{children}</div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-2.5 text-sm text-[#b91c1c]"
          >
            {error}
          </p>
        )}
        <DialogFooter className="sticky bottom-0 bg-white py-3 sm:static sm:py-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={pending}
            className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
          >
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || pending}
            className="bg-[#eca826] text-white hover:bg-[#d4951e]"
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Salvando...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reenviar cobrança ────────────────────────────────────────────────────────

const CHANNEL_LABEL: Record<ResendChannel, string> = { push: "push", email: "e-mail" };

function ResendDialog({ detail, onClose }: DialogProps) {
  const mutation = useResendInvoice(detail.invoice.id);
  const { reason, setReason, valid } = useReason();
  const [channels, setChannels] = useState<Record<ResendChannel, boolean>>({ push: true, email: true });
  const [error, setError] = useState<string | null>(null);
  const selected = (Object.keys(channels) as ResendChannel[]).filter((c) => channels[c]);
  const submitLabel =
    selected.length === 0
      ? "Reenviar"
      : `Reenviar por ${selected.map((c) => CHANNEL_LABEL[c]).join(" e ")}`;

  const submit = async () => {
    setError(null);
    try {
      const result = await mutation.mutateAsync({ reason: reason.trim(), channels: selected });
      const sent = selected
        .map((c) => `${CHANNEL_LABEL[c]} ${channelText(result.channels?.[c])}`)
        .join(" · ");
      toast.success(`Cobrança reenviada: ${sent}.`);
      onClose();
    } catch (err) {
      setError(actionErrorMessage(err));
    }
  };

  return (
    <ActionDialog
      title={`Reenviar a cobrança de ${detail.invoice.number} para ${companyOf(detail)}?`}
      description="Sai o texto do passo atual da régua: antes do vencimento, o aviso da fatura emitida; depois, o lembrete de atraso."
      submitLabel={submitLabel}
      canSubmit={valid && selected.length > 0}
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-medium text-[#1d1d1b]">Canais</legend>
        {(["push", "email"] as ResendChannel[]).map((channel) => (
          <label key={channel} className="flex items-center gap-2 text-sm text-[#1d1d1b]">
            <input
              type="checkbox"
              checked={channels[channel]}
              onChange={(e) => setChannels((c) => ({ ...c, [channel]: e.target.checked }))}
              className="h-4 w-4 accent-[#eca826]"
            />
            {channel === "push" ? "Push" : "E-mail"}
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm text-[#737373]">
          <input type="checkbox" disabled className="h-4 w-4" />
          WhatsApp (ainda não ligado)
        </label>
        {selected.length === 0 && (
          <p className="text-xs text-[#b45309]">Escolha pelo menos um canal.</p>
        )}
      </fieldset>
      <ReasonField value={reason} onChange={setReason} />
    </ActionDialog>
  );
}

// ─── 2ª via do Pix ────────────────────────────────────────────────────────────

function SecondCopyDialog({ detail, onClose }: DialogProps) {
  const mutation = useIssueSecondCopy(detail.invoice.id);
  const { reason, setReason, valid } = useReason();
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const charge = await mutation.mutateAsync({ reason: reason.trim() });
      toast.success(
        charge
          ? `Novo código Pix gerado (${charge.attempt}ª tentativa).`
          : "Pedido de novo código Pix registrado.",
      );
      onClose();
    } catch (err) {
      setError(actionErrorMessage(err));
    }
  };

  return (
    <ActionDialog
      title={`Gerar 2ª via do Pix de ${detail.invoice.number}`}
      description="Gerar um novo código Pix? O código atual deixa de valer, inclusive o que está no e-mail já enviado."
      submitLabel="Gerar novo código"
      canSubmit={valid}
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <ReasonField value={reason} onChange={setReason} />
    </ActionDialog>
  );
}

// ─── Baixa manual ─────────────────────────────────────────────────────────────

const brtDayKey = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

function MarkPaidDialog({ detail, onClose }: DialogProps) {
  const mutation = useMarkInvoicePaid(detail.invoice.id);
  const defaults = detail.actions.markPaid;
  const { reason, setReason, valid } = useReason();
  const [paidAt, setPaidAt] = useState(defaults.defaultPaidDate);
  const [amount, setAmount] = useState(centsToInput(defaults.defaultAmountInCents));
  const [error, setError] = useState<string | null>(null);
  const dateId = useId();
  const amountId = useId();
  const cents = parseBrlToCents(amount);
  const amountError =
    cents === null || cents <= 0
      ? "Informe o valor recebido, por exemplo 1.248,60."
      : cents > MANUAL_MAX_CENTS
        ? `O valor máximo é ${formatBrl(MANUAL_MAX_CENTS)}.`
        : null;
  const differs = !amountError && cents !== detail.invoice.totalInCents;

  const submit = async () => {
    if (cents === null) return;
    setError(null);
    try {
      const result = await mutation.mutateAsync({
        reason: reason.trim(),
        paidAt,
        amountInCents: cents,
      });
      const base = `Baixa de ${formatBrl(cents)} registrada`;
      if (result.pendingCharge === "FAILED") {
        toast.warning(
          `${base}, mas o Pix pendente não foi cancelado na Woovi. Cancele pelo painel da Woovi; se o Pix cair, devolva o valor.`,
        );
      } else if (result.pendingCharge === "CANCELLED") {
        toast.success(`${base}. O Pix pendente foi cancelado.`);
      } else {
        toast.success(`${base}.`);
      }
      onClose();
    } catch (err) {
      setError(actionErrorMessage(err));
    }
  };

  return (
    <ActionDialog
      title={`Dar baixa manual em ${detail.invoice.number}?`}
      description="Use só se o dinheiro entrou por outro caminho (transferência, depósito). Se o Pix também cair, o sistema avisa pagamento em dobro para devolver."
      submitLabel={amountError ? "Dar baixa" : `Dar baixa de ${formatBrl(cents as number)}`}
      canSubmit={valid && !amountError && !!paidAt}
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={dateId}>Data do pagamento</Label>
          <Input
            id={dateId}
            type="date"
            autoFocus
            value={paidAt}
            min={brtDayKey(detail.invoice.closedAt)}
            max={defaults.defaultPaidDate}
            onChange={(e) => setPaidAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={amountId}>Valor recebido (R$)</Label>
          <Input
            id={amountId}
            inputMode="decimal"
            value={amount}
            aria-invalid={amountError ? true : undefined}
            aria-describedby={`${amountId}-help`}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>
      <p id={`${amountId}-help`} className="text-xs text-[#b45309]">
        {amountError ??
          (differs
            ? `O valor é diferente do total da fatura (${detail.invoice.total}). Explique no motivo.`
            : "")}
      </p>
      <ReasonField value={reason} onChange={setReason} />
    </ActionDialog>
  );
}

// ─── Liberar bloqueio ─────────────────────────────────────────────────────────

function WaiveBlockDialog({ detail, onClose }: DialogProps) {
  const mutation = useWaiveInvoiceBlock(detail.invoice.id);
  const limits = detail.actions.waiveBlock;
  const today = detail.actions.markPaid.defaultPaidDate;
  const { reason, setReason, valid } = useReason();
  const [until, setUntil] = useState(limits.suggestedUntil);
  const [error, setError] = useState<string | null>(null);
  const untilId = useId();
  const inRange = !!until && until >= today && until <= limits.maxUntil;

  const submit = async () => {
    setError(null);
    try {
      const result = await mutation.mutateAsync({ reason: reason.trim(), until });
      toast.success(`Bloqueio liberado até ${ddmm(result.until ?? until)}.`);
      onClose();
    } catch (err) {
      setError(actionErrorMessage(err));
    }
  };

  return (
    <ActionDialog
      title="Liberar bloqueio até…"
      description={`Liberar publicar e aprovar para ${companyOf(detail)} até ${
        until ? ddmm(until) : "a data escolhida"
      }? A fatura continua em aberto e a régua continua.`}
      submitLabel={inRange ? `Liberar até ${ddmm(until)}` : "Liberar"}
      canSubmit={valid && inRange}
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <div className="space-y-1.5">
        <Label htmlFor={untilId}>Até (data)</Label>
        <Input
          id={untilId}
          type="date"
          autoFocus
          value={until}
          min={today}
          max={limits.maxUntil}
          aria-describedby={`${untilId}-help`}
          onChange={(e) => setUntil(e.target.value)}
        />
        <p id={`${untilId}-help`} className="text-xs text-[#737373]">
          {`Sugestão: 7 dias (${dayLabel(limits.suggestedUntil)}). Máximo: ${dayLabel(limits.maxUntil)}.`}
        </p>
      </div>
      <ReasonField value={reason} onChange={setReason} />
    </ActionDialog>
  );
}

// ─── Ajuste (desconto ou cobrança) ────────────────────────────────────────────

function AdjustmentDialog({ detail, onClose }: DialogProps) {
  const contractorUserId = detail.invoice.company.contractorUserId;
  const mutation = useBillingAdjustment(contractorUserId);
  // Um id por abertura: clique duplo e nova tentativa caem na mesma linha.
  const [requestId] = useState(newRequestId);
  const submitting = useRef(false);
  const { reason, setReason, valid } = useReason();
  const [direction, setDirection] = useState<"DEBIT" | "CREDIT" | null>(null);
  const [amount, setAmount] = useState("");
  const [vacancyId, setVacancyId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const baseId = useId();
  const cents = parseBrlToCents(amount);
  const amountOk = cents !== null && cents > 0 && cents <= MANUAL_MAX_CENTS;
  const kind = direction === "CREDIT" ? "desconto" : "cobrança";
  const submitLabel =
    direction && amountOk ? `Lançar ${kind} de ${formatBrl(cents as number)}` : "Lançar ajuste";

  const submit = async () => {
    if (!direction || !amountOk || submitting.current) return;
    submitting.current = true;
    setError(null);
    try {
      const result = await mutation.mutateAsync({
        direction,
        amountInCents: cents as number,
        reason: reason.trim(),
        vacancyId: vacancyId.trim() || null,
        requestId,
      });
      if (result.replayed) {
        toast.info("Este ajuste já tinha sido lançado.");
      } else {
        toast.success(
          `${direction === "CREDIT" ? "Desconto" : "Cobrança"} de ${formatBrl(cents as number)} ${
            direction === "CREDIT" ? "lançado" : "lançada"
          } para ${companyOf(detail)}. Entra na próxima fatura.`,
        );
      }
      onClose();
    } catch (err) {
      setError(actionErrorMessage(err));
    } finally {
      submitting.current = false;
    }
  };

  return (
    <ActionDialog
      title={`Lançar um ajuste para ${companyOf(detail)}?`}
      description="Entra na próxima fatura."
      submitLabel={submitLabel}
      canSubmit={valid && amountOk && !!direction}
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-medium text-[#1d1d1b]">Tipo</legend>
        {(
          [
            ["CREDIT", "Desconto (crédito)"],
            ["DEBIT", "Cobrança (débito)"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex items-center gap-2 text-sm text-[#1d1d1b]">
            <input
              type="radio"
              name={`${baseId}-direction`}
              checked={direction === value}
              onChange={() => setDirection(value)}
              className="h-4 w-4 accent-[#eca826]"
            />
            {label}
          </label>
        ))}
        {!direction && <p className="text-xs text-[#b45309]">Escolha o tipo: desconto ou cobrança.</p>}
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${baseId}-amount`}>Valor (R$)</Label>
          <Input
            id={`${baseId}-amount`}
            inputMode="decimal"
            placeholder="48,60"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${baseId}-vacancy`}>Vaga (opcional)</Label>
          <Input
            id={`${baseId}-vacancy`}
            placeholder="id da vaga desta empresa"
            value={vacancyId}
            onChange={(e) => setVacancyId(e.target.value)}
          />
        </div>
      </div>
      <ReasonField value={reason} onChange={setReason} />
    </ActionDialog>
  );
}

// ─── Fechar agora (fatura extraordinária) ─────────────────────────────────────

function CloseNowDialog({ detail, onClose }: DialogProps) {
  const router = useRouter();
  const contractorUserId = detail.invoice.company.contractorUserId;
  const mutation = useCloseInvoiceNow(contractorUserId);
  // Prévia do que está aberto e do vencimento (o mesmo GET da aba Cobrança).
  const billing = useAdminBillingMode(contractorUserId);
  const { reason, setReason, valid } = useReason();
  const [error, setError] = useState<string | null>(null);
  const company = companyOf(detail);
  const open = billing.data?.openPreview ?? null;
  const due = billing.data?.extraordinaryInvoice?.dueDate ?? null;
  const description = open
    ? `Fechar agora uma fatura com os lançamentos ainda não faturados de ${company} (${open.lineCount} ${
        open.lineCount === 1 ? "lançamento" : "lançamentos"
      }, ${formatBrl(open.totalInCents)})?${due ? ` Vence em ${dayLabel(due)}.` : ""}`
    : `Fechar agora uma fatura com os lançamentos ainda não faturados de ${company}?`;

  const submit = async () => {
    setError(null);
    try {
      const invoice = await mutation.mutateAsync({ reason: reason.trim() });
      toast.success(`Fatura ${invoice.number} fechada. Vence ${dayLabel(invoice.dueDate)}.`);
      onClose();
      router.push(`/financeiro/faturas/${encodeURIComponent(invoice.id)}`);
    } catch (err) {
      setError(actionErrorMessage(err));
    }
  };

  return (
    <ActionDialog
      title="Fechar agora"
      description={
        <>
          <p>{description}</p>
          {open && open.lineCount > 0 && (
            <p className="mt-1 text-xs text-[#737373]">
              {`Conta (débitos − créditos): ${open.calc}. Fonte: lançamentos do faturado ainda sem fatura.`}
            </p>
          )}
        </>
      }
      submitLabel="Fechar fatura agora"
      canSubmit={valid}
      pending={mutation.isPending}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <ReasonField value={reason} onChange={setReason} />
    </ActionDialog>
  );
}

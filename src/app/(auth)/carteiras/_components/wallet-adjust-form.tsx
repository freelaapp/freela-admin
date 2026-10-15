"use client";

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAdjustWallet } from "@/modules/admin/application/use-admin-wallets";
import { parseBrlToCents } from "@/modules/admin/application/invoice-presentation";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";

type Direction = "credit" | "debit";

/** Mesmo formato do resto da tela de Carteiras ("R$ 5.000,00"). */
function formatBrl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

interface PendingAdjust {
  direction: Direction;
  amountInCents: number;
  reason: string;
}

/**
 * Ajuste manual do saldo da carteira (super-admin), em dois passos: o
 * formulário e a conferência com o sentido, o valor, o saldo atual e o saldo
 * depois. O valor é lido em centavos pelo mesmo parser do Financeiro: "50,00"
 * e "50.00" são R$ 50,00 — o parser antigo tirava todo ponto e "50.00" virava
 * R$ 5.000,00.
 */
export function WalletAdjustForm({
  userId,
  currentBalanceInCents,
  balanceError = false,
}: {
  userId: string;
  /**
   * Saldo atual, do extrato da carteira. `null` enquanto o extrato carrega: a
   * conferência só abre com o saldo de verdade (o da linha da lista pode estar
   * velho), senão o "saldo depois" sairia errado.
   */
  currentBalanceInCents: number | null;
  /** O extrato falhou: sem saldo atual não há conferência. */
  balanceError?: boolean;
}) {
  const [direction, setDirection] = useState<Direction>("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<PendingAdjust | null>(null);
  const mutation = useAdjustWallet();

  const balanceReady = currentBalanceInCents !== null;

  function review() {
    if (!balanceReady) return;
    const cents = parseBrlToCents(amount);
    if (cents === null || cents <= 0) {
      toast.error("Valor inválido. Use reais e centavos, por exemplo 50,00.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Informe o motivo do ajuste.");
      return;
    }
    setPending({ direction, amountInCents: cents, reason: reason.trim() });
  }

  async function apply() {
    if (!pending) return;
    const deltaInCents = pending.direction === "debit" ? -pending.amountInCents : pending.amountInCents;
    try {
      const res = await mutation.mutateAsync({
        userId,
        payload: { deltaInCents, reason: pending.reason },
      });
      toast.success(`Ajuste aplicado. Novo saldo: ${formatBrl(res.balanceInCents)}`);
      setPending(null);
      setAmount("");
      setReason("");
    } catch (error) {
      // A API explica o motivo ("Saldo insuficiente para este ajuste de débito.").
      toast.error(apiErrorOf(error).message ?? "Não foi possível aplicar o ajuste.");
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-dashed border-[#e5e5e5] p-3">
      <p className="text-sm font-semibold text-[#1d1d1b]">Ajuste manual (super-admin)</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <NativeSelect
          aria-label="Sentido do ajuste"
          value={direction}
          onChange={(e) => setDirection(e.target.value as Direction)}
          className="sm:w-36"
        >
          <option value="credit">Creditar</option>
          <option value="debit">Debitar</option>
        </NativeSelect>
        <Input
          aria-label="Valor (R$)"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Valor (R$), ex.: 50,00"
          className="flex-1"
        />
      </div>
      <Input
        aria-label="Motivo"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (ex.: chamado #123)"
      />
      <Button onClick={review} disabled={mutation.isPending || !balanceReady} className="w-full">
        {balanceReady ? (
          "Revisar ajuste"
        ) : balanceError ? (
          "Saldo indisponível"
        ) : (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Carregando saldo atual…
          </>
        )}
      </Button>
      {!balanceReady && balanceError && (
        <p role="alert" className="text-xs text-red-700">
          Não foi possível carregar o saldo atual da carteira. O ajuste fica bloqueado até o extrato
          carregar: feche e abra a carteira de novo.
        </p>
      )}

      <AdjustConfirmDialog
        pending={pending}
        currentBalanceInCents={currentBalanceInCents ?? 0}
        submitting={mutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => void apply()}
      />
    </div>
  );
}

function AdjustConfirmDialog({
  pending,
  currentBalanceInCents,
  submitting,
  onCancel,
  onConfirm,
}: {
  pending: PendingAdjust | null;
  currentBalanceInCents: number;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const isDebit = pending?.direction === "debit";
  const amount = pending?.amountInCents ?? 0;
  const after = isDebit ? currentBalanceInCents - amount : currentBalanceInCents + amount;
  // A API não deixa o saldo ficar negativo (débito guardado): avisa antes.
  const insufficient = isDebit && amount > currentBalanceInCents;
  const verb = isDebit ? "Debitar" : "Creditar";

  return (
    <Dialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open && !submitting) onCancel();
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
          {`${verb} ${formatBrl(amount)}?`}
        </h2>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[#737373]">Saldo atual</dt>
            <dd className="font-medium tabular-nums text-[#1d1d1b]">{formatBrl(currentBalanceInCents)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#737373]">{isDebit ? "Débito" : "Crédito"}</dt>
            <dd className="font-medium tabular-nums text-[#1d1d1b]">
              {`${isDebit ? "−" : "+"} ${formatBrl(amount)}`}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-[#e5e5e5] pt-1.5">
            <dt className="font-semibold text-[#1d1d1b]">Saldo depois</dt>
            <dd
              data-testid="wallet-adjust-after"
              className={`font-semibold tabular-nums ${insufficient ? "text-red-600" : "text-[#1d1d1b]"}`}
            >
              {formatBrl(after)}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-[#525252]">
          {`Conta: saldo atual ${isDebit ? "−" : "+"} valor do ajuste. Fonte do saldo atual: extrato da carteira mostrado acima.`}
        </p>
        <p className="mt-2 break-words text-sm text-[#1d1d1b]">
          <span className="text-[#737373]">Motivo:</span> {pending?.reason}
        </p>
        {insufficient && (
          <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">
            O saldo não cobre este débito. A carteira não pode ficar negativa: diminua o valor.
          </p>
        )}
        <DialogFooter className="flex-col-reverse sm:flex-row">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
          >
            Voltar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={submitting || insufficient}
            className="bg-[#eca826] text-white hover:bg-[#d4951e]"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Aplicando...
              </>
            ) : (
              `Confirmar: ${verb.toLowerCase()} ${formatBrl(amount)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

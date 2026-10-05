"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PeriodFilter } from "@/components/commissions/period-filter";
import { CommissionStatementView, StatementPager } from "@/components/commissions/statement-view";
import { formatCents } from "@/lib/money";
import { brasiliaToday, resolveCommissionPeriod, type CommissionPeriodSelection } from "@/lib/commissions/period";
import type { StatementPayoutItem, StatementStatus } from "@/lib/commissions/types";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { parseDecimal } from "@/lib/commissions/rule-form";
import {
  useCommissionAdjustment,
  useCommissionPayoutPreview,
  useCommissionStatement,
  useRegisterCommissionPayout,
  useReverseCommissionPayout,
} from "@/modules/admin/application/use-admin-consultant-commissions";

function parseReais(raw: string): number {
  return Math.round(parseDecimal(raw) * 100);
}

export function CommissionStatementTab({ consultantId }: { consultantId: string }) {
  const [period, setPeriod] = useState<CommissionPeriodSelection>({ preset: "this_year", customFrom: "", customTo: "" });
  const [status, setStatus] = useState<StatementStatus | "">("");
  const [page, setPage] = useState(1);
  const range = useMemo(() => resolveCommissionPeriod(period), [period]);
  const statement = useCommissionStatement(consultantId, { ...range, status: status || undefined, page });

  const [payOpen, setPayOpen] = useState(false);
  const [periodEnd, setPeriodEnd] = useState("");
  const [paidAt, setPaidAt] = useState(brasiliaToday());
  const [proof, setProof] = useState("");
  const preview = useCommissionPayoutPreview(consultantId, payOpen && periodEnd ? periodEnd : null);
  const register = useRegisterCommissionPayout(consultantId);

  const [adjOpen, setAdjOpen] = useState(false);
  const [adjAmount, setAdjAmount] = useState("");
  const [adjType, setAdjType] = useState<"credit" | "debit">("credit");
  const [adjReason, setAdjReason] = useState("");
  const adjustment = useCommissionAdjustment(consultantId);

  const [reverseTarget, setReverseTarget] = useState<StatementPayoutItem | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const reverse = useReverseCommissionPayout(consultantId);

  const balances = statement.data?.balances;

  const handlePay = async () => {
    if (!preview.data) return;
    try {
      await register.mutateAsync({
        periodEnd,
        paidAt,
        paymentProof: proof,
        expectedAmountInCents: preview.data.amountInCents,
      });
      toast.success("Pagamento registrado.");
      setPayOpen(false);
      setPeriodEnd("");
      setProof("");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível registrar o pagamento."));
      preview.refetch();
    }
  };

  const handleAdjustment = async () => {
    const cents = parseReais(adjAmount);
    if (!Number.isFinite(cents) || cents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    try {
      await adjustment.mutateAsync({ amountInCents: adjType === "debit" ? -cents : cents, reason: adjReason });
      toast.success("Ajuste lançado.");
      setAdjOpen(false);
      setAdjAmount("");
      setAdjReason("");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível lançar o ajuste."));
    }
  };

  const handleReverse = async () => {
    if (!reverseTarget) return;
    try {
      await reverse.mutateAsync({ payoutId: reverseTarget.id, reason: reverseReason });
      toast.success("Pagamento estornado. Os lançamentos voltaram para a receber.");
      setReverseTarget(null);
      setReverseReason("");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível estornar."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
          <p className="text-xs text-[#737373]">A pagar</p>
          <p className="mt-1 text-2xl font-bold text-[#1d1d1b]">{balances ? formatCents(balances.openInCents) : "—"}</p>
        </div>
        <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
          <p className="text-xs text-[#737373]">Já pago</p>
          <p className="mt-1 text-2xl font-bold text-[#1d1d1b]">{balances ? formatCents(balances.paidInCents) : "—"}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => setPayOpen(true)} className="w-full sm:w-auto">
          Registrar pagamento
        </Button>
        <Button variant="outline" onClick={() => setAdjOpen(true)} className="w-full sm:w-auto">
          Lançar ajuste
        </Button>
      </div>

      <PeriodFilter
        value={period}
        onChange={(next) => {
          setPeriod(next);
          setPage(1);
        }}
      />
      <select
        aria-label="Situação"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm sm:w-auto"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value as StatementStatus | "");
          setPage(1);
        }}
      >
        <option value="">Tudo</option>
        <option value="OPEN">A pagar</option>
        <option value="PAID">Pago</option>
      </select>

      {statement.isLoading ? (
        <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-[#eca826]" />
      ) : (
        <>
          <CommissionStatementView items={statement.data?.items ?? []} onReversePayout={setReverseTarget} />
          {statement.data && (
            <StatementPager
              page={statement.data.page}
              pageSize={statement.data.pageSize}
              total={statement.data.total}
              onPage={setPage}
            />
          )}
        </>
      )}

      <Dialog open={payOpen} onOpenChange={(open) => !open && setPayOpen(false)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              Quita tudo o que está a pagar até a data escolhida. O valor é calculado pelo sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-period-end">Quitar até</Label>
              <Input id="pay-period-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
            {preview.data && (
              <p className="text-sm font-semibold text-[#1d1d1b]">
                Total a pagar: {formatCents(preview.data.amountInCents)} ({preview.data.entries.length} lançamento(s))
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="pay-paid-at">Data do PIX</Label>
              <Input id="pay-paid-at" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-proof">Comprovante (txid do PIX)</Label>
              <Input id="pay-proof" value={proof} onChange={(e) => setProof(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Voltar
            </Button>
            <Button
              onClick={handlePay}
              disabled={!preview.data || preview.data.amountInCents <= 0 || !proof.trim() || !paidAt || register.isPending}
            >
              {register.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjOpen} onOpenChange={(open) => !open && setAdjOpen(false)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lançar ajuste</DialogTitle>
            <DialogDescription>Corrige o saldo do consultor. O motivo aparece no extrato dele.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <select
              aria-label="Tipo de ajuste"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              value={adjType}
              onChange={(e) => setAdjType(e.target.value as "credit" | "debit")}
            >
              <option value="credit">Crédito (consultor recebe)</option>
              <option value="debit">Débito (desconta do consultor)</option>
            </select>
            <div className="space-y-1.5">
              <Label htmlFor="adj-amount">Valor (R$)</Label>
              <Input id="adj-amount" inputMode="decimal" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-reason">Motivo</Label>
              <Input id="adj-reason" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjOpen(false)}>
              Voltar
            </Button>
            <Button onClick={handleAdjustment} disabled={!adjReason.trim() || adjustment.isPending}>
              Lançar ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reverseTarget)} onOpenChange={(open) => !open && setReverseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estornar pagamento</DialogTitle>
            <DialogDescription>
              {reverseTarget && `${formatCents(reverseTarget.amountInCents)} — os lançamentos voltam para "a pagar".`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reverse-reason">Motivo</Label>
            <Input id="reverse-reason" value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseTarget(null)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleReverse} disabled={!reverseReason.trim() || reverse.isPending}>
              Estornar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

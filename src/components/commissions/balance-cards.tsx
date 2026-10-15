import { formatCents } from "@/lib/money";
import type { CommissionBalances } from "@/lib/commissions/types";

const LABELS = {
  admin: { open: "A pagar", paid: "Já pago" },
  consultant: { open: "A receber", paid: "Já recebido" },
} as const;

/**
 * Saldos da comissão: SEMPRE desde o início — não mudam com o filtro de
 * período da tela (a API soma o livro inteiro). Cada número diz a conta e a
 * fonte (regra do dono: todo número com a conta e de onde veio).
 */
export function CommissionBalanceCards({
  balances,
  audience,
}: {
  balances: CommissionBalances | undefined;
  /** Quem lê: o admin paga ("A pagar"), o consultor recebe ("A receber"). */
  audience: "admin" | "consultant";
}) {
  const labels = LABELS[audience];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <BalanceCard
        label={labels.open}
        value={balances ? formatCents(balances.openInCents) : "—"}
        calc="soma dos lançamentos de comissão ainda sem pagamento, desde o início (não muda com o filtro de período)"
        source="livro de comissão do consultor"
      />
      <BalanceCard
        label={labels.paid}
        value={balances ? formatCents(balances.paidInCents) : "—"}
        calc="soma dos pagamentos registrados, sem os estornados, desde o início (não muda com o filtro de período)"
        source="pagamentos de comissão registrados no painel"
      />
    </div>
  );
}

function BalanceCard({
  label,
  value,
  calc,
  source,
}: {
  label: string;
  value: string;
  calc: string;
  source: string;
}) {
  return (
    <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
      <p className="text-xs text-[#737373]">
        {label} <span className="text-[#a3a3a3]">· desde o início</span>
      </p>
      <p className="mt-1 text-2xl font-bold text-[#1d1d1b]">{value}</p>
      <p className="mt-1 text-[11px] text-[#737373]">{`Conta: ${calc}. Fonte: ${source}.`}</p>
    </div>
  );
}

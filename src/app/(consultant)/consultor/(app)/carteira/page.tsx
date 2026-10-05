"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodFilter } from "@/components/commissions/period-filter";
import { CommissionStatementView, StatementPager } from "@/components/commissions/statement-view";
import { formatCents } from "@/lib/money";
import { resolveCommissionPeriod, type CommissionPeriodSelection } from "@/lib/commissions/period";
import type { StatementStatus } from "@/lib/commissions/types";
import { useMyStatement, useMyWallet } from "@/modules/consultant/application/use-consultant-commissions";

export default function CarteiraPage() {
  const wallet = useMyWallet();
  const [period, setPeriod] = useState<CommissionPeriodSelection>({ preset: "this_year", customFrom: "", customTo: "" });
  const [status, setStatus] = useState<StatementStatus | "">("");
  const [page, setPage] = useState(1);
  const range = useMemo(() => resolveCommissionPeriod(period), [period]);
  const statement = useMyStatement({ ...range, status: status || undefined, page });

  return (
    <div className="space-y-4">
      <PageHeader title="Carteira" description="O que você tem a receber e o extrato de cada valor." />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
          <p className="text-xs text-[#737373]">A receber</p>
          <p className="mt-1 text-2xl font-bold text-[#1d1d1b]">
            {wallet.data ? formatCents(wallet.data.openInCents) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
          <p className="text-xs text-[#737373]">Já recebido</p>
          <p className="mt-1 text-2xl font-bold text-[#1d1d1b]">
            {wallet.data ? formatCents(wallet.data.paidInCents) : "—"}
          </p>
        </div>
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
        <option value="OPEN">A receber</option>
        <option value="PAID">Recebido</option>
      </select>
      {statement.isLoading ? (
        <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-[#eca826]" />
      ) : (
        <>
          <CommissionStatementView items={statement.data?.items ?? []} />
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
    </div>
  );
}

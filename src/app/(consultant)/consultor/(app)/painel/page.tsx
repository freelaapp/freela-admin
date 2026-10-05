"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodFilter } from "@/components/commissions/period-filter";
import { CommissionDashboardView } from "@/components/commissions/dashboard-view";
import { resolveCommissionPeriod, type CommissionPeriodSelection } from "@/lib/commissions/period";
import { useMyCommissionDashboard } from "@/modules/consultant/application/use-consultant-commissions";

export default function PainelPage() {
  const [period, setPeriod] = useState<CommissionPeriodSelection>({ preset: "this_month", customFrom: "", customTo: "" });
  const range = useMemo(() => resolveCommissionPeriod(period), [period]);
  const dashboard = useMyCommissionDashboard(range);

  return (
    <div>
      <PageHeader title="Painel" description="Suas indicações e o que você ganhou no período." />
      {dashboard.data?.rule && (
        <p className="mb-4 rounded-lg bg-[#fff7e6] p-3 text-sm text-[#1d1d1b]">
          Você ganha: {dashboard.data.rule.description}
        </p>
      )}
      <PeriodFilter value={period} onChange={setPeriod} />
      <CommissionDashboardView data={dashboard.data} isLoading={dashboard.isLoading} />
    </div>
  );
}

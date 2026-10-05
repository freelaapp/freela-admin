"use client";

import { useMemo, useState } from "react";
import { PeriodFilter } from "@/components/commissions/period-filter";
import { CommissionDashboardView } from "@/components/commissions/dashboard-view";
import { resolveCommissionPeriod, type CommissionPeriodSelection } from "@/lib/commissions/period";
import { useCommissionDashboard } from "@/modules/admin/application/use-admin-consultant-commissions";

export function CommissionDashboardTab({ consultantId }: { consultantId: string }) {
  const [period, setPeriod] = useState<CommissionPeriodSelection>({ preset: "this_month", customFrom: "", customTo: "" });
  const range = useMemo(() => resolveCommissionPeriod(period), [period]);
  const dashboard = useCommissionDashboard(consultantId, range);
  return (
    <div>
      <PeriodFilter value={period} onChange={setPeriod} />
      <CommissionDashboardView data={dashboard.data} isLoading={dashboard.isLoading} />
    </div>
  );
}

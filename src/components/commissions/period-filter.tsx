"use client";

import { ChoicePills } from "@/components/ui/choice-pills";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  COMMISSION_PERIOD_PRESETS,
  type CommissionPeriodPreset,
  type CommissionPeriodSelection,
} from "@/lib/commissions/period";

export function PeriodFilter({
  value,
  onChange,
}: {
  value: CommissionPeriodSelection;
  onChange: (next: CommissionPeriodSelection) => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <ChoicePills<CommissionPeriodPreset>
        aria-label="Período"
        options={COMMISSION_PERIOD_PRESETS}
        value={value.preset}
        onChange={(preset) => onChange({ ...value, preset })}
      />
      {value.preset === "custom" && (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <div className="space-y-1">
            <Label htmlFor="period-from">De</Label>
            <Input
              id="period-from"
              type="date"
              value={value.customFrom}
              onChange={(e) => onChange({ ...value, customFrom: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="period-to">Até</Label>
            <Input
              id="period-to"
              type="date"
              value={value.customTo}
              onChange={(e) => onChange({ ...value, customTo: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

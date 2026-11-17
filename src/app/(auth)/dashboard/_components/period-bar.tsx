"use client";

import type { AdminMetricsPeriodPreset } from "@/modules/admin/infrastructure/admin-api";

/** Os presets da barra de período (mesmas opções do painel desde jul/2026). */
export const PERIOD_PRESETS: { id: AdminMetricsPeriodPreset; label: string }[] = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "this_month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
  { id: "custom", label: "Personalizado" },
];

/** "YYYY-MM-DD" de hoje (ou de N dias atrás) no fuso de Brasília. */
export function isoDayBrasilia(daysAgo = 0): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000 - 3 * 3_600_000);
  return d.toISOString().slice(0, 10);
}

interface PeriodBarProps {
  period: AdminMetricsPeriodPreset;
  onPeriodChange: (period: AdminMetricsPeriodPreset) => void;
  /** Só no "Personalizado": início e fim (inclusivo), `YYYY-MM-DD` de Brasília. */
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  className?: string;
}

/**
 * Barra de período do painel: Hoje · Ontem · 7 dias · 30 dias · 90 dias · Este mês · Mês passado ·
 * Personalizado. Quebra em linhas no celular (nunca rola a página para o lado).
 */
export function PeriodBar({
  period,
  onPeriodChange,
  from,
  to,
  onFromChange,
  onToChange,
  className,
}: PeriodBarProps) {
  return (
    <div className={className ?? "flex flex-wrap items-center gap-2 mb-3"}>
      <span className="text-xs font-medium text-[#737373] mr-1">Período:</span>
      <div className="inline-flex flex-wrap rounded-lg border border-[#e5e5e5] bg-white p-0.5">
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPeriodChange(p.id)}
            aria-pressed={period === p.id}
            className={
              period === p.id
                ? "px-3 h-8 rounded-md text-sm font-semibold bg-[#eca826] text-[#1d1d1b] cursor-pointer"
                : "px-3 h-8 rounded-md text-sm text-[#737373] hover:bg-[#f7f7f7] cursor-pointer transition-colors"
            }
          >
            {p.label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => onFromChange(e.target.value)}
            aria-label="Início do período"
            className="h-9 px-3 rounded-lg bg-white border border-[#e5e5e5] text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
          />
          <span className="text-xs text-[#737373]">até</span>
          <input
            type="date"
            value={to}
            min={from}
            max={isoDayBrasilia(0)}
            onChange={(e) => onToChange(e.target.value)}
            aria-label="Fim do período"
            className="h-9 px-3 rounded-lg bg-white border border-[#e5e5e5] text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
          />
        </div>
      )}
    </div>
  );
}

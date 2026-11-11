"use client";

import { Loader2 } from "lucide-react";
import { queueCounterLines } from "@/modules/admin/application/orientation-queue-presentation";
import type { QueueCountersView } from "@/modules/admin/infrastructure/orientation-api";

interface Props {
  data: QueueCountersView | undefined;
  isLoading: boolean;
  onRetry: () => void;
}

/** Contadores do topo: valor grande + "Ver a conta" (o que é, a conta e a fonte). Não seguem os filtros. */
export function QueueCounters({ data, isLoading, onRetry }: Props) {
  if (isLoading) {
    return (
      <div role="status" aria-label="Carregando" className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-[#eca826]" />
      </div>
    );
  }
  if (!data) {
    return (
      <p className="py-3 text-sm text-[#737373]">
        Não consegui carregar os contadores.{" "}
        <button type="button" className="underline" onClick={onRetry}>
          Tentar de novo
        </button>
      </p>
    );
  }
  const lines = queueCounterLines(data.counters);
  return (
    <section aria-label="Contadores da Fila" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {lines.map((l) => (
        <div key={l.label} className="rounded-lg border border-[#e5e5e5] bg-white p-3">
          <p className="text-xs font-medium text-[#737373]">{l.label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[#1d1d1b]">{l.value}</p>
          <details className="mt-2 text-xs text-[#525252]">
            <summary className="min-h-6 cursor-pointer font-medium text-[#1d1d1b] underline">Ver a conta</summary>
            <p className="mt-1">{l.explanation}</p>
          </details>
        </div>
      ))}
    </section>
  );
}

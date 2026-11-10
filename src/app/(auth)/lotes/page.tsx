"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { useAdminLots } from "@/modules/admin/application/use-admin-lots";
import {
  attentionReasons,
  filterLots,
  formatServiceDate,
  isLotsUnavailable,
  lotCountsLine,
  startsInText,
  type LotFilter,
} from "@/modules/admin/application/lots-presentation";

/**
 * Lotes (vagas em lote, fatia 1; A2): os dias das empresas com várias vagas, dos próximos 7 dias,
 * o mais próximo em cima, com o motivo de atenção escrito em cada cartão. Só leitura. Com a chave
 * da API desligada (404, ou API antiga sem a rota), avisa que ainda não está ligado, sem erro.
 */
export default function LotesPage() {
  const { isChecking, allowed } = useAreaGuard("JOBS");
  const [filter, setFilter] = useState<LotFilter>("all");
  const lots = useAdminLots(allowed);

  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }

  const header = (
    <PageHeader
      title="Lotes"
      description="Empresas com várias vagas no mesmo dia, dos próximos 7 dias. O mais próximo fica em cima."
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => lots.refetch()}
          disabled={lots.isFetching}
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${lots.isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    />
  );

  if (lots.isError && isLotsUnavailable(lots.error)) {
    return (
      <div>
        {header}
        <p className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">
          Os lotes ainda não estão ligados.
        </p>
      </div>
    );
  }

  const now = new Date();
  const all = lots.data ?? [];
  const today = filterLots(all, "today", now).length;
  const tomorrow = filterLots(all, "tomorrow", now).length;
  const attention = filterLots(all, "attention", now).length;
  const items = filterLots(all, filter, now);
  const tabs: Array<[LotFilter, string]> = [
    ["all", `Todos${lots.data ? ` ${all.length}` : ""}`],
    ["today", `Hoje${lots.data ? ` ${today}` : ""}`],
    ["tomorrow", `Amanhã${lots.data ? ` ${tomorrow}` : ""}`],
    ["attention", `Atenção${lots.data ? ` ${attention}` : ""}`],
  ];

  return (
    <div>
      {header}

      <div className="mb-4 flex flex-wrap gap-1" role="tablist">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`min-h-9 rounded-md border px-3 py-1 text-xs font-semibold transition-colors ${
              filter === value
                ? "border-[#1d1d1b] bg-[#1d1d1b] text-white"
                : "border-[#e5e5e5] bg-white text-[#737373] hover:text-[#1d1d1b]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {lots.isLoading && (
        <div className="grid gap-3" aria-label="Carregando os lotes" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" data-testid="lot-skeleton" />
          ))}
        </div>
      )}

      {lots.isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>Não foi possível carregar os lotes. Confira a conexão e toque em Tentar de novo.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => lots.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {lots.data && items.length === 0 && (
        <p className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">
          {all.length === 0
            ? "Nenhum lote nos próximos 7 dias."
            : "Nenhum lote neste filtro."}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((lot) => {
          const reasons = attentionReasons(lot);
          const starts = startsInText(lot.firstStartTime, now);
          return (
            <article
              key={lot.id}
              data-testid="lot-card"
              className="space-y-2 rounded-lg border border-[#e5e5e5] bg-white p-4"
            >
              <p className="break-words font-semibold text-[#1d1d1b]">
                {lot.companyName ?? "Empresa"}
              </p>
              <p className="text-sm text-[#737373]">
                {formatServiceDate(lot.serviceDate)}
                {starts ? ` · ${starts}` : ""}
              </p>
              <p className="text-sm text-[#1d1d1b]">{lotCountsLine(lot)}</p>
              {reasons.map((reason) => (
                <p
                  key={reason}
                  data-testid="lot-attention"
                  className="flex items-start gap-1.5 text-sm font-medium text-[#c97b0e]"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{reason}</span>
                </p>
              ))}
              <Link
                href={`/lotes/${encodeURIComponent(lot.id)}`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-[#e5e5e5] px-3 text-sm font-semibold text-[#1d1d1b] hover:bg-[#f0f0f0]"
              >
                Abrir o lote
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}

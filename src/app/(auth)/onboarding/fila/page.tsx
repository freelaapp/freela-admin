"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";
import {
  brasiliaDateKey,
  formatCount,
  orientationErrorMessage,
} from "@/modules/admin/application/orientation-presentation";
import { queueCsv } from "@/modules/admin/application/orientation-queue-presentation";
import {
  useExportOrientationQueue,
  useOrientationQueue,
  useOrientationQueueCounters,
  useOrientationQueuePeople,
} from "@/modules/admin/application/use-orientation";
import type { OrientationQueueFilter } from "@/modules/admin/infrastructure/orientation-api";
import { QueueCounters } from "./_components/queue-counters";
import { QueueFiltersBar } from "./_components/queue-filters-bar";
import { QueueGroups } from "./_components/queue-groups";
import { QueuePeople } from "./_components/queue-people";
import { queueFilterFromParams, queueFilterToParams } from "./_lib/queue-filters";

function FilaScreen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() ?? "/onboarding/fila";
  const filterKey = searchParams.toString();
  const filter = useMemo(() => queueFilterFromParams(new URLSearchParams(filterKey)), [filterKey]);

  // Página e seleção valem só para o filtro e a página em que foram feitas: mudou um deles, voltam ao início.
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  const page = pageState.key === filterKey ? pageState.page : 1;
  const selectionKey = `${filterKey}|${page}`;
  const [selection, setSelection] = useState<{ key: string; ids: Set<string> }>({ key: selectionKey, ids: new Set() });
  const selected = selection.key === selectionKey ? selection.ids : new Set<string>();
  const [exportNote, setExportNote] = useState<string | null>(null);

  const counters = useOrientationQueueCounters();
  const groups = useOrientationQueue(filter);
  const people = useOrientationQueuePeople(filter, page);
  const exporter = useExportOrientationQueue();

  const applyFilter = (next: OrientationQueueFilter) => {
    setExportNote(null);
    const qs = queueFilterToParams(next).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const toggle = (id: string) => {
    const ids = new Set(selected);
    if (!ids.delete(id)) ids.add(id);
    setSelection({ key: selectionKey, ids });
  };
  const toggleAll = (checked: boolean) => {
    const ids = checked
      ? new Set((people.data?.rows ?? []).flatMap((r) => (r.providerGlobalId ? [r.providerGlobalId] : [])))
      : new Set<string>();
    setSelection({ key: selectionKey, ids });
  };

  const exportCsv = async () => {
    setExportNote(null);
    try {
      const res = await exporter.mutateAsync(filter);
      const { header, rows } = queueCsv(res.rows);
      downloadCsv(`fila-onboarding-${brasiliaDateKey(new Date().toISOString())}.csv`, header, rows);
      if (res.truncated) {
        setExportNote(
          `Exportados ${formatCount(res.rows.length)} de ${formatCount(res.total)}. Filtre por cidade para ver o resto.`,
        );
      } else {
        toast.success(`${formatCount(res.rows.length)} pessoas exportadas.`);
      }
    } catch (err) {
      toast.error(orientationErrorMessage(err, "Não consegui exportar. Tente de novo."));
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#1d1d1b]">Fila</h1>
        <Button
          variant="outline"
          className="min-h-11 md:min-h-9"
          onClick={() => void exportCsv()}
          disabled={exporter.isPending}
        >
          Exportar CSV
        </Button>
      </div>
      {exportNote && (
        <p role="status" className="rounded-lg border border-[#eca826] bg-[#fff8e6] p-3 text-sm text-[#1d1d1b]">
          {exportNote}
        </p>
      )}

      <QueueCounters data={counters.data} isLoading={counters.isLoading} onRetry={() => void counters.refetch()} />

      <QueueFiltersBar filter={filter} onChange={applyFilter} />

      {groups.data && (
        <QueueGroups
          groups={groups.data.groups}
          truncated={groups.data.groupsTruncated === true}
          filter={filter}
          onPick={(p) => applyFilter({ ...filter, uf: p.uf, city: p.city })}
        />
      )}
      {groups.isError && (
        <p className="text-sm text-[#737373]">
          Não consegui carregar os grupos por cidade.{" "}
          <button type="button" className="underline" onClick={() => void groups.refetch()}>
            Tentar de novo
          </button>
        </p>
      )}

      {people.isLoading ? (
        <div role="status" aria-label="Carregando" className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
        </div>
      ) : !people.data ? (
        <p className="py-8 text-sm text-[#737373]">
          Não consegui carregar a lista.{" "}
          <button type="button" className="underline" onClick={() => void people.refetch()}>
            Tentar de novo
          </button>
        </p>
      ) : people.data.rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#737373]">Ninguém na fila com esses filtros</p>
      ) : (
        <QueuePeople
          rows={people.data.rows}
          total={people.data.total}
          page={page}
          pageSize={people.data.pageSize}
          isFetching={people.isFetching}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onPage={(p) => setPageState({ key: filterKey, page: p })}
        />
      )}
    </div>
  );
}

export default function FilaPage() {
  return (
    <Suspense
      fallback={
        <div role="status" aria-label="Carregando" className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
        </div>
      }
    >
      <FilaScreen />
    </Suspense>
  );
}

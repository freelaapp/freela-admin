"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
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
import { ConvocationDialog, type ConvocationTarget } from "./_components/convocation-dialog";
import { ConvocationsProgress } from "./_components/convocations-progress";
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

  // Página e seleção valem só para o filtro em que foram feitas. Qualquer mudança de filtro
  // (inclusive voltar a um filtro anterior) zera os dois: nada de seleção que sobra.
  const fresh = (key: string) => ({ key, page: 1, ids: new Set<string>() });
  const [view, setView] = useState(() => fresh(filterKey));
  if (view.key !== filterKey) setView(fresh(filterKey));
  const cur = view.key === filterKey ? view : fresh(filterKey);
  const page = cur.page;
  const selected = cur.ids;
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [limitText, setLimitText] = useState("");
  const [convoke, setConvoke] = useState<{ target: ConvocationTarget; filter: OrientationQueueFilter; requestKey: string } | null>(null);

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
    setView({ ...cur, ids });
  };
  const toggleAll = (checked: boolean) => {
    const ids = checked
      ? new Set((people.data?.rows ?? []).flatMap((r) => (r.providerGlobalId ? [r.providerGlobalId] : [])))
      : new Set<string>();
    setView({ ...cur, ids });
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
      toast.error(
        isAxiosError(err) && err.response?.status === 429
          ? "Muitos pedidos em pouco tempo (a exportação aceita 3 por minuto). Espere 1 minuto e tente de novo."
          : orientationErrorMessage(err, "Não consegui exportar. Tente de novo."),
      );
    }
  };

  const limitValid = /^\d{1,5}$/.test(limitText) && Number(limitText) >= 1 && Number(limitText) <= 10_000;
  const limitOk = limitText === "" || limitValid;
  const openConvocation = (target: ConvocationTarget) =>
    setConvoke({ target, filter, requestKey: crypto.randomUUID() });
  // A API só convoca quem está Pendente (soma isso ao filtro): com outra Situação a prévia seria sempre 0.
  const notPending = (filter.status ?? "PENDING") !== "PENDING";

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

      {people.data && people.data.rows.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-[#e5e5e5] bg-white p-3 md:flex-row md:flex-wrap md:items-end">
          <Button
            className="min-h-11 md:min-h-9"
            disabled={selected.size === 0 || notPending}
            onClick={() => openConvocation({ kind: "picked", ids: [...selected] })}
          >
            Convocar selecionados ({formatCount(selected.size)})
          </Button>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex items-center gap-2 text-sm text-[#525252]">
              <label htmlFor="convocar-limite">no máximo</label>
              <input
                id="convocar-limite"
                inputMode="numeric"
                placeholder="todos"
                value={limitText}
                onChange={(e) => setLimitText(e.target.value.trim())}
                aria-invalid={!limitOk}
                className="h-11 w-24 rounded-md border border-[#e5e5e5] px-3 text-sm md:h-9"
              />
              <span>pessoas</span>
            </div>
            <Button
              variant="outline"
              className="min-h-11 md:min-h-9"
              disabled={!limitOk || people.data.total === 0 || notPending}
              onClick={() =>
                openConvocation({
                  kind: "filtered",
                  listTotal: people.data.total,
                  ...(limitValid ? { limit: Number(limitText) } : {}),
                })
              }
            >
              Convocar o grupo filtrado
            </Button>
          </div>
          {notPending && (
            <p role="status" className="text-xs text-[#525252]">
              Só dá para convocar quem está Pendente. Troque a Situação para Pendente.
            </p>
          )}
          {!limitOk && <p role="alert" className="text-xs text-[#991b1b]">Digite um número de 1 a 10.000.</p>}
        </div>
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
          busy={people.isFetching}
          selected={selected}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onPage={(p) => setView({ key: filterKey, page: p, ids: new Set() })}
        />
      )}

      <ConvocationsProgress />

      {convoke && (
        <ConvocationDialog
          key={convoke.requestKey}
          target={convoke.target}
          filter={convoke.filter}
          requestKey={convoke.requestKey}
          onClose={() => setConvoke(null)}
          onSent={() => setView({ ...cur, ids: new Set() })}
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

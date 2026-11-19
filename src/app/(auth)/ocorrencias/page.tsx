"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ChoicePills } from "@/components/ui/choice-pills";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { useOccurrences } from "@/modules/admin/application/use-occurrences";
import {
  DISABLED_TEXT,
  LIST_ERROR_TEXT,
  NO_SINCE_TEXT,
  appliedLabel,
  contestLabel,
  decisionShort,
  emptyText,
  headerDescription,
  isOccurrencesDisabled,
  matchesQuery,
  openCountHint,
  placeLine,
  tabLabel,
  vacancyLine,
} from "@/modules/admin/application/occurrences-presentation";
import { dayLabel } from "@/modules/admin/application/suspensions-presentation";
import type { OccurrenceTab } from "@/modules/admin/infrastructure/occurrences-api";

const TH = "px-3 py-2 text-left text-xs font-semibold text-[#737373]";
const TD = "px-3 py-3 align-top text-sm text-[#1d1d1b]";
const TABS: OccurrenceTab[] = ["open", "decided", "all"];

/**
 * Ocorrências (D5, fatia C2; frente E4): as faltas sem aviso desde `OCCURRENCE_QUEUE_SINCE`. O
 * sistema já tirou os pontos e aplicou a suspensão; aqui o suporte confirma ou troca, com quem
 * decidiu, quando e por quê. Abas "Para decidir", "Decididas" e "Todas"; a busca filtra no
 * navegador. Com a chave da API desligada (404 `FEATURE_DISABLED`), avisa sem tela de erro.
 */
export default function OcorrenciasPage() {
  const { isChecking, allowed } = useAreaGuard("FREELANCERS");
  const [tab, setTab] = useState<OccurrenceTab>("open");
  const [q, setQ] = useState("");
  const list = useOccurrences(tab, allowed);
  // O número da aba "Para decidir" vem de qualquer aba (a API manda `openCount` sempre).
  const openCount = list.data?.openCount ?? null;

  const shown = useMemo(
    () => (list.data?.items ?? []).filter((item) => matchesQuery(item, q)),
    [list.data, q],
  );

  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }

  const disabled = list.isError && isOccurrencesDisabled(list.error);
  const since = list.data?.since ?? null;
  const header = (
    <PageHeader
      title="Ocorrências"
      description={headerDescription(since)}
      action={
        disabled ? undefined : (
          <Button variant="outline" size="sm" onClick={() => list.refetch()} disabled={list.isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${list.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        )
      }
    />
  );

  if (disabled) {
    return (
      <div>
        {header}
        <p className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">{DISABLED_TEXT}</p>
      </div>
    );
  }

  const decidedColumn = tab !== "open";

  return (
    <div>
      {header}

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <ChoicePills
            aria-label="Abas"
            options={TABS.map((t) => ({ value: t, label: tabLabel(t, openCount) }))}
            value={tab}
            onChange={setTab}
          />
          <p className="mt-1.5 text-xs text-[#737373]">{openCountHint(since)}</p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#737373] sm:w-72">
          Buscar
          <Input
            type="search"
            value={q}
            placeholder="Nome, telefone, empresa ou cidade"
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      {list.isLoading ? (
        <div className="space-y-2" aria-label="Carregando as ocorrências">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : list.isError ? (
        <div className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">
          <p>{LIST_ERROR_TEXT}</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => list.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : !since ? (
        <p className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">{NO_SINCE_TEXT}</p>
      ) : shown.length === 0 ? (
        <div className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">
          <p>{emptyText(tab, Boolean(q.trim()))}</p>
          {q.trim() && (
            <Button className="mt-3" size="sm" variant="outline" onClick={() => setQ("")}>
              Limpar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Celular: um cartão por caso. */}
          <ul className="space-y-2 md:hidden">
            {shown.map((item) => (
              <li key={item.infractionId} className="rounded-lg border border-[#e5e5e5] p-3 text-sm">
                <p className="font-semibold text-[#1d1d1b]">{item.person.name ?? item.person.email ?? "—"}</p>
                <p className="text-[#1d1d1b]">{vacancyLine(item)}</p>
                {placeLine(item) && <p className="text-xs text-[#737373]">{placeLine(item)}</p>}
                <p className="mt-1 text-xs text-[#737373]">{appliedLabel(item)}</p>
                <p className="text-xs text-[#737373]">{contestLabel(item)}</p>
                {decidedColumn && <p className="text-xs text-[#737373]">{decisionShort(item)}</p>}
                <Link
                  href={`/ocorrencias/${item.infractionId}`}
                  className="mt-2 inline-block text-sm font-semibold text-[#b9770e] underline"
                >
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border border-[#e5e5e5] md:block">
            <table className="w-full min-w-[760px]">
              <thead className="bg-[#fafafa]">
                <tr>
                  <th className={TH}>Freelancer</th>
                  <th className={TH}>Vaga</th>
                  <th className={TH}>Registrada em</th>
                  <th className={TH}>O que o sistema aplicou</th>
                  <th className={TH}>Contestação</th>
                  {decidedColumn && <th className={TH}>Decisão</th>}
                  <th className={TH}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => (
                  <tr key={item.infractionId} className="border-t border-[#f0f0f0]">
                    <td className={TD}>
                      <p className="font-medium">{item.person.name ?? item.person.email ?? "—"}</p>
                      <p className="text-xs text-[#737373]">{item.person.phone ?? item.person.email ?? ""}</p>
                    </td>
                    <td className={TD}>
                      <p>{vacancyLine(item)}</p>
                      {placeLine(item) && <p className="text-xs text-[#737373]">{placeLine(item)}</p>}
                    </td>
                    <td className={TD}>{dayLabel(item.createdAt)}</td>
                    <td className={TD}>{appliedLabel(item)}</td>
                    <td className={TD}>
                      {item.needsContestAnswer ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          {contestLabel(item)}
                        </span>
                      ) : (
                        contestLabel(item)
                      )}
                    </td>
                    {decidedColumn && <td className={TD}>{decisionShort(item)}</td>}
                    <td className={TD}>
                      <Link
                        href={`/ocorrencias/${item.infractionId}`}
                        className="text-sm font-semibold text-[#b9770e] underline"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

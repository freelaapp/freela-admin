"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Scale } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { useSuspensions } from "@/modules/admin/application/use-suspensions";
import {
  DEFAULT_FILTERS,
  DISABLED_TEXT,
  ERROR_TEXT,
  LIMIT_LEGEND,
  LIMIT_REACHED_TEXT,
  LIST_LIMIT,
  ORDER_OPTIONS,
  PERIOD_OPTIONS,
  REASON_GROUP_OPTIONS,
  SITUATION_OPTIONS,
  apiFilterOf,
  applySuspensionFilters,
  canKeepOccurrence,
  canRegisterConversation,
  clearFilters,
  contestReasonLabel,
  conversationLabel,
  conversationOverdueLabel,
  countText,
  dayLabel,
  emptyText,
  hasActiveFilters,
  isActive,
  isPenaltyLadderDisabled,
  originLabel,
  reasonLabel,
  returnLabel,
  stateLabel,
  suspensionIdFromSearch,
  type SuspensionFilters,
  type SuspensionOrder,
  type SuspensionPeriod,
  type SuspensionReasonGroup,
  type SuspensionSituation,
} from "@/modules/admin/application/suspensions-presentation";
import type { SuspensionItem } from "@/modules/admin/infrastructure/suspensions-api";
import {
  KeepOccurrenceDialog,
  LiftSuspensionDialog,
  RegisterConversationDialog,
  SuspendDialog,
} from "./_components/suspension-dialogs";
import { SuspensionDetailPanel } from "./_components/suspension-detail";

type DialogState =
  | { kind: "lift" | "conversation" | "keep"; item: SuspensionItem }
  | { kind: "suspend" }
  | null;

const TH = "px-3 py-2 text-left text-xs font-semibold text-[#737373]";
const TD = "px-3 py-3 align-top text-sm text-[#1d1d1b]";
const FILTER_LABEL = "flex flex-col gap-1 text-xs font-semibold text-[#737373]";

/** Grava (ou tira) o `?s=<id>` do detalhe sem navegar (como o `/jobs` faz com `?vaga=`). */
function writeDetailParam(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("s", id);
  else url.searchParams.delete("s");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

/**
 * Suspensões (fluxo de vagas v2, fatia G; designer, lote 2 §5.5): quem não pode se candidatar,
 * até quando e por quê; registrar a conversa, levantar (motivo obrigatório) e suspender. Com a
 * chave da API desligada (404 `FEATURE_DISABLED`, a chave só liga depois do jurídico), avisa que
 * as consequências novas ainda não estão ligadas, sem tela de erro.
 *
 * D5, fatia A1 (18/11): filtros (situação, busca, começou em, motivo), ordem, contador e o
 * detalhe em painel lateral (`?s=<id>`), tudo no navegador sobre as até 100 linhas que a API
 * manda. O pedido à API não muda (`filter=active|all`, sem `limit`).
 */
export default function SuspensoesPage() {
  const { isChecking, allowed } = useAreaGuard("FREELANCERS");
  const [filters, setFilters] = useState<SuspensionFilters>(DEFAULT_FILTERS);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const list = useSuspensions(apiFilterOf(filters.situation), allowed);

  // `?s=<id>` lido de `window.location` (e não de `useSearchParams`, que pediria um <Suspense>).
  useEffect(() => {
    setDetailId(suspensionIdFromSearch(window.location.search));
  }, []);

  const loaded = list.data?.items;
  const shown = useMemo(
    () => applySuspensionFilters(loaded ?? [], filters, new Date()),
    [loaded, filters],
  );

  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }

  const disabled = list.isError && isPenaltyLadderDisabled(list.error);
  const header = (
    <PageHeader
      title="Suspensões"
      description="Quem não pode se candidatar agora, até quando e por quê."
      action={
        disabled ? undefined : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => list.refetch()} disabled={list.isFetching}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${list.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDialog({ kind: "suspend" })}>
              Suspender
            </Button>
          </div>
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

  const data = list.data;
  const items = data?.items ?? [];
  const filtered = hasActiveFilters(filters);
  const set = <K extends keyof SuspensionFilters>(key: K, value: SuspensionFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const openDetail = (id: string) => {
    setDetailId(id);
    writeDetailParam(id);
  };
  const closeDetail = () => {
    setDetailId(null);
    writeDetailParam(null);
  };
  const detailItem = detailId ? (items.find((i) => i.id === detailId) ?? null) : null;

  return (
    <div>
      {header}

      {data?.legalNotice && (
        <p
          role="note"
          className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
        >
          <Scale className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{data.legalNotice}</span>
        </p>
      )}

      <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className={FILTER_LABEL}>
          Situação
          <NativeSelect
            value={filters.situation}
            onChange={(e) => set("situation", e.target.value as SuspensionSituation)}
          >
            {SITUATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className={FILTER_LABEL}>
          Buscar
          <Input
            type="search"
            value={filters.q}
            placeholder="Nome, telefone ou e-mail"
            onChange={(e) => set("q", e.target.value)}
          />
        </label>
        <label className={FILTER_LABEL}>
          Começou em
          <NativeSelect
            value={filters.period}
            onChange={(e) => set("period", e.target.value as SuspensionPeriod)}
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className={FILTER_LABEL}>
          Motivo
          <NativeSelect
            value={filters.reason}
            onChange={(e) => set("reason", e.target.value as SuspensionReasonGroup)}
          >
            {REASON_GROUP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className={FILTER_LABEL}>
          Ordem
          <NativeSelect
            value={filters.order}
            onChange={(e) => set("order", e.target.value as SuspensionOrder)}
          >
            {ORDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>

      {data && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#737373]">
          <span className="font-semibold text-[#1d1d1b]">{countText(shown.length, items.length)}</span>
          {filtered && (
            <button
              type="button"
              onClick={() => setFilters(clearFilters(filters))}
              className="font-semibold text-[#b07a10] underline-offset-2 hover:underline"
            >
              Limpar filtros
            </button>
          )}
          <span className="w-full">{LIMIT_LEGEND}</span>
          {items.length >= LIST_LIMIT && (
            <span className="w-full font-semibold text-amber-800">{LIMIT_REACHED_TEXT}</span>
          )}
        </div>
      )}

      {list.isLoading && (
        <div className="grid gap-3" aria-label="Carregando as suspensões" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" data-testid="suspension-skeleton" />
          ))}
        </div>
      )}

      {list.isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{ERROR_TEXT}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => list.refetch()}>
            Tentar de novo
          </Button>
        </div>
      )}

      {data && shown.length === 0 && (
        <div className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">
          <p>{emptyText(filters.situation, items.length)}</p>
          {filtered && items.length > 0 && (
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setFilters(clearFilters(filters))}>
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {data && shown.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#e5e5e5] bg-white">
          <table className="w-full min-w-[960px] border-collapse">
            <thead className="border-b border-[#e5e5e5] bg-[#fafafa]">
              <tr>
                <th scope="col" className={TH}>Pessoa</th>
                <th scope="col" className={TH}>Motivo</th>
                <th scope="col" className={TH}>Início</th>
                <th scope="col" className={TH}>Volta em</th>
                <th scope="col" className={TH}>Conversa</th>
                <th scope="col" className={TH}>Origem (ocorrência)</th>
                <th scope="col" className={TH}>Situação</th>
                <th scope="col" className={TH}>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr
                  key={item.id}
                  className={`border-b border-[#f0f0f0] last:border-0 ${detailId === item.id ? "bg-amber-50/60" : ""}`}
                >
                  <td className={TD}>
                    <p className="font-semibold">{item.person.name ?? "Sem nome"}</p>
                    <p className="text-xs text-[#737373]">{item.person.phone ?? item.person.email ?? ""}</p>
                  </td>
                  <td className={TD}>{reasonLabel(item)}</td>
                  <td className={TD}>{dayLabel(item.startsAt)}</td>
                  <td className={TD}>{returnLabel(item)}</td>
                  <td className={TD}>
                    <p>{conversationLabel(item)}</p>
                    {conversationOverdueLabel(item) && (
                      <span className="mt-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                        {conversationOverdueLabel(item)}
                      </span>
                    )}
                  </td>
                  <td className={TD}>
                    <p>{originLabel(item)}</p>
                    {item.source?.status === "CONTESTED" && item.source.justification && (
                      <p className="mt-1 text-xs text-[#737373]">
                        {contestReasonLabel(item.source.contestReason)
                          ? `${contestReasonLabel(item.source.contestReason)}: `
                          : ""}
                        “{item.source.justification}”
                      </p>
                    )}
                  </td>
                  <td className={TD}>{stateLabel(item)}</td>
                  <td className={TD}>
                    <div className="flex flex-col items-start gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openDetail(item.id)}
                        aria-label={`Ver detalhe de ${item.person.name ?? "Sem nome"}`}
                      >
                        Ver detalhe
                      </Button>
                      {isActive(item) && canRegisterConversation(item) && (
                        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "conversation", item })}>
                          Registrar conversa
                        </Button>
                      )}
                      {isActive(item) && canKeepOccurrence(item) && (
                        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "keep", item })}>
                          Manter a ocorrência
                        </Button>
                      )}
                      {isActive(item) && (
                        <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "lift", item })}>
                          Levantar suspensão
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailId && data && (
        <SuspensionDetailPanel
          item={detailItem}
          notFound={!detailItem}
          canSearchAll={apiFilterOf(filters.situation) === "active"}
          onSearchAll={() => set("situation", "all")}
          onClose={closeDetail}
          onAction={(kind, item) => setDialog({ kind, item })}
        />
      )}

      {dialog?.kind === "lift" && <LiftSuspensionDialog item={dialog.item} onClose={() => setDialog(null)} />}
      {dialog?.kind === "conversation" && (
        <RegisterConversationDialog item={dialog.item} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "keep" && <KeepOccurrenceDialog item={dialog.item} onClose={() => setDialog(null)} />}
      {dialog?.kind === "suspend" && <SuspendDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

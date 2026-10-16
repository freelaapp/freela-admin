"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FileClock,
  HandCoins,
  Hourglass,
  Info,
  Lock,
  X,
} from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  dayLabel,
  formatBrl,
  lastMessageLines,
  periodLabel,
  SITUATION_CHIPS,
  tableCaption,
} from "@/modules/admin/application/invoice-presentation";
import {
  advancedCompositionCalc,
  advancedSlices,
} from "@/modules/admin/application/held-repasses-presentation";
import {
  useAdminInvoices,
  useBillingCompanies,
  useBillingSummary,
} from "@/modules/admin/application/use-admin-billing";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import {
  advancedBreakdownOf,
  heldSummaryCardOf,
} from "@/modules/admin/infrastructure/held-repasses-api";
import type {
  AdminInvoiceListItem,
  AdminInvoiceSituationCode,
  BillingSummary,
  SummaryCard,
} from "@/modules/admin/infrastructure/billing-api";
import type { BillingMode } from "@/modules/admin/infrastructure/billing-mode-api";
import type { InvoiceCompanyFilter } from "./billing-companies-view";
import { InvoiceSituationBadge } from "./invoice-situation-badge";

/** Situações em aberto: a API ordena pelo vencimento (a mais atrasada primeiro). */
const OPEN_SITUATIONS: AdminInvoiceSituationCode[] = ["A_VENCER", "VENCE_HOJE", "VENCIDA", "BLOQUEADA"];

const CYCLES: Array<{ value: BillingMode | ""; label: string }> = [
  { value: "", label: "Todos" },
  { value: "INVOICED_7", label: "Semanal" },
  { value: "INVOICED_15", label: "Quinzenal" },
  { value: "INVOICED_30", label: "Mensal" },
];

/** Os seis cards fixos; o `held` (API #603) é opcional e entra à parte. */
type CardKey = Exclude<keyof BillingSummary["cards"], "held">;

/** O que é o número da coluna Total, e de onde vem. */
const TOTAL_HELP = "Total da fatura = débitos − créditos. Fonte: a fatura fechada.";

/** Ordem e ícone dos seis cards do topo (UX 7.3). */
const CARDS: Array<{ key: CardKey; icon: React.ElementType; iconColor: string; money: boolean }> = [
  { key: "upcoming", icon: CalendarClock, iconColor: "text-[#eca826]", money: true },
  { key: "overdue", icon: AlertTriangle, iconColor: "text-[#b91c1c]", money: true },
  // Contagem de empresas; o valor em dinheiro vai na `meta`.
  { key: "blockedCompanies", icon: Lock, iconColor: "text-[#b91c1c]", money: false },
  { key: "received", icon: Banknote, iconColor: "text-[#15803d]", money: true },
  { key: "unbilled", icon: FileClock, iconColor: "text-[#737373]", money: true },
  { key: "advanced", icon: HandCoins, iconColor: "text-[#b45309]", money: true },
];

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * Aba "Faturas" do Financeiro (UX 7.3–7.4, Fase 3). Indicadores com a conta e a
 * fonte de cada número, filtros (situação, ciclo, empresa, fechamento) e a
 * lista paginada no servidor. O detalhe é uma página própria.
 *
 * `company` vem do "Ver faturas" da aba Empresas faturadas: o filtro mora na
 * página (trocar de aba desmonta esta), e o chip "Empresa: X" o desfaz.
 */
export function InvoicesView({
  company = null,
  onClearCompany,
  onSeeHeld,
}: {
  company?: InvoiceCompanyFilter | null;
  onClearCompany?: () => void;
  /** "Ver lista" do card "Retido aguardando a fatura": abre a aba Pagamentos aos freelancers. */
  onSeeHeld?: () => void;
} = {}) {
  const baseId = useId();
  const [situation, setSituation] = useState<AdminInvoiceSituationCode | null>(null);
  const [mode, setMode] = useState<BillingMode | "">("");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim(), 300);
  const [closedFrom, setClosedFrom] = useState("");
  const [closedTo, setClosedTo] = useState("");
  const [page, setPage] = useState(1);

  const summary = useBillingSummary();
  const list = useAdminInvoices({
    situation: situation ?? undefined,
    contractorUserId: company?.contractorUserId,
    mode: mode || undefined,
    search: search || undefined,
    closedFrom: closedFrom || undefined,
    closedTo: closedTo || undefined,
    page,
  });
  const filtersActive = !!(situation || mode || search || closedFrom || closedTo || company);
  const emptyTotal = !filtersActive && list.data && !list.isPlaceholderData && list.data.total === 0;
  // Só para o texto da lista vazia (há empresa no faturado, mas nenhuma fatura
  // fechada ainda): a lista das empresas só é lida quando a de faturas vem vazia.
  const companies = useBillingCompanies({ enabled: !!emptyTotal });

  // Rota fora do ar (rollback da API-3e): aviso calmo, não erro (runbook).
  const unavailable = [list.error, summary.error].some((e) => apiErrorOf(e).status === 404);
  if (unavailable) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#737373]" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold text-[#1d1d1b]">
            As faturas ainda não estão disponíveis neste ambiente.
          </p>
          <p className="text-[#525252]">
            O faturamento pós-pago ainda não foi ligado na API. Quando estiver no ar, as faturas das
            empresas faturadas aparecem aqui.
          </p>
        </div>
      </div>
    );
  }

  const clearFilters = () => {
    onClearCompany?.();
    setSituation(null);
    setMode("");
    setSearchInput("");
    setClosedFrom("");
    setClosedTo("");
    setPage(1);
  };
  const changeFilter = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  /** A contagem do chip e de onde ela vem (regra: todo número com a conta e a fonte). */
  const countFor = (
    code: AdminInvoiceSituationCode | null,
  ): { value: number; source: string } | null => {
    if (code === situation && list.data && !list.isPlaceholderData) {
      return {
        value: list.data.total,
        source: `${list.data.total} = faturas na lista com os filtros de agora.`,
      };
    }
    if (code === "VENCIDA" && summary.data) {
      const value = summary.data.cards.overdue.count;
      return {
        value,
        source: `${value} = faturas vencidas. Fonte: indicador Vencido (emitidas, não pagas, vencimento antes de hoje).`,
      };
    }
    return null;
  };

  const isOpenFilter = !!situation && OPEN_SITUATIONS.includes(situation);
  const caption =
    tableCaption(situation) +
    (situation === "VENCIDA" || situation === "BLOQUEADA"
      ? ", a mais atrasada primeiro"
      : isOpenFilter
        ? ", pelo vencimento"
        : "");

  const columns: Column<AdminInvoiceListItem>[] = [
    {
      header: "Fatura",
      mobile: "title",
      accessor: (row) => (
        <div className="min-w-0">
          <Link
            href={`/financeiro/faturas/${encodeURIComponent(row.id)}`}
            className="font-semibold text-[#1d1d1b] underline-offset-2 hover:text-[#eca826] hover:underline"
          >
            {row.number}
          </Link>
          <p className="text-xs text-[#737373]">{periodLabel(row.periodStart, row.periodEnd)}</p>
        </div>
      ),
    },
    {
      header: "Empresa",
      accessor: (row) => (
        <div className="min-w-0">
          <p className="text-[#1d1d1b]">{row.company.name ?? "Sem nome"}</p>
          <p className="text-xs text-[#737373]">{row.modeLabel}</p>
        </div>
      ),
    },
    {
      header: "Total",
      headerTitle: TOTAL_HELP,
      accessor: (row) => (
        <span className="font-medium" title={TOTAL_HELP}>
          {row.total}
        </span>
      ),
    },
    {
      header: "Vence",
      accessor: (row) => dayLabel(row.dueDate),
      ariaSort: isOpenFilter ? "ascending" : undefined,
    },
    { header: "Situação", accessor: (row) => <InvoiceSituationBadge situation={row.situation} /> },
    {
      header: "Última mensagem",
      className: "hidden lg:table-cell",
      mobile: "hide",
      accessor: (row) => {
        const lines = lastMessageLines(row.lastMessage);
        return (
          <div className="min-w-0 text-xs">
            <p className="text-[#1d1d1b]">{lines.head}</p>
            {lines.channels && <p className="text-[#737373]">{lines.channels}</p>}
          </div>
        );
      },
    },
  ];

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;
  const hasInvoicedCompanies = (companies.data?.items.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {summary.data?.doublePayments.count ? <DoublePaymentAlert summary={summary.data} /> : null}

      <SummaryCards summary={summary} onSeeHeld={onSeeHeld} />

      <div role="group" aria-label="Situação" className="flex flex-wrap gap-1.5">
        {SITUATION_CHIPS.map(({ code, label }) => {
          const active = situation === code;
          const count = countFor(code);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              // "Vencidas, 1": a contagem faz parte do nome lido pelo leitor de tela.
              aria-label={count !== null ? `${label}, ${count.value}` : label}
              title={count?.source}
              onClick={() => changeFilter(setSituation)(code)}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-[#1d1d1b] text-white"
                  : "bg-[#f7f7f7] text-[#525252] hover:text-[#1d1d1b]",
              )}
            >
              {label}
              {count !== null && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 text-[11px]",
                    active ? "bg-white/20" : "bg-white text-[#1d1d1b]",
                  )}
                >
                  {count.value}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {list.isLoading || (emptyTotal && companies.isLoading) ? (
        <TableSkeleton />
      ) : list.isError ? (
        <div className="rounded-xl border border-[#e5e5e5] p-4 text-sm text-[#1d1d1b]">
          <p>Não conseguimos carregar as faturas.</p>
          <Button variant="outline" size="sm" onClick={() => list.refetch()} className="mt-3">
            Tentar de novo
          </Button>
        </div>
      ) : emptyTotal ? (
        <div className="rounded-xl border border-dashed border-[#e5e5e5] p-6 text-center text-sm text-[#525252]">
          {hasInvoicedCompanies
            ? "Nenhuma fatura fechada ainda. A primeira fecha às 08:00 do dia do fechamento (semanal: sexta) com os serviços realizados e confirmados até a véspera. As empresas no faturado estão em 'Empresas faturadas'."
            : "Nenhuma empresa no faturado ainda. Ligue em Empresas > Documentos e cobrança."}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={list.data?.items ?? []}
          caption={caption}
          isFetching={list.isFetching}
          searchPlaceholder="Buscar empresa (nome ou CNPJ)"
          controlledSearch={{
            value: searchInput,
            onChange: (value) => {
              setSearchInput(value);
              setPage(1);
            },
          }}
          emptyMessage={
            <div className="space-y-2">
              <p>
                {company && !(situation || mode || search || closedFrom || closedTo)
                  ? `Nenhuma fatura fechada para ${company.name} ainda. A primeira sai no fechamento que tiver serviço realizado e confirmado (veja o próximo em 'Empresas faturadas').`
                  : "Nenhuma fatura nesta situação."}
              </p>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          }
          filters={
            <div className="flex flex-wrap items-end gap-2">
              {company && (
                <button
                  type="button"
                  onClick={() => {
                    onClearCompany?.();
                    setPage(1);
                  }}
                  aria-label={`Tirar o filtro da empresa ${company.name}`}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#eca826]/10 px-3 text-xs font-medium text-[#b07708] hover:bg-[#eca826]/20"
                >
                  {`Empresa: ${company.name}`}
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              <div className="flex flex-col gap-1">
                <label htmlFor={`${baseId}-mode`} className="text-xs font-medium text-[#737373]">
                  Ciclo
                </label>
                <NativeSelect
                  id={`${baseId}-mode`}
                  value={mode}
                  onChange={(e) => changeFilter(setMode)(e.target.value as BillingMode | "")}
                  className="h-9 py-1.5"
                >
                  {CYCLES.map((cycle) => (
                    <option key={cycle.value} value={cycle.value}>
                      {cycle.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${baseId}-from`} className="text-xs font-medium text-[#737373]">
                  Fechamento de
                </label>
                <input
                  id={`${baseId}-from`}
                  type="date"
                  value={closedFrom}
                  max={closedTo || undefined}
                  onChange={(e) => changeFilter(setClosedFrom)(e.target.value)}
                  className="h-9 rounded-lg bg-[#f7f7f7] px-3 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor={`${baseId}-to`} className="text-xs font-medium text-[#737373]">
                  Fechamento até
                </label>
                <input
                  id={`${baseId}-to`}
                  type="date"
                  value={closedTo}
                  min={closedFrom || undefined}
                  onChange={(e) => changeFilter(setClosedTo)(e.target.value)}
                  className="h-9 rounded-lg bg-[#f7f7f7] px-3 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
                />
              </div>
            </div>
          }
          footer={
            list.data && list.data.total > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#737373]">
                <span>{`Página ${list.data.page} de ${totalPages} · ${list.data.total} ${
                  list.data.total === 1 ? "fatura" : "faturas"
                }`}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Página anterior"
                    disabled={page <= 1 || list.isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Próxima página"
                    disabled={!list.data.hasMore || list.isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function SummaryCards({
  summary,
  onSeeHeld,
}: {
  summary: ReturnType<typeof useBillingSummary>;
  onSeeHeld?: () => void;
}) {
  if (summary.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando">
        {CARDS.map(({ key }) => (
          <Skeleton key={key} className="h-28 w-full" />
        ))}
      </div>
    );
  }
  if (summary.isError || !summary.data) {
    return (
      <div className="rounded-xl border border-[#e5e5e5] p-4 text-sm text-[#1d1d1b]">
        <p>Não conseguimos carregar os indicadores das faturas.</p>
        <Button variant="outline" size="sm" onClick={() => summary.refetch()} className="mt-3">
          Tentar de novo
        </Button>
      </div>
    );
  }
  const data = summary.data;
  // ADR-017 (API #603), aditivos: a composição do "Adiantado" e o card dos
  // retidos. Ausentes (API de antes) → o card fica como era e o novo não aparece.
  const breakdown = advancedBreakdownOf(data.cards.advanced.breakdown);
  const held = heldSummaryCardOf(data.cards.held);
  return (
    <section aria-label="Indicadores das faturas" className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.map(({ key, icon, iconColor, money }) => {
          const card: SummaryCard = data.cards[key];
          const composition = key === "advanced" && breakdown ? breakdown : null;
          return (
            <div key={key} data-testid={`kpi-${key}`}>
              <KpiCard
                className="h-full"
                title={card.label}
                value={money ? formatBrl(card.valueInCents) : String(card.count)}
                icon={icon}
                iconColor={iconColor}
                meta={card.meta}
                help={card.help}
                breakdown={composition ? advancedSlices(composition) : undefined}
                details={{
                  calc: composition
                    ? `${card.calc}. Por motivo de ter saído antes da fatura: ${advancedCompositionCalc(composition)}`
                    : card.calc,
                  source: card.source,
                }}
              />
            </div>
          );
        })}
        {held && (
          <div data-testid="kpi-held" className="flex flex-col gap-2">
            <KpiCard
              className="h-full"
              title={held.label}
              value={formatBrl(held.valueInCents)}
              icon={Hourglass}
              iconColor="text-[#0369a1]"
              meta={held.meta}
              help={held.help}
              details={{ calc: held.calc, source: held.source }}
            />
            {onSeeHeld && (
              <Button variant="outline" size="sm" onClick={onSeeHeld} className="self-start">
                Ver lista
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="rounded-lg bg-[#f7f7f7] px-3 py-2 text-sm">
        <p className="font-medium text-[#1d1d1b]">{`${data.receivableTotal.label} = ${data.receivableTotal.calc}.`}</p>
        <p className="text-xs text-[#737373]">{`Fonte: ${data.receivableTotal.source}`}</p>
      </div>
    </section>
  );
}

function DoublePaymentAlert({ summary }: { summary: BillingSummary }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#b91c1c]"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">{summary.doublePayments.text}</p>
        <details className="text-xs">
          <summary className="cursor-pointer select-none font-medium">Ver a conta</summary>
          <p className="mt-1">{`Conta: ${summary.doublePayments.calc}`}</p>
          <p className="mt-0.5">{`Fonte: ${summary.doublePayments.source}`}</p>
        </details>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {summary.doublePayments.latest.map((item) => (
            <Link
              key={item.invoiceId}
              href={`/financeiro/faturas/${encodeURIComponent(item.invoiceId)}`}
              className="font-semibold underline underline-offset-2"
            >
              {`Ver ${item.number}`}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border border-[#e5e5e5] p-4" aria-busy="true" aria-label="Carregando">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

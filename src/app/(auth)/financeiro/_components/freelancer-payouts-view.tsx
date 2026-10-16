"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  Hourglass,
  Info,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInstantDate } from "@/lib/date.utils";
import { cn } from "@/lib/utils";
import {
  chipCountSource,
  deadlineDistance,
  heldCardsOf,
  heldSituationText,
  HELD_SITUATION_CHIPS,
  paidByFreelaCardOf,
  releaseAvailability,
  TONE_CLASS,
  type CardText,
} from "@/modules/admin/application/held-repasses-presentation";
import { dayLabel, formatBrl, instantWithWeekday } from "@/modules/admin/application/invoice-presentation";
import { repasseStatusBadge } from "@/modules/admin/application/repasse-status-presentation";
import { useAdminRepasses } from "@/modules/admin/application/use-admin-repasses";
import { useBillingSummary } from "@/modules/admin/application/use-admin-billing";
import { useHeldRepasses } from "@/modules/admin/application/use-held-repasses";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import type { RepasseItem } from "@/modules/admin/infrastructure/admin-api";
import {
  advancedBreakdownOf,
  type HeldRepasseItem,
  type HeldSituationFilter,
} from "@/modules/admin/infrastructure/held-repasses-api";
import { ReleasePayoutDialog } from "./release-payout-dialog";

/** A lista é pequena (dezenas): uma página grande deixa a busca valer para todos. */
const PAGE_SIZE = 200;

type View = "held" | "all";

const CARD_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  held: { icon: Hourglass, color: "text-[#0369a1]" },
  due48h: { icon: CalendarClock, color: "text-[#b91c1c]" },
  paidByFreela: { icon: HandCoins, color: "text-[#b45309]" },
};

/**
 * Aba "Pagamentos aos freelancers" do Financeiro (ADR-017; UX 2026-10-15 §6).
 * Em empresa faturada, o freelancer recebe quando a empresa paga a fatura; até
 * lá o pagamento fica retido, e a Freela paga no teto se a empresa não pagar.
 *
 * - "Aguardando fatura": os cards e a lista dos retidos (API #603), do teto mais
 *   próximo para o mais longe, com o "Pagar agora". Antes do deploy da API a
 *   rota dá 404: aviso calmo, sem erro.
 * - "Todos os repasses": a lista de sempre (já no ar), com o status traduzido.
 */
export function FreelancerPayoutsView() {
  const [view, setView] = useState<View>("held");
  const [situation, setSituation] = useState<HeldSituationFilter>("all");
  const [page, setPage] = useState(1);
  const held = useHeldRepasses({ situation, page, pageSize: PAGE_SIZE });
  const summary = useBillingSummary();
  const unavailable = apiErrorOf(held.error).status === 404;
  const totals = held.data?.totals ?? null;

  const views: Array<{ key: View; label: string; count: number | null }> = [
    { key: "held", label: "Aguardando fatura", count: totals?.all.count ?? null },
    { key: "all", label: "Todos os repasses", count: null },
  ];

  return (
    <div className="space-y-6">
      {!unavailable && <PayoutCards held={held} summary={summary} />}

      <div role="group" aria-label="Pagamentos aos freelancers" className="flex flex-wrap gap-1.5">
        {views.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            aria-label={count !== null ? `${label}, ${count}` : label}
            onClick={() => setView(key)}
            className={cn(
              "inline-flex min-h-9 items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              view === key ? "bg-[#1d1d1b] text-white" : "bg-[#f7f7f7] text-[#525252] hover:text-[#1d1d1b]",
            )}
          >
            {label}
            {count !== null && (
              <span
                aria-hidden="true"
                className={cn(
                  "ml-1.5 rounded-full px-1.5 text-[11px]",
                  view === key ? "bg-white/20" : "bg-white text-[#1d1d1b]",
                )}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === "held" ? (
        unavailable ? (
          <UnavailableNotice />
        ) : (
          <HeldList
            held={held}
            situation={situation}
            onSituation={(next) => {
              setSituation(next);
              setPage(1);
            }}
            page={page}
            onPage={setPage}
          />
        )
      ) : (
        <AllRepassesList />
      )}
    </div>
  );
}

function UnavailableNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] p-4 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#737373]" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold text-[#1d1d1b]">
          Os pagamentos aguardando fatura ainda não estão disponíveis neste ambiente.
        </p>
        <p className="text-[#525252]">
          Quando a API com a regra &quot;o freelancer recebe quando a fatura é paga&quot; estiver no ar,
          eles aparecem aqui. A lista de todos os repasses continua em &quot;Todos os repasses&quot;.
        </p>
      </div>
    </div>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

function PayoutCards({
  held,
  summary,
}: {
  held: ReturnType<typeof useHeldRepasses>;
  summary: ReturnType<typeof useBillingSummary>;
}) {
  if (held.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Carregando">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }
  const cards: CardText[] = [];
  const totals = held.data?.totals;
  // "Agora" da conta das 48 h = quando a lista foi lida (a API usa o mesmo instante).
  if (totals) cards.push(...heldCardsOf(totals, new Date(held.dataUpdatedAt || Date.now())));
  const advanced = summary.data?.cards.advanced;
  const breakdown = advancedBreakdownOf(advanced?.breakdown);
  if (advanced && breakdown) cards.push(paidByFreelaCardOf(breakdown, advanced.source));
  // Campos novos ausentes (API de antes): os cards não aparecem.
  if (cards.length === 0) return null;
  return (
    <section aria-label="Indicadores dos pagamentos aos freelancers" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <div key={card.key} data-testid={`kpi-${card.key}`}>
          <KpiCard
            className="h-full"
            title={card.title}
            value={formatBrl(card.valueInCents)}
            icon={CARD_ICON[card.key]?.icon ?? Hourglass}
            iconColor={CARD_ICON[card.key]?.color}
            meta={card.meta}
            help={card.help}
            details={{ calc: card.calc, source: card.source }}
          />
        </div>
      ))}
    </section>
  );
}

// ─── Lista "Aguardando fatura" ───────────────────────────────────────────────

type HeldRow = HeldRepasseItem & { id: string; busca: string };

const VALUE_HELP = "O que o freelancer recebe (o valor retido). Fonte: o repasse retido da vaga.";
const EXPECTED_HELP =
  "Previsto = vencimento da fatura emitida; sem fatura, o vencimento previsto do período do serviço.";
const DEADLINE_HELP =
  "Garantido até = o teto: 00:00 do 4º dia depois do vencimento (ou o início do bloqueio da fatura, o que vier antes). Se a empresa não pagar até lá, a Freela paga.";

function HeldList({
  held,
  situation,
  onSituation,
  page,
  onPage,
}: {
  held: ReturnType<typeof useHeldRepasses>;
  situation: HeldSituationFilter;
  onSituation: (s: HeldSituationFilter) => void;
  page: number;
  onPage: (p: number) => void;
}) {
  const [releasing, setReleasing] = useState<HeldRepasseItem | null>(null);
  // Cada abertura remonta o diálogo: motivo limpo, sem erro antigo.
  const [opening, setOpening] = useState(0);
  const now = new Date();
  const totals = held.data?.totals ?? null;
  const rows: HeldRow[] = useMemo(
    () =>
      (held.data?.items ?? []).map((item) => ({
        ...item,
        id: item.repasseId,
        busca: [
          item.freelancer.name,
          item.company.name,
          item.invoice?.number,
          item.vacancyTitle,
          item.vacancyId,
        ]
          .filter(Boolean)
          .join(" "),
      })),
    [held.data],
  );

  if (held.isLoading) {
    return (
      <div className="space-y-2 rounded-xl border border-[#e5e5e5] p-4" aria-busy="true" aria-label="Carregando">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (held.isError && !held.data) {
    return (
      <div role="alert" className="rounded-xl border border-[#e5e5e5] p-4 text-sm text-[#1d1d1b]">
        <p>Não conseguimos carregar os pagamentos aos freelancers.</p>
        <Button variant="outline" size="sm" onClick={() => held.refetch()} className="mt-3">
          Tentar de novo
        </Button>
      </div>
    );
  }

  const chipLabel = HELD_SITUATION_CHIPS.find((c) => c.filter === situation)?.label ?? "Todas";
  const emptyTotal = situation === "all" && !held.isPlaceholderData && (held.data?.total ?? 0) === 0;
  const pageSum = rows.reduce((acc, row) => acc + row.amountInCents, 0);
  const total = held.data?.total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / (held.data?.pageSize ?? PAGE_SIZE)));

  const columns: Column<HeldRow>[] = [
    {
      header: "Freelancer",
      mobile: "title",
      accessor: (row) => (
        <div className="min-w-0">
          <p className="text-[#1d1d1b]">{row.freelancer.name ?? "Sem nome"}</p>
          {!row.freelancer.hasPixKey && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[#b91c1c]">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              sem chave Pix
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Serviço",
      accessor: (row) => (
        <div className="min-w-0 text-sm">
          <p className="text-[#1d1d1b]">
            {[row.vacancyTitle ?? "Serviço", row.serviceDate ? dayLabel(row.serviceDate) : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-xs text-[#737373]">{row.company.name ?? "Empresa sem nome"}</p>
          <p className="font-mono text-[10px] text-[#a3a3a3]">{`vaga #${row.vacancyId.slice(0, 8)}`}</p>
        </div>
      ),
    },
    {
      header: "Valor",
      headerTitle: VALUE_HELP,
      accessor: (row) => (
        <span className="whitespace-nowrap font-medium tabular-nums" title={VALUE_HELP}>
          {formatBrl(row.amountInCents)}
        </span>
      ),
    },
    {
      header: "Fatura",
      accessor: (row) => {
        const s = heldSituationText(row, now);
        return (
          <div className="min-w-0 text-sm">
            {row.invoice && (
              <Link
                href={`/financeiro/faturas/${encodeURIComponent(row.invoice.id)}`}
                className="font-medium text-[#1d1d1b] underline-offset-2 hover:text-[#eca826] hover:underline"
              >
                {row.invoice.number}
              </Link>
            )}
            <p className={cn("text-xs", TONE_CLASS[s.tone])}>{s.label}</p>
          </div>
        );
      },
    },
    {
      header: "Previsto",
      headerTitle: EXPECTED_HELP,
      accessor: (row) => <span className="whitespace-nowrap">{dayLabel(row.expectedDate)}</span>,
    },
    {
      header: "Garantido até",
      headerTitle: DEADLINE_HELP,
      ariaSort: "ascending",
      accessor: (row) => {
        const distance = deadlineDistance(row.effectiveDeadlineAt, now);
        return (
          <div className="min-w-0 text-sm">
            <p className="whitespace-nowrap text-[#1d1d1b]">{instantWithWeekday(row.effectiveDeadlineAt)}</p>
            <p className={cn("text-xs font-medium", TONE_CLASS[distance.tone])}>{distance.label}</p>
            {row.calc && (
              <details className="mt-0.5 text-xs text-[#525252]">
                <summary className="cursor-pointer select-none text-[#737373] hover:text-[#1d1d1b]">
                  Ver a conta
                </summary>
                <p className="mt-1">{`Conta: ${row.calc}`}</p>
                {row.source && <p className="mt-0.5">{`Fonte: ${row.source}`}</p>}
              </details>
            )}
          </div>
        );
      },
    },
    {
      header: "",
      mobile: "actions",
      accessor: (row) => {
        const availability = releaseAvailability(row);
        if (!availability.enabled) {
          return <p className="max-w-[16rem] text-xs text-[#737373]">{availability.reason}</p>;
        }
        return (
          <Button
            size="sm"
            aria-label={`Pagar agora ${formatBrl(row.amountInCents)} para ${row.freelancer.name ?? "o freelancer"}`}
            onClick={() => {
              setOpening((n) => n + 1);
              setReleasing(row);
            }}
            className="min-h-11 bg-[#eca826] text-white hover:bg-[#d4951e]"
          >
            Pagar agora
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Situação da fatura" className="flex flex-wrap gap-1.5">
        {HELD_SITUATION_CHIPS.map(({ filter, label, totalsKey }) => {
          const active = situation === filter;
          const part = totals ? totals[totalsKey] : null;
          return (
            <button
              key={filter}
              type="button"
              aria-pressed={active}
              aria-label={part ? `${label}, ${part.count}` : label}
              title={part ? chipCountSource(label, part) : undefined}
              onClick={() => onSituation(filter)}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                active ? "bg-[#1d1d1b] text-white" : "bg-[#f7f7f7] text-[#525252] hover:text-[#1d1d1b]",
              )}
            >
              {label}
              {part && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "ml-1.5 rounded-full px-1.5 text-[11px]",
                    active ? "bg-white/20" : "bg-white text-[#1d1d1b]",
                  )}
                >
                  {part.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {emptyTotal ? (
        <div className="rounded-xl border border-dashed border-[#e5e5e5] p-6 text-center text-sm text-[#525252]">
          Nenhum pagamento aguardando fatura agora. Com a regra &quot;o freelancer recebe quando a fatura é
          paga&quot; ligada, o pagamento do serviço de empresa faturada fica aqui do fim do serviço até a
          fatura ser paga (ou até o teto, quando a Freela paga).
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          caption={`Pagamentos aguardando fatura, do teto mais próximo · ${chipLabel}`}
          isFetching={held.isFetching}
          searchPlaceholder="Buscar nesta lista: freelancer, empresa, fatura ou vaga"
          searchKey="busca"
          emptyMessage={
            <div className="space-y-2">
              <p>Nenhum pagamento com este filtro.</p>
              {situation !== "all" && (
                <Button variant="outline" size="sm" onClick={() => onSituation("all")}>
                  Limpar filtro
                </Button>
              )}
            </div>
          }
          footer={
            rows.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#737373]">
                <span
                  title={`Soma dos valores das ${rows.length} linhas desta página. O total de todos os retidos está no card "Retido aguardando fatura".`}
                >
                  {`Mostrando ${rows.length} de ${total} · ${formatBrl(pageSum)} nesta página`}
                </span>
                {totalPages > 1 && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Página anterior"
                      disabled={page <= 1 || held.isFetching}
                      onClick={() => onPage(Math.max(1, page - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Próxima página"
                      disabled={!held.data?.hasMore || held.isFetching}
                      onClick={() => onPage(page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            ) : undefined
          }
        />
      )}

      {releasing && (
        <ReleasePayoutDialog key={opening} item={releasing} onClose={() => setReleasing(null)} />
      )}
    </div>
  );
}

// ─── "Todos os repasses" (lista de sempre) ───────────────────────────────────

type RepasseRow = RepasseItem & { busca: string; statusLabel: string };

/**
 * A lista de sempre (`GET /v1/bars-restaurants/admin/repasses`): ainda sem nome
 * nem vaga resolvidos na API, mas com o status traduzido (inclusive "Aguardando
 * a fatura" e "Em verificação"). Lê ao abrir e no "Atualizar".
 */
function AllRepassesList() {
  const { data, isLoading, isFetching, isError, refetch } = useAdminRepasses();
  const rows: RepasseRow[] = useMemo(
    () =>
      (data ?? []).map((r) => {
        const statusLabel = repasseStatusBadge(r.status).label;
        return { ...r, statusLabel, busca: `${r.providerGlobalId} ${r.vacancyId} ${statusLabel}` };
      }),
    [data],
  );

  if (isLoading && !data) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#eca826]" />
      </div>
    );
  }
  if (isError && !data) {
    return (
      <div role="alert" className="rounded-xl border border-[#e5e5e5] p-4 text-sm text-[#1d1d1b]">
        <p>Não conseguimos carregar os repasses.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
          Tentar de novo
        </Button>
      </div>
    );
  }

  const columns: Column<RepasseRow>[] = [
    {
      header: "Freelancer (id)",
      mobile: "title",
      accessor: (row) => <span className="font-mono text-xs">{row.providerGlobalId.slice(0, 12)}</span>,
    },
    {
      header: "Vaga",
      accessor: (row) => <span className="font-mono text-xs">{`#${row.vacancyId.slice(0, 8)}`}</span>,
    },
    {
      header: "Valor",
      accessor: (row) => <span className="whitespace-nowrap">{formatBrl(row.amountInCents)}</span>,
    },
    {
      header: "Data",
      className: "hidden md:table-cell",
      accessor: (row) => formatInstantDate(row.createdAt),
    },
    {
      header: "Status",
      accessor: (row) => {
        const badge = repasseStatusBadge(row.status);
        return (
          <span
            title={row.status}
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
          >
            {badge.label}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Buscar por id do freelancer, vaga ou status…"
      searchKey="busca"
      filters={
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RotateCcw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
          Atualizar
        </Button>
      }
      isFetching={isFetching}
    />
  );
}

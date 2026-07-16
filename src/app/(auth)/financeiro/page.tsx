"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import {
  DollarSign, TrendingDown, TrendingUp, RotateCcw,
  Loader2, Wallet, Landmark, PiggyBank, X,
} from "lucide-react";
import { useAdminPayments } from "@/modules/admin/application/use-admin-payments";
import { useAdminRepasses } from "@/modules/admin/application/use-admin-repasses";
import { useFinanceSummary, useFinanceTransactions } from "@/modules/admin/application/use-admin-finance";
import type {
  PaymentItem, RepasseItem, FinanceTransaction,
} from "@/modules/admin/infrastructure/admin-api";
import { formatInstantDate, formatVacancyTime } from "@/lib/date.utils";

const tabs = ["Visão Geral", "Transações", "Pagamentos", "Repasses", "Estornos & Cancelamentos"] as const;
type Tab = typeof tabs[number];

// Tabs que operam sobre o dashboard financeiro novo (com filtro de data).
const FINANCE_TABS: Tab[] = ["Visão Geral", "Transações", "Estornos & Cancelamentos"];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatCurrencyNullable(cents: number | null) {
  return cents === null ? "Indisponível" : formatCurrency(cents);
}

function formatInstant(iso: string) {
  return `${formatInstantDate(iso)} ${formatVacancyTime(iso)}`;
}

const formatDate = formatInstantDate;

// ─── Período (filtro de data) ────────────────────────────────────────────────

/** Formata um Date nos limites locais como YYYY-MM-DD (dia de Brasília do usuário). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Range = { from: string; to: string };

const PRESETS: { label: string; compute: () => Range }[] = [
  {
    label: "7 dias",
    compute: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { from: ymd(from), to: ymd(to) };
    },
  },
  {
    label: "30 dias",
    compute: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from: ymd(from), to: ymd(to) };
    },
  },
  {
    label: "Este mês",
    compute: () => {
      const now = new Date();
      return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: ymd(now) };
    },
  },
  { label: "Tudo", compute: () => ({ from: "", to: "" }) },
];

function DateRangeBar({
  range,
  onChange,
}: {
  range: Range;
  onChange: (r: Range) => void;
}) {
  const activePreset = PRESETS.find((p) => {
    const r = p.compute();
    return r.from === range.from && r.to === range.to;
  })?.label;

  return (
    <div className="flex flex-col lg:flex-row lg:items-end gap-3 mb-5">
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#737373]">De</span>
          <input
            type="date"
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => onChange({ ...range, from: e.target.value })}
            className="h-9 px-3 rounded-lg bg-[#f7f7f7] border-none text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#737373]">Até</span>
          <input
            type="date"
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => onChange({ ...range, to: e.target.value })}
            className="h-9 px-3 rounded-lg bg-[#f7f7f7] border-none text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => onChange(p.compute())}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              activePreset === p.label
                ? "bg-[#1d1d1b] text-white"
                : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Transações (fluxo unificado) ────────────────────────────────────────────

const KIND_LABELS: Record<string, string> = {
  charge: "Cobrança",
  repasse: "Repasse ao freelancer",
  bonus: "Bônus de avaliação",
  refund_admin_br: "Estorno · admin (bar/restaurante)",
  refund_admin_casa: "Estorno · admin (em casa)",
  refund_cancel: "Estorno · cancelamento",
};

function providerLabel(provider: string | null) {
  if (!provider) return "—";
  if (provider === "openpix") return "Woovi";
  if (provider === "asaas") return "Asaas";
  return provider;
}

function TypeBadge({ type }: { type: FinanceTransaction["type"] }) {
  const map = {
    entrada: { label: "Entrada", cls: "bg-green-500/10 text-green-600" },
    saida: { label: "Saída", cls: "bg-red-500/10 text-red-600" },
    estorno: { label: "Estorno", cls: "bg-[#eca826]/10 text-[#eca826]" },
  } as const;
  const { label, cls } = map[type];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

type TxRow = {
  id: string;
  data: string;
  descricao: string;
  gateway: string;
  busca: string;
  raw: FinanceTransaction;
};

function mapTxToRow(t: FinanceTransaction): TxRow {
  return {
    id: t.id,
    data: formatInstant(t.createdAt),
    descricao: KIND_LABELS[t.kind] ?? t.kind,
    gateway: providerLabel(t.provider),
    busca: `${t.vacancyId ?? ""} ${t.reference ?? ""} ${KIND_LABELS[t.kind] ?? t.kind}`.trim(),
    raw: t,
  };
}

const TX_TYPES: { label: string; value: FinanceTransaction["type"] | undefined }[] = [
  { label: "Todas", value: undefined },
  { label: "Entradas", value: "entrada" },
  { label: "Saídas", value: "saida" },
  { label: "Estornos", value: "estorno" },
];

function TransactionsView({
  range,
  fixedType,
  fixedVacancyId,
}: {
  range: Range;
  /** Quando definido, trava o filtro de tipo (ex.: aba Estornos). */
  fixedType?: FinanceTransaction["type"];
  fixedVacancyId?: string;
}) {
  const [type, setType] = useState<FinanceTransaction["type"] | undefined>(fixedType);
  const [vacancyId, setVacancyId] = useState(fixedVacancyId ?? "");

  const { data, isLoading, isFetching } = useFinanceTransactions({
    from: range.from,
    to: range.to,
    type: fixedType ?? type,
    vacancyId: vacancyId.trim() || undefined,
  });

  const rows = useMemo(() => (data?.items ?? []).map(mapTxToRow), [data]);

  // A lista traz TODAS as situações (inclusive cobrança pendente/expirada e
  // repasse falho — importante para operação), mas o rodapé soma só o que
  // LIQUIDOU, senão os totais estouram e contradizem a Visão Geral (que usa
  // COMPLETED/REFUNDED para entradas e COMPLETED/PAID para saídas).
  const totals = useMemo(() => {
    const settled = (it: FinanceTransaction) =>
      it.type === "entrada"
        ? it.status === "COMPLETED" || it.status === "REFUNDED"
        : it.type === "saida"
          ? it.status === "COMPLETED" || it.status === "PAID"
          : true; // estornos são registros de estorno já decididos
    const t = { entrada: 0, saida: 0, estorno: 0, foraDaSoma: 0 };
    for (const it of data?.items ?? []) {
      if (settled(it)) t[it.type] += it.amountInCents;
      else t.foraDaSoma += 1;
    }
    return t;
  }, [data]);

  const columns = [
    {
      header: "Data",
      accessor: "data" as const,
      className: "hidden md:table-cell whitespace-nowrap",
      sortable: true,
      sortAccessor: (r: TxRow) => r.raw.createdAt,
    },
    { header: "Tipo", accessor: (r: TxRow) => <TypeBadge type={r.raw.type} /> },
    { header: "Descrição", accessor: "descricao" as const },
    { header: "Gateway", accessor: "gateway" as const, className: "hidden lg:table-cell" },
    {
      header: "Vaga",
      accessor: (r: TxRow) =>
        r.raw.vacancyId ? (
          <button
            onClick={() => setVacancyId(r.raw.vacancyId!)}
            title="Filtrar o fluxo desta vaga"
            className="font-mono text-xs text-[#737373] hover:text-[#eca826] underline decoration-dotted"
          >
            {r.raw.vacancyId.slice(0, 8)}
          </button>
        ) : (
          <span className="text-[#a3a3a3]">—</span>
        ),
    },
    {
      header: "Valor",
      accessor: (r: TxRow) => {
        const sign = r.raw.type === "entrada" ? "+" : "−";
        const color =
          r.raw.type === "entrada"
            ? "text-green-600"
            : r.raw.type === "saida"
              ? "text-red-600"
              : "text-[#eca826]";
        return (
          <span className={`font-medium whitespace-nowrap ${color}`}>
            {sign} {formatCurrency(r.raw.amountInCents)}
          </span>
        );
      },
      sortable: true,
      sortAccessor: (r: TxRow) => r.raw.amountInCents,
    },
    {
      header: "Status",
      accessor: (r: TxRow) => {
        const s = TX_STATUS[r.raw.status] ?? {
          label: r.raw.status,
          cls: "bg-[#f7f7f7] text-[#737373]",
        };
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
            {s.label}
          </span>
        );
      },
    },
  ];

  const filters = (
    <div className="flex flex-wrap items-center gap-1.5">
      {!fixedType &&
        TX_TYPES.map((t) => (
          <button
            key={t.label}
            onClick={() => setType(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              type === t.value
                ? "bg-[#eca826] text-white"
                : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]"
            }`}
          >
            {t.label}
          </button>
        ))}
      {vacancyId && !fixedVacancyId && (
        <button
          onClick={() => setVacancyId("")}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#eca826]/10 text-[#eca826] hover:bg-[#eca826]/20"
        >
          <X className="w-3.5 h-3.5" /> Vaga {vacancyId.slice(0, 8)}
        </button>
      )}
    </div>
  );

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#eca826]" />
      </div>
    );
  }

  const footer = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-[#737373]">
      <span>{rows.length} transações{data?.truncated ? " (limitado a 1000)" : ""}</span>
      <span className="text-green-600 font-medium">Entradas liquidadas {formatCurrency(totals.entrada)}</span>
      <span className="text-red-600 font-medium">Saídas liquidadas {formatCurrency(totals.saida)}</span>
      <span className="text-[#eca826] font-medium">Estornos {formatCurrency(totals.estorno)}</span>
      {totals.foraDaSoma > 0 && (
        <span>
          {totals.foraDaSoma} não liquidada{totals.foraDaSoma > 1 ? "s" : ""} (pendente/expirada/falha) fora da soma
        </span>
      )}
    </div>
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Buscar por vaga, referência…"
      searchKey="busca"
      filters={filters}
      footer={footer}
      isFetching={isFetching}
      defaultSort={{ index: 0, direction: "desc" }}
    />
  );
}

// Tradução dos status crus da API. Nos ESTORNOS o campo status carrega o TIPO
// de estorno (FULL/PARTIAL_50/NONE) — rotulado de acordo.
const TX_STATUS: Record<string, { label: string; cls: string }> = {
  COMPLETED: { label: "Concluído", cls: "bg-green-50 text-green-700" },
  PAID: { label: "Pago", cls: "bg-green-50 text-green-700" },
  PENDING: { label: "Pendente", cls: "bg-amber-50 text-amber-700" },
  PROCESSING: { label: "Processando", cls: "bg-amber-50 text-amber-700" },
  FAILED: { label: "Falhou", cls: "bg-red-50 text-red-700" },
  EXPIRED: { label: "Expirado", cls: "bg-[#f7f7f7] text-[#737373]" },
  CANCELLED: { label: "Cancelado", cls: "bg-[#f7f7f7] text-[#737373]" },
  REFUNDED: { label: "Estornado", cls: "bg-[#eca826]/10 text-[#b07708]" },
  FULL: { label: "Estorno integral", cls: "bg-[#eca826]/10 text-[#b07708]" },
  PARTIAL_50: { label: "Estorno 50%", cls: "bg-[#eca826]/10 text-[#b07708]" },
  NONE: { label: "Sem estorno", cls: "bg-[#f7f7f7] text-[#737373]" },
};

// ─── Legado: Pagamentos / Repasses (endpoints antigos, sem filtro de data) ────

const LEGACY_PAYMENT_STATUS: Record<string, string> = {
  COMPLETED: "Pago",
  PENDING: "Pendente",
  REFUNDED: "Estornado",
  EXPIRED: "Expirado",
  FAILED: "Falhou",
};

function mapPaymentToRow(p: PaymentItem) {
  const hasBreakdown = (p.serviceAmountInCents ?? 0) > 0;
  return {
    id: p.id,
    freelancer: p.correlationId.slice(0, 12),
    valor: formatCurrency(p.value),
    valorServico: hasBreakdown ? formatCurrency(p.serviceAmountInCents) : "—",
    taxa: hasBreakdown ? formatCurrency(p.value - p.serviceAmountInCents) : "—",
    tipo: "Diária",
    data: formatDate(p.createdAt),
    status: LEGACY_PAYMENT_STATUS[p.status] ?? p.status,
    raw: p,
  };
}

function mapRepasseToRow(r: RepasseItem) {
  return {
    id: r.id,
    freelancer: r.providerGlobalId.slice(0, 12),
    valor: formatCurrency(r.amountInCents),
    tipo: "Repasse",
    data: formatDate(r.createdAt),
    status: r.status,
    raw: r,
  };
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const [tab, setTab] = useState<Tab>("Visão Geral");
  const [range, setRange] = useState<Range>({ from: "", to: "" });

  const { data: summary, isLoading: loadingSummary, isFetching: fetchingSummary } =
    useFinanceSummary({ from: range.from, to: range.to });
  const { data: payments, isLoading: loadingPayments } = useAdminPayments();
  const { data: repasses, isLoading: loadingRepasses } = useAdminRepasses();

  const paymentRows = payments?.map(mapPaymentToRow) ?? [];
  const repasseRows = repasses?.map(mapRepasseToRow) ?? [];

  const pagamentoColumns = [
    { header: "ID", accessor: "freelancer" as const },
    { header: "Valor do serviço", accessor: "valorServico" as const, className: "hidden lg:table-cell" },
    { header: "Taxa", accessor: "taxa" as const, className: "hidden lg:table-cell" },
    { header: "Valor", accessor: "valor" as const },
    { header: "Tipo", accessor: "tipo" as const, className: "hidden lg:table-cell" },
    { header: "Data", accessor: "data" as const, className: "hidden md:table-cell" },
    {
      header: "Status",
      accessor: (row: typeof paymentRows[0]) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          row.status === "Pago" ? "bg-green-500/10 text-green-500" : "bg-[#eca826]/10 text-[#eca826]"
        }`}>
          {row.status}
        </span>
      ),
    },
  ];

  const repasseColumns = [
    { header: "Provider", accessor: "freelancer" as const },
    { header: "Valor", accessor: "valor" as const },
    { header: "Data", accessor: "data" as const, className: "hidden md:table-cell" },
    {
      header: "Status",
      accessor: (row: typeof repasseRows[0]) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          row.status === "COMPLETED" ? "bg-green-500/10 text-green-500" : "bg-[#eca826]/10 text-[#eca826]"
        }`}>
          {row.status}
        </span>
      ),
    },
  ];

  const usesDateRange = FINANCE_TABS.includes(tab);
  const periodLabel =
    range.from || range.to
      ? `Período: ${range.from ? formatVacancyDateLabel(range.from) : "início"} → ${range.to ? formatVacancyDateLabel(range.to) : "hoje"}`
      : "Período: todo o histórico";

  return (
    <div>
      <PageHeader title="Financeiro" description="Saldo ao vivo, fluxo de caixa e transações por vaga" />

      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t ? "bg-[#eca826] text-white" : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {usesDateRange && <DateRangeBar range={range} onChange={setRange} />}

      {tab === "Visão Geral" && (
        <div className="space-y-6">
          {loadingSummary && !summary ? (
            <div className="flex items-center justify-center h-[40vh]">
              <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
            </div>
          ) : (
            <>
              {/* Saldo AO VIVO dos gateways */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-[#1d1d1b]">Saldo em conta</span>
                  <span className="inline-flex items-center gap-1 text-xs text-green-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> ao vivo
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <KpiCard
                    title="Saldo Woovi (OpenPix)"
                    value={formatCurrencyNullable(summary?.saldoWooviCents ?? null)}
                    icon={Wallet}
                  />
                  <KpiCard
                    title="Saldo Asaas"
                    value={formatCurrencyNullable(summary?.saldoAsaasCents ?? null)}
                    icon={Landmark}
                  />
                  <KpiCard
                    title="Saldo total"
                    value={formatCurrencyNullable(summary?.saldoTotalCents ?? null)}
                    icon={PiggyBank}
                  />
                </div>
              </div>

              {/* Fluxo no período */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-[#1d1d1b]">Fluxo no período</span>
                  <span className="text-xs text-[#737373]">{periodLabel}</span>
                  {fetchingSummary && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#eca826]" />}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KpiCard
                    title="Entradas"
                    value={formatCurrency(summary?.entradasCents ?? 0)}
                    icon={TrendingUp}
                    iconColor="text-green-600"
                    meta={`${summary?.entradasCount ?? 0} pagamentos`}
                  />
                  <KpiCard
                    title="Saídas (repasses + bônus)"
                    value={formatCurrency(summary?.saidasCents ?? 0)}
                    icon={TrendingDown}
                    iconColor="text-red-600"
                    meta={`${summary?.saidasCount ?? 0} transações`}
                  />
                  <KpiCard
                    title="Estornos"
                    value={formatCurrency(summary?.estornosCents ?? 0)}
                    icon={RotateCcw}
                    iconColor="text-[#eca826]"
                    meta={`${summary?.estornosCount ?? 0} cancelamentos`}
                  />
                  <KpiCard
                    title="Lucro (taxa da plataforma)"
                    value={formatCurrency(summary?.lucroCents ?? 0)}
                    icon={DollarSign}
                    iconColor={(summary?.lucroCents ?? 0) >= 0 ? "text-green-600" : "text-red-600"}
                    meta={`taxa − gateway (${formatCurrency(summary?.gatewayFeesCents ?? 0)}) − bônus`}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "Transações" && <TransactionsView range={range} />}

      {tab === "Pagamentos" && (
        <DataTable
          columns={pagamentoColumns}
          data={paymentRows}
          searchPlaceholder="Buscar..."
          searchKey="freelancer"
          isFetching={loadingPayments}
        />
      )}

      {tab === "Repasses" && (
        <DataTable
          columns={repasseColumns}
          data={repasseRows}
          searchPlaceholder="Buscar..."
          searchKey="freelancer"
          isFetching={loadingRepasses}
        />
      )}

      {tab === "Estornos & Cancelamentos" && (
        <TransactionsView range={range} fixedType="estorno" />
      )}
    </div>
  );
}

/** Rótulo curto de um dia YYYY-MM-DD (dd/mm) para o cabeçalho do período. */
function formatVacancyDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { DataTable } from "@/components/shared/data-table";
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard, RotateCcw,
  XCircle, Receipt, Loader2, AlertTriangle
} from "lucide-react";
import { useAdminPayments } from "@/modules/admin/application/use-admin-payments";
import { useAdminRepasses } from "@/modules/admin/application/use-admin-repasses";
import { useAdminMetrics } from "@/modules/admin/application/use-admin-metrics";
import type { PaymentItem, RepasseItem } from "@/modules/admin/infrastructure/admin-api";
import { formatInstantDate } from "@/lib/date.utils";

const tabs = ["Visão Geral", "Pagamentos", "Repasses", "Estornos & Cancelamentos", "Por Cidade", "Por Tipo de Freelancer", "Parcerias"] as const;
type Tab = typeof tabs[number];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

const formatDate = formatInstantDate;

function mapPaymentToRow(p: PaymentItem) {
  return {
    id: p.id,
    freelancer: p.correlationId.slice(0, 12),
    empresa: "—",
    valor: formatCurrency(p.value),
    tipo: "Diária",
    data: formatDate(p.createdAt),
    status: p.status === "COMPLETED" ? "Pago" : "Pendente",
    raw: p,
  };
}

function mapRepasseToRow(r: RepasseItem) {
  return {
    id: r.id,
    freelancer: r.providerGlobalId.slice(0, 12),
    empresa: "—",
    valor: formatCurrency(r.amountInCents),
    tipo: "Repasse",
    data: formatDate(r.createdAt),
    status: r.status,
    raw: r,
  };
}

function ComingSoonBanner() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-800">Módulo em desenvolvimento</p>
        <p className="text-sm text-amber-700 mt-0.5">Os dados para esta seção serão disponibilizados em breve.</p>
      </div>
    </div>
  );
}

export default function FinanceiroPage() {
  const [tab, setTab] = useState<Tab>("Visão Geral");
  const { data: payments, isLoading: loadingPayments } = useAdminPayments();
  const { data: repasses, isLoading: loadingRepasses } = useAdminRepasses();
  const { data: metrics } = useAdminMetrics();

  const paymentRows = payments?.map(mapPaymentToRow) ?? [];
  const repasseRows = repasses?.map(mapRepasseToRow) ?? [];

  const isLoading = loadingPayments || loadingRepasses;

  const pagamentoColumns = [
    { header: "ID", accessor: "freelancer" as const },
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  const totalRevenue = metrics ? formatCurrency(metrics.totalRevenue) : "R$ 0,00";
  const completedJobs = metrics?.completedJobs ?? 0;
  const cancelledJobs = metrics?.cancelledJobs ?? 0;

  return (
    <div>
      <PageHeader title="Financeiro" description="Acompanhamento de indicadores financeiros e receitas" />

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

      {tab === "Visão Geral" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Faturamento Bruto" value={totalRevenue} icon={DollarSign} />
            <KpiCard title="Receita Líquida" value={totalRevenue} icon={TrendingUp} />
            <KpiCard title="Serviços Concluídos" value={String(completedJobs)} icon={Receipt} />
            <KpiCard title="Repasse Pendentes" value={String(metrics?.pendingRepasses ?? 0)} icon={CreditCard} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total Pagamentos" value={String(payments?.length ?? 0)} icon={CreditCard} />
            <KpiCard title="Total Repasses" value={String(repasses?.length ?? 0)} icon={RotateCcw} />
            <KpiCard title="Cancelamentos" value={String(cancelledJobs)} icon={XCircle} />
            <KpiCard title="Repasse Completados" value={String(metrics?.completedRepasses ?? 0)} icon={TrendingDown} />
          </div>
        </div>
      )}

      {tab === "Pagamentos" && (
        <DataTable columns={pagamentoColumns} data={paymentRows} searchPlaceholder="Buscar..." searchKey="freelancer" />
      )}

      {tab === "Repasses" && (
        <DataTable columns={repasseColumns} data={repasseRows} searchPlaceholder="Buscar..." searchKey="freelancer" />
      )}

      {tab === "Estornos & Cancelamentos" && <ComingSoonBanner />}

      {tab === "Por Cidade" && <ComingSoonBanner />}

      {tab === "Por Tipo de Freelancer" && <ComingSoonBanner />}

      {tab === "Parcerias" && <ComingSoonBanner />}
    </div>
  );
}

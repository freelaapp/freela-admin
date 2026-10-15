"use client";

import { Briefcase, CheckCircle2, Loader2, Users, Wallet } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { formatCents } from "@/lib/money";
import type { CommissionDashboard } from "@/lib/commissions/types";

const num = (value: number) => value.toLocaleString("pt-BR");

/** "2026-10-01" → "01/10/2026" (o período vem como dia, sem hora). */
function dayBR(day: string): string {
  const [y, m, d] = day.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** O recorte do filtro em texto: "de 01/10/2026 a 31/10/2026", "desde o início"… */
export function commissionPeriodText(period: { from: string | null; to: string | null }): string {
  if (period.from && period.to) return `de ${dayBR(period.from)} a ${dayBR(period.to)}`;
  if (period.from) return `desde ${dayBR(period.from)}`;
  if (period.to) return `até ${dayBR(period.to)}`;
  return "desde o início";
}

export function CommissionDashboardView({
  data,
  isLoading,
  isError = false,
  onRetry,
}: {
  data: CommissionDashboard | undefined;
  isLoading: boolean;
  /** A consulta falhou: sem isso a área ficava em branco, sem dizer nada. */
  isError?: boolean;
  onRetry?: () => void;
}) {
  if (isLoading && !data) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }
  if (!data) {
    if (!isError) return null;
    return (
      <div role="alert" className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-800">
        <p>Não foi possível carregar o painel de comissão. Tente de novo.</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 min-h-10 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Tentar de novo
          </button>
        )}
      </div>
    );
  }
  const r = data.registrations;
  const periodo = commissionPeriodText(data.period);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
        <p className="text-xs text-[#737373]">Regra de comissão vigente</p>
        <p className="mt-1 text-sm font-medium text-[#1d1d1b]">
          {data.rule?.description ?? "Comissão desligada"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Cadastros trazidos"
          value={num(r.total)}
          icon={Users}
          breakdown={[
            { label: "Empresa", value: num(r.empresa) },
            { label: "Em Casa", value: num(r.casa) },
            { label: "Freelancer", value: num(r.freelancer) },
            { label: "Só login", value: num(r.semPerfil) },
          ]}
        />
        <KpiCard
          title="Vagas publicadas"
          value={num(data.vacancies.published)}
          icon={Briefcase}
          meta={`${num(data.vacancies.hires)} contratação(ões)`}
        />
        <KpiCard title="Serviços concluídos" value={num(data.vacancies.completed)} icon={CheckCircle2} />
        <KpiCard
          title="Comissão gerada no período"
          value={formatCents(data.commission.generatedInCents)}
          icon={Wallet}
          // Três recortes diferentes no mesmo cartão: gerada e paga seguem o
          // filtro; o "a receber" é o saldo de hoje, desde o início.
          breakdown={[
            { label: "Pago no período", value: formatCents(data.commission.paidInCents) },
            { label: "A receber (desde o início)", value: formatCents(data.commission.openInCents) },
          ]}
          details={{
            calc: `Gerada = soma dos lançamentos de comissão (inclui ajustes) com data ${periodo}. Pago no período = soma dos pagamentos registrados ${periodo}, sem os estornados. A receber = soma de todos os lançamentos ainda sem pagamento, desde o início — não muda com o filtro.`,
            source: "livro de comissão do consultor (lançamentos e pagamentos)",
          }}
        />
      </div>

      <div className="rounded-lg border border-[#e5e5e5] bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-[#1d1d1b]">Clientes no período</h3>
        {data.clients.length === 0 ? (
          <p className="text-sm text-[#737373]">Nenhum cliente com vaga ou comissão no período.</p>
        ) : (
          <ul className="divide-y divide-[#f1f1f1]">
            {data.clients.map((client) => (
              <li key={client.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1d1d1b]">
                    {client.companyName ?? client.name ?? "Cliente"}
                  </p>
                  {client.companyName && client.name && (
                    <p className="truncate text-xs text-[#737373]">{client.name}</p>
                  )}
                </div>
                <p className="text-xs text-[#737373]">
                  {num(client.vacancies)} vaga(s) · {num(client.completed)} concluído(s) ·{" "}
                  <span className="font-semibold text-[#1d1d1b]">{formatCents(client.commissionInCents)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

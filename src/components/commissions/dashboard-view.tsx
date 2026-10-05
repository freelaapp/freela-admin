"use client";

import { Briefcase, CheckCircle2, Loader2, Users, Wallet } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { formatCents } from "@/lib/money";
import type { CommissionDashboard } from "@/lib/commissions/types";

const num = (value: number) => value.toLocaleString("pt-BR");

export function CommissionDashboardView({
  data,
  isLoading,
}: {
  data: CommissionDashboard | undefined;
  isLoading: boolean;
}) {
  if (isLoading && !data) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }
  if (!data) return null;
  const r = data.registrations;

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
          title="Comissão gerada"
          value={formatCents(data.commission.generatedInCents)}
          icon={Wallet}
          breakdown={[
            { label: "Pago no período", value: formatCents(data.commission.paidInCents) },
            { label: "A receber (hoje)", value: formatCents(data.commission.openInCents) },
          ]}
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

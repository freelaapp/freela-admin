"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  DollarSign,
  Loader2,
  Star,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { useAdminDashboard } from "@/modules/admin/application/use-admin-dashboard";
import {
  buildPeriodGroups,
  buildTotalCards,
  exclusionText,
  type DashboardCardGroup,
} from "@/modules/admin/application/dashboard-presentation";
import { DashboardUnavailableError } from "@/modules/admin/infrastructure/dashboard-api";
import type { AdminMetricsPeriodPreset } from "@/modules/admin/infrastructure/admin-api";
import { PeriodBar, isoDayBrasilia } from "./_components/period-bar";
import { VacancyStagesSection } from "./_components/vacancy-stages-section";
import { TopContractorsTable } from "./_components/top-contractors-table";

const TOTAL_ICONS = { T1: UserCheck, T2: Building2, T3: DollarSign } as const;
const GROUP_ICONS: Record<DashboardCardGroup["id"], React.ElementType> = {
  signups: Users,
  vacancies: Briefcase,
  conversion: TrendingUp,
  ratings: Star,
};

/**
 * Dashboard (spec "Freela Admin — Especificação do novo Dashboard", 16/11/2026), lido de cima
 * para baixo em cinco faixas: (1) 3 totais desde o início; (2) 7 status das vagas com seletor
 * próprio; (3) barra de período; (4) indicadores do período em quatro grupos; (5) Top 10
 * contratantes. Só as duas últimas mudam com o período. O que saiu do painel antigo está na
 * página "Operação" (`/dashboard/operacao`).
 */
export default function DashboardPage() {
  const [period, setPeriod] = useState<AdminMetricsPeriodPreset>("this_month");
  const [from, setFrom] = useState(() => isoDayBrasilia(29));
  const [to, setTo] = useState(() => isoDayBrasilia(0));
  const { data, isLoading, isError, error, isFetching } = useAdminDashboard({ period, from, to });
  const unavailable = error instanceof DashboardUnavailableError;

  return (
    <div className="min-w-0">
      <PageHeader
        title="Dashboard"
        description="PMO FREELA — Painel Gerencial"
        action={
          <Link
            href="/dashboard/operacao"
            className="text-sm font-medium text-[#737373] underline hover:text-[#1d1d1b]"
          >
            Operação
          </Link>
        }
      />

      {isLoading && !data ? (
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : unavailable ? (
        <div className="mb-8 rounded-xl border border-[#e5e5e5] bg-white p-4 text-sm text-[#525252]">
          <p className="font-medium text-[#1d1d1b]">O dashboard novo ainda não chegou à API.</p>
          <p className="mt-1">
            Enquanto a API não é atualizada, os indicadores de sempre continuam na página{" "}
            <Link href="/dashboard/operacao" className="font-medium underline hover:text-[#eca826]">
              Operação
            </Link>
            .
          </p>
        </div>
      ) : isError || !data ? (
        <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não foi possível carregar os números do dashboard. A tela tenta de novo sozinha; se
          continuar, abra a página{" "}
          <Link href="/dashboard/operacao" className="font-medium underline">
            Operação
          </Link>
          .
        </div>
      ) : (
        <section aria-labelledby="totais" className="mb-8">
          <h2 id="totais" className="sr-only">
            Totais desde o início
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {buildTotalCards(data).map((card) => (
              <KpiCard
                key={card.id}
                title={card.title}
                value={card.value}
                icon={TOTAL_ICONS[card.id as keyof typeof TOTAL_ICONS] ?? Users}
                meta={card.meta}
                details={card.details}
                className="p-5"
              />
            ))}
          </div>
        </section>
      )}

      <VacancyStagesSection />

      <PeriodBar
        period={period}
        onPeriodChange={setPeriod}
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        className="mb-4 flex flex-wrap items-center gap-2"
      />

      {data && !unavailable && (
        <>
          <p className="mb-4 text-xs text-[#737373]">
            Os números abaixo medem <strong>{data.period?.label ?? "o período escolhido"}</strong>{" "}
            e comparam com <strong>{data.period?.previousLabel ?? "o período anterior"}</strong>,
            cada indicador pela data do próprio evento (horário de Brasília).
            {isFetching && " Atualizando…"}
          </p>

          {buildPeriodGroups(data).map((group) => (
            <section key={group.id} aria-labelledby={`grupo-${group.id}`} className="mb-6">
              <h2
                id={`grupo-${group.id}`}
                className="mb-3 text-base font-semibold text-[#1d1d1b]"
              >
                {group.title}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {group.cards.map((card) => (
                  <KpiCard
                    key={card.id}
                    title={card.title}
                    value={card.value}
                    icon={GROUP_ICONS[group.id]}
                    caption={card.caption}
                    badge={card.badge}
                    meta={card.meta}
                    metaColor={card.metaColor}
                    details={card.details}
                  />
                ))}
              </div>
            </section>
          ))}

          <TopContractorsTable
            rows={data.topContractors}
            periodLabel={`Período: ${data.period?.label ?? "o escolhido"} · ranking por contratações concluídas, desempate pelo valor movimentado`}
          />

          <p className="mt-6 text-xs text-[#737373]">{exclusionText(data)}</p>
        </>
      )}
    </div>
  );
}

"use client";

import { Building2, Loader2, Truck, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import {
  useCompanyRegistrations,
  useDriverRegistrations,
} from "@/modules/fretes/application/use-fretes-registrations";

/** Início do mês corrente no fuso de Brasília (UTC-3), igual ao painel de Serviços. */
function startOfMonthBrasilia(now = new Date()): Date {
  const brasilia = new Date(now.getTime() - 3 * 3_600_000);
  return new Date(Date.UTC(brasilia.getUTCFullYear(), brasilia.getUTCMonth(), 1, 3, 0, 0));
}

function countThisMonth(items: Array<{ createdAt: string }>): number {
  const from = startOfMonthBrasilia().getTime();
  return items.filter((i) => {
    const at = new Date(i.createdAt).getTime();
    return Number.isFinite(at) && at >= from;
  }).length;
}

/**
 * Dashboard do Freela Fretes.
 *
 * Só mostra o que o produto realmente gera hoje: cadastros. Nada de GMV, frete
 * concluído ou faturamento — esses números não existem no backend, e inventá-los
 * num painel de gestão é pior que não ter a tela.
 */
export default function FretesDashboardPage() {
  const drivers = useDriverRegistrations();
  const companies = useCompanyRegistrations();

  const isLoading = drivers.isLoading || companies.isLoading;
  const isError = drivers.isError || companies.isError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  if (isError) {
    const err = (drivers.error ?? companies.error) as
      | { response?: { data?: { error?: { message?: string } } } }
      | undefined;
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-red-500">
          {err?.response?.data?.error?.message ?? "Erro ao carregar os cadastros do Fretes."}
        </p>
      </div>
    );
  }

  const driverList = drivers.data?.data ?? [];
  const companyList = companies.data?.data ?? [];
  const driversTotal = drivers.data?.total ?? driverList.length;
  const companiesTotal = companies.data?.total ?? companyList.length;

  const cards = [
    {
      title: "Motoristas Cadastrados",
      value: String(driversTotal),
      icon: Truck,
      meta: `Acumulado · +${countThisMonth(driverList)} novos no mês`,
      help: "Motoristas que concluíram o cadastro no Freela Fretes (tabela driver_registrations).",
    },
    {
      title: "Empresas Cadastradas",
      value: String(companiesTotal),
      icon: Building2,
      meta: `Acumulado · +${countThisMonth(companyList)} novas no mês`,
      help: "Empresas que concluíram o cadastro no Freela Fretes (tabela company_registrations).",
    },
    {
      title: "Cadastros no Mês",
      value: String(countThisMonth(driverList) + countThisMonth(companyList)),
      icon: UserPlus,
      iconColor: "text-green-500",
      meta: "Motoristas + empresas · mês corrente",
      help: "Soma dos dois cadastros no mês-calendário de Brasília. É o indicador de captação da vertical.",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Freela Fretes"
        description="Captação de cadastro — a operação de fretes ainda não roda no sistema"
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {cards.map((c) => (
          <KpiCard key={c.title} {...c} />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-[#e5e5e5] p-5">
        <h3 className="font-semibold text-[#1d1d1b] mb-1">O que existe hoje</h3>
        <p className="text-sm text-[#737373]">
          O Freela Fretes está em fase de captação: o site coleta cadastro de motorista e de
          empresa, e é isso que estes números medem. Frete publicado, tabela de preços, veículos e
          financeiro aparecem no painel quando existirem no backend — até lá, essas telas ficam
          marcadas como &ldquo;em breve&rdquo; em vez de mostrar número de exemplo.
        </p>
      </div>
    </div>
  );
}

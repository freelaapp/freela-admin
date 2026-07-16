"use client";

import { useState } from "react";
import {
  UserCheck,
  Building2,
  Briefcase,
  CheckCircle2,
  Clock,
  Hourglass,
  TrendingUp,
  Timer,
  RefreshCw,
  Ban,
  DollarSign,
  Wallet,
  Star,
  ListChecks,
  Users,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Button } from "@/components/ui/button";
import { useAdminMetrics } from "@/modules/admin/application/use-admin-metrics";

const COLORS = ["#eca826", "#f0b040", "#f4c060", "#16a34a", "#737373", "#dc2626"];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

// serviceType é bagunçado no banco (slug 'auxiliar-cozinha' convive com 'Garçom/Garçonete').
// Title-case só os slugs (minúsculo com hífen); deixa os já formatados como estão.
function formatCargo(value: string) {
  if (/^[a-z0-9-]+$/.test(value)) {
    return value
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return value;
}

export default function DashboardPage() {
  const [cidade, setCidade] = useState("");
  const [cargo, setCargo] = useState("");
  const { data: m, isLoading, isError } = useAdminMetrics({
    city: cidade || undefined,
    role: cargo || undefined,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  if (isError || !m) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-red-500">Erro ao carregar métricas. Tente novamente.</p>
      </div>
    );
  }

  // Taxa de preenchimento POR PERÍODO, calculada na API: das vagas criadas nos
  // últimos 30 dias que já tiveram desfecho (fecharam todos os slots ou
  // expiraram sem preencher), quantas fecharam. A fórmula antiga misturava
  // aceites acumulados desde o início com as vagas abertas do momento e
  // tendia a 100% conforme a história crescia. Campos opcionais enquanto a
  // API sem eles ainda puder estar no ar.
  const filled30d = m.vacanciesFilled30d;
  const decided30d =
    filled30d !== undefined && m.vacanciesExpiredUnfilled30d !== undefined
      ? filled30d + m.vacanciesExpiredUnfilled30d
      : undefined;
  const fillRate =
    filled30d !== undefined && decided30d
      ? Math.round((filled30d / decided30d) * 100)
      : null;

  // Rótulo de escopo/janela em cada card (legenda logo abaixo dos filtros):
  // os KPIs misturam plataforma toda vs só Bares/Restaurantes, e foto do
  // momento vs acumulado histórico — sem o rótulo o painel induz a erro.
  const row1 = [
    { title: "Freelancers Cadastrados", value: String(m.totalFreelancers), icon: UserCheck, meta: "Global · acumulado", help: "Toda conta de freelancer já criada na plataforma (BR + Casa) que não foi banida. Não mede atividade — é cadastro acumulado." },
    { title: "Contratantes Cadastrados", value: String(m.totalCompanies), icon: Building2, meta: "Global · ativos", help: "Empresas/pessoas contratantes ativas, contando cada uma só uma vez mesmo se estiver nos dois módulos." },
    { title: "Novos Freelancers (Mês)", value: String(m.newFreelancersThisMonth), icon: RefreshCw, meta: "Global · mês atual" },
    { title: "Usuários Ativos", value: String(m.activeUsers), icon: Users, meta: "Global · agora" },
  ];

  // "Desde o início" = go-live real da operação (corte vem da API em launchDate;
  // vagas de teste anteriores ficam fora). "Não concluídas" = tiveram desfecho
  // sem serviço concluído (canceladas ou janela encerrada sem job COMPLETED);
  // vagas ainda em aberto não contam.
  const launchLabel = m.launchDate
    ? m.launchDate.split("-").reverse().join("/")
    : "o início";
  const row2 = [
    { title: "Vagas Abertas", value: String(m.openVacancies), icon: Briefcase, meta: "BR · agora" },
    { title: "Candidaturas Aceitas", value: String(m.acceptedCandidacies), icon: CheckCircle2, iconColor: "text-green-500", meta: "BR · acumulado", help: "Total histórico de freelancers aceitos em vagas de Bares & Restaurantes. É acumulado desde o início — não significa vagas preenchidas agora." },
    {
      title: "Vagas Abertas e Não Concluídas",
      help: "Das vagas criadas desde o início real da operação, quantas terminaram SEM serviço concluído: canceladas ou com o prazo encerrado sem ninguém concluir o job. Vagas ainda em andamento não contam.",
      value:
        m.vacanciesNotCompletedSinceLaunch !== undefined
          ? String(m.vacanciesNotCompletedSinceLaunch)
          : "N/A",
      icon: Hourglass,
      meta:
        m.vacanciesCreatedSinceLaunch !== undefined
          ? `BR · de ${m.vacanciesCreatedSinceLaunch} criadas desde ${launchLabel}`
          : `BR · desde ${launchLabel}`,
    },
    { title: "Vagas Canceladas", value: String(m.cancelledVacancies), icon: Ban, iconColor: "text-red-500", meta: "BR · acumulado" },
  ];

  const row3 = [
    {
      title: "Taxa de Preenchimento (30d)",
      help: "Das vagas criadas nos últimos 30 dias que já tiveram desfecho (preencheram todos os postos ou expiraram sem preencher), a porcentagem que preencheu. Vagas canceladas e vagas ainda abertas ficam fora da conta.",
      value: fillRate === null ? "N/A" : `${fillRate}%`,
      icon: TrendingUp,
      iconColor: "text-green-500",
      meta:
        fillRate === null
          ? "Sem vagas encerradas nos últimos 30 dias"
          : `Meta: 80% · ${filled30d}/${decided30d} vagas encerradas`,
      metaColor: fillRate !== null && fillRate >= 80 ? "text-green-500" : "text-red-500",
      ...(fillRate !== null ? { progress: fillRate } : {}),
    },
    { title: "Jobs Agendados", value: String(m.scheduledJobs), icon: Timer, meta: "BR · agora" },
    { title: "Jobs em Andamento", value: String(m.inProgressJobs), icon: Clock, meta: "BR · agora" },
    { title: "Serviços Concluídos", value: String(m.completedJobs), icon: ListChecks, iconColor: "text-green-500", meta: "BR · acumulado" },
  ];

  // Avaliações separadas POR DIREÇÃO (o antigo "Feedbacks 200" somava as duas
  // direções, incluía pré-go-live e ignorava a Casa). Cada card traz a média
  // da própria fatia na meta.
  const fbAvg = (v: number | null | undefined) =>
    v != null ? `média ${v.toFixed(2).replace(".", ",")} ⭐` : "sem notas";
  const fbProviders = m.feedbacksReceivedByProviders;
  const fbContractors = m.feedbacksReceivedByContractors;
  const row4 = [
    { title: "GMV (Volume Bruto)", value: formatCurrency(m.totalRevenue), icon: DollarSign, iconColor: "text-green-500", meta: "Global · acumulado · líquido de estornos", help: "Todo o dinheiro pago pelos contratantes desde o início (sem os estornados). Inclui a fatia dos freelancers — não é receita da empresa; para receita, veja o Lucro na aba Financeiro." },
    { title: "Repasse Pendentes", value: String(m.pendingRepasses), icon: Wallet, meta: "Global · agora" },
    {
      title: "Avaliações Recebidas por Freelancers",
      help: "Notas que CONTRATANTES deram a freelancers, nos dois módulos, desde o go-live. A média ao lado é só desta direção.",
      value: fbProviders ? String(fbProviders.count) : "N/A",
      icon: Star,
      meta: fbProviders
        ? `BR+Casa · desde ${launchLabel} · ${fbAvg(fbProviders.averageRating)}`
        : `BR+Casa · desde ${launchLabel}`,
    },
    {
      title: "Avaliações Recebidas por Contratantes",
      help: "Notas que FREELANCERS deram a contratantes, nos dois módulos, desde o go-live. A média ao lado é só desta direção.",
      value: fbContractors ? String(fbContractors.count) : "N/A",
      icon: Building2,
      meta: fbContractors
        ? `BR+Casa · desde ${launchLabel} · ${fbAvg(fbContractors.averageRating)}`
        : `BR+Casa · desde ${launchLabel}`,
    },
  ];

  const jobsPorCidade = m.jobsByCity.length > 0
    ? m.jobsByCity.map((j) => ({ cidade: j.city, jobs: j.count }))
    : [{ cidade: "Sem dados", jobs: 0 }];

  const freelancersPorCargo = m.freelancersByRole.length > 0
    ? m.freelancersByRole.map((f) => ({ name: f.role, value: f.count }))
    : [{ name: "Sem dados", value: 0 }];

  const jobsPorMes = m.jobsByMonth.length > 0
    ? m.jobsByMonth.map((j) => {
        const [year, month] = j.month.split("-");
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        return { mes: monthNames[parseInt(month, 10) - 1], jobs: j.count };
      })
    : [{ mes: "Sem dados", jobs: 0 }];

  const empresasMaisAtivas = m.topCompanies.length > 0
    ? m.topCompanies.map((c) => ({ empresa: c.name, jobs: c.jobCount }))
    : [{ empresa: "Sem dados", jobs: 0 }];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="PMO FREELA — Painel Gerencial"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <select
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
          className="h-9 px-3 rounded-lg bg-white border border-[#e5e5e5] text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
        >
          <option value="">Cidade: Todas</option>
          {(m.filterOptions?.cities ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          className="h-9 px-3 rounded-lg bg-white border border-[#e5e5e5] text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
        >
          <option value="">Cargo: Todos</option>
          {(m.filterOptions?.roles ?? []).map((r) => (
            <option key={r} value={r}>
              {formatCargo(r)}
            </option>
          ))}
        </select>
        {(cidade || cargo) && (
          <Button variant="outline" onClick={() => { setCidade(""); setCargo(""); }}>
            Limpar filtros
          </Button>
        )}
      </div>
      {(cidade || cargo) && (
        <p className="text-xs text-[#737373] mb-2">
          Filtro aplicado a vagas, jobs, candidaturas e gráficos. Indicadores globais de pessoas e
          financeiro (freelancers, usuários, GMV, repasses, avaliações) não mudam com o filtro.
        </p>
      )}
      <p className="text-xs text-[#737373] mb-6">
        Nos cards: <strong>Global</strong> = plataforma toda (Bares/Restaurantes + Freela em Casa);{" "}
        <strong>BR</strong> = só Bares/Restaurantes. <strong>Acumulado</strong> = desde o início da
        plataforma; <strong>agora</strong> = situação atual.
      </p>

      {/* KPI Rows */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {row1.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {row2.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {row3.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {row4.map((k) => (
          <KpiCard key={k.title} {...k} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-5">
          <h3 className="font-semibold text-[#1d1d1b] mb-4">Jobs por Cidade</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={jobsPorCidade}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="cidade" tick={{ fontSize: 12 }} stroke="#737373" />
              <YAxis tick={{ fontSize: 12 }} stroke="#737373" />
              <Tooltip />
              <Bar dataKey="jobs" fill="#eca826" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-[#e5e5e5] p-5">
          <h3 className="font-semibold text-[#1d1d1b] mb-1">Freelancers por Cargo</h3>
          <p className="text-xs text-[#737373] mb-4">
            Só perfis Bares/Restaurantes com cargo informado — população menor que o total global
            de freelancers.
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={freelancersPorCargo}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
              >
                {freelancersPorCargo.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-[#e5e5e5] p-5">
          <h3 className="font-semibold text-[#1d1d1b] mb-4">Jobs por Mês</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={jobsPorMes}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#737373" />
              <YAxis tick={{ fontSize: 12 }} stroke="#737373" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="jobs"
                stroke="#eca826"
                strokeWidth={2.5}
                dot={{ fill: "#eca826" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-[#e5e5e5] p-5">
          <h3 className="font-semibold text-[#1d1d1b] mb-4">Empresas Mais Ativas</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={empresasMaisAtivas} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#737373" />
              <YAxis
                dataKey="empresa"
                type="category"
                tick={{ fontSize: 12 }}
                stroke="#737373"
                width={120}
              />
              <Tooltip />
              <Bar dataKey="jobs" fill="#16a34a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

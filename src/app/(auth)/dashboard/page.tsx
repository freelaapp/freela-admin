"use client";

import {
  UserCheck,
  Building2,
  Briefcase,
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Timer,
  RefreshCw,
  Ban,
  DollarSign,
  Wallet,
  Receipt,
  AlertCircle,
  ListChecks,
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

export default function DashboardPage() {
  const { data: m, isLoading, isError } = useAdminMetrics();

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

  const fillRate = m.openVacancies > 0
    ? Math.round((m.acceptedCandidacies / (m.openVacancies + m.acceptedCandidacies)) * 100)
    : 0;

  const row1 = [
    { title: "Freelancers Cadastrados", value: String(m.totalFreelancers), icon: UserCheck },
    { title: "Contratantes Cadastrados", value: String(m.totalCompanies), icon: Building2 },
    { title: "Vagas Abertas", value: String(m.openVacancies), icon: Briefcase },
  ];

  const row2 = [
    { title: "Vagas Abertas", value: String(m.openVacancies), icon: ClipboardList },
    { title: "Vagas Preenchidas", value: String(m.acceptedCandidacies), icon: CheckCircle2, iconColor: "text-green-500" },
    { title: "Jobs em Andamento", value: String(m.inProgressJobs), icon: Clock },
    { title: "Candidaturas Pendentes", value: String(m.pendingCandidacies), icon: XCircle, iconColor: "text-red-500" },
  ];

  const row3 = [
    { title: "Taxa de Preenchimento", value: `${fillRate}%`, icon: TrendingUp, iconColor: "text-green-500", meta: "Meta: 80%", metaColor: fillRate >= 80 ? "text-green-500" : "text-red-500", progress: fillRate },
    { title: "Jobs Agendados", value: String(m.scheduledJobs), icon: Timer },
    { title: "Novos Freelancers (Mês)", value: String(m.newFreelancersThisMonth), icon: RefreshCw },
    { title: "Vagas Canceladas", value: String(m.cancelledVacancies), icon: Ban, iconColor: "text-red-500" },
  ];

  const row4 = [
    { title: "GMV (Volume Bruto)", value: formatCurrency(m.totalRevenue), icon: DollarSign, iconColor: "text-green-500" },
    { title: "Repasse Pendentes", value: String(m.pendingRepasses), icon: Wallet },
    { title: "Feedbacks", value: String(m.totalFeedbacks), icon: Receipt },
    { title: "Avaliação Média", value: m.averageRating ? `${m.averageRating.toFixed(1)} ⭐` : "N/A", icon: AlertCircle },
    { title: "Serviços Concluídos", value: String(m.completedJobs), icon: ListChecks, iconColor: "text-green-500" },
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
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select className="h-9 px-3 rounded-lg bg-white border border-[#e5e5e5] text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30">
          <option>Cidade: Todas</option>
          <option>São Paulo</option>
          <option>Rio de Janeiro</option>
          <option>Belo Horizonte</option>
          <option>Curitiba</option>
        </select>
        <select className="h-9 px-3 rounded-lg bg-white border border-[#e5e5e5] text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30">
          <option>Cargo: Todos</option>
          <option>Garçom</option>
          <option>Bartender</option>
          <option>Cozinheiro</option>
        </select>
        <select className="h-9 px-3 rounded-lg bg-white border border-[#e5e5e5] text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30">
          <option>Período: Últimos 7 Dias</option>
          <option>Últimos 30 Dias</option>
          <option>Este Mês</option>
          <option>Este Ano</option>
        </select>
        <Button variant="outline">Personalizado</Button>
      </div>

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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {row4.map((k, i) => (
          <KpiCard key={k.title + i} {...k} />
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
          <h3 className="font-semibold text-[#1d1d1b] mb-4">Freelancers por Cargo</h3>
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

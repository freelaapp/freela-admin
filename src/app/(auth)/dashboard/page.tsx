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
  HelpCircle,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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


// ─── Guia de leitura do dashboard (linguagem de negócio) ─────────────────────

function DashboardGuideDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items: { title: string; text: string }[] = [
    {
      title: "Global vs BR — o escopo de cada card",
      text: "\"Global\" soma a plataforma toda (Bares & Restaurantes + Freela em Casa). \"BR\" é só Bares & Restaurantes — vagas, jobs e candidaturas são deste módulo. O rótulo cinza embaixo de cada card diz qual é.",
    },
    {
      title: "Acumulado, agora ou mês — a janela de tempo",
      text: "\"Acumulado\" conta desde o início da plataforma (inclui o piloto de maio/2026). \"Agora\" é a foto deste instante. \"Mês atual\" zera todo dia 1º. Não compare cards de janelas diferentes entre si.",
    },
    {
      title: "A saúde da operação em 3 cards",
      text: "Vagas Abertas (o que está no ar), Taxa de Preenchimento 30d (das vagas que encerraram no último mês, quantas preencheram — meta 80%) e Vagas Abertas e Não Concluídas (as que terminaram sem serviço desde o go-live). Esses três contam a história do funil.",
    },
    {
      title: "Dinheiro: aqui é só o volume",
      text: "O GMV mostra tudo que os contratantes pagaram (inclui a fatia dos freelancers — não é receita). Receita, saídas, estornos e saldo em conta vivem na aba Financeiro, que tem o próprio guia.",
    },
    {
      title: "Avaliações em duas direções",
      text: "Um card conta as notas que os freelancers RECEBERAM (dadas por contratantes) e o outro as que os contratantes receberam. Cada um mostra a própria média — não existe mais uma média única misturada.",
    },
    {
      title: "Os filtros de Cidade e Cargo",
      text: "Filtram só vagas, jobs, candidaturas e gráficos. Os indicadores de pessoas e dinheiro (freelancers, usuários, GMV, repasses, avaliações) são globais e não mudam com o filtro.",
    },
    {
      title: "O gráfico Freelancers por Cargo",
      text: "A pizza usa só os perfis de Bares & Restaurantes que informaram cargo — os percentuais são desse grupo, não dos milhares de cadastros globais.",
    },
  ];
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>Como ler estes números</DialogTitle>
          <DialogDescription>
            Guia rápido do painel — cada card também tem um ⓘ com a explicação no hover.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {items.map((it) => (
            <div key={it.title} className="rounded-lg bg-[#f7f7f7] p-3">
              <p className="text-sm font-semibold text-[#1d1d1b]">{it.title}</p>
              <p className="mt-1 text-sm text-[#737373]">{it.text}</p>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]">Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardPage() {
  const [cidade, setCidade] = useState("");
  const [cargo, setCargo] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
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
    { title: "Novos Freelancers (Mês)", value: String(m.newFreelancersThisMonth), icon: RefreshCw, meta: "Global · mês atual", help: "Contas de freelancer criadas do dia 1º deste mês até agora (mês-calendário, não 30 dias corridos)." },
    { title: "Usuários Ativos", value: String(m.activeUsers), icon: Users, meta: "Global · agora", help: "Contas (freelancers + contratantes) que não estão banidas nem em processo de exclusão. É status da conta, não uso recente — a plataforma ainda não mede login/engajamento." },
  ];

  // "Desde o início" = go-live real da operação (corte vem da API em launchDate;
  // vagas de teste anteriores ficam fora). "Não concluídas" = tiveram desfecho
  // sem serviço concluído (canceladas ou janela encerrada sem job COMPLETED);
  // vagas ainda em aberto não contam.
  const launchLabel = m.launchDate
    ? m.launchDate.split("-").reverse().join("/")
    : "o início";
  const row2 = [
    { title: "Vagas Abertas", value: String(m.openVacancies), icon: Briefcase, meta: "BR · agora", help: "Vagas de Bares & Restaurantes abertas NESTE momento, ainda dentro do prazo, aceitando candidaturas." },
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
    { title: "Vagas Canceladas", value: String(m.cancelledVacancies), icon: Ban, iconColor: "text-red-500", meta: "BR · acumulado", help: "Total histórico de vagas canceladas (pelo contratante, admin ou sistema) desde o início, incluindo o período de testes." },
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
    { title: "Jobs Agendados", value: String(m.scheduledJobs), icon: Timer, meta: "BR · agora", help: "Serviços já pagos e confirmados aguardando o dia/horário de início (freelancer contratado, check-in ainda não feito)." },
    { title: "Jobs em Andamento", value: String(m.inProgressJobs), icon: Clock, meta: "BR · agora", help: "Serviços acontecendo AGORA: o freelancer fez check-in e ainda não fez check-out." },
    { title: "Serviços Concluídos", value: String(m.completedJobs), icon: ListChecks, iconColor: "text-green-500", meta: "BR · acumulado", help: "Total histórico de serviços finalizados com check-out desde o início da plataforma." },
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
    { title: "Repasse Pendentes", value: String(m.pendingRepasses), icon: Wallet, meta: "Global · agora", help: "Pagamentos a freelancers aguardando liberação neste momento. Zero = ninguém esperando receber. Repasses que falharam não aparecem aqui — ficam na aba Financeiro > Transações." },
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
        action={
          <Button
            variant="outline"
            onClick={() => setGuideOpen(true)}
            className="border-[#e5e5e5] text-[#1d1d1b] hover:bg-[#f7f7f7] font-medium"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Como ler estes números
          </Button>
        }
      />
      <DashboardGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} />

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

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
  UserX,
  ChevronDown,
  ChevronRight,
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

// ─── Helpers do painel simplificado (8 cards do PMO) ─────────────────────────

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-07" → "julho/2026". */
function monthLabel(ym: string | undefined): string {
  if (!ym) return "—";
  const [year, month] = ym.split("-");
  const name = MONTH_NAMES[Number(month) - 1];
  return name ? `${name}/${year}` : ym;
}

/** Variação percentual vs. período anterior, já formatada. */
function deltaLabel(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "sem movimento" : "sem base de comparação";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

/**
 * Cor da comparação. `higherIsBetter=false` inverte (cancelamento e no-show:
 * cair é bom). Empate fica neutro — pintar de verde/vermelho um 0% engana.
 */
function deltaColor(current: number, previous: number, higherIsBetter: boolean): string {
  if (current === previous) return "text-[#737373]";
  const up = current > previous;
  return up === higherIsBetter ? "text-green-500" : "text-red-500";
}

/** Percentual de um card sobre a sua base (ex.: no-show sobre jobs do mês). */
function shareLabel(part: number, total: number): string | null {
  if (!total) return null;
  return `${((part / total) * 100).toFixed(1).replace(".", ",")}%`;
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
      title: "Leitura de segunda-feira em 30 segundos",
      text: "Demanda (Contratantes e Vagas Geradas) → liquidez (Vagas em Aberto sem Freelancer e Canceladas sem Freelancer) → entrega e confiança (Contratações Concluídas e Não Compareceu) → dinheiro (Faturamento). Qualquer card vermelho já aponta sozinho onde agir.",
    },
    {
      title: "O que entra neste painel",
      text: "Só o que o sistema gera sozinho, sem digitação. Total de contatos e cadastros feitos pelo comercial continuam na matinal — são planilha/CRM, não têm origem no sistema.",
    },
    {
      title: "Todo card é cross-módulo",
      text: "Diferente do painel antigo, os 8 cards somam Bares & Restaurantes + Freela em Casa. Nada aqui é \"só BR\".",
    },
    {
      title: "A comparação embaixo de cada card",
      text: "O número grande é o mês corrente; embaixo vem o mesmo indicador no mês anterior e a variação. Verde e vermelho respeitam o sentido do indicador — cancelamento e falta caindo é verde.",
    },
    {
      title: "Vagas em Aberto sem Freelancer",
      text: "É o único card de tempo real: vagas publicadas, ainda no prazo, sem ninguém aceito. Substitui os dois cards ambíguos do painel antigo (\"Vagas Abertas\" e \"Vagas Abertas e Não Concluídas\").",
    },
    {
      title: "Canceladas sem Freelancer — o que o sistema consegue medir hoje",
      text: "O app ainda não pede o MOTIVO do cancelamento, então o card conta as vagas canceladas que nunca tiveram candidatura aceita. Quando o motivo virar seleção obrigatória no app, o card passa a usar o motivo real.",
    },
    {
      title: "Não Compareceu (no-show)",
      text: "Vem da régua de reputação: serviço sem check-in depois da tolerância e cancelamento do freelancer em cima da hora (menos de 6h), que a régua já trata como falta. O que o admin anulou não conta.",
    },
    {
      title: "Faturamento não é GMV",
      text: "O card mostra a taxa que fica com o Freela (percentual + taxa fixa) das vagas pagas no mês, já líquida de estornos. O GMV — tudo que passou pela plataforma — aparece como número secundário. O lucro, que ainda desconta taxa de gateway e bônus, está na aba Financeiro.",
    },
    {
      title: "Os filtros de Cidade e Cargo",
      text: "Escopam os cards que nascem de vaga (geradas, em aberto sem freelancer, concluídas, canceladas, no-show e faturamento). Os cards de pessoas (contratantes e freelancers) são globais e não mudam com o filtro.",
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
  // Painel antigo (16 KPIs) preservado, mas fechado por padrão: o painel de
  // primeiro nível agora são os 8 cards da matinal (documento PMO jul/2026).
  const [detailsOpen, setDetailsOpen] = useState(false);
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

  // ─── Os 8 cards do painel simplificado (PMO jul/2026) ──────────────────────
  // Todos cross-módulo (BR + Casa). Padrão do documento: período explícito +
  // comparação vs. período anterior. `s` é opcional enquanto a API sem o bloco
  // ainda puder estar no ar.
  const s = m.simplified;
  const mesAtual = monthLabel(s?.currentMonth);
  const mesAnterior = monthLabel(s?.previousMonth);

  const mom = (
    cur: number,
    prev: number,
    higherIsBetter: boolean,
    extra?: string | null,
  ) => ({
    meta: [
      `${mesAtual} · ${prev} em ${mesAnterior} (${deltaLabel(cur, prev)})`,
      extra,
    ]
      .filter(Boolean)
      .join(" · "),
    metaColor: deltaColor(cur, prev, higherIsBetter),
  });

  const cardsSimplificados = s
    ? [
        {
          title: "Total de Contratantes",
          value: String(s.contractors.total),
          icon: Building2,
          meta: `Acumulado · +${s.contractors.newThisMonth} novos em ${mesAtual}`,
          help: "Contas de contratante ativas na plataforma inteira (Bares & Restaurantes + Freela em Casa), contando cada conta uma única vez. É o tamanho da carteira de demanda.",
        },
        {
          title: "Total de Freelancers",
          value: String(s.freelancers.total),
          icon: UserCheck,
          meta: `Acumulado · +${s.freelancers.newThisMonth} novos em ${mesAtual}`,
          help: "Contas de freelancer ativas na plataforma inteira. Ler sempre junto com \"Vagas em Aberto sem Freelancer\": cadastro alto com vaga parada = base dormente, não oferta real.",
        },
        {
          title: "Vagas Geradas",
          value: String(s.vacanciesCreated.current),
          icon: Briefcase,
          ...mom(s.vacanciesCreated.current, s.vacanciesCreated.previous, true),
          help: "Vagas publicadas no mês corrente (BR + Casa). É o pulso da demanda — antecipa o faturamento em 1 a 2 semanas.",
        },
        {
          title: "Vagas em Aberto sem Freelancer",
          value: String(s.openVacanciesWithoutProvider),
          icon: Hourglass,
          iconColor: s.openVacanciesWithoutProvider > 0 ? "text-red-500" : "text-[#eca826]",
          meta: "Agora · fila de risco (contratante esperando)",
          metaColor: s.openVacanciesWithoutProvider > 0 ? "text-red-500" : "text-[#737373]",
          help: "Vagas publicadas, ainda dentro do prazo e sem nenhuma candidatura aceita, NESTE momento. Cada uma é um contratante esperando: se o número cresce, acione freelancers da cidade antes de virar cancelamento.",
        },
        {
          title: "Contratações Concluídas",
          value: String(s.completedJobs.current),
          icon: ListChecks,
          iconColor: "text-green-500",
          ...mom(
            s.completedJobs.current,
            s.completedJobs.previous,
            true,
            `acumulado ${s.completedJobs.total}`,
          ),
          help: "Serviços que chegaram ao fim (check-out) no mês corrente, nos dois módulos. Junto com \"Vagas Geradas\" forma a conversão real do marketplace.",
        },
        {
          title: "Vagas Canceladas sem Freelancer",
          value: String(s.vacanciesCancelledWithoutProvider.current),
          icon: Ban,
          iconColor:
            s.vacanciesCancelledWithoutProvider.current > 0 ? "text-red-500" : "text-[#eca826]",
          ...mom(
            s.vacanciesCancelledWithoutProvider.current,
            s.vacanciesCancelledWithoutProvider.previous,
            false,
            shareLabel(s.vacanciesCancelledWithoutProvider.current, s.vacanciesCreated.current)
              ? `${shareLabel(s.vacanciesCancelledWithoutProvider.current, s.vacanciesCreated.current)} das vagas geradas`
              : null,
          ),
          help: "Vagas canceladas no mês que NUNCA tiveram um freelancer aceito — a plataforma não entregou. O app ainda não pede o motivo do cancelamento, então este é o recorte que o sistema consegue gerar sozinho; quando o motivo virar campo obrigatório, o card passa a usá-lo.",
        },
        {
          title: "Freelancer Não Compareceu",
          value: String(s.noShows.current),
          icon: UserX,
          iconColor: s.noShows.current > 0 ? "text-red-500" : "text-[#eca826]",
          ...mom(
            s.noShows.current,
            s.noShows.previous,
            false,
            shareLabel(s.noShows.current, s.noShows.jobsScheduledCurrent)
              ? `${shareLabel(s.noShows.current, s.noShows.jobsScheduledCurrent)} dos ${s.noShows.jobsScheduledCurrent} jobs do mês`
              : null,
          ),
          help: "Faltas registradas pela régua de reputação: serviço sem check-in depois da tolerância, e cancelamento do freelancer em cima da hora (menos de 6h), que a régua trata como falta. Infrações anuladas pelo admin não contam.",
        },
        {
          title: "Faturamento Total",
          value: formatCurrency(s.platformRevenue.current),
          icon: DollarSign,
          iconColor: "text-green-500",
          ...mom(
            s.platformRevenue.current,
            s.platformRevenue.previous,
            true,
            `GMV ${formatCurrency(s.platformRevenue.gmvCurrent)} · acumulado ${formatCurrency(s.platformRevenue.total)}`,
          ),
          help: "Taxa da plataforma (percentual + taxa fixa) das vagas efetivamente pagas no mês, já líquida de estornos (pagamento estornado sai da soma). Diferente do GMV, que é todo o dinheiro que passou pela plataforma. A aba Financeiro ainda desconta as taxas de gateway para chegar ao lucro.",
        },
      ]
    : [];

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
        Os 8 cards abaixo são <strong>cross-módulo</strong> (Bares/Restaurantes + Freela em Casa) e
        comparam <strong>{mesAtual}</strong> com <strong>{mesAnterior}</strong>. Dentro de
        &ldquo;Indicadores detalhados&rdquo;, os cards antigos seguem com o rótulo de escopo
        (<strong>Global</strong> vs <strong>BR</strong>) e janela (<strong>acumulado</strong> vs{" "}
        <strong>agora</strong>).
      </p>

      {/* Painel simplificado — os 8 indicadores da matinal (PMO jul/2026). */}
      {cardsSimplificados.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {cardsSimplificados.map((k) => (
            <KpiCard key={k.title} {...k} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-[#737373] mb-6">
          Painel simplificado indisponível nesta versão da API — mostrando apenas os indicadores
          detalhados.
        </p>
      )}

      {/* Painel detalhado antigo — preservado, fechado por padrão. */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-[#737373] hover:text-[#1d1d1b] cursor-pointer transition-colors"
        >
          {detailsOpen ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          Indicadores detalhados ({row1.length + row2.length + row3.length + row4.length} cards)
        </button>
        {detailsOpen && (
          <div className="mt-4">
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {row4.map((k) => (
                <KpiCard key={k.title} {...k} />
              ))}
            </div>
          </div>
        )}
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

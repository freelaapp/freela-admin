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
import { DataTable } from "@/components/shared/data-table";
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
import type {
  AdminMetricsPeriodPreset,
  ModuleSplit,
} from "@/modules/admin/infrastructure/admin-api";

const COLORS = ["#eca826", "#f0b040", "#f4c060", "#16a34a", "#737373", "#dc2626"];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

// ─── Barra de período ────────────────────────────────────────────────────────
// Move a janela dos indicadores de FLUXO (vagas geradas, concluídas, canceladas,
// no-show, faturamento). Os cards de FOTO ("agora") e os acumulados seguem fixos
// — cada card diz no rodapé a que janela pertence.

const PERIOD_PRESETS: { id: AdminMetricsPeriodPreset; label: string }[] = [
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "this_month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
  { id: "custom", label: "Personalizado" },
];

/** "YYYY-MM-DD" de hoje (ou de N dias atrás) no fuso de Brasília. */
function isoDayBrasilia(daysAgo = 0): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000 - 3 * 3_600_000);
  return d.toISOString().slice(0, 10);
}

// ─── Quebra Empresa × Casa ───────────────────────────────────────────────────
// O pedido do dono: nenhum número de módulo pode aparecer sem dizer de onde vem.
// Onde a API devolve o par, o card mostra o total no número grande e "Empresa N ·
// Casa N" logo abaixo. Onde o indicador é de PESSOA (cadastro, usuário ativo), o
// rótulo continua "Global" — a conta é da plataforma e a mesma pessoa pode atuar
// nos dois produtos, então quebrar por módulo contaria gente duas vezes.

function moduleBreakdown(
  split: ModuleSplit | undefined,
  format: (value: number) => string = (v) => String(v),
): { label: string; value: string }[] | undefined {
  if (!split) return undefined;
  return [
    { label: "Empresa", value: format(split.barsRestaurants) },
    { label: "Casa", value: format(split.homeServices) },
  ];
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

/** ISO-8601 ("2026-01-23" ou com hora) → "23/01/2026". Vazio se ausente. */
function isoDateLabel(iso: string | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10).split("-").reverse().join("/");
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
      title: "Empresa e Casa em todo card de vaga",
      text: "O número grande soma os dois produtos; logo abaixo vem a quebra \"Empresa\" (Bares & Restaurantes) e \"Casa\" (Freela em Casa). Assim dá para ver de qual produto veio o movimento sem trocar de tela.",
    },
    {
      title: "Por que os cards de pessoas não têm Empresa/Casa",
      text: "Contratantes, freelancers e usuários ativos são contas da PLATAFORMA, e a mesma pessoa pode atuar nos dois produtos. Quebrar por módulo contaria gente duas vezes, então esses cards seguem marcados como Global.",
    },
    {
      title: "A barra de período",
      text: "Escolha a janela (7, 30 ou 90 dias, este mês, mês passado ou um intervalo próprio) e os indicadores de fluxo — vagas geradas, concluídas, canceladas, não compareceu e faturamento — passam a medir esse recorte. A comparação embaixo de cada card é sempre a janela anterior de MESMO tamanho.",
    },
    {
      title: "O que a barra de período NÃO muda",
      text: "\"Vagas em Aberto sem Freelancer\" é foto do momento e os cadastros são acumulados: esses cards ignoram a janela de propósito e dizem isso no rodapé.",
    },
    {
      title: "A comparação embaixo de cada card",
      text: "O número grande é o período escolhido; embaixo vem o mesmo indicador na janela anterior e a variação. Verde e vermelho respeitam o sentido do indicador — cancelamento e falta caindo é verde.",
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
  // Janela de tempo dos indicadores de fluxo. O default é o mês corrente —
  // exatamente o que o painel já mostrava antes da barra existir.
  const [periodo, setPeriodo] = useState<AdminMetricsPeriodPreset>("this_month");
  // Intervalo próprio já nasce preenchido (últimos 30 dias) para o painel nunca
  // ficar sem dado enquanto o usuário escolhe as duas datas.
  const [dataInicio, setDataInicio] = useState(() => isoDayBrasilia(29));
  const [dataFim, setDataFim] = useState(() => isoDayBrasilia(0));
  // Painel antigo (16 KPIs) preservado, mas fechado por padrão: o painel de
  // primeiro nível agora são os 8 cards da matinal (documento PMO jul/2026).
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { data: m, isLoading, isError } = useAdminMetrics({
    city: cidade || undefined,
    role: cargo || undefined,
    period: periodo,
    from: dataInicio,
    to: dataFim,
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

  // "Usuários Ativos" agora é USO, não cadastro: quem teve movimentação de
  // verdade na janela da API (6 meses), aberto em freelancers × contratantes.
  // O número antigo (m.activeUsers = só status da conta) fica na meta como
  // comparação — a base tem muita conta herdada e a diferença é o recado.
  // `activeUsers6m` é opcional enquanto a API sem o campo puder estar no ar.
  const a6 = m.activeUsers6m;
  const usuariosAtivosCard = a6
    ? {
        title: "Usuários Ativos",
        value: String(a6.total),
        icon: Users,
        breakdown: [
          { label: "freelancers", value: String(a6.freelancers) },
          { label: "contratantes", value: String(a6.contractors) },
        ],
        meta: `Global · últimos ${a6.windowMonths} meses · ${m.activeUsers.toLocaleString("pt-BR")} contas ativas por cadastro`,
        help:
          `Quem realmente mexeu na conta nos últimos ${a6.windowMonths} meses, nos dois módulos (BR + Casa). ` +
          "Do lado do FREELANCER conta: abrir o app (token de notificação renovado), candidatar-se a uma vaga, fazer check-in ou check-out, trabalhar/concluir um serviço e escrever uma avaliação. " +
          "Do lado do CONTRATANTE conta: publicar vaga, gerar pagamento, escrever avaliação e abrir o app. " +
          "Editar o perfil NÃO entra: um backfill de 24/05/2026 carimbou a data de atualização de 149 mil cadastros, então esse campo não distingue quem mexeu na conta de quem foi tocado por script. " +
          "Quem é freelancer E contratante aparece nos dois números, por isso o total é a união e fica abaixo da soma. " +
          "Contas banidas ou em processo de exclusão ficam de fora. O número ao lado, bem maior, é o antigo: contas ativas por cadastro, que inclui a base herdada que nunca voltou a usar a plataforma.",
      }
    : {
        title: "Usuários Ativos",
        value: String(m.activeUsers),
        icon: Users,
        meta: "Global · agora · contas por status (API sem a métrica de uso)",
        help: "Contas que não estão banidas nem em processo de exclusão. É status de cadastro, não uso recente — esta versão da API ainda não devolve a métrica de movimentação em 6 meses.",
      };

  // Freelancers/Contratantes Ativos como cards de PRIMEIRO NÍVEL do dashboard
  // inicial (pedido do dono: hoje o número só aparece dentro do card mesclado
  // "Usuários Ativos", escondido atrás do "Indicadores detalhados"). Mesma
  // fonte (`a6`) do card mesclado acima — só some se a API ainda não devolver
  // `activeUsers6m`.
  const sinceLabel = isoDateLabel(a6?.since);
  const cardsAtivos = a6
    ? [
        {
          title: "Freelancers Ativos",
          value: a6.freelancers.toLocaleString("pt-BR"),
          icon: UserCheck,
          meta: `Global · últimos ${a6.windowMonths} meses · desde ${sinceLabel}`,
          help: "Freelancers com movimentação real na plataforma (BR + Casa) nos últimos meses: abrir o app, candidatar-se, check-in/check-out, concluir serviço ou avaliar. Quem também é contratante conta aqui E no card de Contratantes Ativos — por isso não some com ele.",
        },
        {
          title: "Contratantes Ativos",
          value: a6.contractors.toLocaleString("pt-BR"),
          icon: Building2,
          meta: `Global · últimos ${a6.windowMonths} meses · desde ${sinceLabel}`,
          help: "Contratantes com movimentação real (BR + Casa) nos últimos meses: publicar vaga, gerar pagamento, avaliar ou abrir o app. Quem também é freelancer conta aqui E no card de Freelancers Ativos — por isso não some com ele.",
        },
        {
          title: "Total de Ativos (União)",
          value: a6.total.toLocaleString("pt-BR"),
          icon: Users,
          meta: `Global · últimos ${a6.windowMonths} meses · quem é os dois papéis conta uma vez`,
          help: "União distinta de Freelancers Ativos + Contratantes Ativos — NÃO é a soma dos dois cards ao lado, porque a mesma pessoa pode ser freelancer e contratante e contaria duas vezes.",
        },
      ]
    : [];

  // Quebra por cidade dos ativos (campo novo, aninhado em `activeUsers6m`;
  // ainda não deployado em produção — tratar ausente como vazio, nunca quebrar).
  const byCity = a6?.byCity;
  const cityRows = (byCity?.rows ?? []).map((r, i) => ({
    id: i,
    cidade: r.city,
    freelancers: r.freelancers,
    contratantes: r.contractors,
    total: r.total,
  }));

  // Rótulo de escopo/janela em cada card (legenda logo abaixo dos filtros):
  // os KPIs misturam plataforma toda vs só Bares/Restaurantes, e foto do
  // momento vs acumulado histórico — sem o rótulo o painel induz a erro.
  const row1 = [
    { title: "Freelancers Cadastrados", value: String(m.totalFreelancers), icon: UserCheck, meta: "Global · acumulado", help: "Toda conta de freelancer já criada na plataforma (BR + Casa) que não foi banida. Não mede atividade — é cadastro acumulado." },
    { title: "Contratantes Cadastrados", value: String(m.totalCompanies), icon: Building2, meta: "Global · ativos", help: "Empresas/pessoas contratantes ativas, contando cada uma só uma vez mesmo se estiver nos dois módulos." },
    { title: "Novos Freelancers (Mês)", value: String(m.newFreelancersThisMonth), icon: RefreshCw, meta: "Global · mês atual", help: "Contas de freelancer criadas do dia 1º deste mês até agora (mês-calendário, não 30 dias corridos)." },
    usuariosAtivosCard,
  ];

  // "Desde o início" = go-live real da operação (corte vem da API em launchDate;
  // vagas de teste anteriores ficam fora). "Não concluídas" = tiveram desfecho
  // sem serviço concluído (canceladas ou janela encerrada sem job COMPLETED);
  // vagas ainda em aberto não contam.
  const launchLabel = m.launchDate
    ? m.launchDate.split("-").reverse().join("/")
    : "o início";

  // Quebra Empresa × Casa dos KPIs detalhados. Quando a API devolve o par, o
  // número grande passa a ser o TOTAL dos dois produtos (antes era só o de
  // Empresa, rotulado "BR ·", que era justamente a ambiguidade reclamada) e o
  // rodapé abre Empresa/Casa. API sem o bloco → cai no comportamento antigo.
  const bm = m.byModule;
  const detalhado = (
    split: ModuleSplit | undefined,
    fallback: number,
    janela: string,
  ) => ({
    value: String(split ? split.total : fallback),
    breakdown: moduleBreakdown(split),
    meta: split ? `Empresa + Casa · ${janela}` : `BR · ${janela}`,
  });

  const row2 = [
    {
      title: "Vagas Abertas",
      icon: Briefcase,
      ...detalhado(bm?.openVacancies, m.openVacancies, "agora"),
      help: "Vagas abertas NESTE momento, ainda dentro do prazo, aceitando candidaturas. Não muda com a barra de período — é foto do momento.",
    },
    {
      title: "Candidaturas Aceitas",
      icon: CheckCircle2,
      iconColor: "text-green-500",
      ...detalhado(bm?.acceptedCandidacies, m.acceptedCandidacies, "acumulado"),
      help: "Total histórico de freelancers aceitos em vagas, nos dois produtos. É acumulado desde o início — não significa vagas preenchidas agora, e não muda com a barra de período.",
    },
    {
      title: "Vagas Abertas e Não Concluídas",
      help: "Das vagas de Empresa (Bares & Restaurantes) criadas desde o início real da operação, quantas terminaram SEM serviço concluído: canceladas ou com o prazo encerrado sem ninguém concluir o job. Vagas ainda em andamento não contam.",
      value:
        m.vacanciesNotCompletedSinceLaunch !== undefined
          ? String(m.vacanciesNotCompletedSinceLaunch)
          : "N/A",
      icon: Hourglass,
      meta:
        m.vacanciesCreatedSinceLaunch !== undefined
          ? `Empresa · de ${m.vacanciesCreatedSinceLaunch} criadas desde ${launchLabel}`
          : `Empresa · desde ${launchLabel}`,
    },
    {
      title: "Vagas Canceladas",
      icon: Ban,
      iconColor: "text-red-500",
      ...detalhado(bm?.cancelledVacancies, m.cancelledVacancies, "acumulado"),
      help: "Total histórico de vagas canceladas (pelo contratante, admin ou sistema) desde o início, incluindo o período de testes.",
    },
  ];

  const row3 = [
    {
      title: "Taxa de Preenchimento (30d)",
      help: "Das vagas de Empresa (Bares & Restaurantes) criadas nos últimos 30 dias que já tiveram desfecho (preencheram todos os postos ou expiraram sem preencher), a porcentagem que preencheu. Vagas canceladas e vagas ainda abertas ficam fora da conta. Janela fixa de 30 dias — não segue a barra de período.",
      value: fillRate === null ? "N/A" : `${fillRate}%`,
      icon: TrendingUp,
      iconColor: "text-green-500",
      meta:
        fillRate === null
          ? "Empresa · sem vagas encerradas nos últimos 30 dias"
          : `Empresa · meta 80% · ${filled30d}/${decided30d} vagas encerradas`,
      metaColor: fillRate !== null && fillRate >= 80 ? "text-green-500" : "text-red-500",
      ...(fillRate !== null ? { progress: fillRate } : {}),
    },
    {
      title: "Jobs Agendados",
      icon: Timer,
      ...detalhado(bm?.scheduledJobs, m.scheduledJobs, "agora"),
      help: "Serviços já pagos e confirmados aguardando o dia/horário de início (freelancer contratado, check-in ainda não feito).",
    },
    {
      title: "Jobs em Andamento",
      icon: Clock,
      ...detalhado(bm?.inProgressJobs, m.inProgressJobs, "agora"),
      help: "Serviços acontecendo AGORA: o freelancer fez check-in e ainda não fez check-out.",
    },
    {
      title: "Serviços Concluídos",
      icon: ListChecks,
      iconColor: "text-green-500",
      ...detalhado(bm?.completedJobs, m.completedJobs, "acumulado"),
      help: "Total histórico de serviços finalizados com check-out desde o início da plataforma, nos dois produtos.",
    },
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
  // Rótulos da janela: quem manda é o que a API DE FATO aplicou (`period`), não
  // o que está selecionado na barra — período inválido cai no default lá e o
  // painel precisa dizer a verdade. API sem o bloco → volta ao mês-calendário.
  const janelaAtual = m.period?.label ?? mesAtual;
  const janelaAnterior = m.period?.previousLabel ?? mesAnterior;
  const sBm = s?.byModule;

  const mom = (
    cur: number,
    prev: number,
    higherIsBetter: boolean,
    extra?: string | null,
  ) => ({
    meta: [
      `${janelaAtual} · ${prev} em ${janelaAnterior} (${deltaLabel(cur, prev)})`,
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
          meta: `Global · acumulado · +${s.contractors.newInPeriod ?? s.contractors.newThisMonth} novos em ${janelaAtual}`,
          help: "Contas de contratante ativas na plataforma inteira (Empresa + Casa), contando cada conta uma única vez. Não é quebrado por produto de propósito: a mesma conta pode publicar nos dois, e somar por módulo contaria a mesma empresa duas vezes. É o tamanho da carteira de demanda.",
        },
        {
          title: "Total de Freelancers",
          value: String(s.freelancers.total),
          icon: UserCheck,
          meta: `Global · acumulado · +${s.freelancers.newInPeriod ?? s.freelancers.newThisMonth} novos em ${janelaAtual}`,
          help: "Contas de freelancer ativas na plataforma inteira. Global por natureza — o mesmo freelancer atende Empresa e Casa. Ler sempre junto com \"Vagas em Aberto sem Freelancer\": cadastro alto com vaga parada = base dormente, não oferta real.",
        },
        {
          title: "Vagas Geradas",
          value: String(s.vacanciesCreated.current),
          icon: Briefcase,
          breakdown: moduleBreakdown(sBm?.vacanciesCreated),
          ...mom(s.vacanciesCreated.current, s.vacanciesCreated.previous, true),
          help: "Vagas publicadas na janela escolhida, somando Empresa (Bares & Restaurantes) e Casa (Freela em Casa) — a quebra vem logo abaixo do número. É o pulso da demanda: antecipa o faturamento em 1 a 2 semanas.",
        },
        {
          title: "Vagas em Aberto sem Freelancer",
          value: String(s.openVacanciesWithoutProvider),
          icon: Hourglass,
          iconColor: s.openVacanciesWithoutProvider > 0 ? "text-red-500" : "text-[#eca826]",
          breakdown: moduleBreakdown(sBm?.openVacanciesWithoutProvider),
          meta: "Agora · não muda com o período · fila de risco (contratante esperando)",
          metaColor: s.openVacanciesWithoutProvider > 0 ? "text-red-500" : "text-[#737373]",
          help: "Vagas publicadas, ainda dentro do prazo e sem nenhuma candidatura aceita, NESTE momento. É foto do momento: a barra de período não mexe neste card. Cada uma é um contratante esperando — se o número cresce, acione freelancers da cidade antes de virar cancelamento.",
        },
        {
          title: "Contratações Concluídas",
          value: String(s.completedJobs.current),
          icon: ListChecks,
          iconColor: "text-green-500",
          breakdown: moduleBreakdown(sBm?.completedJobs),
          ...mom(
            s.completedJobs.current,
            s.completedJobs.previous,
            true,
            `acumulado ${s.completedJobs.total}`,
          ),
          help: "Serviços que chegaram ao fim (check-out) na janela escolhida, com a quebra Empresa × Casa abaixo do número. Junto com \"Vagas Geradas\" forma a conversão real do marketplace.",
        },
        {
          title: "Vagas Canceladas sem Freelancer",
          value: String(s.vacanciesCancelledWithoutProvider.current),
          icon: Ban,
          iconColor:
            s.vacanciesCancelledWithoutProvider.current > 0 ? "text-red-500" : "text-[#eca826]",
          breakdown: moduleBreakdown(sBm?.vacanciesCancelledWithoutProvider),
          ...mom(
            s.vacanciesCancelledWithoutProvider.current,
            s.vacanciesCancelledWithoutProvider.previous,
            false,
            shareLabel(s.vacanciesCancelledWithoutProvider.current, s.vacanciesCreated.current)
              ? `${shareLabel(s.vacanciesCancelledWithoutProvider.current, s.vacanciesCreated.current)} das vagas geradas`
              : null,
          ),
          help: "Vagas canceladas na janela que NUNCA tiveram um freelancer aceito — a plataforma não entregou. O app ainda não pede o motivo do cancelamento, então este é o recorte que o sistema consegue gerar sozinho; quando o motivo virar campo obrigatório, o card passa a usá-lo.",
        },
        {
          title: "Freelancer Não Compareceu",
          value: String(s.noShows.current),
          icon: UserX,
          iconColor: s.noShows.current > 0 ? "text-red-500" : "text-[#eca826]",
          breakdown: moduleBreakdown(sBm?.noShows),
          ...mom(
            s.noShows.current,
            s.noShows.previous,
            false,
            shareLabel(s.noShows.current, s.noShows.jobsScheduledCurrent)
              ? `${shareLabel(s.noShows.current, s.noShows.jobsScheduledCurrent)} dos ${s.noShows.jobsScheduledCurrent} jobs da janela`
              : null,
          ),
          help: "Faltas registradas pela régua de reputação na janela escolhida: serviço sem check-in depois da tolerância, e cancelamento do freelancer em cima da hora (menos de 6h), que a régua trata como falta. A quebra abaixo diz em qual produto a falta aconteceu. Infrações anuladas pelo admin não contam.",
        },
        {
          title: "Faturamento Total",
          value: formatCurrency(s.platformRevenue.current),
          icon: DollarSign,
          iconColor: "text-green-500",
          breakdown: moduleBreakdown(sBm?.platformRevenue, formatCurrency),
          ...mom(
            s.platformRevenue.current,
            s.platformRevenue.previous,
            true,
            `GMV ${formatCurrency(s.platformRevenue.gmvCurrent)} · acumulado ${formatCurrency(s.platformRevenue.total)}`,
          ),
          help: "Taxa da plataforma (percentual + taxa fixa) das vagas efetivamente pagas na janela, já líquida de estornos (pagamento estornado sai da soma), com a quebra Empresa × Casa abaixo. Diferente do GMV, que é todo o dinheiro que passou pela plataforma. A aba Financeiro ainda desconta as taxas de gateway para chegar ao lucro.",
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

      {/* Barra de período — janela dos indicadores de fluxo. */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs font-medium text-[#737373] mr-1">Período:</span>
        <div className="inline-flex flex-wrap rounded-lg border border-[#e5e5e5] bg-white p-0.5">
          {PERIOD_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodo(p.id)}
              aria-pressed={periodo === p.id}
              className={
                periodo === p.id
                  ? "px-3 h-8 rounded-md text-sm font-semibold bg-[#eca826] text-[#1d1d1b] cursor-pointer"
                  : "px-3 h-8 rounded-md text-sm text-[#737373] hover:bg-[#f7f7f7] cursor-pointer transition-colors"
              }
            >
              {p.label}
            </button>
          ))}
        </div>
        {periodo === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={dataInicio}
              max={dataFim}
              onChange={(e) => setDataInicio(e.target.value)}
              aria-label="Início do período"
              className="h-9 px-3 rounded-lg bg-white border border-[#e5e5e5] text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
            />
            <span className="text-xs text-[#737373]">até</span>
            <input
              type="date"
              value={dataFim}
              min={dataInicio}
              max={isoDayBrasilia(0)}
              onChange={(e) => setDataFim(e.target.value)}
              aria-label="Fim do período"
              className="h-9 px-3 rounded-lg bg-white border border-[#e5e5e5] text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
            />
          </div>
        )}
      </div>

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
        Os cards abaixo somam os dois produtos e abrem a quebra{" "}
        <strong>Empresa</strong> (Bares &amp; Restaurantes) <strong>× Casa</strong> (Freela em Casa)
        logo abaixo do número. Os indicadores de fluxo medem{" "}
        <strong>{janelaAtual}</strong> e comparam com <strong>{janelaAnterior}</strong>; os de{" "}
        <strong>foto do momento</strong> e os <strong>acumulados</strong> dizem isso no rodapé e não
        mudam com o período. Cadastros e usuários seguem marcados como{" "}
        <strong>Global</strong> — a mesma conta atende os dois produtos, então não são quebrados por
        módulo.
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

      {/* Freelancers/Contratantes Ativos — cards de primeiro nível (pedido do dono). */}
      {cardsAtivos.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {cardsAtivos.map((k) => (
            <KpiCard key={k.title} {...k} />
          ))}
        </div>
      )}

      {/* Ativos por cidade — quebra do card acima. */}
      {a6 && (
        <div className="bg-white rounded-xl border border-[#e5e5e5] p-5 mb-6">
          <h3 className="font-semibold text-[#1d1d1b] mb-1">Ativos por Cidade</h3>
          <p className="text-xs text-[#737373] mb-4">
            Freelancers e contratantes com movimentação real nos últimos {a6.windowMonths} meses
            (desde {sinceLabel || "—"}), agrupados pela cidade do cadastro. A coluna{" "}
            <strong>Total</strong> é a união distinta de cada linha — nunca a soma de Freelancers +
            Contratantes.
          </p>
          {byCity ? (
            <DataTable
              columns={[
                { header: "Cidade", accessor: "cidade" as const, sortable: true, sortAccessor: (r) => r.cidade },
                {
                  header: "Freelancers",
                  accessor: (r) => r.freelancers.toLocaleString("pt-BR"),
                  sortable: true,
                  sortAccessor: (r) => r.freelancers,
                },
                {
                  header: "Contratantes",
                  accessor: (r) => r.contratantes.toLocaleString("pt-BR"),
                  sortable: true,
                  sortAccessor: (r) => r.contratantes,
                },
                {
                  header: "Total",
                  accessor: (r) => r.total.toLocaleString("pt-BR"),
                  sortable: true,
                  sortAccessor: (r) => r.total,
                },
              ]}
              data={cityRows}
              searchPlaceholder="Buscar cidade..."
              searchKey="cidade"
              footer={
                <div className="flex flex-col gap-1 text-sm text-[#737373]">
                  <span>
                    {cityRows.length === 0
                      ? "Nenhuma cidade com ativos nesta janela."
                      : `Mostrando ${cityRows.length.toLocaleString("pt-BR")} cidade${cityRows.length === 1 ? "" : "s"} (top, desc por total)`}
                    {byCity.othersCities > 0 &&
                      ` · + ${byCity.othersCities.toLocaleString("pt-BR")} outra${byCity.othersCities === 1 ? "" : "s"} cidade${byCity.othersCities === 1 ? "" : "s"} (${byCity.othersTotal.toLocaleString("pt-BR")} ativos)`}
                  </span>
                  {byCity.withoutCity > 0 && (
                    <span>Sem cidade cadastrada: {byCity.withoutCity.toLocaleString("pt-BR")} ativos</span>
                  )}
                </div>
              }
            />
          ) : (
            <p className="text-sm text-[#737373]">
              Quebra por cidade indisponível nesta versão da API — aguardando o deploy do backend
              (branch <code>feat/ativos-por-cidade</code>).
            </p>
          )}
        </div>
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

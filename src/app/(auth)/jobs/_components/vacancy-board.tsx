"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";

import type { VacancyItem } from "@/modules/admin/infrastructure/admin-api";
import { useSupportChecklist } from "@/modules/admin/application/use-support-checklist";
import type { OutreachStage } from "@/modules/admin/infrastructure/vacancy-outreach-api";
import type { VacancyBucket } from "./vacancy-bucket";
import {
  calcularJanela,
  compararUrgencia,
  resolverPendencias,
  type JanelaDaVaga,
  type PendenciasDaVaga,
} from "./support-actions";
import { SupportAlertBanner, type AlertaDeVaga } from "./support-alert-banner";
import { SupportWorkspace } from "./support-workspace";

/**
 * Modo Painel: as vagas em colunas por etapa do funil.
 *
 * Cada coluna é uma etapa, na ordem em que a vaga anda (esquerda → direita), e
 * a cor sinaliza a temperatura: vermelho no que está parado sem candidato,
 * verde no que fechou. Quem olha de passagem entende a direção sem legenda.
 *
 * O componente é BURRO de propósito quanto à CLASSIFICAÇÃO: recebe as vagas já
 * com o `bucket` resolvido e só desenha (`resolveVacancyBucket` vive em
 * `vacancy-bucket.ts`, uma fonte só para a tabela e para o painel). O recorte
 * de ATIVIDADE, esse sim, mora aqui — é regra de exibição do painel, não de
 * classificação, e a tabela continua mostrando o histórico inteiro.
 */

export type BoardBucket = VacancyBucket;

export interface BoardVacancy {
  id: string;
  bucket: BoardBucket;
  empresa: string;
  cargo: string;
  cidade: string;
  candidatos: number;
  /** Já formatado ("R$ 180,00"). O painel não faz conta. */
  valor: string;
  /**
   * O mesmo valor em centavos, para o somatório por etapa.
   *
   * Vem cru justamente porque o painel NÃO deve reconverter o texto formatado:
   * "R$ 1.234,56" parseado de volta é onde nasce erro de milhar.
   */
  valorCents: number;
  /**
   * Nosso resíduo (margem) na vaga, em centavos: taxa de serviço (já líquida do
   * desconto do plano) + taxa Pix — a mesma conta do lucro do financeiro. O
   * seguro não entra (vai à seguradora) e o INSS é à parte (fora da plataforma).
   *
   * Separado do valor porque respondem perguntas diferentes: o valor diz quanto
   * dinheiro passa pela etapa, o resíduo diz quanto fica para nós (não é "lucro":
   * não abate custos). Zero quando a vaga não tem snapshot de taxa (vagas antigas).
   */
  residuoCents: number;
  /** Dia do SERVIÇO, já formatado ("12/08"). */
  data: string;
  /** Faixa do turno, já formatada ("18:00 - 00:00"). */
  turno: string;
  /** Freelancer aceito, quando já houver. */
  freelancer: string | null;
  /**
   * Contatos para os atalhos da área de trabalho. Opcionais: o Freela em Casa
   * não expõe telefone na listagem, e a gaveta prefere dizer "sem telefone" a
   * exigir três `null` de quem não tem o dado.
   */
  freelancerTelefone?: string | null;
  contratanteContato?: string | null;
  contratanteTelefone?: string | null;
  raw: VacancyItem;
}

/**
 * Colunas na ordem do fluxo.
 *
 * `lost` e `cancelled` ficam fora: não pedem ação e comeriam a largura das que
 * pedem. `lost` na prática nunca chega até aqui — expirou sem contratação é,
 * por definição, serviço no passado, e o recorte de atividade já o removeu.
 */
const COLUNAS: Array<{
  bucket: BoardBucket;
  titulo: string;
  /** O que a coluna cobra de quem está olhando. */
  chamada: string;
  cor: string;
  corFundo: string;
}> = [
  {
    bucket: "open",
    titulo: "Aberta · sem candidato",
    chamada: "publicada, ninguém se candidatou ainda",
    cor: "#DC2626",
    corFundo: "#FEF2F2",
  },
  {
    bucket: "awaitingSelection",
    titulo: "Aguardando seleção",
    chamada: "tem candidato — o contratante precisa escolher",
    cor: "#D97706",
    corFundo: "#FFFBEB",
  },
  {
    bucket: "awaitingPayment",
    titulo: "Aguardando pagamento",
    chamada: "freelancer escolhido, falta pagar",
    cor: "#7C3AED",
    corFundo: "#F5F3FF",
  },
  {
    bucket: "confirmed",
    titulo: "Freela confirmado",
    chamada: "pago e agendado para o turno",
    cor: "#2563EB",
    corFundo: "#EFF6FF",
  },
  {
    bucket: "inProgress",
    titulo: "Em andamento",
    chamada: "freelancer no local agora",
    cor: "#0D9488",
    corFundo: "#F0FDFA",
  },
  {
    bucket: "completedAwaitingReview",
    titulo: "Aguardando avaliação",
    chamada: "trava o repasse ao freelancer",
    cor: "#65A30D",
    corFundo: "#F7FEE7",
  },
  {
    bucket: "completedReviewed",
    titulo: "Concluída",
    chamada: "ciclo fechado",
    cor: "#16A34A",
    corFundo: "#F0FDF4",
  },
];

/**
 * Etapas em que a vaga está parada esperando o CONTRATANTE — as únicas que
 * ganham botão de aviso. Nas demais quem deve a ação é o freelancer ou o
 * sistema, e cobrar o contratante ali seria ruído.
 */
export type AvisoStage = "awaitingSelection" | "awaitingPayment";

const AVISO_POR_BUCKET: Partial<Record<BoardBucket, { stage: AvisoStage; rotulo: string }>> = {
  awaitingSelection: { stage: "awaitingSelection", rotulo: "Cobrar escolha" },
  awaitingPayment: { stage: "awaitingPayment", rotulo: "Cobrar pagamento" },
};

/** Verde do "já avisado". Fica no card inteiro, não só no botão: o painel é
 *  lido de longe, e uma tarja fina não se vê da mesa. */
const COR_AVISADO = "#16A34A";

/** Quantos cards por coluna antes de virar um "+N". */
const MAX_CARDS = 8;

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/**
 * Soma em centavos → reais arredondados.
 *
 * Sem centavos de propósito: o número existe para dar a ordem de grandeza da
 * etapa de relance, na TV, e "R$ 4.180" se lê mais rápido que "R$ 4.180,00".
 * O valor exato de cada vaga continua no card.
 */
export function somaFormatada(cents: number): string {
  return BRL.format(Math.round(cents / 100));
}

const SP_TZ = "America/Sao_Paulo";

const PARTES_DIA_BR = new Intl.DateTimeFormat("en-US", {
  timeZone: SP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Dia-calendário de um instante em Brasília, como "YYYY-MM-DD".
 *
 * Montado por `formatToParts` e não por `toLocaleDateString`: a ordem dos
 * campos muda com o locale da máquina, e aqui o formato precisa ser sempre o
 * ISO para a comparação de dias funcionar.
 */
function diaEmBrasilia(d: Date): string {
  const partes = PARTES_DIA_BR.formatToParts(d);
  const campo = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${campo("year")}-${campo("month")}-${campo("day")}`;
}

/** Dia do SERVIÇO como "YYYY-MM-DD", ou null se não der para ler. */
function diaDoServico(v: VacancyItem): string | null {
  // `date` chega como "YYYY-MM-DD" (gravado meia-noite UTC): o dia já está no
  // prefixo, e lê-lo direto evita o desvio para o dia anterior em UTC-3.
  const puro = v.date?.slice(0, 10);
  if (puro && /^\d{4}-\d{2}-\d{2}$/.test(puro)) return puro;

  // Sem `date` legível: cai no instante do turno, convertido para o dia em SP.
  const iso = v.startTime || v.endTime;
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : diaEmBrasilia(new Date(ms));
}

function referenciaDeTempo(v: VacancyItem): number | null {
  const iso = v.startTime || v.date || v.createdAt;
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Quando a vaga foi PUBLICADA — é por aqui que as colunas ordenam.
 *
 * Não confundir com `diaDoServico`, que é o dia do turno e decide o recorte.
 * Vaga aberta hoje para daqui a duas semanas é notícia nova mesmo com serviço
 * distante; é ela que precisa aparecer no topo.
 */
function aberturaEm(v: VacancyItem): number {
  const iso = v.createdAt || v.date || v.startTime;
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Mantém no painel só o que ainda diz respeito a hoje.
 *
 * Em 03/08/2026 o painel mostrava ~350 vagas, das quais 251 tinham mais de 30
 * dias — havia vaga em "aguardando pagamento" há 67 dias, e eram 140 vagas
 * `CLOSED` de datas já passadas empilhadas nessa coluna. Um quadro de
 * acompanhamento cheio de vaga morta não é acompanhamento, é arquivo — e o que
 * precisa de gente hoje some no meio.
 *
 * A régua é o DIA do serviço, não o horário de término: a vaga de hoje fica no
 * painel o dia inteiro (inclusive depois do turno acabar, que é quando alguém
 * ainda vai conferir se deu certo) e sai sozinha na virada.
 *
 * Duas exceções, ambas para não esconder justamente o caso que precisa de
 * gente: vaga EM ANDAMENTO nunca sai — freelancer com check-in aberto e sem
 * check-out passou do dia é anomalia, não histórico; e vaga sem data legível
 * também fica, porque sumir com um registro por não conseguir ler a data dele
 * seria esconder o mais estranho de todos.
 *
 * Comparação por string: datas em ISO ordenam lexicograficamente, então
 * `"2026-08-03" >= "2026-08-03"` resolve o dia sem nenhuma conta de fuso.
 */
export function filtrarAtivas(
  vagas: BoardVacancy[],
  agora: number = Date.now(),
): BoardVacancy[] {
  const hoje = diaEmBrasilia(new Date(agora));
  return vagas.filter((v) => {
    if (v.bucket === "inProgress") return true;
    const dia = diaDoServico(v.raw);
    if (dia === null) return true;
    return dia >= hoje;
  });
}

/**
 * Vaga que precisa de gente AGORA: o serviço já começou (ou começa em menos de
 * duas horas) e o pagamento ainda não saiu. É o caso em que o sistema cancela a
 * vaga sozinho ao bater o horário de início — melhor alguém ver antes.
 */
function precisaDeAtencao(item: BoardVacancy, agora: number): boolean {
  if (item.bucket !== "awaitingPayment") return false;
  const ref = referenciaDeTempo(item.raw);
  if (ref === null) return false;
  return ref - agora < 2 * 60 * 60 * 1000;
}

function CardVaga({
  item,
  cor,
  agora,
  onSelect,
  aviso,
  avisadoEm,
  onAvisar,
  avisando,
  pendencias,
  onAbrirAcoes,
}: {
  item: BoardVacancy;
  cor: string;
  agora: number;
  onSelect: (vacancyId: string) => void;
  aviso?: { stage: AvisoStage; rotulo: string };
  avisadoEm?: string;
  onAvisar?: (vacancyId: string, stage: AvisoStage) => void;
  avisando?: boolean;
  /** Checklist do suporte para esta vaga. Ausente = painel sem área de trabalho. */
  pendencias?: PendenciasDaVaga;
  onAbrirAcoes?: (vacancyId: string) => void;
}) {
  const atencao = precisaDeAtencao(item, agora);
  const jaAvisado = Boolean(avisadoEm);
  const temCritica = (pendencias?.criticasPendentes.length ?? 0) > 0;
  // Ordem da cor da borda: ação crítica pendente vence tudo — é o estado que
  // custa dinheiro. Depois "já avisado" (alguém tratou), depois a urgência de
  // horário, e por fim a cor da própria etapa.
  const corBorda = temCritica
    ? "#DC2626"
    : jaAvisado
      ? COR_AVISADO
      : atencao
        ? "#F97316"
        : cor;

  return (
    <div
      style={{
        borderLeftColor: corBorda,
        background: temCritica ? "#FEF2F2" : jaAvisado ? "#F0FDF4" : undefined,
      }}
      className={`rounded-[10px] border border-[#E2E8F0] border-l-[3px] bg-white shadow-[0_1px_2px_rgba(15,23,42,.04)] transition-all hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(15,23,42,.08)] ${
        atencao ? "ring-1 ring-[#F97316]/30" : ""
      }`}
    >
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      // O card abre o MESMO modal de detalhes da tabela — não existe uma
      // segunda tela de vaga. `text-left` porque button centraliza por padrão.
      className="w-full cursor-pointer rounded-t-[10px] px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#94A3B8]"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        {/* Id encurtado: o suficiente para casar com o suporte sem ocupar a
            linha inteira com um uuid que ninguém lê de relance. */}
        <span className="font-mono text-[10.5px] font-semibold tracking-wide text-[#94A3B8]">
          {item.id.slice(0, 8)}
        </span>
        <span className="shrink-0 text-[12.5px] font-bold text-[#0F172A]">{item.valor}</span>
      </div>

      <div className="truncate text-[13.5px] font-semibold leading-tight text-[#0F172A]">
        {item.cargo}
      </div>
      <div className="mt-0.5 truncate text-[12px] text-[#475569]">{item.empresa}</div>

      <div className="mt-1.5 flex flex-col gap-px text-[11px] text-[#94A3B8]">
        {item.cidade && item.cidade !== "N/A" ? (
          <span className="truncate">{item.cidade}</span>
        ) : null}
        <span className={atencao ? "font-semibold text-[#C2410C]" : ""}>
          {item.data} · {item.turno}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 border-t border-[#F1F5F9] pt-2 text-[12px]">
        {item.freelancer ? (
          <>
            <span
              style={{ background: cor }}
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              aria-hidden
            >
              {item.freelancer.charAt(0).toUpperCase()}
            </span>
            <span className="truncate font-medium text-[#334155]">{item.freelancer}</span>
          </>
        ) : (
          <span className="italic text-[#94A3B8]">
            {item.candidatos > 0
              ? `${item.candidatos} candidato${item.candidatos > 1 ? "s" : ""}`
              : "Nenhum candidato ainda"}
          </span>
        )}
      </div>

      {aviso && onAvisar ? (
        <div className="mt-2 border-t border-[#F1F5F9] pt-2">
          {jaAvisado ? (
            <span className="text-[11px] font-semibold text-[#16A34A]">
              ✓ Avisado {formatarQuando(avisadoEm!)}
            </span>
          ) : (
            <span className="text-[11px] text-[#94A3B8]">Ainda não avisado</span>
          )}
        </div>
      ) : null}
    </button>

      {/* Rodapé FORA do <button> do card: botão dentro de botão é HTML inválido
          e o clique de um dispararia o outro. É aqui que mora a operação —
          quantas ações do checklist já saíram e a cobrança da etapa. */}
      {(pendencias && onAbrirAcoes) || (aviso && onAvisar) ? (
        <div className="flex items-center gap-1.5 border-t border-[#F1F5F9] px-2.5 py-1.5">
          {pendencias && onAbrirAcoes ? (
            <button
              type="button"
              onClick={() => onAbrirAcoes(item.id)}
              title={
                temCritica
                  ? `${pendencias.criticasPendentes.length} ação(ões) crítica(s) pendente(s)`
                  : "Abrir a área de trabalho do suporte"
              }
              className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                temCritica
                  ? "bg-[#DC2626] text-white hover:bg-[#B91C1C]"
                  : pendencias.concluida
                    ? "bg-[#DCFCE7] text-[#166534] hover:bg-[#BBF7D0]"
                    : "bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0]"
              }`}
            >
              <ClipboardCheck className="h-3 w-3" aria-hidden />
              {pendencias.feitas}/{pendencias.total}
              {temCritica ? ` · ${pendencias.criticasPendentes.length} crítica(s)` : ""}
            </button>
          ) : null}

          {aviso && onAvisar ? (
            <button
              type="button"
              disabled={avisando}
              onClick={() => onAvisar(item.id, aviso.stage)}
              className={`ml-auto cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
                jaAvisado
                  ? "bg-[#DCFCE7] text-[#166534] hover:bg-[#BBF7D0]"
                  : "bg-[#1d1d1b] text-white hover:bg-[#333]"
              }`}
              title={
                jaAvisado
                  ? "Já avisado — clique para mandar de novo"
                  : `Mandar no WhatsApp: ${aviso.rotulo.toLowerCase()}`
              }
            >
              {avisando ? "Enviando…" : jaAvisado ? "Reenviar" : aviso.rotulo}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** "hoje 14:32" / "ontem" / "09/08" — o suficiente para saber se a cobrança é
 *  recente sem ocupar a linha inteira. */
function formatarQuando(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  const hoje = diaEmBrasilia(new Date());
  const dia = diaEmBrasilia(d);
  if (dia === hoje) {
    return `hoje ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: SP_TZ })}`;
  }
  const [, mes, diaDoMes] = dia.split("-");
  return `${diaDoMes}/${mes}`;
}

export function VacancyBoard({
  vacancies,
  isFetching,
  onSelect,
  avisados,
  onAvisar,
  avisando,
  areaDeTrabalho = false,
  quemTicou,
  onReenviarGrupo,
}: {
  vacancies: BoardVacancy[];
  isFetching: boolean;
  /** Abre os detalhes da vaga. O quadro só emite o id — quem resolve a linha
   *  e abre o modal é a página, a mesma da tabela. */
  onSelect: (vacancyId: string) => void;
  /** Chave "vagaId::etapa" → quando o aviso saiu. Ausente = ainda não avisado. */
  avisados?: Map<string, string>;
  /** Dispara o aviso da etapa. Ausente = o painel não mostra o botão (é o caso
   *  de quem abre o quadro sem permissão de disparo). */
  onAvisar?: (vacancyId: string, stage: AvisoStage) => void;
  /** Vaga com envio em curso, para travar o botão sem travar o painel. */
  avisando?: string | null;
  /**
   * Liga a área de trabalho do suporte: banner vermelho, checklist por vaga e
   * a gaveta de ações. Desligada por padrão — quem quiser o painel como quadro
   * de acompanhamento puro (a TV da sala) continua com o quadro de antes.
   */
  areaDeTrabalho?: boolean;
  /** Nome de quem está no painel — vai gravado em cada tique do checklist. */
  quemTicou?: string | null;
  /** Reenvia o anúncio no grupo da cidade (atalho da primeira ação da etapa
   *  "aberta sem candidato"). Ausente = a ação continua lá, só sem o botão. */
  onReenviarGrupo?: (vacancyId: string) => Promise<void>;
}) {
  const [busca, setBusca] = useState("");
  /** Vaga com a área de trabalho aberta. */
  const [acoesDe, setAcoesDe] = useState<string | null>(null);
  const checklist = useSupportChecklist(quemTicou);

  // Um relógio só para o painel inteiro: recalcular por card a cada render
  // custaria caro com centenas de vagas. Um minuto basta.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const ativas = useMemo(() => filtrarAtivas(vacancies, agora), [vacancies, agora]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return ativas;
    return ativas.filter((v) =>
      [v.cargo, v.empresa, v.cidade, v.id, v.freelancer ?? ""].some((campo) =>
        campo.toLowerCase().includes(q),
      ),
    );
  }, [ativas, busca]);

  /**
   * Checklist do suporte resolvido por vaga: a janela de tempo, a prioridade e
   * o que ainda falta fazer.
   *
   * Uma passada só para o painel inteiro — o banner, a ordem das colunas e o
   * rodapé de cada card leem daqui, e recalcular em cada um faria três verdades
   * diferentes do mesmo checklist.
   */
  const contexto = useMemo(() => {
    const mapa = new Map<string, { janela: JanelaDaVaga; pendencias: PendenciasDaVaga }>();
    if (!areaDeTrabalho) return mapa;
    for (const v of visiveis) {
      const janela = calcularJanela(v.raw, agora);
      mapa.set(v.id, {
        janela,
        pendencias: resolverPendencias(v.bucket, janela, checklist.feitasDaVaga(v.id)),
      });
    }
    return mapa;
    // `checklist.feitasDaVaga` muda de identidade a cada tique — é ele que faz
    // o banner apagar a linha no mesmo clique.
  }, [areaDeTrabalho, visiveis, agora, checklist]);

  const porBucket = useMemo(() => {
    const mapa = new Map<BoardBucket, BoardVacancy[]>();
    for (const v of visiveis) {
      const lista = mapa.get(v.bucket) ?? [];
      lista.push(v);
      mapa.set(v.bucket, lista);
    }
    /**
     * Ordem da coluna: a régua de prioridade primeiro, abertura só no empate.
     *
     * Era "mais recente primeiro", usando a novidade como proxy de "ninguém
     * viu ainda". Com o checklist não é mais preciso adivinhar: o topo da
     * coluna passa a ser o que tem menos tempo até o turno e ação pendente —
     * exatamente a fila em que o suporte atende.
     */
    for (const lista of mapa.values()) {
      lista.sort((a, b) => {
        const ca = contexto.get(a.id);
        const cb = contexto.get(b.id);
        if (ca && cb) {
          const urgencia = compararUrgencia(
            { prioridade: ca.pendencias.prioridade, janela: ca.janela },
            { prioridade: cb.pendencias.prioridade, janela: cb.janela },
          );
          if (urgencia !== 0) return urgencia;
        }
        return aberturaEm(b.raw) - aberturaEm(a.raw);
      });
    }
    return mapa;
  }, [visiveis, contexto]);

  /**
   * As vagas com ação crítica em aberto, na ordem de atendimento.
   *
   * Só as etapas do fluxo entram: cobrar uma ação de vaga cancelada seria pedir
   * trabalho que não muda nada.
   */
  const alertas = useMemo<AlertaDeVaga[]>(() => {
    const itens = visiveis
      .filter((v) => v.bucket !== "cancelled" && v.bucket !== "lost")
      .map((v) => ({ vaga: v, ctx: contexto.get(v.id) }))
      .filter(
        (i): i is { vaga: BoardVacancy; ctx: { janela: JanelaDaVaga; pendencias: PendenciasDaVaga } } =>
          Boolean(i.ctx) && (i.ctx?.pendencias.criticasPendentes.length ?? 0) > 0,
      );
    itens.sort((a, b) =>
      compararUrgencia(
        { prioridade: a.ctx.pendencias.prioridade, janela: a.ctx.janela },
        { prioridade: b.ctx.pendencias.prioridade, janela: b.ctx.janela },
      ),
    );
    return itens.map(({ vaga, ctx }) => ({
      id: vaga.id,
      cargo: vaga.cargo,
      empresa: vaga.empresa,
      prioridade: ctx.pendencias.prioridade,
      horasAteInicio: ctx.janela.horasAteInicio,
      criticas: ctx.pendencias.criticasPendentes.map((a) => a.label),
    }));
  }, [visiveis, contexto]);

  const vagaEmFoco = acoesDe ? (vacancies.find((v) => v.id === acoesDe) ?? null) : null;

  const canceladas = porBucket.get("cancelled")?.length ?? 0;
  const emAcompanhamento = visiveis.length - canceladas;
  const ocultadas = vacancies.length - ativas.length;

  /**
   * Potencial por etapa e total.
   *
   * Só as colunas do fluxo entram — cancelada não é potencial, é perda, e somá-la
   * inflaria o número que a mesa usa para decidir onde correr atrás.
   */
  const potencialPorBucket = useMemo(() => {
    const mapa = new Map<BoardBucket, number>();
    for (const coluna of COLUNAS) {
      const itens = porBucket.get(coluna.bucket) ?? [];
      mapa.set(
        coluna.bucket,
        itens.reduce((soma, item) => soma + (item.valorCents || 0), 0),
      );
    }
    return mapa;
  }, [porBucket]);

  const potencialTotal = useMemo(
    () => [...potencialPorBucket.values()].reduce((soma, valor) => soma + valor, 0),
    [potencialPorBucket],
  );

  /** Resíduo (margem) por etapa e total — o que sobra para nós, não o que transaciona. */
  const residuoPorBucket = useMemo(() => {
    const mapa = new Map<BoardBucket, number>();
    for (const coluna of COLUNAS) {
      const itens = porBucket.get(coluna.bucket) ?? [];
      mapa.set(
        coluna.bucket,
        itens.reduce((soma, item) => soma + (item.residuoCents || 0), 0),
      );
    }
    return mapa;
  }, [porBucket]);

  const residuoTotal = useMemo(
    () => [...residuoPorBucket.values()].reduce((soma, valor) => soma + valor, 0),
    [residuoPorBucket],
  );

  const horaAtualizacao = new Date(agora).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SP_TZ,
  });

  return (
    <div className="rounded-xl bg-[#F8FAFC] p-4 text-[#0F172A]">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold leading-none tracking-tight">
            Vagas em andamento
          </h2>
          <p className="mt-1 text-[13px] text-[#64748B]">
            {emAcompanhamento} vaga(s) ativa(s) ·{" "}
            <span className="capitalize">
              {new Date(agora).toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                timeZone: SP_TZ,
              })}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Potencial total: o que está em jogo no painel inteiro, somando as
              etapas. Fica no topo porque é o número que a mesa olha primeiro. */}
          <div className="rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-2 text-right">
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#94A3B8]">
              Potencial do dia
            </div>
            <div className="text-[20px] font-bold leading-tight tabular-nums text-[#0F172A]">
              {somaFormatada(potencialTotal)}
            </div>
          </div>
          {/* Resíduo à parte, e não somado ao potencial: o potencial é o dinheiro
              que PASSA, o resíduo é o que FICA para nós (margem, não lucro —
              não abate custos). Juntar os dois num número só inflaria a mesa. */}
          <div className="rounded-[10px] border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-2 text-right">
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#16A34A]">
              Resíduo do dia (nossa margem)
            </div>
            <div className="text-[20px] font-bold leading-tight tabular-nums text-[#166534]">
              {somaFormatada(residuoTotal)}
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-[12px] text-[#64748B]">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isFetching ? "animate-pulse bg-[#22C55E]" : "bg-[#CBD5E1]"
              }`}
              aria-hidden
            />
            Atualizado às {horaAtualizacao}
          </span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar vaga, estabelecimento, freela…"
            aria-label="Buscar no painel"
            className="w-[300px] max-w-full rounded-[10px] border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-[13px] outline-none transition-colors focus:border-[#94A3B8]"
          />
        </div>
      </div>

      {/* Banner vermelho acima de tudo: a vaga que vai ser cancelada por falta
          de pagamento não pode depender de alguém rolar até a coluna certa. */}
      <SupportAlertBanner alertas={alertas} onAbrir={setAcoesDe} />

      {/* Colunas: rolagem horizontal só quando a tela for estreita demais. */}
      <div className="flex items-start gap-3 overflow-x-auto pb-2">
        {COLUNAS.map((coluna) => {
          const itens = porBucket.get(coluna.bucket) ?? [];
          const mostrados = itens.slice(0, MAX_CARDS);
          const restantes = itens.length - mostrados.length;

          return (
            <section
              key={coluna.bucket}
              className="flex min-w-[220px] flex-1 flex-col rounded-xl bg-[#F1F5F9]"
              aria-label={`${coluna.titulo}: ${itens.length}`}
            >
              <div
                style={{ background: coluna.corFundo }}
                className="rounded-t-xl px-3 py-2.5"
                title={coluna.chamada}
              >
                <div className="flex items-center gap-2">
                  <span
                    style={{ background: coluna.cor }}
                    className="h-2 w-2 shrink-0 rounded-full"
                    aria-hidden
                  />
                  <span className="flex-1 text-[12.5px] font-semibold leading-tight">
                    {coluna.titulo}
                  </span>
                  <span
                    style={{ color: coluna.cor }}
                    className="rounded-full bg-white px-2 py-0.5 text-[12px] font-bold tabular-nums"
                  >
                    {itens.length}
                  </span>
                </div>
                {/* Quanto dinheiro está parado NESTA etapa. É o que diz onde
                    correr atrás primeiro: 8 vagas de R$ 90 pesam menos que 2
                    de R$ 900. */}
                <div className="mt-1 flex items-baseline gap-2 pl-4">
                  <span
                    style={{ color: coluna.cor }}
                    className="text-[12px] font-bold tabular-nums"
                  >
                    {somaFormatada(potencialPorBucket.get(coluna.bucket) ?? 0)}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums text-[#16A34A]">
                    resíduo {somaFormatada(residuoPorBucket.get(coluna.bucket) ?? 0)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2 p-2.5">
                {mostrados.map((item) => {
                  const aviso = AVISO_POR_BUCKET[coluna.bucket];
                  return (
                    <CardVaga
                      key={item.id}
                      item={item}
                      cor={coluna.cor}
                      agora={agora}
                      onSelect={onSelect}
                      aviso={aviso}
                      avisadoEm={
                        aviso ? avisados?.get(`${item.id}::${aviso.stage}`) : undefined
                      }
                      onAvisar={onAvisar}
                      avisando={avisando === item.id}
                      pendencias={contexto.get(item.id)?.pendencias}
                      onAbrirAcoes={setAcoesDe}
                    />
                  );
                })}

                {itens.length === 0 ? (
                  <p className="rounded-[10px] border-[1.5px] border-dashed border-[#CBD5E1] py-6 text-center text-[12px] text-[#94A3B8]">
                    Nenhuma vaga
                  </p>
                ) : null}

                {restantes > 0 ? (
                  <p className="pt-0.5 text-center text-[12px] font-semibold text-[#64748B]">
                    + {restantes} nesta etapa
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {/* Legenda: sem ela as cores viram enfeite. Só as três que MUDAM o card
          entram — a cor de cada coluna já está no cabeçalho dela. */}
      <div className="mt-3 flex flex-wrap items-center gap-4 rounded-xl bg-white px-4 py-2.5 text-[11.5px] text-[#64748B]">
        <span className="font-semibold text-[#334155]">Legenda:</span>
        {areaDeTrabalho ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#DC2626]" aria-hidden />
            ação crítica do suporte ainda não feita
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <span
            style={{ background: COR_AVISADO }}
            className="inline-block h-2.5 w-2.5 rounded-sm"
            aria-hidden
          />
          contratante já avisado nesta etapa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#F97316]" aria-hidden />
          começa em menos de 2h e ainda não foi pago
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#CBD5E1]" aria-hidden />
          cor da própria etapa
        </span>
      </div>

      {/* Cancelada não pede ação, mas cancelamento de vaga de hoje/amanhã ainda
          rende conversa — contagem no rodapé basta. */}
      {canceladas > 0 ? (
        <div className="mt-3 rounded-xl bg-[#F1F5F9] px-4 py-2.5 text-[12px] text-[#64748B]">
          <strong className="font-bold text-[#334155]">{canceladas}</strong> cancelada(s) no
          período
        </div>
      ) : null}

      {/* Dizer o que foi escondido, e não só esconder: sem esta linha o painel
          mentiria por omissão, e quem procurasse uma vaga antiga aqui concluiria
          que ela sumiu do sistema. */}
      {ocultadas > 0 ? (
        <p className="mt-2 text-[11.5px] text-[#94A3B8]">
          {ocultadas} vaga(s) já encerrada(s) fora do painel — use a tabela para ver o
          histórico completo.
        </p>
      ) : null}

      {/* Onde os tiques ficam guardados hoje. Dito na tela, e não só no código,
          porque muda como o time trabalha: quem ticar numa máquina não aparece
          ticado na outra enquanto a API não guardar isso. */}
      {areaDeTrabalho ? (
        <p className="mt-2 text-[11.5px] text-[#94A3B8]">
          As ações ticadas ficam salvas neste navegador.
        </p>
      ) : null}

      {vagaEmFoco ? (
        <SupportWorkspace
          vaga={vagaEmFoco}
          janela={contexto.get(vagaEmFoco.id)?.janela ?? calcularJanela(vagaEmFoco.raw, agora)}
          checklist={checklist}
          ocupado={avisando === vagaEmFoco.id}
          handlers={{
            onReenviarGrupo,
            onCobrar: onAvisar
              ? async (vacancyId: string, stage: OutreachStage) => {
                  onAvisar(vacancyId, stage as AvisoStage);
                }
              : undefined,
            // Fecha a gaveta ao abrir o modal: os dois empilhados brigariam
            // pelo Esc, e quem foi ver os candidatos já saiu do checklist.
            onAbrirDetalhes: (vacancyId: string) => {
              setAcoesDe(null);
              onSelect(vacancyId);
            },
          }}
          onClose={() => setAcoesDe(null)}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import type { VacancyItem } from "@/modules/admin/infrastructure/admin-api";
import type { VacancyBucket } from "./vacancy-bucket";

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
  /** Dia do SERVIÇO, já formatado ("12/08"). */
  data: string;
  /** Faixa do turno, já formatada ("18:00 - 00:00"). */
  turno: string;
  /** Freelancer aceito, quando já houver. */
  freelancer: string | null;
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

/** Quantos cards por coluna antes de virar um "+N". */
const MAX_CARDS = 8;

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
}: {
  item: BoardVacancy;
  cor: string;
  agora: number;
  onSelect: (vacancyId: string) => void;
}) {
  const atencao = precisaDeAtencao(item, agora);

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      // O card abre o MESMO modal de detalhes da tabela — não existe uma
      // segunda tela de vaga. `text-left` porque button centraliza por padrão.
      style={{ borderLeftColor: atencao ? "#F97316" : cor }}
      className={`w-full cursor-pointer rounded-[10px] border border-[#E2E8F0] border-l-[3px] bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,.04)] transition-all hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(15,23,42,.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#94A3B8] ${
        atencao ? "ring-1 ring-[#F97316]/30" : ""
      }`}
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
    </button>
  );
}

export function VacancyBoard({
  vacancies,
  isFetching,
  onSelect,
}: {
  vacancies: BoardVacancy[];
  isFetching: boolean;
  /** Abre os detalhes da vaga. O quadro só emite o id — quem resolve a linha
   *  e abre o modal é a página, a mesma da tabela. */
  onSelect: (vacancyId: string) => void;
}) {
  const [busca, setBusca] = useState("");

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

  const porBucket = useMemo(() => {
    const mapa = new Map<BoardBucket, BoardVacancy[]>();
    for (const v of visiveis) {
      const lista = mapa.get(v.bucket) ?? [];
      lista.push(v);
      mapa.set(v.bucket, lista);
    }
    // Mais RECENTE primeiro, pela data de abertura: a vaga que acabou de entrar
    // é a que ninguém viu ainda, e o topo da coluna é o que se lê primeiro.
    for (const lista of mapa.values()) {
      lista.sort((a, b) => aberturaEm(b.raw) - aberturaEm(a.raw));
    }
    return mapa;
  }, [visiveis]);

  const canceladas = porBucket.get("cancelled")?.length ?? 0;
  const emAcompanhamento = visiveis.length - canceladas;
  const ocultadas = vacancies.length - ativas.length;

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
                className="flex items-center gap-2 rounded-t-xl px-3 py-2.5"
                title={coluna.chamada}
              >
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

              <div className="flex flex-col gap-2 p-2.5">
                {mostrados.map((item) => (
                  <CardVaga
                    key={item.id}
                    item={item}
                    cor={coluna.cor}
                    agora={agora}
                    onSelect={onSelect}
                  />
                ))}

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
    </div>
  );
}

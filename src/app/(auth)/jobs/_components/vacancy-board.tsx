"use client";

import { useEffect, useMemo, useState } from "react";

import type { VacancyItem } from "@/modules/admin/infrastructure/admin-api";

/**
 * Modo Painel: as vagas em colunas por etapa do funil.
 *
 * Cada coluna é uma etapa, na ordem em que a vaga anda (esquerda → direita), e
 * a cor sinaliza a temperatura: vermelho no que está parado sem candidato,
 * verde no que fechou. Quem olha de passagem entende a direção sem legenda.
 *
 * Perdidas e canceladas ficam numa faixa no rodapé, não em colunas: elas não
 * pedem ação e comeriam a largura das que pedem.
 *
 * O componente é BURRO de propósito quanto à CLASSIFICAÇÃO: recebe as vagas já
 * com o `bucket` resolvido e só desenha (`resolveVacancyBucket` vive na página,
 * uma fonte só para a tabela e para o painel). O recorte de RECÊNCIA, esse sim,
 * mora aqui — é regra de exibição do painel, não de classificação, e a tabela
 * continua mostrando o histórico inteiro.
 */

export type BoardBucket =
  | "open"
  | "awaitingHire"
  | "inProgress"
  | "completedAwaitingReview"
  | "completedReviewed"
  | "lost"
  | "cancelled";

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

/** Colunas na ordem do fluxo. `lost`/`cancelled` ficam fora — vão no rodapé. */
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
    titulo: "Aberta · sem freelancer",
    chamada: "publicada, ainda sem candidato aceito",
    cor: "#DC2626",
    corFundo: "#FEF2F2",
  },
  {
    bucket: "awaitingHire",
    titulo: "Aguardando pagamento",
    chamada: "contratante escolheu, falta pagar",
    cor: "#7C3AED",
    corFundo: "#F5F3FF",
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
    cor: "#D97706",
    corFundo: "#FFFBEB",
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

/**
 * Janela de recência do painel, em dias corridos a partir da data do SERVIÇO.
 *
 * Em 03/08/2026 o painel mostrava ~350 vagas, das quais **251 tinham mais de 30
 * dias** — havia vaga em "aguardando pagamento" há 67 dias. Não era um caso
 * isolado: eram 140 vagas `CLOSED` de datas já passadas empilhadas nessa coluna.
 * Um quadro de acompanhamento cheio de vaga morta não é acompanhamento, é
 * arquivo — e o que precisa de gente hoje some no meio.
 *
 * 14 dias porque a distribuição real deixa isso legível (~29 vagas) sem perder
 * o passado recente, que ainda rende conversa. Ajuste aqui se o volume mudar; a
 * tabela nunca foi filtrada e segue com o histórico completo.
 */
export const JANELA_DIAS = 14;

function referenciaDeTempo(v: VacancyItem): number | null {
  const iso = v.startTime || v.date || v.createdAt;
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Quando a vaga foi PUBLICADA — é por aqui que as colunas ordenam.
 *
 * Não confundir com `referenciaDeTempo`, que é o dia do SERVIÇO e alimenta o
 * "há 2h" do card. Vaga aberta hoje para daqui a duas semanas é notícia nova
 * mesmo com serviço distante; é ela que precisa aparecer no topo.
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
 * Vaga sem data legível PASSA. Sumir com um registro por não conseguir ler a
 * data dele seria esconder justamente o caso estranho — que é o que mais
 * interessa a quem vigia o quadro.
 */
export function filtrarRecentes(
  vagas: BoardVacancy[],
  agora: number = Date.now(),
  janelaDias: number = JANELA_DIAS,
): BoardVacancy[] {
  const corte = agora - janelaDias * 24 * 60 * 60 * 1000;
  return vagas.filter((v) => {
    const ref = referenciaDeTempo(v.raw);
    if (ref === null) return true;
    return ref >= corte;
  });
}

/**
 * Vaga que precisa de gente AGORA: o serviço já começou (ou começa em menos de
 * duas horas) e o pagamento ainda não saiu. É o caso em que o vigia cancela a
 * vaga sozinho ao bater o horário de início — melhor alguém ver antes.
 */
function precisaDeAtencao(item: BoardVacancy, agora: number): boolean {
  if (item.bucket !== "awaitingHire") return false;
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

  const visiveis = useMemo(() => {
    const recentes = filtrarRecentes(vacancies, agora);
    const q = busca.trim().toLowerCase();
    if (!q) return recentes;
    return recentes.filter((v) =>
      [v.cargo, v.empresa, v.cidade, v.id, v.freelancer ?? ""].some((campo) =>
        campo.toLowerCase().includes(q),
      ),
    );
  }, [vacancies, busca, agora]);

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

  const perdidas = porBucket.get("lost")?.length ?? 0;
  const canceladas = porBucket.get("cancelled")?.length ?? 0;
  const emAcompanhamento = visiveis.length - perdidas - canceladas;
  const ocultadas = vacancies.length - filtrarRecentes(vacancies, agora).length;

  const horaAtualizacao = new Date(agora).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
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
              className="flex min-w-[230px] flex-1 flex-col rounded-xl bg-[#F1F5F9]"
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

      {/* Perdidas e canceladas não pedem ação; contagem no rodapé basta. */}
      {perdidas + canceladas > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-[#F1F5F9] px-4 py-2.5 text-[12px] text-[#64748B]">
          <span>
            <strong className="font-bold text-[#334155]">{perdidas}</strong> expiraram sem
            contratação
          </span>
          <span>
            <strong className="font-bold text-[#334155]">{canceladas}</strong> canceladas
          </span>
        </div>
      ) : null}

      {/* Dizer o que foi escondido, e não só esconder: sem esta linha o painel
          mentiria por omissão, e quem procurasse uma vaga antiga aqui concluiria
          que ela sumiu do sistema. */}
      {ocultadas > 0 ? (
        <p className="mt-2 text-[11.5px] text-[#94A3B8]">
          {ocultadas} vaga(s) com mais de {JANELA_DIAS} dias fora do painel — use a tabela para
          ver o histórico completo.
        </p>
      ) : null}
    </div>
  );
}

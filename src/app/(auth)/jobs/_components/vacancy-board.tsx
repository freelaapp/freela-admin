"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Clock, MapPin, Users } from "lucide-react";

import type { VacancyItem } from "@/modules/admin/infrastructure/admin-api";

/**
 * Modo Painel: as vagas em colunas por etapa, para acompanhar na TV.
 *
 * As decisões aqui são todas para leitura A DISTÂNCIA, não para uso no mouse:
 *
 * - Tipografia grande e contraste alto; nada depende de hover ou tooltip.
 * - A contagem de cada etapa é o maior número da coluna — de longe é o que se
 *   lê primeiro.
 * - Uma coluna por etapa do fluxo, na ordem em que a vaga anda (esquerda →
 *   direita). Quem olha de passagem entende a direção sem legenda.
 * - Perdidas e canceladas ficam numa faixa no rodapé, não em colunas: elas não
 *   pedem ação e comeriam espaço das que pedem.
 * - Cada card mostra "há quanto tempo está nesta etapa". É o sinal que importa
 *   num quadro de acompanhamento — vaga parada é o que precisa de gente.
 *
 * O componente é BURRO de propósito: recebe as vagas já classificadas e só
 * desenha. A classificação (`resolveVacancyBucket`) segue na página, uma fonte
 * só para a tabela e para o painel.
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
  raw: VacancyItem;
}

/** Colunas na ordem do fluxo. `lost`/`cancelled` ficam fora — vão no rodapé. */
const COLUNAS: Array<{
  bucket: BoardBucket;
  titulo: string;
  /** O que a coluna cobra de quem está olhando. */
  chamada: string;
  cor: string;
  barra: string;
}> = [
  {
    bucket: "open",
    titulo: "Aberta",
    chamada: "aguardando candidato",
    cor: "text-[#0369a1]",
    barra: "bg-[#0ea5e9]",
  },
  {
    bucket: "awaitingHire",
    titulo: "Aguardando pagamento",
    chamada: "contratante escolheu, falta pagar",
    cor: "text-[#c2410c]",
    barra: "bg-[#f97316]",
  },
  {
    bucket: "inProgress",
    titulo: "Em andamento",
    chamada: "freelancer no local",
    cor: "text-[#15803d]",
    barra: "bg-[#22c55e]",
  },
  {
    bucket: "completedAwaitingReview",
    titulo: "Aguardando avaliação",
    chamada: "trava o repasse ao freelancer",
    cor: "text-[#a16207]",
    barra: "bg-[#eab308]",
  },
  {
    bucket: "completedReviewed",
    titulo: "Concluída",
    chamada: "ciclo fechado",
    cor: "text-[#525252]",
    barra: "bg-[#a3a3a3]",
  },
];

/** Quantos cards por coluna. Além disso a TV não lê mesmo — vira um "+N". */
const MAX_CARDS = 8;

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
 * "em 3h", "há 2 d". Sem segundos: numa TV o número muda o tempo todo e vira
 * ruído em vez de informação.
 */
function distanciaHumana(ms: number, agora: number): string {
  const diff = ms - agora;
  const futuro = diff > 0;
  const abs = Math.abs(diff);

  const min = Math.floor(abs / 60_000);
  if (min < 60) return futuro ? `em ${min} min` : `há ${min} min`;

  const horas = Math.floor(min / 60);
  if (horas < 24) return futuro ? `em ${horas}h` : `há ${horas}h`;

  const dias = Math.floor(horas / 24);
  return futuro ? `em ${dias} d` : `há ${dias} d`;
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
  agora,
  onSelect,
}: {
  item: BoardVacancy;
  agora: number;
  onSelect: (vacancyId: string) => void;
}) {
  const ref = referenciaDeTempo(item.raw);
  const atencao = precisaDeAtencao(item, agora);

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      // O quadro nasceu para TV, mas a mesma tela é usada no computador — o
      // card abre o MESMO modal de detalhes da tabela. `text-left` porque
      // button centraliza por padrão e desalinharia tudo.
      className={`w-full cursor-pointer rounded-lg border bg-white px-3 py-2.5 text-left transition-colors hover:border-[#eca826] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#eca826]/50 ${
        atencao ? "border-[#f97316] ring-1 ring-[#f97316]/30" : "border-[#e5e5e5]"
      }`}
    >
      <p className="flex items-center gap-1.5 truncate text-[15px] font-bold leading-tight text-[#1d1d1b]">
        <Building2 className="h-4 w-4 shrink-0 text-[#a3a3a3]" aria-hidden />
        {item.empresa}
      </p>

      <p className="mt-1 truncate text-[13px] font-medium text-[#525252]">{item.cargo}</p>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#737373]">
        {item.cidade && item.cidade !== "N/A" ? (
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{item.cidade}</span>
          </span>
        ) : null}

        {ref !== null ? (
          <span
            className={`flex items-center gap-1 font-semibold ${
              atencao ? "text-[#c2410c]" : ""
            }`}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {distanciaHumana(ref, agora)}
          </span>
        ) : null}

        {item.bucket === "open" ? (
          <span
            className={`flex items-center gap-1 font-semibold ${
              item.candidatos === 0 ? "text-[#a3a3a3]" : "text-[#0369a1]"
            }`}
          >
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {item.candidatos}
          </span>
        ) : null}
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
  // Um relógio só para o painel inteiro: recalcular "há 2h" por card a cada
  // render custaria caro com centenas de vagas. Um minuto basta — a granularidade
  // exibida é de minuto.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const porBucket = useMemo(() => {
    const mapa = new Map<BoardBucket, BoardVacancy[]>();
    for (const v of vacancies) {
      const lista = mapa.get(v.bucket) ?? [];
      lista.push(v);
      mapa.set(v.bucket, lista);
    }
    // Mais RECENTE primeiro, pela data de abertura: a vaga que acabou de entrar
    // é a que ninguém viu ainda, e o topo da coluna é o único lugar que se lê de
    // longe. (Ordenava pelo dia do serviço, o que empurrava vaga velha parada
    // para cima justamente na coluna que mais acumula resíduo.)
    for (const lista of mapa.values()) {
      lista.sort((a, b) => aberturaEm(b.raw) - aberturaEm(a.raw));
    }
    return mapa;
  }, [vacancies]);

  const perdidas = porBucket.get("lost")?.length ?? 0;
  const canceladas = porBucket.get("cancelled")?.length ?? 0;

  const horaAtualizacao = new Date(agora).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-[12px] text-[#737373]">
        <span>
          {vacancies.length - perdidas - canceladas} vaga(s) em acompanhamento
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isFetching ? "animate-pulse bg-[#22c55e]" : "bg-[#d4d4d4]"
            }`}
            aria-hidden
          />
          Atualizado às {horaAtualizacao}
        </span>
      </div>

      {/* Colunas: rolagem horizontal só quando a TV for estreita demais. */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {COLUNAS.map((coluna) => {
          const itens = porBucket.get(coluna.bucket) ?? [];
          const visiveis = itens.slice(0, MAX_CARDS);
          const restantes = itens.length - visiveis.length;

          return (
            <section
              key={coluna.bucket}
              className="flex min-w-[240px] flex-1 flex-col rounded-xl bg-[#fafafa] p-3"
              aria-label={`${coluna.titulo}: ${itens.length}`}
            >
              <div className={`mb-0.5 h-1 w-8 rounded-full ${coluna.barra}`} aria-hidden />

              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className={`text-[13px] font-bold uppercase tracking-wide ${coluna.cor}`}>
                  {coluna.titulo}
                </h3>
                <span className="text-[26px] font-bold leading-none text-[#1d1d1b] tabular-nums">
                  {itens.length}
                </span>
              </div>

              <p className="mb-3 text-[11px] leading-tight text-[#a3a3a3]">{coluna.chamada}</p>

              <div className="flex flex-col gap-2">
                {visiveis.map((item) => (
                  <CardVaga key={item.id} item={item} agora={agora} onSelect={onSelect} />
                ))}

                {itens.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#e5e5e5] px-3 py-4 text-center text-[12px] text-[#a3a3a3]">
                    nenhuma
                  </p>
                ) : null}

                {restantes > 0 ? (
                  <p className="pt-0.5 text-center text-[12px] font-semibold text-[#737373]">
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
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-[#fafafa] px-4 py-2.5 text-[12px] text-[#737373]">
          <span>
            <strong className="font-bold text-[#525252]">{perdidas}</strong> expiraram sem
            contratação
          </span>
          <span>
            <strong className="font-bold text-[#525252]">{canceladas}</strong> canceladas
          </span>
        </div>
      ) : null}
    </div>
  );
}

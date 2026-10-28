"use client";

import { useRef, useState } from "react";
import { BellRing, History, ListOrdered, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useCancelReserveCall,
  useOpenReserveCall,
  useReplaceReserves,
  useVacancyReserves,
} from "@/modules/admin/application/use-vacancy-reserves";
import type {
  AdminReserveCallReason,
  VacancyCandidacyItem,
  VacancyReserveCallHistory,
  VacancyReserveChange,
  VacancyReservePerson,
  VacancyReservesView,
} from "@/modules/admin/infrastructure/admin-api";
import { formatInstantDateTime, formatVacancyTime } from "@/lib/date.utils";

const MOTIVO: Record<string, string> = {
  PRESTART_NO_RESPONSE: "Não confirmou presença",
  PRESTART_DECLINED: "Avisou que não vai",
  PRINCIPAL_UNCONFIRMED: "Não confirmou o aceite",
  PRINCIPAL_WITHDREW: 'Desistiu da vaga ("Não vou mais")',
  CONTRACTOR_CHOICE: "Outro motivo",
};

/** Motivos que o suporte pode escolher (a API recusa os outros). */
const MOTIVOS_DO_SUPORTE: AdminReserveCallReason[] = [
  "PRESTART_NO_RESPONSE",
  "PRESTART_DECLINED",
  "PRINCIPAL_UNCONFIRMED",
  "CONTRACTOR_CHOICE",
];

const QUEM: Record<string, string> = {
  CONTRACTOR: "a empresa",
  ADMIN: "o suporte",
  SYSTEM: "o sistema",
};

const SITUACAO_CHAMADA: Record<string, string> = {
  OPEN: "Em andamento",
  FILLED: "Uma reserva aceitou",
  EXHAUSTED: "Nenhuma reserva aceitou",
  CANCELLED: "Cancelada",
};

const FIM_CHAMADA: Record<string, string> = {
  CONTRACTOR_CANCELLED: "o escolhido foi mantido",
  PRINCIPAL_STARTED: "o escolhido começou o serviço",
  VACANCY_CANCELLED: "a vaga foi cancelada",
  NO_RESERVE_LEFT: "acabaram as reservas",
  SLOT_FILLED: "a vaga foi preenchida por outro caminho",
};

const ESCOLHIDA_POR: Record<string, string> = {
  CONTRACTOR: "Escolhida pela empresa",
  ADMIN: "Escolhida pelo suporte",
  SYSTEM: "Escolhida pelo sistema",
};

const RESPOSTA_OFERTA: Record<string, string> = {
  OFFERED: "chamada agora",
  ACCEPTED: "aceitou",
  DECLINED: "não pôde",
  EXPIRED: "não respondeu a tempo",
  RELEASED: "liberada",
  LEFT: "saiu da reserva",
  HELD: "na espera",
};

const primeiroNome = (nome: string | null | undefined) =>
  (nome ?? "").trim().split(/\s+/)[0] || "O freelancer";

function linhaPessoa(p: {
  averageRating?: number | null;
  city?: string | null;
  matchScore?: number | null;
}) {
  const partes: string[] = [];
  if (typeof p.averageRating === "number" && p.averageRating > 0)
    partes.push(`★ ${p.averageRating.toFixed(1)}`);
  if (typeof p.matchScore === "number")
    partes.push(`${Math.round(p.matchScore)}% compatível`);
  if (p.city) partes.push(p.city);
  return partes.join(" · ");
}

/** Nome de quem aparece no histórico: reservas, escolhido e candidatos desta vaga. */
function montarNomes(
  view: VacancyReservesView,
  candidacies: VacancyCandidacyItem[] | undefined,
) {
  const nomes = new Map<string, string>();
  for (const c of candidacies ?? [])
    if (c.providerName) nomes.set(c.id, c.providerName);
  for (const p of [
    ...view.reserves,
    ...view.eligible,
    ...(view.chosen ?? []),
    ...(view.candidates ?? []),
  ])
    nomes.set(p.candidacyId, p.name);
  if (view.principal)
    nomes.set(view.principal.candidacyId, view.principal.name);
  return (id: string | null) =>
    id ? (nomes.get(id) ?? `candidatura ${id.slice(0, 8)}`) : "—";
}

function LinhaChamada({
  chamada,
  nome,
}: {
  chamada: VacancyReserveCallHistory;
  nome: (id: string | null) => string;
}) {
  const ofertas = [...chamada.offers].sort((a, b) => a.position - b.position);
  const fim = chamada.closeReason ? FIM_CHAMADA[chamada.closeReason] : null;
  return (
    <li className="rounded-md bg-white px-2.5 py-2 text-xs">
      <p className="text-[#1d1d1b]">
        <span className="font-semibold">
          {formatInstantDateTime(chamada.createdAt)}
        </span>
        {` · ${QUEM[chamada.requestedByKind] ?? chamada.requestedByKind} chamou a reserva`}
        {chamada.replacedCandidacyId &&
          ` no lugar de ${nome(chamada.replacedCandidacyId)}`}
      </p>
      <p className="text-[#737373]">
        {`Motivo: ${MOTIVO[chamada.reason] ?? chamada.reason}`}
        {chamada.note && ` — "${chamada.note}"`}
      </p>
      {ofertas.length > 0 && (
        <p className="text-[#737373]">
          {ofertas
            .map(
              (o) =>
                `${nome(o.candidacyId)} (reserva ${o.position}): ${RESPOSTA_OFERTA[o.status] ?? o.status}`,
            )
            .join(" · ")}
        </p>
      )}
      <p className="font-medium text-[#1d1d1b]">
        {SITUACAO_CHAMADA[chamada.status] ?? chamada.status}
        {chamada.status === "FILLED" &&
          chamada.filledByCandidacyId &&
          `: ${nome(chamada.filledByCandidacyId)} entrou`}
        {chamada.status !== "FILLED" && fim && `: ${fim}`}
      </p>
    </li>
  );
}

/** Saída da lista sem ninguém tirar: o que aconteceu com a pessoa. */
const SAIU_SOZINHA: Record<string, string> = {
  ACCEPTED_ELSEWHERE: "foi escolhida em outra vaga no mesmo horário",
  CANDIDACY_GONE: "retirou a candidatura",
};

/** Fim da lista inteira (cron), por motivo. */
const RESERVAS_TERMINARAM: Record<string, (prazo: string) => string> = {
  HOLD_ENDED: (prazo) => `prazo das ${prazo}`,
  VACANCY_CANCELLED: () => "a vaga foi cancelada",
  PRINCIPAL_STARTED: () => "o escolhido começou o serviço",
  POLICY_CHANGED: () => "a regra das reservas mudou (28/10)",
};

type LinhaDaLista = { id: string; em: string; texto: string };

/**
 * Trocas na lista de reservas (UX 2026-10-28 §6.6), agrupadas pelo instante: as
 * linhas de uma mesma troca saem com o mesmo horário. Quem pôs e quem tirou vem
 * das linhas (`designatedBy`/`releasedBy`); antes de 29/10 só a empresa tirava.
 * Saídas dentro de uma chamada ficam com a chamada.
 */
function linhasDaLista(
  changes: VacancyReserveChange[],
  holdUntil: string,
): LinhaDaLista[] {
  type Grupo = {
    postas: VacancyReserveChange[];
    tiradas: VacancyReserveChange[];
    reordenadas: VacancyReserveChange[];
    sozinhas: VacancyReserveChange[];
  };
  const grupos = new Map<string, Grupo>();
  const grupo = (em: string) => {
    let g = grupos.get(em);
    if (!g) {
      g = { postas: [], tiradas: [], reordenadas: [], sozinhas: [] };
      grupos.set(em, g);
    }
    return g;
  };
  for (const c of changes) {
    grupo(c.designatedAt).postas.push(c);
    if (!c.releasedAt || c.callId) continue;
    if (c.releaseReason === "REPLACED_BY_CONTRACTOR")
      grupo(c.releasedAt).tiradas.push(c);
    else if (c.releaseReason === "REORDERED")
      grupo(c.releasedAt).reordenadas.push(c);
    else grupo(c.releasedAt).sozinhas.push(c);
  }

  const primeiro = (c: VacancyReserveChange) => primeiroNome(c.name);
  const prazo = formatVacancyTime(holdUntil);
  const linhas: LinhaDaLista[] = [];
  for (const [em, g] of grupos) {
    const mexida = [...g.tiradas, ...g.reordenadas][0];
    const autor = g.postas[0]
      ? {
          quem: g.postas[0].designatedBy,
          email: g.postas[0].designatedByLabel,
        }
      : mexida
        ? {
            quem: mexida.releasedBy ?? "CONTRACTOR",
            email: mexida.releasedByLabel,
          }
        : null;
    if (autor) {
      const postas = [...g.postas].sort((a, b) => a.position - b.position);
      const reordenadas = new Set(g.reordenadas.map((c) => c.candidacyId));
      const novas = postas.filter((c) => !reordenadas.has(c.candidacyId));
      const partes: string[] = [];
      if (novas.length > 0)
        partes.push(
          `escolheu as reservas: ${postas.map((c) => `${c.position} ${primeiro(c)}`).join(" · ")}`,
        );
      else if (postas.length > 0)
        partes.push(
          `mudou a ordem: ${postas.map((c) => `${primeiro(c)} passou para ${c.position}`).join(", ")}`,
        );
      if (g.tiradas.length > 0)
        partes.push(
          `tirou ${g.tiradas.map(primeiro).join(" e ")} das reservas`,
        );
      linhas.push({
        id: `lista-${em}`,
        em,
        texto: `${QUEM[autor.quem] ?? autor.quem} ${partes.join("; ")}${autor.email ? ` (${autor.email})` : ""}`,
      });
    }
    const fimDaLista = g.sozinhas.find(
      (c) => RESERVAS_TERMINARAM[c.releaseReason ?? ""],
    );
    if (fimDaLista)
      linhas.push({
        id: `fim-${em}`,
        em,
        texto: `as reservas terminaram: ${RESERVAS_TERMINARAM[fimDaLista.releaseReason ?? ""](prazo)}`,
      });
    for (const c of g.sozinhas.filter(
      (s) => !RESERVAS_TERMINARAM[s.releaseReason ?? ""],
    ))
      linhas.push({
        id: `saiu-${c.reserveId}`,
        em,
        texto: SAIU_SOZINHA[c.releaseReason ?? ""]
          ? `${primeiro(c)} saiu das reservas: ${SAIU_SOZINHA[c.releaseReason ?? ""]}`
          : `${primeiro(c)} saiu das reservas`,
      });
  }
  return linhas;
}

/** Chamadas, trocas e mudanças na lista numa linha só, da mais recente para a mais antiga. */
function linhaDoTempo(
  historico: VacancyReservesView["history"],
  holdUntil: string,
) {
  const itens = [
    ...historico.calls.map((chamada) => ({
      tipo: "chamada" as const,
      em: chamada.createdAt,
      chamada,
    })),
    ...historico.principalChanges.map((troca) => ({
      tipo: "troca" as const,
      em: troca.occurredAt,
      troca,
    })),
    ...linhasDaLista(historico.reserveChanges ?? [], holdUntil).map(
      (linha) => ({ tipo: "lista" as const, em: linha.em, linha }),
    ),
  ];
  return itens.sort((a, b) => Date.parse(b.em) - Date.parse(a.em));
}

/**
 * Reservas da vaga (Fase B, AD-2), no modal de detalhes: a lista que a empresa
 * escolheu (desde 28/10 é ela quem monta, e as pessoas não sabem que estão na
 * lista), a chamada aberta com "Cancelar a chamada", o "Chamar reserva" no
 * lugar da empresa (só com `canCall`) e o histórico de chamadas e trocas.
 *
 * Some quando não há nada a mostrar (chave desligada e sem histórico, vaga sem
 * escolhido nem reserva, ou a API não reconhece a vaga).
 */
export function VacancyReservesSection({
  vacancyId,
  candidacies,
}: {
  vacancyId: string;
  candidacies?: VacancyCandidacyItem[];
}) {
  const { data: view, isError } = useVacancyReserves(vacancyId);
  const chamar = useOpenReserveCall(vacancyId);
  const cancelar = useCancelReserveCall(vacancyId);
  const trocar = useReplaceReserves(vacancyId);
  const [formAberto, setFormAberto] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [selecao, setSelecao] = useState<string[]>([]);
  const [motivo, setMotivo] = useState<AdminReserveCallReason>(
    "PRESTART_NO_RESPONSE",
  );
  const [nota, setNota] = useState("");
  const chave = useRef(`admin-reserve-${vacancyId}-${Date.now()}`);

  if (isError || !view) return null;
  const historico = view.history ?? { calls: [], principalChanges: [] };
  const temHistorico =
    historico.calls.length > 0 ||
    historico.principalChanges.length > 0 ||
    (historico.reserveChanges?.length ?? 0) > 0;
  if (!view.enabled && !temHistorico) return null;
  const reservas = [...(view.chosen ?? view.reserves)].sort(
    (a, b) => a.position - b.position,
  );
  const candidatos = view.candidates ?? view.eligible;
  const chamadaAberta = view.openCall ?? null;
  if (
    !view.principal &&
    reservas.length === 0 &&
    !chamadaAberta &&
    !temHistorico
  )
    return null;

  const nome = montarNomes(view, candidacies);
  const nomeEscolhido = primeiroNome(view.principal?.name);
  const naEspera = reservas.filter((r) => r.status === "HELD");
  const proxima = naEspera[0];
  // API anterior não manda `canCall`: vale a regra antiga (lista só com a vaga paga).
  const chamavel = view.canCall ?? true;
  const podeChamar = view.enabled && !chamadaAberta && !!proxima && chamavel;
  const ocupado = chamar.isPending || cancelar.isPending || trocar.isPending;
  const faltaNota = motivo === "CONTRACTOR_CHOICE" && !nota.trim();
  // Escolher no lugar da empresa (ponte até o app 1.0.45): só com `canChoose`
  // explícito — API anterior não manda e não tem a rota.
  const naLista = reservas.filter((r) => r.status === "HELD");
  const opcoes: VacancyReservePerson[] = [
    ...naLista,
    ...candidatos.filter(
      (c) => !naLista.some((r) => r.candidacyId === c.candidacyId),
    ),
  ];
  const podeEscolher =
    view.enabled &&
    view.canChoose === true &&
    !chamadaAberta &&
    opcoes.length > 0;
  const listaAtual = naLista.map((r) => r.candidacyId);
  const mudou = selecao.join(",") !== listaAtual.join(",");
  const maximo = view.max;
  const cheia = selecao.length >= maximo;

  function alternar(id: string) {
    setSelecao((atual) =>
      atual.includes(id)
        ? atual.filter((s) => s !== id)
        : atual.length >= maximo
          ? atual
          : [...atual, id],
    );
  }

  async function guardarReservas() {
    try {
      await trocar.mutateAsync(selecao);
      const nomeDe = (id: string) =>
        primeiroNome(opcoes.find((o) => o.candidacyId === id)?.name);
      toast.success(
        selecao.length > 0
          ? `Reservas guardadas: ${selecao.map((id, i) => `${i + 1} ${nomeDe(id)}`).join(" · ")}.`
          : "Reservas tiradas.",
      );
      setEscolhendo(false);
    } catch (e) {
      toast.error(
        getAxiosErrorMessage(e, "Não foi possível guardar as reservas."),
      );
    }
  }

  async function confirmarChamada() {
    if (!proxima || faltaNota) return;
    try {
      await chamar.mutateAsync({
        reason: motivo,
        note: nota.trim() || undefined,
        idempotencyKey: chave.current,
      });
      toast.success(
        `Chamamos ${primeiroNome(proxima.name)} (reserva ${proxima.position}).`,
      );
      chave.current = `admin-reserve-${vacancyId}-${Date.now()}`;
      setFormAberto(false);
      setNota("");
    } catch (e) {
      toast.error(
        getAxiosErrorMessage(e, "Não foi possível chamar a reserva."),
      );
    }
  }

  async function cancelarChamada(callId: string) {
    const texto = view?.principal
      ? `Cancelar a chamada? ${nomeEscolhido} continua na vaga.`
      : "Cancelar a chamada da reserva?";
    if (!window.confirm(texto)) return;
    try {
      await cancelar.mutateAsync(callId);
      toast.success("Chamada cancelada.");
    } catch (e) {
      toast.error(
        getAxiosErrorMessage(e, "Não foi possível cancelar a chamada."),
      );
    }
  }

  return (
    <section
      className="space-y-3 rounded-lg border border-[#e5e5e5] p-3"
      aria-label="Reservas"
    >
      <div>
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[#737373]">
          <Users className="h-3.5 w-3.5" />
          Reservas
        </p>
        {view.enabled ? (
          reservas.length > 0 && (
            <p className="mt-1 text-xs text-[#737373]">
              {`Valem até ${formatVacancyTime(view.holdUntil)}. Elas não sabem que estão na lista: só recebem mensagem se forem chamadas. Ao chamar, a reserva tem até 15 minutos para aceitar; se não aceitar, chamamos a próxima.`}
            </p>
          )
        ) : (
          <p className="mt-1 text-xs text-[#737373]">
            Reservas desligadas agora. Abaixo, só o histórico.
          </p>
        )}
      </div>

      {chamadaAberta?.offeredTo && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
          <p className="flex items-center gap-1.5 font-semibold">
            <BellRing className="h-3.5 w-3.5" />
            {`Chamada aberta: ${primeiroNome(chamadaAberta.offeredTo.name)} (reserva ${chamadaAberta.offeredTo.position}) tem até ${formatVacancyTime(chamadaAberta.offeredTo.expiresAt)} para aceitar`}
          </p>
          <p className="mt-0.5 opacity-80">
            {`Motivo: ${MOTIVO[chamadaAberta.reason] ?? chamadaAberta.reason}.`}
            {view.principal &&
              ` ${nomeEscolhido} continua na vaga até uma reserva aceitar.`}
          </p>
          <button
            type="button"
            onClick={() => cancelarChamada(chamadaAberta.callId)}
            disabled={ocupado}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-60"
          >
            {cancelar.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            {view.principal
              ? `Cancelar a chamada (manter ${nomeEscolhido})`
              : "Cancelar a chamada"}
          </button>
        </div>
      )}

      {view.enabled &&
        (reservas.length === 0 ? (
          <p className="text-xs text-[#737373]">
            {candidatos.length > 0
              ? `A empresa não escolheu reservas. ${candidatos.length === 1 ? "1 outro candidato pode entrar" : `${candidatos.length} outros candidatos podem entrar`} na lista; quem escolhe é a empresa, na tela da vaga.`
              : "A empresa não escolheu reservas."}
          </p>
        ) : (
          <ol className="space-y-1.5">
            {reservas.map((r) => (
              <li
                key={r.reserveId}
                className="flex items-center gap-2 rounded-md bg-[#f7f7f7] px-2.5 py-1.5 text-xs"
              >
                <span className="shrink-0 font-semibold text-[#737373]">{`Reserva ${r.position}`}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[#1d1d1b]">
                    {r.name}
                  </p>
                  {linhaPessoa(r) && (
                    <p className="text-[11px] text-[#737373]">
                      {linhaPessoa(r)}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-[#737373]">
                  {r.status === "OFFERED"
                    ? "Chamada agora"
                    : (ESCOLHIDA_POR[r.designatedBy] ??
                      "Escolhida pela empresa")}
                </span>
              </li>
            ))}
          </ol>
        ))}

      {view.enabled && !chamadaAberta && !!proxima && !chamavel && (
        <p className="text-xs text-[#737373]">
          Chamar reserva fica disponível depois que a empresa pagar a vaga e
          enquanto as reservas valem.
        </p>
      )}

      {podeEscolher && !escolhendo && !formAberto && (
        <button
          type="button"
          onClick={() => {
            setSelecao(listaAtual);
            setEscolhendo(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#e5e5e5] bg-white px-3 py-2 text-xs font-semibold text-[#1d1d1b] transition-colors hover:bg-[#f0f0f0]"
        >
          <ListOrdered className="h-3.5 w-3.5" />
          {naLista.length > 0
            ? "Mudar reservas no lugar da empresa"
            : "Escolher reservas no lugar da empresa"}
        </button>
      )}

      {podeEscolher && escolhendo && (
        <div
          className="space-y-2 rounded-md border border-[#e5e5e5] bg-[#f7f7f7] p-2.5 text-xs"
          role="group"
          aria-label="Escolher reservas no lugar da empresa"
        >
          <p className="font-semibold text-[#1d1d1b]">
            Escolher reservas no lugar da empresa
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-[#737373]">
            <li>Só quando a empresa pedir (por exemplo, quem usa só o app).</li>
            <li>{`A ordem em que você marca é a ordem de chamada. Até ${view.max}.`}</li>
            <li>
              Ninguém é avisado agora: a reserva só recebe mensagem se for
              chamada.
            </li>
            <li>Fica registrado como &quot;Escolhida pelo suporte&quot;.</li>
          </ul>
          <ul className="space-y-1">
            {opcoes.map((o) => {
              const posicao = selecao.indexOf(o.candidacyId) + 1;
              const marcada = posicao > 0;
              const apagada = cheia && !marcada;
              return (
                <li key={o.candidacyId}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={marcada}
                    aria-label={
                      marcada ? `${o.name}, reserva ${posicao}` : o.name
                    }
                    disabled={apagada || ocupado}
                    onClick={() => alternar(o.candidacyId)}
                    className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left ${marcada ? "border-amber-300 bg-amber-50" : "border-[#e5e5e5] bg-white"} disabled:opacity-50`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${marcada ? "border-amber-400 bg-amber-400 text-[#1d1d1b]" : "border-[#d4d4d4]"}`}
                    >
                      {marcada ? posicao : ""}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[#1d1d1b]">
                        {o.name}
                      </span>
                      {linhaPessoa(o) && (
                        <span className="block text-[11px] text-[#737373]">
                          {linhaPessoa(o)}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {cheia && opcoes.length > selecao.length && (
            <p className="text-[#737373]">{`Máximo de ${view.max}. Desmarque uma para trocar.`}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={guardarReservas}
              disabled={ocupado || !mudou}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1d1d1b] px-3 py-2 font-semibold text-white transition-colors hover:bg-[#333] disabled:opacity-60"
            >
              {trocar.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {selecao.length === 0
                ? "Tirar todas as reservas"
                : `Guardar ${selecao.length} ${selecao.length === 1 ? "reserva" : "reservas"}`}
            </button>
            <button
              type="button"
              onClick={() => setEscolhendo(false)}
              disabled={ocupado}
              className="rounded-md border border-[#e5e5e5] bg-white px-3 py-2 font-medium text-[#1d1d1b] hover:bg-[#f0f0f0]"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {podeChamar && !formAberto && !escolhendo && (
        <button
          type="button"
          onClick={() => setFormAberto(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#1d1d1b] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#333]"
        >
          <BellRing className="h-3.5 w-3.5" />
          Chamar reserva
        </button>
      )}

      {podeChamar && formAberto && proxima && (
        <div
          className="space-y-2 rounded-md border border-[#e5e5e5] bg-[#f7f7f7] p-2.5 text-xs"
          role="group"
          aria-label="Chamar reserva"
        >
          <p className="font-semibold text-[#1d1d1b]">{`Chamar ${primeiroNome(proxima.name)} (reserva ${proxima.position}) no lugar da empresa?`}</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[#737373]">
            <li>Mesmo valor, sem nova cobrança.</li>
            <li>
              Ela tem até 15 minutos para aceitar. Se não aceitar, chamamos a
              próxima.
            </li>
            {view.principal && (
              <li>{`${nomeEscolhido} continua na vaga até uma reserva aceitar.`}</li>
            )}
            <li>Fica registrado que foi o suporte.</li>
          </ul>
          <fieldset className="space-y-1">
            <legend className="font-medium text-[#1d1d1b]">Motivo</legend>
            {MOTIVOS_DO_SUPORTE.map((m) => (
              <label key={m} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`motivo-reserva-${vacancyId}`}
                  value={m}
                  checked={motivo === m}
                  onChange={() => setMotivo(m)}
                />
                {MOTIVO[m]}
              </label>
            ))}
          </fieldset>
          <label className="block">
            <span className="font-medium text-[#1d1d1b]">
              {motivo === "CONTRACTOR_CHOICE"
                ? "Conte o motivo (obrigatório)"
                : "Observação (opcional, fica no histórico)"}
            </span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              maxLength={500}
              rows={2}
              className="mt-1 w-full rounded-md border border-[#e5e5e5] bg-white p-2"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmarChamada}
              disabled={ocupado || faltaNota}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1d1d1b] px-3 py-2 font-semibold text-white transition-colors hover:bg-[#333] disabled:opacity-60"
            >
              {chamar.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {`Chamar ${primeiroNome(proxima.name)}`}
            </button>
            <button
              type="button"
              onClick={() => setFormAberto(false)}
              disabled={ocupado}
              className="rounded-md border border-[#e5e5e5] bg-white px-3 py-2 font-medium text-[#1d1d1b] hover:bg-[#f0f0f0]"
            >
              Voltar
            </button>
          </div>
        </div>
      )}

      {temHistorico && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[#737373]">
            <History className="h-3 w-3" />
            Histórico
          </p>
          <ul className="space-y-1.5 rounded-md bg-[#f7f7f7] p-1.5">
            {linhaDoTempo(historico, view.holdUntil).map((item) =>
              item.tipo === "lista" ? (
                <li
                  key={item.linha.id}
                  className="rounded-md bg-white px-2.5 py-2 text-xs"
                >
                  <p className="text-[#1d1d1b]">
                    <span className="font-semibold">
                      {formatInstantDateTime(item.em)}
                    </span>
                    {` · ${item.linha.texto}`}
                  </p>
                </li>
              ) : item.tipo === "chamada" ? (
                <LinhaChamada
                  key={item.chamada.id}
                  chamada={item.chamada}
                  nome={nome}
                />
              ) : (
                <li
                  key={item.troca.id}
                  className="rounded-md bg-white px-2.5 py-2 text-xs"
                >
                  <p className="text-[#1d1d1b]">
                    <span className="font-semibold">
                      {formatInstantDateTime(item.troca.occurredAt)}
                    </span>
                    {item.troca.kind === "SUBSTITUTED"
                      ? ` · ${nome(item.troca.fromCandidacyId)} saiu e ${nome(item.troca.toCandidacyId)} entrou`
                      : ` · a vaga de ${nome(item.troca.fromCandidacyId)} foi liberada`}
                  </p>
                  <p className="text-[#737373]">
                    {`${MOTIVO[item.troca.reason] ?? item.troca.reason} · por ${QUEM[item.troca.actorKind] ?? item.troca.actorKind}`}
                    {item.troca.note && ` — "${item.troca.note}"`}
                  </p>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

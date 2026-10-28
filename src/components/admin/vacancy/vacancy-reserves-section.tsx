"use client";

import { useRef, useState } from "react";
import { BellRing, History, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useCancelReserveCall,
  useOpenReserveCall,
  useVacancyReserves,
} from "@/modules/admin/application/use-vacancy-reserves";
import type {
  AdminReserveCallReason,
  VacancyCandidacyItem,
  VacancyReserveCallHistory,
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
  for (const p of [...view.reserves, ...view.eligible])
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

/** Chamadas e trocas numa linha só, da mais recente para a mais antiga. */
function linhaDoTempo(historico: VacancyReservesView["history"]) {
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
  ];
  return itens.sort((a, b) => Date.parse(b.em) - Date.parse(a.em));
}

/**
 * Reservas da vaga (Fase B, AD-2), no modal de detalhes: quem está guardado,
 * a chamada aberta com "Cancelar a chamada", o "Chamar reserva" no lugar da
 * empresa e o histórico de chamadas e trocas do escolhido.
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
  const [formAberto, setFormAberto] = useState(false);
  const [motivo, setMotivo] = useState<AdminReserveCallReason>(
    "PRESTART_NO_RESPONSE",
  );
  const [nota, setNota] = useState("");
  const chave = useRef(`admin-reserve-${vacancyId}-${Date.now()}`);

  if (isError || !view) return null;
  const historico = view.history ?? { calls: [], principalChanges: [] };
  const temHistorico =
    historico.calls.length > 0 || historico.principalChanges.length > 0;
  if (!view.enabled && !temHistorico) return null;
  const reservas = [...view.reserves].sort((a, b) => a.position - b.position);
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
  const podeChamar = view.enabled && !chamadaAberta && !!proxima;
  const ocupado = chamar.isPending || cancelar.isPending;
  const faltaNota = motivo === "CONTRACTOR_CHOICE" && !nota.trim();

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
              {`De prontidão até ${formatVacancyTime(view.holdUntil)}. Ao chamar, a reserva tem até 15 minutos para aceitar; se não aceitar, chamamos a próxima.`}
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
            {view.eligible.length > 0
              ? `Ninguém guardado. ${view.eligible.length === 1 ? "1 pessoa topou" : `${view.eligible.length} pessoas toparam`} ser reserva; a empresa escolhe na tela da vaga.`
              : "Ninguém desta vaga topou ser reserva."}
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
                    : r.designatedBy === "CONTRACTOR"
                      ? "Escolhida pela empresa"
                      : "Escolhida pelo sistema"}
                </span>
              </li>
            ))}
          </ol>
        ))}

      {podeChamar && !formAberto && (
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
            {linhaDoTempo(historico).map((item) =>
              item.tipo === "chamada" ? (
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

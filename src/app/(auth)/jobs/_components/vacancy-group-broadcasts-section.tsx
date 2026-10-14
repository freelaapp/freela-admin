"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  useGroupBroadcastResend,
  useVacancyGroupBroadcastPreview,
} from "@/modules/admin/application/use-vacancy-group-broadcasts";
import {
  cidadeUf,
  formatDiaHora,
  formatKm,
  lastBroadcastAt,
  modeLabel,
  origemDaDistancia,
  primeiroMotivo,
  grupos,
  RAIO_PADRAO_KM,
  reasonLabel,
  roundAllFailed,
  roundHeadline,
  roundInFlight,
  roundShortSummary,
  sortDestinations,
  statusLabel,
} from "@/modules/admin/domain/group-broadcast";
import {
  isNotFoundError,
  type GroupBroadcastDestination,
  type GroupBroadcastRound,
} from "@/modules/admin/infrastructure/vacancy-group-broadcasts-api";
import type { OutreachRecord } from "@/modules/admin/infrastructure/vacancy-outreach-api";

import { NoGroupInRadius, ResendGroupsDialog } from "./resend-groups-dialog";

const TOM_SITUACAO = {
  green: "text-green-700",
  red: "text-red-700",
  gray: "text-[#737373]",
  blue: "text-blue-700",
} as const;

function CartaoDoGrupo({ d, radiusKm }: { d: GroupBroadcastDestination; radiusKm: number }) {
  const local = [cidadeUf(d.city, d.uf), formatKm(d.distanceKm)].filter(Boolean).join(" · ");
  const situacao = statusLabel(d);
  const motivo =
    d.status === "FAILED" || d.status === "SKIPPED"
      ? d.errorMessage || d.errorCode || "Motivo não informado."
      : null;
  return (
    <li className="rounded-md border border-[#e5e5e5] bg-white p-2.5" data-testid="group-card">
      <p className="break-words font-medium text-[#1d1d1b]">{d.groupName}</p>
      {local && <p className="text-xs text-[#737373]">{local}</p>}
      <span className="mt-1 inline-block rounded-full border border-[#e5e5e5] px-2 py-0.5 text-[11px] font-medium text-[#525252]">
        {reasonLabel(d.reason, radiusKm)}
      </span>
      <p className={`mt-1 text-xs font-semibold ${TOM_SITUACAO[situacao.tone]}`}>
        <span aria-hidden>{situacao.icon} </span>
        {situacao.text}
      </p>
      {motivo && <p className="break-words text-xs text-[#525252]">{motivo}</p>}
    </li>
  );
}

function Rodada({
  round,
  aberta,
  radiusKm,
}: {
  round: GroupBroadcastRound;
  aberta: boolean;
  radiusKm: number;
}) {
  return (
    <details open={aberta} className="group" data-testid="group-round">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 text-xs font-semibold text-[#1d1d1b] [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
        <span>
          {modeLabel(round.mode)} · {formatDiaHora(round.createdAt)}
          <span className="font-normal text-[#737373]"> · {roundShortSummary(round)}</span>
        </span>
      </summary>
      <ul className="mt-1 space-y-2">
        {sortDestinations(round.destinations).map((d, i) => (
          <CartaoDoGrupo key={`${d.groupJid || d.groupName}-${i}`} d={d} radiusKm={radiusKm} />
        ))}
      </ul>
    </details>
  );
}

/** " (reenvio manual)" / " (automático)" do registro antigo da coluna Disparo. */
function origemAntiga(record: OutreachRecord): string {
  const { autoSentAt: auto, manualSentAt: manual } = record;
  if (!auto && !manual) return "";
  const manualDepois = Boolean(manual) && (!auto || Date.parse(manual!) >= Date.parse(auto!));
  return manualDepois ? " (reenvio manual)" : " (automático)";
}

/**
 * "Divulgação nos grupos" no modal da vaga (Empresas): para quais grupos de
 * WhatsApp a vaga foi, rodada por rodada, e o reenvio para todos os grupos no
 * raio. Substitui o aviso "Vaga não divulgada" do modal — o estado vazio desta
 * seção já diz isso.
 */
export function VacancyGroupBroadcastsSection({
  vacancyId,
  record,
  pollMs,
  maxPollMs,
  now,
}: {
  vacancyId: string;
  /** Registro da coluna "Disparo" (usado se a API ainda não tem o registro por grupo). */
  record: OutreachRecord | undefined;
  pollMs?: number;
  maxPollMs?: number;
  now?: Date;
}) {
  const fluxo = useGroupBroadcastResend(vacancyId, { keepLoaded: true, pollMs, maxPollMs });
  const { query } = fluxo;
  const preview = useVacancyGroupBroadcastPreview(vacancyId, true);
  const [confirmando, setConfirmando] = useState(false);

  const apiAntiga = query.isError && isNotFoundError(query.error);
  const data = query.data;
  const radiusKm = data?.radiusKm ?? preview.data?.radiusKm ?? 0;
  const ultima = data?.rounds[0] ?? null;
  const naFila = Boolean(ultima && roundInFlight(ultima));

  const nuncaSaiu = apiAntiga ? !record : Boolean(data && data.rounds.length === 0 && !data.legacy);
  const todosFalharam = Boolean(ultima && roundAllFailed(ultima));
  const quandoSaiu = apiAntiga ? (record?.lastSentAt ?? null) : lastBroadcastAt(data);

  const nPrevia = preview.data?.destinations.length;
  const semGrupoNoRaio = nPrevia === 0;
  const verbo = nuncaSaiu ? "Enviar" : "Reenviar";
  const rotulo = todosFalharam
    ? "Tentar de novo"
    : nPrevia !== undefined && nPrevia > 0
      ? `${verbo} para ${grupos(nPrevia)}`
      : verbo;
  const ocupado = fluxo.enviando || fluxo.acompanhando || naFila;

  const temDistancia = Boolean(
    data?.rounds.some((r) => r.destinations.some((d) => d.distanceKm !== null)),
  );

  let corpo: React.ReactNode;
  if (query.isLoading) {
    corpo = (
      <div aria-busy="true" className="space-y-2">
        <span className="sr-only">Carregando a divulgação…</span>
        <Skeleton className="h-20 w-full" data-testid="group-skeleton" />
        <Skeleton className="h-20 w-full" data-testid="group-skeleton" />
      </div>
    );
  } else if (apiAntiga) {
    corpo = record ? (
      <p className="text-sm text-[#1d1d1b]">
        Enviada em {formatDiaHora(record.lastSentAt)}
        {origemAntiga(record)}. Não sabemos quais grupos receberam.
      </p>
    ) : (
      <p className="text-sm text-[#1d1d1b]">
        <strong>Ainda não divulgada.</strong> Nenhum grupo recebeu esta vaga.
      </p>
    );
  } else if (query.isError || !data) {
    corpo = (
      <div role="alert" className="text-sm text-red-700">
        <p>Não conseguimos carregar a divulgação desta vaga.</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-1 inline-flex min-h-10 cursor-pointer items-center font-semibold underline underline-offset-2"
        >
          Tentar de novo
        </button>
      </div>
    );
  } else if (data.rounds.length === 0) {
    corpo = data.legacy ? (
      <p className="text-sm text-[#1d1d1b]">
        Enviada em {formatDiaHora(quandoSaiu ?? data.legacy.autoSentAt ?? data.legacy.manualSentAt ?? "")},
        antes de o painel registrar os grupos. Não sabemos quais grupos receberam.
      </p>
    ) : semGrupoNoRaio ? null : (
      <p className="text-sm text-[#1d1d1b]">
        <strong>Ainda não divulgada.</strong> Nenhum grupo recebeu esta vaga.
      </p>
    );
  } else {
    const motivo = todosFalharam && ultima ? primeiroMotivo(ultima) : null;
    corpo = (
      <>
        <p className="text-sm font-medium text-[#1d1d1b]">{roundHeadline(ultima!, radiusKm)}</p>
        {todosFalharam && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <strong>A vaga não saiu em nenhum grupo.</strong>
            {motivo ? ` ${motivo}.` : ""} Tente de novo em alguns minutos.
          </div>
        )}
        {data.center.source === null && radiusKm > 0 && (
          <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <strong>Sem localização da vaga: foi só para o grupo da cidade.</strong> Não conseguimos
            achar o endereço no mapa, então os grupos a até {radiusKm} km não receberam.
          </div>
        )}
        <div className="space-y-1">
          {data.rounds.map((r, i) => (
            <Rodada key={r.roundId} round={r} aberta={i === 0} radiusKm={radiusKm} />
          ))}
        </div>
        {temDistancia && (
          <p className="text-[11px] text-[#737373]">
            Distância em linha reta, {origemDaDistancia(data.center)} até o centro da cidade do
            grupo, arredondada para o km inteiro.
          </p>
        )}
      </>
    );
  }

  // Ação: some no carregamento e no erro (lá a ação é "Tentar de novo" a leitura).
  const mostrarAcao = !query.isLoading && (apiAntiga || Boolean(data));

  return (
    <section aria-label="Divulgação nos grupos" className="space-y-3 rounded-lg bg-[#f7f7f7] p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[#737373]">
        Divulgação nos grupos
      </p>
      {corpo}
      {mostrarAcao &&
        (semGrupoNoRaio && !apiAntiga ? (
          <NoGroupInRadius center={preview.data?.center ?? data?.center ?? null} radiusKm={radiusKm} />
        ) : (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => setConfirmando(true)}
            title={`Manda de novo para todos os grupos a até ${radiusKm || RAIO_PADRAO_KM} km da vaga, inclusive os que já receberam.`}
            className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center rounded-md bg-[#1d1d1b] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#333] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            {ocupado ? "Enviando…" : rotulo}
          </button>
        ))}
      <ResendGroupsDialog
        vacancyId={vacancyId}
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={fluxo.resend}
        sending={fluxo.enviando}
        lastBroadcastAt={quandoSaiu}
        neverSent={nuncaSaiu}
        now={now}
      />
    </section>
  );
}

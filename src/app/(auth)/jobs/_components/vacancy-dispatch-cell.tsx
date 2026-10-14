"use client";

import { useState } from "react";
import { toast } from "sonner";

import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useResendVacancyGroupMessage } from "@/modules/admin/application/use-vacancy-outreach";
import { useGroupBroadcastResend } from "@/modules/admin/application/use-vacancy-group-broadcasts";
import { lastRoundInFlight, RAIO_PADRAO_KM } from "@/modules/admin/domain/group-broadcast";
import type { OutreachRecord } from "@/modules/admin/infrastructure/vacancy-outreach-api";
import { formatInstantDate, formatVacancyTime } from "@/lib/date.utils";

import { GroupDispatchBadge } from "./group-dispatch-badge";
import { ResendGroupsDialog } from "./resend-groups-dialog";

/**
 * Coluna "Disparo" — o anúncio da vaga no grupo da cidade.
 *
 * Antes dizia só "✓ enviado" e sumia com o botão. Isso escondia as duas coisas
 * que quem olha o painel precisa saber: se o disparo AUTOMÁTICO funcionou (a
 * Evolution cai, e a vaga entra sem ninguém no grupo saber) e se alguém já
 * apertou o botão — duas pessoas no mesmo painel mandavam o mesmo anúncio duas
 * vezes para o mesmo grupo.
 *
 * Vive fora das páginas porque os DOIS módulos usam a mesma coluna; duplicar
 * faria Empresa e Casa divergirem na primeira mudança.
 */
export function VacancyDispatchCell({
  vacancyId,
  record,
  module,
  broadcastAt,
}: {
  vacancyId: string;
  record: OutreachRecord | undefined;
  module: "empresa" | "casa";
  /** Empresas: `groupBroadcastAt` da vaga (saiu num grupo antes do registro da coluna). */
  broadcastAt?: string | null;
}) {
  // Empresas: divulgação por raio (vários grupos), com confirmação e andamento.
  // Casa (encerrado): exatamente o comportamento de antes.
  return module === "empresa" ? (
    <EmpresaDispatchCell vacancyId={vacancyId} record={record} broadcastAt={broadcastAt ?? null} />
  ) : (
    <CasaDispatchCell vacancyId={vacancyId} record={record} module={module} />
  );
}

/**
 * Empresas: selo da última rodada nos grupos + "Reenviar", que pede
 * confirmação listando os grupos (vai para TODOS no raio, inclusive os que já
 * receberam) e acompanha a fila até o fim.
 */
function EmpresaDispatchCell({
  vacancyId,
  record,
  broadcastAt,
}: {
  vacancyId: string;
  record: OutreachRecord | undefined;
  broadcastAt: string | null;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const fluxo = useGroupBroadcastResend(vacancyId);
  // Rodada ainda na fila: reenviar agora abriria outra rodada por cima dela.
  const ocupado =
    fluxo.enviando || fluxo.acompanhando || lastRoundInFlight(record?.groupBroadcast?.lastRound);
  const ultimaVez =
    record?.groupBroadcast?.lastRound && record.groupBroadcast.lastRound.sent > 0
      ? record.groupBroadcast.lastRound.at
      : (record?.lastSentAt ?? broadcastAt);
  const jaSaiu = Boolean(record || broadcastAt);

  return (
    <div className="flex items-center gap-1.5">
      <GroupDispatchBadge record={record} vacancyBroadcastAt={broadcastAt} />
      <button
        type="button"
        disabled={ocupado}
        onClick={() => setConfirmando(true)}
        className="cursor-pointer whitespace-nowrap rounded-md bg-[#1d1d1b] px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#333] disabled:cursor-wait disabled:opacity-60"
        title={`Manda de novo para todos os grupos a até ${RAIO_PADRAO_KM} km da vaga, inclusive os que já receberam.`}
      >
        {ocupado ? "Enviando…" : jaSaiu ? "Reenviar" : "Enviar"}
      </button>
      <ResendGroupsDialog
        vacancyId={vacancyId}
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={fluxo.resend}
        sending={fluxo.enviando}
        lastBroadcastAt={ultimaVez}
        neverSent={!jaSaiu}
      />
    </div>
  );
}

/** Casa (encerrado): o botão de antes, sem confirmação, só o grupo da cidade. */
function CasaDispatchCell({
  vacancyId,
  record,
  module,
}: {
  vacancyId: string;
  record: OutreachRecord | undefined;
  module: "empresa" | "casa";
}) {
  const [enviando, setEnviando] = useState(false);
  const reenviar = useResendVacancyGroupMessage();

  const auto = record?.autoSentAt ?? null;
  const manual = record?.manualSentAt ?? null;
  // Linha antiga (anterior ao registro de origem) — sabemos que saiu, não por quem.
  const semOrigem = Boolean(record) && !auto && !manual;

  async function disparar() {
    setEnviando(true);
    try {
      await reenviar.mutateAsync({ vacancyId, module });
      toast.success("Anúncio enviado ao grupo da cidade.");
    } catch (e) {
      toast.error(getAxiosErrorMessage(e, "Não foi possível enviar ao grupo."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <StatusDoDisparo auto={auto} manual={manual} semOrigem={semOrigem} />
      <button
        type="button"
        disabled={enviando}
        onClick={disparar}
        className="cursor-pointer whitespace-nowrap rounded-md bg-[#1d1d1b] px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#333] disabled:cursor-wait disabled:opacity-60"
        title={
          record
            ? "Enviar de novo o anúncio desta vaga no grupo da cidade"
            : "Enviar o anúncio desta vaga no grupo da cidade"
        }
      >
        {enviando ? "Enviando…" : record ? "Reenviar" : "Enviar"}
      </button>
    </div>
  );
}

/** O selo: o que aconteceu com esta vaga, em uma olhada. */
function StatusDoDisparo({
  auto,
  manual,
  semOrigem,
}: {
  auto: string | null;
  manual: string | null;
  semOrigem: boolean;
}) {
  if (semOrigem) {
    return (
      <span
        className="whitespace-nowrap text-xs font-medium text-[#737373]"
        title="Enviado antes de o painel passar a registrar a origem do disparo"
      >
        ✓ enviado
      </span>
    );
  }

  if (!auto && !manual) {
    return (
      <span
        className="whitespace-nowrap text-xs font-medium text-red-600"
        title="O anúncio desta vaga nunca saiu no grupo da cidade"
      >
        ✗ não enviado
      </span>
    );
  }

  // Quando os dois existem, o selo mostra o ÚLTIMO (é o que responde "e agora,
  // precisa mandar?"); o histórico completo fica no title.
  const manualDepois = Boolean(manual) && (!auto || Date.parse(manual!) >= Date.parse(auto!));
  const titulo = [
    auto ? `Automático em ${quando(auto)}` : "Automático não saiu",
    manual ? `Manual em ${quando(manual)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span
      className={`whitespace-nowrap text-xs font-medium ${
        manualDepois ? "text-blue-700" : "text-green-700"
      }`}
      title={titulo}
    >
      ✓ {manualDepois ? "manual" : "automático"}
      <span className="ml-1 font-normal tabular-nums text-[#737373]">
        {formatVacancyTime((manualDepois ? manual : auto)!)}
      </span>
    </span>
  );
}

/** "11/08 · 20:04" no fuso de Brasília. */
function quando(iso: string): string {
  return `${formatInstantDate(iso)} · ${formatVacancyTime(iso)}`;
}

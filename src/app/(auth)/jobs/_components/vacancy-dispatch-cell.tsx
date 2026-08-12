"use client";

import { useState } from "react";
import { toast } from "sonner";

import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useResendVacancyGroupMessage } from "@/modules/admin/application/use-vacancy-outreach";
import type { OutreachRecord } from "@/modules/admin/infrastructure/vacancy-outreach-api";
import { formatInstantDate, formatVacancyTime } from "@/lib/date.utils";

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

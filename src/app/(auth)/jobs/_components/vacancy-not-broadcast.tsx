"use client";

import { Badge } from "@/components/ui/badge";
import type { OutreachRecord } from "@/modules/admin/infrastructure/vacancy-outreach-api";
import { VacancyDispatchCell } from "./vacancy-dispatch-cell";

/** Selo âmbar da linha/cartão: o anúncio desta vaga nunca saiu em grupo. */
export function NotBroadcastBadge() {
  return (
    <Badge
      variant="warning"
      title="O anúncio desta vaga não saiu em nenhum grupo de WhatsApp. Abra a vaga para reenviar."
    >
      Não divulgada
    </Badge>
  );
}

/**
 * Aviso do modal da vaga com o MESMO botão da coluna Disparo — que já mostra a
 * mensagem da API no erro (ex.: 'Não existe o grupo "Vagas Freela Brejetuba ES"…').
 */
export function VacancyNotBroadcastNotice({
  vacancyId,
  module,
  record,
}: {
  vacancyId: string;
  module: "empresa" | "casa";
  record: OutreachRecord | undefined;
}) {
  return (
    <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <p className="font-semibold">Vaga não divulgada · Reenviar ao grupo</p>
      <p className="mt-1 text-xs">
        O anúncio desta vaga não saiu em nenhum grupo de WhatsApp: os freelancers da cidade não foram
        avisados. Se a cidade ainda não tem grupo, crie em Grupos WhatsApp e envie por aqui.
      </p>
      <div className="mt-2">
        <VacancyDispatchCell vacancyId={vacancyId} record={record} module={module} />
      </div>
    </div>
  );
}

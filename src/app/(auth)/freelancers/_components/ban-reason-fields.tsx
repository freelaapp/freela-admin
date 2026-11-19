"use client";

import { useQuery } from "@tanstack/react-query";
import { ChoicePills } from "@/components/ui/choice-pills";
import { getFreelancerAccessEvents } from "@/modules/admin/infrastructure/admin-api";
import {
  BAN_REASON_OPTIONS,
  UNBAN_REASON_OPTIONS,
  accessEventLine,
} from "@/modules/admin/application/freelancer-access-presentation";

/**
 * D5, fatia C3: o motivo (lista fixa) e a nota interna no diálogo de banir/desbanir, mais o último
 * registro de acesso da pessoa (quem baniu, quando e por quê). API antiga: sem histórico.
 */
export function BanReasonFields({
  userId,
  banning,
  reason,
  note,
  error,
  onReason,
  onNote,
}: {
  userId: string | null;
  /** true = banir; false = desbanir. */
  banning: boolean;
  reason: string;
  note: string;
  error: string | null;
  onReason: (value: string) => void;
  onNote: (value: string) => void;
}) {
  const history = useQuery({
    queryKey: ["admin", "freelancer-access-events", userId],
    queryFn: () => getFreelancerAccessEvents(userId as string),
    enabled: Boolean(userId),
    retry: false,
  });
  const last = history.data?.[0] ?? null;
  const options = (banning ? BAN_REASON_OPTIONS : UNBAN_REASON_OPTIONS).map((o) => ({
    value: o.value as string,
    label: o.label,
  }));

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-[#1d1d1b]">
          {banning ? "Motivo do bloqueio" : "Motivo para desbanir"}
        </p>
        <ChoicePills<string>
          aria-label={banning ? "Motivo do bloqueio" : "Motivo para desbanir"}
          options={options}
          value={reason}
          onChange={onReason}
        />
        {banning && (
          <p className="mt-1.5 text-xs text-[#737373]">
            O motivo fica registrado com o seu nome. A pessoa lê esse motivo no aviso de conta bloqueada,
            quando os avisos novos estiverem ligados.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="ban-note" className="mb-1.5 block text-xs font-semibold text-[#1d1d1b]">
          Nota interna {banning ? "(opcional)" : "(obrigatória com Outro motivo)"}
        </label>
        <textarea
          id="ban-note"
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(e) => onNote(e.target.value)}
          className="w-full rounded-md border border-[#e5e5e5] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
        />
      </div>
      {error && <p className="text-xs font-medium text-red-700">{error}</p>}
      {last && <p className="text-xs text-[#737373]">Último registro: {accessEventLine(last)}</p>}
    </div>
  );
}

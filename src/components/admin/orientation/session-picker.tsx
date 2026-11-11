"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatSessionDay,
  formatSessionTimeRange,
} from "@/modules/admin/application/orientation-presentation";
import { useOrientationSessions, useOrientationSettings } from "@/modules/admin/application/use-orientation";
import type { OrientationSessionView } from "@/modules/admin/infrastructure/orientation-api";

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 28;
const DEFAULT_CLOSES_MIN = 0;

interface Props {
  /** Turma atual (ao trocar): não aparece na lista. */
  excludeSessionId?: string;
  pending: boolean;
  onPick: (sessionId: string) => void;
  onCancel: () => void;
}

function seatsText(left: number): string {
  return left === 1 ? "falta 1 lugar" : `faltam ${left} lugares`;
}

/** Lista inline das turmas abertas dos próximos 28 dias, com lugar e inscrição aberta. O servidor decide no fim. */
export function SessionPicker({ excludeSessionId, pending, onPick, onCancel }: Props) {
  const [range] = useState(() => {
    const now = Date.now();
    return { from: new Date(now).toISOString(), to: new Date(now + WINDOW_DAYS * DAY_MS).toISOString() };
  });
  const sessionsQ = useOrientationSessions(range);
  const settingsQ = useOrientationSettings();
  const closesMin = settingsQ.data?.bookingClosesMinBefore ?? DEFAULT_CLOSES_MIN;

  const options = useMemo<OrientationSessionView[]>(() => {
    const now = Date.now();
    return (sessionsQ.data ?? []).filter(
      (s) =>
        s.status === "OPEN" &&
        s.id !== excludeSessionId &&
        s.bookedCount < s.capacity &&
        new Date(s.startsAt).getTime() - closesMin * 60_000 > now,
    );
  }, [sessionsQ.data, excludeSessionId, closesMin]);

  return (
    <div className="space-y-2 text-sm text-[#1d1d1b]">
      <p className="font-semibold">Escolha a turma</p>
      {sessionsQ.isLoading && (
        <p className="flex items-center gap-2 text-[#737373]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando turmas…
        </p>
      )}
      {sessionsQ.isError && <p className="text-red-600">Não deu para carregar as turmas.</p>}
      {!sessionsQ.isLoading && !sessionsQ.isError && options.length === 0 && (
        <p className="text-[#737373]">Nenhuma turma com vaga e inscrição aberta nos próximos 28 dias.</p>
      )}
      <ul className="space-y-2">
        {options.map((s) => (
          <li key={s.id}>
            <Button
              variant="outline"
              className="min-h-11 w-full justify-start whitespace-normal text-left"
              disabled={pending}
              onClick={() => onPick(s.id)}
            >
              {formatSessionDay(s.startsAt)} · {formatSessionTimeRange(s.startsAt, s.endsAt)} —{" "}
              {seatsText(s.capacity - s.bookedCount)}
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <Button variant="outline" className="min-h-11" onClick={onCancel} disabled={pending}>
          Voltar
        </Button>
      </div>
    </div>
  );
}

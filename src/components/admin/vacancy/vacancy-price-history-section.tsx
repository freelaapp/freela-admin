"use client";

import { HandCoins, Pencil, Tag } from "lucide-react";

import { useVacancyPriceHistory } from "@/modules/admin/application/use-vacancy-price-history";
import type {
  PricingChangeReason,
  VacancyPriceHistoryEntry,
} from "@/modules/admin/infrastructure/admin-api";
import { formatCents } from "@/lib/money";
import { formatInstantDateTime } from "@/lib/date.utils";

/**
 * Histórico de preços da vaga — linha do tempo de cada (re)precificação.
 *
 * Cada entrada é uma mudança de valor: criação, ajuste manual ou negociação
 * (proposta do freelancer / contraproposta do contratante aceitas). Mostra o
 * total que o contratante paga e o líquido do freelancer em cada momento, mais a
 * variação sobre a entrada anterior — é onde o operador vê "por que o valor
 * mudou" sem cruzar logs. Auto-contido: busca os próprios dados e some quando
 * não há histórico (vaga antiga anterior ao log, ou negociação desligada → 404).
 *
 * Espelha visualmente o `VacancyRoadmap` (mesma trilha vertical + nós).
 */

const REASON_META: Record<
  string,
  { label: string; Icon: typeof HandCoins; negotiation: boolean }
> = {
  CREATE: { label: "Preço inicial", Icon: Tag, negotiation: false },
  UPDATE: { label: "Preço ajustado", Icon: Pencil, negotiation: false },
  PROPOSAL_ACCEPT: {
    label: "Proposta do freelancer aceita",
    Icon: HandCoins,
    negotiation: true,
  },
  COUNTER_ACCEPT: {
    label: "Contraproposta aceita",
    Icon: HandCoins,
    negotiation: true,
  },
};

function reasonMeta(reason: PricingChangeReason | null) {
  return (
    (reason && REASON_META[reason]) ?? {
      label: "Precificação",
      Icon: Tag,
      negotiation: false,
    }
  );
}

/** "(+R$ 20,00)" / "(−R$ 15,00)" da variação sobre a entrada anterior. */
function DeltaBadge({ deltaInCents }: { deltaInCents: number }) {
  if (deltaInCents === 0) return null;
  const up = deltaInCents > 0;
  return (
    <span
      className={`ml-1.5 text-[11px] font-semibold tabular-nums ${
        up ? "text-[#b45309]" : "text-[#15803d]"
      }`}
    >
      ({up ? "+" : "−"}
      {formatCents(Math.abs(deltaInCents))})
    </span>
  );
}

function PriceHistoryRow({
  entry,
  previous,
  isLast,
}: {
  entry: VacancyPriceHistoryEntry;
  previous: VacancyPriceHistoryEntry | null;
  isLast: boolean;
}) {
  const meta = reasonMeta(entry.changeReason);
  const { Icon } = meta;
  const chargeDelta = previous
    ? entry.chargeAmountInCents - previous.chargeAmountInCents
    : 0;
  const netDelta = previous
    ? entry.freelancerAmountInCents - previous.freelancerAmountInCents
    : 0;

  return (
    <li className="relative flex gap-3 pb-3 last:pb-0">
      {!isLast && (
        <span className="absolute left-[11px] top-6 bottom-0 w-px bg-[#e5e5e5]" />
      )}
      <span
        className={`relative z-10 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border ${
          meta.negotiation
            ? "bg-[#eca826] border-[#eca826]"
            : "bg-white border-[#e5e5e5]"
        }`}
      >
        <Icon
          className={`h-3 w-3 ${meta.negotiation ? "text-white" : "text-[#a3a3a3]"}`}
        />
      </span>
      <div className="pt-0.5">
        <p className="text-sm font-medium leading-tight text-[#1d1d1b]">
          {meta.label}
        </p>
        <p className="mt-0.5 text-[11px] font-medium tabular-nums text-[#eca826]">
          {formatInstantDateTime(entry.calculatedAt)}
        </p>
        <p className="mt-1 text-[12px] tabular-nums text-[#1d1d1b]">
          Contratante paga{" "}
          <span className="font-semibold">
            {formatCents(entry.chargeAmountInCents)}
          </span>
          <DeltaBadge deltaInCents={chargeDelta} />
        </p>
        <p className="text-[12px] tabular-nums text-[#737373]">
          Freelancer recebe{" "}
          <span className="font-semibold text-[#1d1d1b]">
            {formatCents(entry.freelancerAmountInCents)}
          </span>
          <DeltaBadge deltaInCents={netDelta} />
          <span className="text-[#a3a3a3]">
            {" · "}
            serviço {formatCents(entry.baseAmountInCents)}
          </span>
        </p>
      </div>
    </li>
  );
}

export function VacancyPriceHistorySection({
  vacancyId,
}: {
  vacancyId: string | null;
}) {
  const { data, isLoading, isError } = useVacancyPriceHistory(vacancyId);

  // Sem histórico (vaga antiga / negociação desligada / 404) → não polui o modal.
  if (!isLoading && !isError && (!data || data.length === 0)) return null;

  return (
    <div className="bg-[#f7f7f7] rounded-lg p-3 space-y-2">
      <p className="text-[#737373] text-xs font-medium uppercase tracking-wide">
        Histórico de preços
      </p>
      {isLoading ? (
        <p className="text-[12px] text-[#a3a3a3]">Carregando histórico…</p>
      ) : isError ? (
        <p className="text-[12px] text-red-600">
          Não foi possível carregar o histórico de preços.
        </p>
      ) : (
        <ol className="mt-1">
          {(data ?? []).map((entry, i, all) => (
            <PriceHistoryRow
              key={`${entry.calculatedAt}-${i}`}
              entry={entry}
              previous={i > 0 ? all[i - 1] : null}
              isLast={i === all.length - 1}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

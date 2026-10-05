"use client";

import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { formatInstantDate } from "@/lib/date.utils";
import type { StatementItem, StatementPayoutItem } from "@/lib/commissions/types";

export function moduleLabel(module: string | null): string {
  if (module === "bars-restaurants") return "Empresa";
  if (module === "home-services") return "Em Casa";
  return "—";
}

export function CommissionStatementView({
  items,
  onReversePayout,
}: {
  items: StatementItem[];
  onReversePayout?: (item: StatementPayoutItem) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-[#e5e5e5] bg-white p-4 text-sm text-[#737373]">
        Nenhum lançamento no período.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[#f1f1f1] rounded-lg border border-[#e5e5e5] bg-white">
      {items.map((item) =>
        item.type === "PAYOUT" ? (
          <li key={`p-${item.id}`} className={`p-4 ${item.reversedAt ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-sm font-semibold text-[#1d1d1b] ${item.reversedAt ? "line-through" : ""}`}>
                  Pagamento de {formatCents(item.amountInCents)}
                </p>
                <p className="text-xs text-[#737373]">
                  {formatInstantDate(item.paidAt)} · quitou {item.entriesCount} lançamento(s) até{" "}
                  {item.periodEnd.split("-").reverse().join("/")}
                </p>
                <p className="break-all text-xs text-[#737373]">Comprovante {item.paymentProof}</p>
                {item.reversedAt && (
                  <p className="text-xs text-red-600">
                    Estornado em {formatInstantDate(item.reversedAt)}: {item.reversalReason}
                  </p>
                )}
              </div>
              {onReversePayout && !item.reversedAt && (
                <Button size="sm" variant="outline" onClick={() => onReversePayout(item)}>
                  Estornar
                </Button>
              )}
            </div>
          </li>
        ) : (
          <li key={`e-${item.id}`} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1d1d1b]">
                  {item.kind === "ADJUSTMENT" ? "Ajuste" : item.companyName ?? item.clientName ?? "Cliente"}
                </p>
                {item.kind === "COMMISSION" ? (
                  <>
                    <p className="text-xs text-[#737373]">
                      {item.vacancyTitle && <span>{item.vacancyTitle}</span>}
                      {" · "}
                      {moduleLabel(item.module)} · concluído em {formatInstantDate(item.occurredAt)}
                    </p>
                    {item.ruleDescription && (
                      <p className="text-xs text-[#737373]">
                        {item.baseFeeInCents != null && `Taxa ${formatCents(item.baseFeeInCents)} · `}
                        {item.ruleDescription}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-[#737373]">
                    {formatInstantDate(item.occurredAt)} · {item.reason}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${item.amountInCents < 0 ? "text-red-600" : "text-[#1d1d1b]"}`}>
                  {formatCents(item.amountInCents)}
                </p>
                <p className={`text-xs ${item.status === "PAID" ? "text-emerald-700" : "text-amber-700"}`}>
                  {item.status === "PAID" && item.paidAt ? `pago em ${formatInstantDate(item.paidAt)}` : "a receber"}
                </p>
              </div>
            </div>
          </li>
        ),
      )}
    </ul>
  );
}

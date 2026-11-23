"use client";

import { useState } from "react";
import {
  MarkPaidExternallyButton,
  MarkPaidExternallyDialog,
} from "@/app/(auth)/financeiro/_components/mark-paid-externally-dialog";
import { formatBrl, instantWithWeekday } from "@/modules/admin/application/invoice-presentation";
import { repasseRowBadge } from "@/modules/admin/application/repasse-status-presentation";
import { useVacancyRepasse } from "@/modules/admin/application/use-held-repasses";

const ddmmBrt = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

/**
 * "Pagamento ao freelancer" no detalhe da vaga (23/11/2026): a situação do
 * repasse (inclusive "Pago por fora") e, quando a API deixa, o "Marcar como pago
 * por fora" — a mesma regra da ação (retido sem liberação ou Pix que falhou).
 * Sem repasse, sem acesso ao Financeiro (403) ou API de antes (404): não aparece.
 */
export function VacancyPayoutBlock({
  vacancyId,
  vacancyTitle,
  serviceDay,
  companyName,
  freelancerName,
}: {
  vacancyId: string;
  vacancyTitle: string | null;
  /** "sáb 22/11" (já formatado pela tela). */
  serviceDay: string | null;
  companyName: string | null;
  freelancerName: string | null;
}) {
  const query = useVacancyRepasse(vacancyId);
  const [opening, setOpening] = useState(0);
  const [marking, setMarking] = useState(false);
  const repasse = query.data;
  if (!repasse) return null;

  const badge = repasseRowBadge(repasse);
  const paid = repasse.paidExternally;
  const service = [vacancyTitle ?? "Serviço", serviceDay, companyName].filter(Boolean).join(" · ");
  const held = repasse.status === "AWAITING_INVOICE";

  return (
    <section
      aria-label="Pagamento ao freelancer"
      className="col-span-2 rounded-lg border border-[#e5e5e5] p-3 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[#737373]">Pagamento ao freelancer</p>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
          {badge.label}
        </span>
      </div>
      <p className="mt-1 font-semibold tabular-nums text-[#1d1d1b]">{formatBrl(repasse.amountInCents)}</p>
      {paid ? (
        <p className="mt-1 text-xs text-[#525252]">
          {[
            `Pago por fora em ${ddmmBrt(paid.at)}`,
            paid.amountPaidInCents !== repasse.amountInCents ? formatBrl(paid.amountPaidInCents) : null,
            paid.reason,
            paid.proof,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : held && repasse.deadlineAt ? (
        <p className="mt-1 text-xs text-[#525252]">
          {`Aguardando a fatura da empresa${
            repasse.releaseAuthorized ? ": liberado, o Pix sai em até 10 min" : ""
          } · garantido até ${instantWithWeekday(repasse.deadlineAt)}`}
        </p>
      ) : repasse.status === "FAILED" && repasse.failureReason ? (
        <p className="mt-1 text-xs text-[#b91c1c]">{`O Pix falhou: ${repasse.failureReason}`}</p>
      ) : null}
      {repasse.markPaidExternally.allowed && (
        <div className="mt-2">
          <MarkPaidExternallyButton
            amountInCents={repasse.amountInCents}
            name={freelancerName}
            onClick={() => {
              setOpening((n) => n + 1);
              setMarking(true);
            }}
          />
        </div>
      )}
      {marking && (
        <MarkPaidExternallyDialog
          key={opening}
          target={{
            repasseId: repasse.repasseId,
            vacancyId,
            amountInCents: repasse.amountInCents,
            freelancerName,
            service,
            companyName,
            kind: held ? "held" : "failed",
            deadlineAt: repasse.deadlineAt,
            failureReason: repasse.failureReason,
          }}
          onClose={() => setMarking(false)}
        />
      )}
    </section>
  );
}

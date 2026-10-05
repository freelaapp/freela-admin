"use client";

import type { ReferralSummary } from "@/modules/admin/infrastructure/referrals-api";
import { PENDING_REASON, PENDING_REASON_ORDER, TONE_CLASS } from "../_lib/referral-labels";

const num = (value: number) => value.toLocaleString("pt-BR");

const KIND_PLURAL = {
  EMPRESA: "viraram empresa",
  SEM_PERFIL: "só criaram o login",
  FREELANCER: "viraram freelancer",
  CASA: "viraram contratante Em Casa",
} as const;

/**
 * Resposta direta para "temos um monte de indicação e nenhuma paga": as
 * indicações ainda abertas agrupadas pelo motivo de não terem virado
 * recompensa, e o que os indicados viraram desde o início.
 */
export function ReferralPendingPanel({ summary }: { summary: ReferralSummary | undefined }) {
  const pending = summary?.pendingByReason;
  if (!summary || !pending) return null;

  const reasons = PENDING_REASON_ORDER.filter((reason) => (pending[reason] ?? 0) > 0);
  const totalPending = reasons.reduce((sum, reason) => sum + (pending[reason] ?? 0), 0);
  const byKind = summary.referredByKind;

  return (
    <section className="mb-6 rounded-lg border border-neutral-200 bg-white p-4" aria-labelledby="por-que">
      <h2 id="por-que" className="text-base font-semibold text-[#1d1d1b]">
        Por que as indicações abertas ainda não viraram recompensa
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        A recompensa nasce quando o indicado é <strong>empresa</strong> e conclui um serviço de{" "}
        <strong>R$ 80 ou mais</strong> (pago ao freelancer) em até <strong>30 dias</strong> do cadastro.
      </p>

      {totalPending === 0 ? (
        <p className="mt-3 text-sm text-neutral-600">Nenhuma indicação aberta no momento.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {reasons.map((reason) => {
            const { label, detail, tone } = PENDING_REASON[reason];
            return (
              <li key={reason} className="flex items-start gap-3 rounded-md border border-neutral-100 p-3">
                <span
                  className={`min-w-10 rounded-full px-2 py-0.5 text-center text-sm font-bold ${TONE_CLASS[tone]}`}
                >
                  {num(pending[reason] ?? 0)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1d1d1b]">{label}</p>
                  <p className="text-xs text-neutral-500">{detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {byKind && (
        <p className="mt-3 text-xs text-neutral-600">
          <span className="font-medium">Todos os indicados desde o início:</span>{" "}
          {(Object.keys(KIND_PLURAL) as Array<keyof typeof KIND_PLURAL>)
            .map((kind) => `${num(byKind[kind] ?? 0)} ${KIND_PLURAL[kind]}`)
            .join(" · ")}
          {summary.rejectedByPersonaBug
            ? ` · ${num(summary.rejectedByPersonaBug)} recusadas pelo erro de cadastro corrigido em 28/09`
            : ""}
          .
        </p>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { useAuth } from "@/modules/auth/application/use-auth";
import { useOrientationSummary } from "@/modules/admin/application/use-orientation";
import { formatCount, formatSessionShort } from "@/modules/admin/application/orientation-presentation";

function clockBrasilia(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Fila de onboarding: quem ainda precisa de aula e não tem turma marcada. Só para quem tem ORIENTATION. */
export function OrientationQueueCard() {
  const { hasPermission } = useAuth();
  const allowed = hasPermission("ORIENTATION");
  const { data } = useOrientationSummary(allowed);

  if (!allowed || !data) return null;

  const f = data.freelancers;
  const next = data.nextSession;
  const meta = next
    ? `Próxima turma: ${formatSessionShort(next.startsAt)} (${next.bookedCount}/${next.capacity})`
    : "Nenhuma turma aberta";

  return (
    <div className="mb-6 max-w-sm">
      <KpiCard
        title="Fila de onboarding"
        value={formatCount(data.queue)}
        icon={ClipboardCheck}
        meta={meta}
        details={{
          calc: `${formatCount(data.queue)} = ${formatCount(f.pending)} pendentes − ${formatCount(data.booked)} com aula marcada. Pendentes = ${formatCount(f.active)} ativos − ${formatCount(f.approved)} aprovados − ${formatCount(f.rejected)} reprovados (inclui ${formatCount(f.withoutGlobal)} sem identidade global).`,
          source: `Freelancers ativos do Empresa, situação da aula e inscrições marcadas; contado às ${clockBrasilia(data.generatedAt)}.`,
        }}
      />
      <Link
        href="/onboarding"
        className="mt-2 inline-block text-sm font-medium text-[#1d1d1b] underline hover:text-[#eca826]"
      >
        Ver turmas
      </Link>
    </div>
  );
}

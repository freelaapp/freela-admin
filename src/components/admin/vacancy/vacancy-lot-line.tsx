"use client";

import Link from "next/link";
import { Layers } from "lucide-react";

import { useAdminLotByVacancy } from "@/modules/admin/application/use-admin-lots";
import { formatServiceDate, lotLineText } from "@/modules/admin/application/lots-presentation";

/**
 * A1: uma linha no modal da vaga com o lote a que ela pertence ("Lote: 12 vagas · 5 escolhidas ·
 * 3 pagas"), ou, quando a vaga está em pré-seleção fora do lote, "Em seleção, ao lado do lote de
 * sáb 14/11". Só leitura. Sem lote, carregando, API antiga (404) ou qualquer erro: não aparece
 * nada, o modal fica como era (sem tela de erro).
 */
export function VacancyLotLine({ vacancyId }: { vacancyId: string }) {
  const { data } = useAdminLotByVacancy(vacancyId);
  if (!data) return null;

  const lot = data.lot;
  const beside = lot ? null : data.besideLot;
  if (!lot && !beside) return null;
  const target = (lot ?? beside)!;

  return (
    <p
      data-testid="vacancy-lot-line"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[#e5e5e5] bg-[#f7f7f7] px-3 py-2 text-xs text-[#1d1d1b]"
    >
      <Layers className="h-3.5 w-3.5 shrink-0 text-[#737373]" aria-hidden="true" />
      <span className="min-w-0 break-words">
        {lot
          ? lotLineText(lot)
          : `Em seleção, ao lado do lote de ${formatServiceDate(target.serviceDate)}`}
      </span>
      <Link
        href={`/lotes/${encodeURIComponent(target.id)}`}
        className="font-semibold text-[#c97b0e] hover:underline"
      >
        Abrir o lote
      </Link>
    </p>
  );
}

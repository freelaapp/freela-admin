"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import {
  RULES_HELP,
  countsLegend,
} from "@/modules/admin/application/freelancers-status-presentation";
import type {
  ProviderStatusFilter,
  ProvidersStatusCounts,
} from "@/modules/admin/infrastructure/admin-api";

function Count({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-2 py-1 text-sm transition-colors ${
        active ? "bg-[#1d1d1b] text-white" : "text-[#1d1d1b] hover:bg-[#f7f7f7]"
      }`}
    >
      <span className="font-semibold">{label}</span> {value.toLocaleString("pt-BR")}
    </button>
  );
}

/**
 * D5, fatia B: a faixa de contadores da página Freelancers. Cada número filtra a lista (menos
 * "Excluídas", que é link para Usuários). A legenda diz o que cada número conta; o "?" mostra as
 * regras, inclusive as que ainda dependem do Denner (D2 "inativas" e D3 "excluídas").
 */
export function StatusCountsStrip({
  counts,
  statusFilter,
  orientationFilter,
  onPickStatus,
  onPickNoOrientation,
}: {
  counts: ProvidersStatusCounts;
  statusFilter: string;
  orientationFilter: string;
  onPickStatus: (status: ProviderStatusFilter) => void;
  onPickNoOrientation: () => void;
}) {
  const is = (s: ProviderStatusFilter) => statusFilter === s && !orientationFilter;
  return (
    <section
      aria-label="Freelancers por situação"
      className="mb-4 rounded-lg border border-[#e5e5e5] bg-white p-3"
    >
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
        <span className="mr-1 text-xs font-semibold text-[#737373]">Situação da conta:</span>
        <Count label="Ativas" value={counts.active} active={is("active")} onClick={() => onPickStatus("active")} />
        <Count label="Banidas" value={counts.banned} active={is("banned")} onClick={() => onPickStatus("banned")} />
        <Count
          label="Exclusão pedida"
          value={counts.deletionRequested}
          active={is("deletion_requested")}
          onClick={() => onPickStatus("deletion_requested")}
        />
        {counts.profileInactive > 0 && (
          <Count
            label="Perfil desativado"
            value={counts.profileInactive}
            active={is("profile_inactive")}
            onClick={() => onPickStatus("profile_inactive")}
          />
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
        <span className="mr-1 text-xs font-semibold text-[#737373]">Entre as ativas:</span>
        <Count
          label="Suspensas agora"
          value={counts.suspended}
          active={is("suspended")}
          onClick={() => onPickStatus("suspended")}
        />
        <Count
          label="Sem aula"
          value={counts.noOrientation}
          active={statusFilter === "active" && orientationFilter === "PENDING"}
          onClick={onPickNoOrientation}
        />
        <span className="mx-1 text-[#d4d4d4]" aria-hidden="true">
          |
        </span>
        <span className="text-sm text-[#1d1d1b]">
          <span className="font-semibold">Excluídas</span> {counts.deleted.toLocaleString("pt-BR")} ·{" "}
          <Link href="/usuarios" className="text-[#b07a10] underline-offset-2 hover:underline">
            ver em Usuários → Excluídos ↗
          </Link>
        </span>
      </div>
      <p className="mt-2 text-xs text-[#737373]">{countsLegend(counts)}</p>
      <details className="mt-1 text-xs text-[#737373]">
        <summary className="inline-flex cursor-pointer items-center gap-1 font-semibold text-[#1d1d1b]">
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Como cada situação é contada
        </summary>
        <dl className="mt-2 grid gap-1">
          {RULES_HELP.map((r) => (
            <div key={r.title}>
              <dt className="inline font-semibold text-[#1d1d1b]">{r.title}: </dt>
              <dd className="inline">{r.text}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

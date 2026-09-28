"use client";

import type { LucideIcon } from "lucide-react";
import { Briefcase, Eye, Link2, MousePointerClick, UserPlus } from "lucide-react";
import { useReferralMetrics } from "@/modules/admin/application/use-admin-referrals";
import {
  REFERRAL_PERIOD_PRESETS,
  brasiliaToday,
  describeReferralRange,
  type ReferralDateRange,
  type ReferralPeriodPreset,
  type ReferralPeriodSelection,
} from "@/modules/admin/application/referral-period";

const num = (value: number | undefined) =>
  value === undefined ? "—" : value.toLocaleString("pt-BR");

function FunnelCard({
  icon: Icon,
  label,
  value,
  hints,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hints?: string[];
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-xs text-neutral-500">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-[#1d1d1b]">{value}</p>
      {hints?.map((hint) => (
        <p key={hint} className="mt-1 text-xs text-neutral-500">
          {hint}
        </p>
      ))}
    </div>
  );
}

function PeriodFilter({
  selection,
  range,
  onChange,
}: {
  selection: ReferralPeriodSelection;
  range: ReferralDateRange;
  onChange: (next: ReferralPeriodSelection) => void;
}) {
  const choose = (preset: ReferralPeriodPreset) => {
    // "Personalizado" parte do período que já está na tela, em vez de datas vazias.
    if (preset === "custom" && selection.preset !== "custom") {
      onChange({ preset, customFrom: range.from ?? "", customTo: range.to ?? "" });
      return;
    }
    onChange({ ...selection, preset });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex flex-wrap rounded-lg border border-[#e5e5e5] bg-white p-0.5">
        {REFERRAL_PERIOD_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => choose(preset.id)}
            aria-pressed={selection.preset === preset.id}
            className={
              selection.preset === preset.id
                ? "h-8 cursor-pointer rounded-md bg-[#eca826] px-3 text-sm font-semibold text-[#1d1d1b]"
                : "h-8 cursor-pointer rounded-md px-3 text-sm text-[#737373] transition-colors hover:bg-[#f7f7f7]"
            }
          >
            {preset.label}
          </button>
        ))}
      </div>
      {selection.preset === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selection.customFrom}
            max={selection.customTo || brasiliaToday()}
            onChange={(event) => onChange({ ...selection, customFrom: event.target.value })}
            aria-label="Início do período"
            className="h-9 rounded-lg border border-[#e5e5e5] bg-white px-3 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
          />
          <span className="text-xs text-[#737373]">até</span>
          <input
            type="date"
            value={selection.customTo}
            min={selection.customFrom || undefined}
            max={brasiliaToday()}
            onChange={(event) => onChange({ ...selection, customTo: event.target.value })}
            aria-label="Fim do período"
            className="h-9 rounded-lg border border-[#e5e5e5] bg-white px-3 text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Funil do Indique e Ganhe no período: quem abriu a tela → gerou o link → o
 * link foi aberto → virou cadastro → publicou vaga. Cada card conta pela data
 * do próprio evento.
 */
export function ReferralFunnelSection({
  selection,
  range,
  onSelectionChange,
}: {
  selection: ReferralPeriodSelection;
  range: ReferralDateRange;
  onSelectionChange: (next: ReferralPeriodSelection) => void;
}) {
  const metrics = useReferralMetrics(range);
  const m = metrics.data;

  return (
    <section className="mb-8" aria-labelledby="funil-indicacao">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="funil-indicacao" className="text-base font-semibold text-[#1d1d1b]">
            Desempenho do programa
          </h2>
          <p className="text-xs text-neutral-500">
            {describeReferralRange(range)} · horário de Brasília
          </p>
        </div>
        <PeriodFilter selection={selection} range={range} onChange={onSelectionChange} />
      </div>

      {metrics.isError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Não consegui carregar os indicadores. Se a API ainda não foi atualizada, eles aparecem
          depois do deploy.
        </p>
      ) : (
        <div
          className={`grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 ${metrics.isFetching ? "opacity-70" : ""}`}
        >
          <FunnelCard
            icon={Eye}
            label="Acessos à tela de indicação"
            value={num(m?.pageViews.total)}
            hints={
              m && [
                `${num(m.pageViews.uniqueUsers)} pessoas`,
                `Web ${num(m.pageViews.byPlatform.web)} · App ${num(m.pageViews.byPlatform.app)}`,
              ]
            }
          />
          <FunnelCard
            icon={Link2}
            label="Links gerados"
            value={num(m?.codesGenerated)}
            hints={["cada código é um link"]}
          />
          <FunnelCard
            icon={MousePointerClick}
            label="Links abertos"
            value={num(m?.linkOpens.total)}
            hints={m && [`${num(m.linkOpens.uniqueCodes)} links diferentes`]}
          />
          <FunnelCard
            icon={UserPlus}
            label="Cadastros pelo link"
            value={num(m?.signups.total)}
            hints={
              m && [
                `${num(m.signups.byProfile.empresa)} empresas · ${num(m.signups.byProfile.casa)} Em Casa`,
                `${num(m.signups.byProfile.freelancer)} freelancers · ${num(m.signups.byProfile.semPerfil)} sem perfil`,
              ]
            }
          />
          <FunnelCard
            icon={Briefcase}
            label="Vagas abertas por indicados"
            value={num(m?.vacancies.total)}
            hints={
              m && [
                `de ${num(m.vacancies.contractors)} contratantes`,
                `Empresa ${num(m.vacancies.byModule["bars-restaurants"])} · Casa ${num(m.vacancies.byModule["home-services"])}`,
              ]
            }
          />
        </div>
      )}

      <p className="mt-2 text-xs text-neutral-500">
        Acessos à tela e links abertos passaram a ser medidos em set/2026 — antes disso esses dois
        cards ficam zerados. Cadastros são classificados pelo perfil que a pessoa tem hoje.
      </p>
    </section>
  );
}

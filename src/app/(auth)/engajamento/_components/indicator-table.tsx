import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { changeInfo, formatValue } from "@/modules/admin/application/engagement-format";
import {
  INDICATORS_PENDING,
  indicatorParts,
  indicatorSource,
  type IndicatorDef,
  type PeriodSide,
} from "@/modules/admin/application/engagement-metrics";
import type { EngagementIndicators, EngagementOverview } from "@/modules/admin/infrastructure/engagement-api";

const ARROW = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight } as const;

/** Variação contra o anterior: seta para onde andou, cor pelo sentido bom do indicador. */
function Change({ def, i }: { def: IndicatorDef; i: EngagementIndicators }) {
  const c = changeInfo(def.pick(i), def.higherIsBetter);
  const Icon = c.direction ? ARROW[c.direction] : null;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", c.color)}>
      {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
      {c.text}
    </span>
  );
}

/** As parcelas da conta ("2 de 5 cadastrados"); nada quando o número é uma contagem simples. */
function Parts({ def, i, side }: { def: IndicatorDef; i: EngagementIndicators; side: PeriodSide }) {
  const text = indicatorParts(def, i, side);
  return text ? <span className="mt-0.5 block break-words text-xs text-[#737373]">{text}</span> : null;
}

/** Sempre visível (regra do dono): o que é, como se calcula e de onde vem. */
function Explain({ def, measuredSince }: { def: IndicatorDef; measuredSince: string | null }) {
  return (
    <>
      <span className="mt-1 block break-words text-xs text-[#525252]">
        <span className="font-medium">Como calcular:</span> {def.how}
      </span>
      <span className="mt-0.5 block break-words text-xs text-[#737373]">
        <span className="font-medium">Fonte:</span> {indicatorSource(def, measuredSince)}
      </span>
    </>
  );
}

/**
 * Tabela de indicadores da diretoria: nome, valor do período, anterior com a
 * variação, parcelas da conta, "como calcular" e fonte. Tabela a partir do
 * `md`; abaixo disso, um cartão por indicador em 1 coluna.
 */
export function IndicatorTable({
  title,
  defs,
  overview,
}: {
  title: string;
  defs: IndicatorDef[];
  overview: EngagementOverview;
}) {
  const i = overview.indicators;
  const since = overview.measuredSince;
  return (
    <section className="rounded-xl border border-[#e5e5e5] bg-white p-4 md:p-5">
      <h3 className="text-base font-semibold text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h3>
      <p className="mb-3 mt-0.5 text-xs text-[#737373]">
        {`Período: ${overview.period.label} · Anterior: ${overview.period.previousLabel}`}
      </p>
      {!i ? (
        <p role="note" className="rounded-lg border border-dashed border-[#e5e5e5] p-4 text-sm text-[#737373]">
          {INDICATORS_PENDING}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[#e5e5e5] text-left text-xs text-[#737373]">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Indicador
                  </th>
                  <th scope="col" className="w-40 py-2 pr-4 text-right font-medium">
                    Período
                  </th>
                  <th scope="col" className="w-48 py-2 text-right font-medium">
                    Anterior
                  </th>
                </tr>
              </thead>
              <tbody>
                {defs.map((def) => {
                  const m = def.pick(i);
                  return (
                    <tr key={def.key} className="border-b border-[#f0f0f0] align-top last:border-0">
                      <th scope="row" className="py-3 pr-4 text-left font-normal">
                        <span className="block font-medium text-[#1d1d1b]">{def.label}</span>
                        <Explain def={def} measuredSince={since} />
                      </th>
                      <td className="py-3 pr-4 text-right">
                        <span className="block text-base font-semibold text-[#1d1d1b]">
                          {formatValue(m.current, def.kind)}
                        </span>
                        <Parts def={def} i={i} side="current" />
                      </td>
                      <td className="py-3 text-right">
                        <span className="block font-semibold text-[#525252]">{formatValue(m.previous, def.kind)}</span>
                        <Change def={def} i={i} />
                        <Parts def={def} i={i} side="previous" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {defs.map((def) => {
              const m = def.pick(i);
              return (
                <li key={def.key} className="rounded-lg border border-[#e5e5e5] p-3">
                  <p className="font-medium text-[#1d1d1b]">{def.label}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <dt className="text-xs text-[#737373]">Período</dt>
                      <dd>
                        <span className="block text-lg font-semibold text-[#1d1d1b]">
                          {formatValue(m.current, def.kind)}
                        </span>
                        <Parts def={def} i={i} side="current" />
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-[#737373]">Anterior</dt>
                      <dd>
                        <span className="block text-lg font-semibold text-[#525252]">
                          {formatValue(m.previous, def.kind)}
                        </span>
                        <Change def={def} i={i} />
                        <Parts def={def} i={i} side="previous" />
                      </dd>
                    </div>
                  </dl>
                  <Explain def={def} measuredSince={since} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

"use client";

import { forwardRef } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { bucketLabel } from "@/modules/admin/application/engagement-format";
import { SERIES_LINES, type SeriesKey } from "@/modules/admin/application/engagement-metrics";
import type { EngagementOverview } from "@/modules/admin/infrastructure/engagement-api";

type Series = EngagementOverview["series"];

function chartRows(series: Series) {
  return series.points.map((p) => ({ ...p, label: bucketLabel(p.bucket, series.unit) }));
}

function pickLines(keys?: SeriesKey[]) {
  return keys ? SERIES_LINES.filter((l) => keys.includes(l.key)) : SERIES_LINES;
}

/** Gráfico da tela, na largura da coluna. Sem dado (null) vira buraco na linha, nunca 0. */
export function SeriesChart({ series, lines }: { series: Series; lines?: SeriesKey[] }) {
  return (
    <section className="rounded-xl border border-[#e5e5e5] bg-white p-5">
      <h3 className="mb-4 text-base font-semibold text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
        Evolução no período
      </h3>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartRows(series)} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="label" stroke="#737373" fontSize={12} minTickGap={16} />
            <YAxis stroke="#737373" fontSize={12} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {pickLines(lines).map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                name={l.label}
                stroke={l.color}
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

/**
 * Cópia de tamanho fixo (720×300), que a página monta fora da tela só para
 * virar PNG no PDF. Assim o PDF não depende da aba aberta nem da largura do
 * celular. Sem animação, para a captura não pegar a linha pela metade. A
 * legenda vai como texto no PDF (a do Recharts é HTML, fica fora do SVG).
 */
export const SeriesChartForExport = forwardRef<HTMLDivElement, { series: Series }>(
  function SeriesChartForExport({ series }, ref) {
    return (
      <div ref={ref} style={{ width: 720, height: 300, background: "#ffffff" }}>
        <LineChart width={720} height={300} data={chartRows(series)} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="label" stroke="#737373" fontSize={12} minTickGap={16} />
          <YAxis stroke="#737373" fontSize={12} allowDecimals={false} />
          {SERIES_LINES.map((l) => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </div>
    );
  },
);

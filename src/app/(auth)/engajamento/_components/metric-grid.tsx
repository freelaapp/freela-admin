import { KpiCard } from "@/components/shared/kpi-card";
import { dateBR, deltaInfo, formatValue } from "@/modules/admin/application/engagement-format";
import type { MetricDef } from "@/modules/admin/application/engagement-metrics";
import type { EngagementOverview, EngagementProduct } from "@/modules/admin/infrastructure/engagement-api";

/** 1 coluna no celular, 2 no tablet, 4 no desktop. */
export function MetricGrid({
  overview,
  metrics,
  product,
}: {
  overview: EngagementOverview;
  metrics: MetricDef[];
  product: EngagementProduct;
}) {
  const since = overview.measuredSince;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((def) => {
        const m = def.pick(overview);
        const delta = deltaInfo(m, def.kind, def.higherIsBetter);
        // Quebra só quando a API manda o par e o filtro é "Empresa + Casa".
        const breakdown =
          product === "all" && m.byModule
            ? [
                { label: "Empresa", value: formatValue(m.byModule.barsRestaurants, def.kind) },
                { label: "Casa", value: formatValue(m.byModule.homeServices, def.kind) },
              ]
            : undefined;
        const help = def.opened
          ? `${def.help} ${since ? `Medido desde ${dateBR(since)}; antes disso aparece "—".` : `Ainda sem medição; aparece "—".`}`
          : def.help;
        return (
          <KpiCard
            key={def.key}
            title={def.label}
            value={formatValue(m.current, def.kind)}
            icon={def.icon}
            meta={delta.text}
            metaColor={delta.color}
            help={help}
            breakdown={breakdown}
          />
        );
      })}
    </div>
  );
}

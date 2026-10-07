import { formatValue } from "@/modules/admin/application/engagement-format";
import { funnelBars, type FunnelStep } from "@/modules/admin/application/engagement-metrics";

export function Funnel({ title, steps }: { title: string; steps: FunnelStep[] }) {
  return (
    <section className="rounded-xl border border-[#e5e5e5] bg-white p-5">
      <h3 className="mb-4 text-base font-semibold text-[#1d1d1b]" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h3>
      <ol className="space-y-3">
        {funnelBars(steps).map((b) => (
          <li key={b.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-[#1d1d1b]">{b.label}</span>
              <span className="shrink-0 font-semibold text-[#1d1d1b]">
                {formatValue(b.value)}
                {b.share !== null && <span className="ml-1 text-xs font-normal text-[#737373]">({b.share}%)</span>}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#f7f7f7]">
              <div className="h-full rounded-full bg-[#eca826]" style={{ width: `${b.width}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

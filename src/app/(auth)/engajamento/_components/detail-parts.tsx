import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KpiCard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  STATUS_BADGE,
  deltaInfo,
  formatValue,
  statusLabel,
  type EngagementSide,
} from "@/modules/admin/application/engagement-format";
import type { DetailNumberDef } from "@/modules/admin/application/engagement-metrics";
import type { ChannelDays, EngagementStatus } from "@/modules/admin/infrastructure/engagement-api";
import { Contact } from "./contact";

export function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#737373] hover:text-[#1d1d1b]">
      <ArrowLeft className="h-4 w-4" />
      Voltar para o engajamento
    </Link>
  );
}

export function SummaryCard({
  side,
  status,
  hasAccess,
  facts,
  phone,
  email,
}: {
  side: EngagementSide;
  status: EngagementStatus;
  hasAccess: boolean;
  facts: { label: string; value: string }[];
  phone: string | null;
  email: string | null;
}) {
  return (
    <Card className="p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_BADGE[status]}>{statusLabel(status, side)}</Badge>
            {!hasAccess && <Badge variant="muted">sem acesso (conta importada)</Badge>}
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {facts.map((f) => (
              <div key={f.label} className="flex justify-between gap-3 sm:block">
                <dt className="text-[#737373]">{f.label}</dt>
                <dd className="text-[#1d1d1b]">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Contact phone={phone} email={email} />
      </div>
    </Card>
  );
}

/** Números da ficha com o período anterior (mesma regra de cor dos cartões do painel). */
export function NumbersGrid<D>({ defs, detail }: { defs: DetailNumberDef<D>[]; detail: D }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {defs.map((def) => {
        const p = def.pick(detail);
        const delta = deltaInfo(p, def.kind, def.higherIsBetter);
        return (
          <KpiCard
            key={def.key}
            title={def.label}
            value={formatValue(p.current, def.kind)}
            icon={def.icon}
            meta={delta.text}
            metaColor={delta.color}
          />
        );
      })}
    </div>
  );
}

export function ChannelDaysCard({ days }: { days: ChannelDays }) {
  return (
    <Card className="p-4 md:p-5">
      <h3 className="mb-2 text-sm font-semibold text-[#1d1d1b]">Dias em que abriu, por canal</h3>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="font-semibold">{formatValue(days.app)}</span> <span className="text-[#737373]">no app</span>
        </span>
        <span>
          <span className="font-semibold">{formatValue(days.web)}</span> <span className="text-[#737373]">no site</span>
        </span>
        <span>
          <span className="font-semibold">{formatValue(days.other)}</span> <span className="text-[#737373]">outros</span>
        </span>
      </div>
      <p className="mt-2 text-xs text-[#737373]">Conta só a partir do início da medição de aberturas.</p>
    </Card>
  );
}

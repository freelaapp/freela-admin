"use client";

import { Loader2 } from "lucide-react";
import { useVipIndicators } from "@/modules/admin/application/use-freela-vip";
import { formatIndicator, VIP_STATUS_LABELS, type IndicatorKind } from "@/modules/admin/application/freela-vip-presentation";
import type { VipIndicatorMetric, VipStatus } from "@/modules/admin/infrastructure/freela-vip-api";
import { QueryError } from "./query-error";

const TILES: { key: "taxaResposta" | "taxaAprovacaoNota" | "taxaAprovacaoFinal" | "tempoMedioProcessoDias" | "vipsPorVaga" | "permanencia"; label: string; kind: IndicatorKind }[] = [
  { key: "taxaResposta", label: "Taxa de resposta", kind: "percent" },
  { key: "taxaAprovacaoNota", label: "Aprovação na nota", kind: "percent" },
  { key: "taxaAprovacaoFinal", label: "Aprovação final", kind: "percent" },
  { key: "tempoMedioProcessoDias", label: "Tempo médio do processo", kind: "days" },
  { key: "vipsPorVaga", label: "VIPs por vaga", kind: "ratio" },
  { key: "permanencia", label: "Permanência", kind: "percent" },
];

export function IndicatorsTab({ cycleId }: { cycleId: string }) {
  const { data, isLoading, isError, refetch } = useVipIndicators(cycleId);
  if (isLoading) return <div className="flex justify-center py-10 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>;
  if (isError || !data) return <QueryError message="Não foi possível carregar os indicadores." onRetry={() => refetch()} />;

  const entries = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {TILES.map((t) => {
          const m = data[t.key] as VipIndicatorMetric;
          const f = formatIndicator(m, t.kind);
          return (
            <div key={t.key} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
              <p className="text-[12px] text-[#64748B]">{t.label}</p>
              <p className={`text-2xl font-semibold ${f.ok === null ? "text-[#0F172A]" : f.ok ? "text-[#166534]" : "text-[#991B1B]"}`}>{f.atual}</p>
              <p className="text-[11px] text-[#94A3B8]">meta {f.meta}</p>
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 text-[13px]">
          <p className="mb-1 font-semibold">Totais</p>
          <p>Convites da base: {data.totais.convitesBase}</p>
          <p>Formulários enviados: {data.totais.formulariosEnviados}</p>
          <p>Aprovados na nota: {data.totais.aprovadosNota}</p>
          <p>VIPs ativos: {data.totais.vipsAtivos} / meta {data.totais.targetVacancies}</p>
          <p>Melhor canal: {data.melhorCanal ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 text-[13px]">
          <p className="mb-1 font-semibold">Aprovação final por canal</p>
          {entries(data.distribuicaoAprovacaoFinal.porSource).map(([k, v]) => <p key={`s-${k}`}>{k}: {v}</p>)}
          {entries(data.distribuicaoAprovacaoFinal.porOrigin).map(([k, v]) => <p key={`o-${k}`}>{k}: {v}</p>)}
          {Object.keys(data.distribuicaoAprovacaoFinal.porSource).length === 0 && <p className="text-[#94A3B8]">—</p>}
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 text-[13px]">
          <p className="mb-1 font-semibold">Por status</p>
          {entries(data.contagemPorStatus).map(([k, v]) => <p key={k}>{VIP_STATUS_LABELS[k as VipStatus] ?? k}: {v}</p>)}
        </div>
      </div>
    </div>
  );
}

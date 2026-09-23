"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveVipScoringConfig, useVipScoringConfig } from "@/modules/admin/application/use-freela-vip";
import { formatDate, validateScoringConfig, VIP_CRITERIA_LABELS } from "@/modules/admin/application/freela-vip-presentation";

export function ScoringTab() {
  const { data, isLoading } = useVipScoringConfig();
  const save = useSaveVipScoringConfig();
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [high, setHigh] = useState("70");
  const [waitlist, setWaitlist] = useState("50");

  useEffect(() => {
    if (!data) return;
    setWeights(Object.fromEntries(Object.entries(data.config.weights).map(([k, v]) => [k, String(v)])));
    setHigh(String(data.config.cutoffs.high));
    setWaitlist(String(data.config.cutoffs.waitlist));
  }, [data]);

  if (isLoading || !data) return <div className="py-8 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>;

  const numericWeights = Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, Number(v)]));
  const cutoffs = { high: Number(high), waitlist: Number(waitlist) };
  const errors = validateScoringConfig({ weights: numericWeights, cutoffs });
  const sum = Object.values(numericWeights).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-[12.5px] text-[#64748B]">
        {data.persisted ? `Versão ${data.version ?? "?"} · salva em ${formatDate(data.updatedAt)}${data.updatedByAdminId ? ` por ${data.updatedByAdminId.slice(0, 8)}` : ""}` : "Usando a configuração padrão (nenhuma versão salva)."} Salvar cria uma versão nova; candidaturas já pontuadas não mudam sozinhas (use &quot;Recalcular nota&quot; na ficha).
      </p>
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="mb-2 text-[14px] font-semibold">Pesos (soma {sum} / 100)</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.keys(weights).map((k) => (
            <div key={k}><Label htmlFor={`w-${k}`}>{VIP_CRITERIA_LABELS[k] ?? k}</Label><Input id={`w-${k}`} inputMode="numeric" value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: e.target.value })} /></div>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <h3 className="mb-2 text-[14px] font-semibold">Cortes</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="c-high">Entrevista (≥)</Label><Input id="c-high" inputMode="numeric" value={high} onChange={(e) => setHigh(e.target.value)} /></div>
          <div><Label htmlFor="c-wait">Lista de espera (≥)</Label><Input id="c-wait" inputMode="numeric" value={waitlist} onChange={(e) => setWaitlist(e.target.value)} /></div>
        </div>
        <p className="mt-1 text-[12px] text-[#64748B]">Abaixo do corte de lista de espera = reprovado.</p>
      </section>
      {errors.length > 0 && <ul className="list-disc pl-5 text-[12.5px] text-[#DC2626]">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div>
        <Button disabled={errors.length > 0 || save.isPending} onClick={() => save.mutate({ weights: numericWeights, bands: data.config.bands, cutoffs })}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Salvar nova versão"}
        </Button>
      </div>
    </div>
  );
}

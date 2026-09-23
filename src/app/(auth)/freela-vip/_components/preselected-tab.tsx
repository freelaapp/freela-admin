"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSendVipInvites, useVipPreselected } from "@/modules/admin/application/use-freela-vip";
import { cycleInviteBudget } from "@/modules/admin/application/freela-vip-presentation";
import type { VipCycle, VipInviteResult } from "@/modules/admin/infrastructure/freela-vip-api";

export function PreselectedTab({ cycle }: { cycle: VipCycle }) {
  const budget = cycleInviteBudget(cycle);
  const [limitText, setLimitText] = useState(String(budget));
  const limit = Math.max(1, Number(limitText) || budget);
  const { data, isLoading, isFetching } = useVipPreselected(cycle.id, limit);
  const send = useSendVipInvites(cycle.id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<VipInviteResult | null>(null);

  const candidates = useMemo(() => data?.candidates ?? [], [data]);
  const allIds = useMemo(() => candidates.map((c) => c.providerGlobalId), [candidates]);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Uma mudança no limite troca a query e pode encolher `allIds`; sem isso, `selected`
  // manteria ids fora da tela e `send.mutate` convidaria gente que o admin não vê mais.
  useEffect(() => {
    setSelected((s) => {
      const next = new Set([...s].filter((id) => allIds.includes(id)));
      return next.size === s.size ? s : next;
    });
  }, [allIds]);

  const submit = () => send.mutate([...selected], { onSuccess: (r) => { setResult(r); setSelected(new Set()); } });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="limit" className="text-[12px] text-[#64748B]">Quantos pré-selecionar</label>
          <Input id="limit" inputMode="numeric" className="w-28" value={limitText} onChange={(e) => setLimitText(e.target.value)} />
        </div>
        <p className="text-[12.5px] text-[#64748B]">Orçamento de convites: <strong>{budget}</strong> ({cycle.targetVacancies} vagas × {cycle.invitesPerVacancy}) · encontrados: {data?.total ?? "—"}</p>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set(allIds))}>Selecionar todos</Button>
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Limpar</Button>
          <Button size="sm" disabled={selected.size === 0 || send.isPending} onClick={submit}>
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <><Send className="mr-1 h-4 w-4" aria-hidden />Enviar convites ({selected.size})</>}
          </Button>
        </div>
      </div>
      {selected.size > budget && (
        <p className="rounded-lg bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#92400E]">Você selecionou mais do que o orçamento de convites ({budget}). A API aceita, mas o ciclo foi dimensionado para {budget}.</p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>
      ) : (
        <div className={`overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white ${isFetching ? "opacity-70" : ""}`}>
          <table className="w-full text-[13px]">
            <thead className="bg-[#F8FAFC] text-left text-[12px] uppercase tracking-wide text-[#64748B]">
              <tr>
                <th className="px-3 py-2"><input type="checkbox" aria-label="Selecionar todos" checked={selected.size > 0 && selected.size === allIds.length} onChange={(e) => setSelected(e.target.checked ? new Set(allIds) : new Set())} /></th>
                <th className="px-3 py-2">Cidade</th>
                <th className="px-3 py-2">Dist.</th>
                <th className="px-3 py-2">Funções</th>
                <th className="px-3 py-2">Completude</th>
                <th className="px-3 py-2">Histórico</th>
                <th className="px-3 py-2">Serviços</th>
                <th className="px-3 py-2">WhatsApp · foto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {candidates.map((c) => {
                const rowLabel = [c.city, c.roles.join(", ")].filter(Boolean).join(" · ") || c.providerGlobalId;
                return (
                <tr key={c.providerGlobalId} className="hover:bg-[#F8FAFC]">
                  <td className="px-3 py-2"><input type="checkbox" aria-label={`Selecionar candidato ${rowLabel}`} checked={selected.has(c.providerGlobalId)} onChange={() => toggle(c.providerGlobalId)} /></td>
                  <td className="px-3 py-2">{c.city ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{c.distanceKm === null ? "—" : `${Math.round(c.distanceKm)} km`}</td>
                  <td className="px-3 py-2 text-[#475569]">{c.roles.join(", ")}</td>
                  <td className="px-3 py-2 tabular-nums">{Math.round(c.completenessScore)}%</td>
                  <td className="px-3 py-2"><Badge variant="secondary">{c.hasCleanHistory ? "limpo" : "com ocorrência"}</Badge></td>
                  <td className="px-3 py-2 tabular-nums">{c.totalCompletedServices} · {c.recentCompletedServices} rec.</td>
                  <td className="px-3 py-2">{c.hasWhatsappPhone ? "✓" : "—"} · {c.hasAvatar ? "✓" : "—"}</td>
                </tr>
                );
              })}
              {candidates.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-[#94A3B8]">Ninguém na base atende aos filtros do ciclo (cidade/raio, função, WhatsApp, sem reprovação recente).</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convites enviados</DialogTitle></DialogHeader>
          <p className="text-[13px]">Enviados: <strong>{result?.invited.length ?? 0}</strong> · Pulados: <strong>{result?.skipped.length ?? 0}</strong></p>
          {result && result.skipped.length > 0 && (
            <ul className="max-h-[40vh] overflow-y-auto text-[12.5px] text-[#64748B]">
              {result.skipped.map((s) => <li key={s.providerGlobalId}>{s.providerGlobalId} — {s.reason === "ALREADY_INVITED" ? "já convidado" : s.reason}</li>)}
            </ul>
          )}
          <DialogFooter><Button onClick={() => setResult(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVipQuestionMutations, useVipQuestions } from "@/modules/admin/application/use-freela-vip";
import { validateQuestionDraft } from "@/modules/admin/application/freela-vip-presentation";
import type { VipQuestion } from "@/modules/admin/infrastructure/freela-vip-api";

type Draft = { role: string; text: string; options: string[]; points: string[]; required: boolean; order: string; active: boolean };
const empty = (): Draft => ({ role: "", text: "", options: ["", ""], points: ["0", "0"], required: true, order: "0", active: true });
const fromQ = (q: VipQuestion): Draft => ({ role: q.role, text: q.text, options: [...q.options], points: q.pointsPerOption.map(String), required: q.required, order: String(q.order), active: q.active });

export function QuestionsTab() {
  const [roleFilter, setRoleFilter] = useState("");
  const { data: questions = [], isLoading } = useVipQuestions(roleFilter.trim() || undefined);
  const m = useVipQuestionMutations();
  const [dialog, setDialog] = useState<{ open: boolean; q?: VipQuestion }>({ open: false });
  const [d, setD] = useState<Draft>(empty());
  useEffect(() => { if (dialog.open) setD(dialog.q ? fromQ(dialog.q) : empty()); }, [dialog]);

  const errors = validateQuestionDraft({ role: d.role, text: d.text, options: d.options, pointsPerOption: d.points.map((p) => Number(p)) });
  const save = () => {
    if (errors.length) return;
    const input = { role: d.role.trim(), text: d.text.trim(), options: d.options.map((o) => o.trim()), pointsPerOption: d.points.map(Number), required: d.required, order: Number(d.order) || 0, active: d.active };
    const close = () => setDialog({ open: false });
    if (dialog.q) m.update.mutate({ id: dialog.q.id, input }, { onSuccess: close });
    else m.create.mutate(input, { onSuccess: close });
  };
  const setOpt = (i: number, v: string) => setD({ ...d, options: d.options.map((o, j) => (j === i ? v : o)) });
  const setPts = (i: number, v: string) => setD({ ...d, points: d.points.map((o, j) => (j === i ? v : o)) });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-[#64748B]">O formulário sorteia 4 perguntas por função (de um banco de até 10) com as opções em ordem aleatória. Os pontos entram na nota &quot;perguntas práticas&quot;.</p>
      <div className="flex flex-wrap items-end gap-2">
        <div><Label htmlFor="qf">Função</Label><Input id="qf" className="w-48" placeholder="ex.: garcom" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} /></div>
        <Button className="ml-auto" onClick={() => setDialog({ open: true })}><Plus className="mr-1 h-4 w-4" aria-hidden />Nova pergunta</Button>
      </div>
      {isLoading ? <div className="py-8 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div> : (
        <ul className="divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
          {questions.map((q) => (
            <li key={q.id} className="flex flex-wrap items-start justify-between gap-2 p-3 text-[13px]">
              <div>
                <p className="font-medium text-[#0F172A]"><Badge variant="secondary">{q.role}</Badge> {q.text}{!q.active && <Badge variant="secondary" className="ml-1">inativa</Badge>}</p>
                <ol className="mt-1 list-decimal pl-5 text-[12px] text-[#64748B]">{q.options.map((o, i) => <li key={i}>{o} — {q.pointsPerOption[i]} pts</li>)}</ol>
              </div>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, q })}>Editar</Button>
                <Button size="sm" variant="ghost" aria-label="Remover" onClick={() => { if (window.confirm("Remover esta pergunta?")) m.remove.mutate(q.id); }}><Trash2 className="h-4 w-4 text-[#DC2626]" aria-hidden /></Button>
              </span>
            </li>
          ))}
          {questions.length === 0 && <li className="p-6 text-center text-[#94A3B8]">Nenhuma pergunta{roleFilter ? " para esta função" : ""}.</li>}
        </ul>
      )}

      <Dialog open={dialog.open} onOpenChange={(o) => !o && setDialog({ open: false })}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog.q ? "Editar pergunta" : "Nova pergunta"}</DialogTitle><DialogDescription>Escolha única. Pontos por opção (≥ 0).</DialogDescription></DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
            <div><Label htmlFor="q-role">Função (slug)</Label><Input id="q-role" value={d.role} onChange={(e) => setD({ ...d, role: e.target.value })} /></div>
            <div><Label htmlFor="q-text">Pergunta</Label><textarea id="q-text" className="min-h-[72px] w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-sm" value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} /></div>
            {d.options.map((o, i) => (
              <div key={i} className="grid grid-cols-[1fr_88px_36px] items-end gap-2">
                <div><Label htmlFor={`o-${i}`}>Opção {i + 1}</Label><Input id={`o-${i}`} value={o} onChange={(e) => setOpt(i, e.target.value)} /></div>
                <div><Label htmlFor={`p-${i}`}>Pontos</Label><Input id={`p-${i}`} inputMode="numeric" value={d.points[i] ?? "0"} onChange={(e) => setPts(i, e.target.value)} /></div>
                <Button variant="ghost" size="sm" aria-label="Remover opção" disabled={d.options.length <= 2} onClick={() => setD({ ...d, options: d.options.filter((_, j) => j !== i), points: d.points.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" aria-hidden /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setD({ ...d, options: [...d.options, ""], points: [...d.points, "0"] })}>Adicionar opção</Button>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="q-order">Ordem</Label><Input id="q-order" inputMode="numeric" value={d.order} onChange={(e) => setD({ ...d, order: e.target.value })} /></div>
              <label className="flex items-center justify-between text-[13px]"><span>Obrigatória</span><Switch checked={d.required} onCheckedChange={(required) => setD({ ...d, required })} /></label>
              <label className="flex items-center justify-between text-[13px]"><span>Ativa</span><Switch checked={d.active} onCheckedChange={(active) => setD({ ...d, active })} /></label>
            </div>
            {errors.length > 0 && <ul className="list-disc pl-5 text-[12.5px] text-[#DC2626]">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false })}>Cancelar</Button>
            <Button disabled={errors.length > 0 || m.create.isPending || m.update.isPending} onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

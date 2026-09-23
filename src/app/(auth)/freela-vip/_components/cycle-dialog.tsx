"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useVipCycleMutations } from "@/modules/admin/application/use-freela-vip";
import type { VipCycle } from "@/modules/admin/infrastructure/freela-vip-api";
import { RedeSelect } from "./rede-select";

type Draft = {
  targetContractorUserId: string;
  name: string;
  cities: string;          // separado por vírgula
  roles: string;           // separado por vírgula (slugs do catálogo)
  targetVacancies: string;
  invitesPerVacancy: string;
  radiusKm: string;
  backgroundJustification: string;
  startsAt: string;        // yyyy-mm-dd
  endsAt: string;
  linkOpen: boolean;
  enrollmentCap: string;
  active: boolean;
};

const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const toIsoOrUndefined = (d: string) => (d ? new Date(`${d}T12:00:00`).toISOString() : undefined);
const fromIso = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

function draftFrom(cycle?: VipCycle): Draft {
  return {
    targetContractorUserId: cycle?.targetContractorUserId ?? "",
    name: cycle?.name ?? "",
    cities: cycle?.cities.join(", ") ?? "",
    roles: cycle?.roles.join(", ") ?? "",
    targetVacancies: String(cycle?.targetVacancies ?? 5),
    invitesPerVacancy: String(cycle?.invitesPerVacancy ?? 4),
    radiusKm: String(cycle?.radiusKm ?? 25),
    backgroundJustification: cycle?.backgroundJustification ?? "",
    startsAt: fromIso(cycle?.startsAt ?? null),
    endsAt: fromIso(cycle?.endsAt ?? null),
    linkOpen: cycle?.linkOpen ?? true,
    enrollmentCap: cycle?.enrollmentCap ? String(cycle.enrollmentCap) : "",
    active: cycle?.active ?? true,
  };
}

export function CycleDialog({ open, cycle, onClose }: { open: boolean; cycle?: VipCycle; onClose: () => void }) {
  const { create, update } = useVipCycleMutations();
  const [d, setD] = useState<Draft>(draftFrom(cycle));
  useEffect(() => { if (open) setD(draftFrom(cycle)); }, [open, cycle]);
  const editing = !!cycle;
  const pending = create.isPending || update.isPending;

  const errors: string[] = [];
  if (!d.targetContractorUserId) errors.push("Selecione a rede.");
  if (!d.name.trim()) errors.push("Informe o nome.");
  if (split(d.cities).length === 0) errors.push("Informe ao menos uma cidade.");
  if (split(d.roles).length === 0) errors.push("Informe ao menos uma função.");
  if (!(Number(d.targetVacancies) >= 1)) errors.push("Vagas-meta deve ser ≥ 1.");
  if (!(Number(d.invitesPerVacancy) >= 1)) errors.push("Convites por vaga deve ser ≥ 1.");

  const save = () => {
    if (errors.length) return;
    const common = {
      name: d.name.trim(),
      cities: split(d.cities),
      roles: split(d.roles),
      targetVacancies: Number(d.targetVacancies),
      invitesPerVacancy: Number(d.invitesPerVacancy),
      radiusKm: Number(d.radiusKm) || 0,
      backgroundJustification: d.backgroundJustification.trim() || undefined,
      startsAt: toIsoOrUndefined(d.startsAt),
      endsAt: toIsoOrUndefined(d.endsAt),
      linkOpen: d.linkOpen,
      enrollmentCap: d.enrollmentCap ? Number(d.enrollmentCap) : undefined,
    };
    if (editing && cycle) {
      update.mutate({ id: cycle.id, input: { ...common, active: d.active } }, { onSuccess: onClose });
    } else {
      create.mutate({ ...common, targetContractorUserId: d.targetContractorUserId }, { onSuccess: onClose });
    }
  };

  const field = (label: string, key: keyof Draft, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <Label htmlFor={`c-${key}`}>{label}</Label>
      <Input id={`c-${key}`} value={String(d[key])} onChange={(e) => setD({ ...d, [key]: e.target.value })} {...props} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar ciclo" : "Novo ciclo de seleção"}</DialogTitle>
          <DialogDescription>
            Uma rodada de seleção para uma rede: cidades, funções, vagas-meta e prazos. Sem justificativa de antecedentes, a etapa de certidões fica bloqueada.
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
          <div>
            <Label htmlFor="rede">Rede (contratante Grandes Redes)</Label>
            <RedeSelect value={d.targetContractorUserId} onChange={(v) => setD({ ...d, targetContractorUserId: v })} disabled={editing} />
          </div>
          {field("Nome do ciclo", "name", { placeholder: "Ex.: Rodada SP outubro" })}
          {field("Cidades (separe por vírgula)", "cities", { placeholder: "São Paulo, Guarulhos" })}
          {field("Funções (slugs, separe por vírgula)", "roles", { placeholder: "garcom, cozinheiro" })}
          <div className="grid grid-cols-3 gap-3">
            {field("Vagas-meta", "targetVacancies", { inputMode: "numeric" })}
            {field("Convites/vaga", "invitesPerVacancy", { inputMode: "numeric" })}
            {field("Raio (km)", "radiusKm", { inputMode: "numeric" })}
          </div>
          <div>
            <Label htmlFor="c-backgroundJustification">Justificativa de antecedentes (opcional)</Label>
            <textarea
              id="c-backgroundJustification"
              className="min-h-[72px] w-full rounded-md border border-[#E2E8F0] px-3 py-2 text-sm"
              value={d.backgroundJustification}
              onChange={(e) => setD({ ...d, backgroundJustification: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Início", "startsAt", { type: "date" })}
            {field("Fim", "endsAt", { type: "date" })}
          </div>
          {field("Teto de inscrições pelo link (opcional)", "enrollmentCap", { inputMode: "numeric" })}
          <label className="flex items-center justify-between text-[13px]">
            <span>Link público aberto</span>
            <Switch checked={d.linkOpen} onCheckedChange={(linkOpen) => setD({ ...d, linkOpen })} />
          </label>
          {editing && (
            <label className="flex items-center justify-between text-[13px]">
              <span>Ciclo ativo</span>
              <Switch checked={d.active} onCheckedChange={(active) => setD({ ...d, active })} />
            </label>
          )}
          {errors.length > 0 && (
            <ul className="list-disc pl-5 text-[12.5px] text-[#DC2626]">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={errors.length > 0 || pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useRegionalPricing,
  useRegionalPricingMutations,
} from "@/modules/admin/application/use-regional-pricing";
import {
  FAIXA_PRESETS,
  bpsToIndexText,
  brl,
  indexTextToBps,
  regionalizeHourly,
} from "@/modules/admin/application/regional-pricing-presentation";
import type { RegionalRule, SourceStatus } from "@/modules/admin/infrastructure/regional-pricing-api";

const MODULE = "bars-restaurants" as const;
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const STATUSES: SourceStatus[] = ["Confirmado", "Parcial", "Pendente"];

type Draft = {
  uf: string;
  city: string;
  indexText: string;
  label: string;
  sourceStatus: SourceStatus | "";
  note: string;
  active: boolean;
  /** Regra existente sendo editada: UF/cidade travadas. */
  editing: boolean;
};

const emptyDraft = (): Draft => ({
  uf: "SP", city: "", indexText: "1,0000", label: "", sourceStatus: "", note: "", active: true, editing: false,
});

export default function PrecosRegiaoPage() {
  const { data, isLoading } = useRegionalPricing(MODULE);
  const { upsert, remove } = useRegionalPricingMutations(MODULE);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const rules = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const all = data?.rules ?? [];
    if (!q) return all;
    return all.filter((r) => `${r.uf} ${r.city} ${r.label ?? ""}`.toLowerCase().includes(q));
  }, [data, filter]);

  const base = data?.referenceBase;
  const draftBps = draft ? indexTextToBps(draft.indexText) : null;

  const openNew = () => setDraft(emptyDraft());
  const openEdit = (r: RegionalRule) =>
    setDraft({
      uf: r.uf, city: r.city, indexText: bpsToIndexText(r.multiplierBps), label: r.label ?? "",
      sourceStatus: r.sourceStatus ?? "", note: r.note ?? "", active: r.active, editing: true,
    });

  const save = () => {
    if (!draft || draftBps === null) return;
    upsert.mutate(
      {
        uf: draft.uf,
        city: draft.city.trim(),
        input: {
          module: MODULE,
          multiplierBps: draftBps,
          label: draft.label.trim() || undefined,
          sourceStatus: draft.sourceStatus || undefined,
          note: draft.note.trim() || undefined,
          active: draft.active,
        },
      },
      { onSuccess: () => setDraft(null) },
    );
  };

  return (
    <div className="flex flex-col gap-4 px-4 pb-8 sm:px-6">
      <PageHeader
        title="Preços por região"
        description="Índice por praça sobre a tabela nacional (cidade → UF → nacional). Arredonda a R$ 0,50 e nunca fica abaixo da tabela."
        action={
          <Button onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" aria-hidden /> Nova regra
          </Button>
        }
      />

      {data && (
        <p
          className={
            data.globalEnabled
              ? "rounded-lg bg-[#F0FDF4] px-3 py-2 text-[12.5px] font-medium text-[#166534]"
              : "flex items-start gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#92400E]"
          }
        >
          {data.globalEnabled ? (
            <>Interruptor mestre <strong>ligado</strong>: as regras abaixo já mudam o preço das vagas novas.</>
          ) : (
            <>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Interruptor mestre <strong>desligado</strong> no servidor: as regras ficam salvas, mas nenhuma
                vaga muda de preço até o dono ligar <code>REGIONAL_PRICING_ENABLED</code> em produção.
              </span>
            </>
          )}
        </p>
      )}

      {base && (
        <p className="text-[12.5px] text-[#64748B]">
          Base nacional viva do catálogo: auxiliar <strong>{brl(base.auxiliarInCents)}</strong>/h · técnico{" "}
          <strong>{brl(base.tecnicoInCents)}</strong>/h. A prévia multiplica esses valores.
        </p>
      )}

      <Input
        placeholder="Filtrar por UF, cidade ou rótulo…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      {isLoading || !data ? (
        <div className="flex items-center justify-center py-12 text-[#94A3B8]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white">
          <table className="w-full text-[13px]">
            <thead className="bg-[#F8FAFC] text-left text-[12px] uppercase tracking-wide text-[#64748B]">
              <tr>
                <th className="px-3 py-2">Praça</th>
                <th className="px-3 py-2">Índice</th>
                <th className="px-3 py-2">Auxiliar</th>
                <th className="px-3 py-2">Técnico</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {rules.map((r) => (
                <tr key={r.id} className={r.active ? "" : "opacity-50"}>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#94A3B8]" aria-hidden />
                      <span className="font-medium text-[#0F172A]">
                        {r.city ? `${r.city} · ${r.uf}` : `${r.uf} (toda a UF)`}
                      </span>
                      {r.label && <Badge variant="secondary">{r.label}</Badge>}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{bpsToIndexText(r.multiplierBps)}</td>
                  <td className="px-3 py-2 tabular-nums">{brl(r.preview.auxiliarInCents)}</td>
                  <td className="px-3 py-2 tabular-nums">{brl(r.preview.tecnicoInCents)}</td>
                  <td className="px-3 py-2 text-[#64748B]">{r.sourceStatus ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)} aria-label="Editar">
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Remover"
                        onClick={() => {
                          if (window.confirm(`Remover a regra de ${r.city || r.uf}? A praça volta a herdar UF/nacional.`)) {
                            remove.mutate({ uf: r.uf, city: r.city });
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-[#DC2626]" aria-hidden />
                      </Button>
                    </span>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[#94A3B8]">
                    Nenhuma regra. Sem regra, toda praça usa a tabela nacional.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.editing ? "Editar índice" : "Nova regra de índice"}</DialogTitle>
            <DialogDescription>
              Deixe a cidade em branco para uma regra da UF inteira. Uma regra de cidade sempre
              vence a regra da UF. A cidade precisa ser o nome oficial (IBGE).
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <Label htmlFor="uf">UF</Label>
                  <NativeSelect
                    id="uf"
                    value={draft.uf}
                    disabled={draft.editing}
                    onChange={(e) => setDraft({ ...draft, uf: e.target.value })}
                  >
                    {UFS.map((uf) => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="city">Cidade (opcional)</Label>
                  <Input
                    id="city"
                    value={draft.city}
                    disabled={draft.editing}
                    placeholder="Ex.: Campinas"
                    onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="index">Índice (1,0000 = tabela nacional)</Label>
                <Input
                  id="index"
                  inputMode="decimal"
                  value={draft.indexText}
                  onChange={(e) => setDraft({ ...draft, indexText: e.target.value })}
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {FAIXA_PRESETS.map((f) => (
                    <Button
                      key={f.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDraft({ ...draft, indexText: bpsToIndexText(f.bps) })}
                    >
                      Faixa {f.label} · {f.hint}
                    </Button>
                  ))}
                </div>
                {base && draftBps !== null && (
                  <p className="mt-2 text-[12.5px] text-[#475569]">
                    Prévia: auxiliar <strong>{brl(regionalizeHourly(base.auxiliarInCents, draftBps))}</strong>/h ·
                    técnico <strong>{brl(regionalizeHourly(base.tecnicoInCents, draftBps))}</strong>/h
                  </p>
                )}
                {draftBps === null && (
                  <p className="mt-2 text-[12.5px] text-[#DC2626]">Informe um índice igual ou maior que 1,0000.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="label">Rótulo</Label>
                  <Input id="label" value={draft.label} placeholder="Capital, Faixa C…" onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="status">Fonte</Label>
                  <NativeSelect id="status" value={draft.sourceStatus} onChange={(e) => setDraft({ ...draft, sourceStatus: e.target.value as SourceStatus | "" })}>
                    <option value="">—</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              <div>
                <Label htmlFor="note">Observação</Label>
                <Input id="note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
              </div>

              <label className="flex items-center justify-between text-[13px]">
                <span>Ativa</span>
                <Switch checked={draft.active} onCheckedChange={(active) => setDraft({ ...draft, active })} />
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={save} disabled={draftBps === null || upsert.isPending}>
              {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

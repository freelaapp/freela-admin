"use client";

import { useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, ChevronsUpDown, Loader2, Plus, Ticket, TicketCheck, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useCoupons, useCouponMutations } from "@/modules/admin/application/use-admin-coupons";
import { useAllContractors } from "@/modules/admin/application/use-both-modules";
import type { CouponDiscountType } from "@/modules/admin/infrastructure/coupons-api";
import type { ContractorAcrossModules } from "@/modules/admin/infrastructure/both-modules-api";

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// Aceita formato pt-BR: "1.000,50" → pontos são separador de milhar, vírgula é decimal.
const toCents = (reais: string) => {
  const normalized = reais.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(normalized || "0");
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};
const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

/** Cupons de desconto do contratante (uso único, % ou R$). CRUD via /admin/coupons. */
export default function CuponsPage() {
  const { data: coupons = [], isLoading } = useCoupons();
  const { data: contractors = [] } = useAllContractors();
  const [dialogOpen, setDialogOpen] = useState(false);

  // userId → rótulo legível do contratante
  const contractorLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of contractors) {
      const label = `${c.companyName ?? c.contactName} (${c.city}/${c.uf})`;
      if (!map.has(c.userId)) map.set(c.userId, label);
    }
    return map;
  }, [contractors]);

  const stats = useMemo(() => {
    const active = coupons.filter((c) => c.active).length;
    const used = coupons.filter((c) => c.redeemedAt != null).length;
    return { total: coupons.length, active, used };
  }, [coupons]);

  return (
    <div>
      <PageHeader
        title="Cupons"
        description="Cupons de desconto do contratante (uso único, por contratante)."
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Novo cupom
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando cupons...
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={<Ticket className="w-4 h-4" />} label="Cupons" value={stats.total} />
            <StatCard
              icon={<CheckCircle2 className="w-4 h-4 text-success" />}
              label="Ativos"
              value={stats.active}
            />
            <StatCard
              icon={<TicketCheck className="w-4 h-4 text-muted-foreground" />}
              label="Usados"
              value={stats.used}
            />
          </div>

          <div className="bg-card rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left font-medium py-3 px-4">Código</th>
                  <th className="text-left font-medium py-3 px-4">Desconto</th>
                  <th className="text-left font-medium py-3 px-4">Contratante</th>
                  <th className="text-left font-medium py-3 px-4">Uso</th>
                  <th className="text-left font-medium py-3 px-4">Validade</th>
                  <th className="text-left font-medium py-3 px-4">Status</th>
                  <th className="text-right font-medium py-3 px-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/60 last:border-0 hover:bg-accent/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-foreground">{c.code}</td>
                    <td className="py-3 px-4">
                      {c.discountType === "PERCENT" ? `${c.percentOff ?? 0}%` : brl(c.amountOffInCents ?? 0)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {contractorLabel.get(c.contractorUserId) ?? (
                        <span className="font-mono text-xs">{c.contractorUserId}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {!c.singleUse ? (
                        <Badge variant="outline">Ilimitado</Badge>
                      ) : c.redeemedAt ? (
                        <Badge variant="secondary">Usado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-success border-success/30">
                          Disponível
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{fmtDate(c.expiresAt)}</td>
                    <td className="py-3 px-4">
                      {c.active ? (
                        <Badge variant="outline" className="text-success border-success/30">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">{c.active && <DeactivateButton id={c.id} />}</td>
                  </tr>
                ))}
                {coupons.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum cupom criado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dialogOpen && <CouponDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}

function DeactivateButton({ id }: { id: string }) {
  const { deactivate } = useCouponMutations();
  return (
    <Button
      size="icon"
      variant="ghost"
      title="Desativar cupom"
      disabled={deactivate.isPending}
      onClick={() => deactivate.mutate(id)}
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}

function CouponDialog({ onClose }: { onClose: () => void }) {
  const { create } = useCouponMutations();
  const { data: contractors = [] } = useAllContractors();
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<CouponDiscountType>("PERCENT");
  const [percentOff, setPercentOff] = useState("10");
  const [amount, setAmount] = useState("10,00");
  const [contractorUserId, setContractorUserId] = useState("");
  const [singleUse, setSingleUse] = useState(true);
  // Validade expressa em DIAS a partir de hoje (o backend persiste como expiresAt).
  const [validityDays, setValidityDays] = useState("");

  const canSave =
    code.trim().length > 0 &&
    contractorUserId.length > 0 &&
    // Validade preenchida precisa ser > 0; vazia significa "sem expiração" e segue válida.
    (validityDays === "" || Number(validityDays) > 0) &&
    (discountType === "PERCENT"
      ? // O backend exige @IsInt 1..100 — bloqueia percentuais decimais antes do envio.
        Number.isInteger(Number(percentOff)) && Number(percentOff) >= 1 && Number(percentOff) <= 100
      : toCents(amount) > 0);

  async function save() {
    await create.mutateAsync({
      code: code.trim(),
      discountType,
      percentOff: discountType === "PERCENT" ? Number(percentOff) : undefined,
      amountOffInCents: discountType === "FIXED" ? toCents(amount) : undefined,
      contractorUserId,
      singleUse,
      // Converte "válido por N dias" em data de expiração (fim do N-ésimo dia),
      // para o cupom valer o dia inteiro exibido na tabela, não até a hora da criação.
      expiresAt:
        validityDays && Number(validityDays) > 0
          ? (() => {
              const d = new Date();
              d.setDate(d.getDate() + Number(validityDays));
              d.setHours(23, 59, 59, 999);
              return d.toISOString();
            })()
          : null,
    });
    onClose();
  }

  // contratantes únicos por userId (um contratante pode ter perfis nos 2 módulos)
  const options = useMemo(() => {
    const seen = new Set<string>();
    return contractors.filter((c) => (seen.has(c.userId) ? false : (seen.add(c.userId), true)));
  }, [contractors]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cupom</DialogTitle>
          <DialogDescription>
            Desconto aplicado ao valor que o contratante paga pela vaga.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Código">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BEMVINDO10"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de desconto">
              <NativeSelect
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as CouponDiscountType)}
              >
                <option value="PERCENT">Percentual (%)</option>
                <option value="FIXED">Valor fixo (R$)</option>
              </NativeSelect>
            </Field>
            {discountType === "PERCENT" ? (
              <Field label="Percentual (%)">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={percentOff}
                  onChange={(e) => setPercentOff(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Valor (R$)">
                <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
            )}
          </div>
          <Field label="Contratante">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contratante encontrado.</p>
            ) : (
              <ContractorCombobox options={options} value={contractorUserId} onChange={setContractorUserId} />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3 items-end">
            <Field label="Validade (dias, opcional)">
              <Input
                type="number"
                min={1}
                placeholder="Ex: 30"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
              />
            </Field>
            <div className="flex items-center justify-between pb-1">
              <Label>Uso único</Label>
              <Switch checked={singleUse} onCheckedChange={setSingleUse} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={!canSave || create.isPending}>
            {create.isPending ? "Salvando..." : "Criar cupom"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function contractorOptionLabel(c: ContractorAcrossModules): string {
  return `${c.companyName ?? c.contactName} — ${c.city}/${c.uf}`;
}

/** Seletor de contratante com busca (combobox simples, sem dependência externa). */
function ContractorCombobox({
  options,
  value,
  onChange,
}: {
  options: ContractorAcrossModules[];
  value: string;
  onChange: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selected = options.find((c) => c.userId === value);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter((c) => contractorOptionLabel(c).toLowerCase().includes(q))
    : options;

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between font-normal"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? contractorOptionLabel(selected) : "Selecione o contratante"}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-md">
          <div className="p-2 border-b border-border">
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou cidade..."
              className="h-8"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum contratante encontrado.</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.userId}
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onChange(c.userId);
                  setOpen(false);
                  setSearch("");
                }}
              >
                <Check className={cn("h-4 w-4 shrink-0", value === c.userId ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{contractorOptionLabel(c)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon} {label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

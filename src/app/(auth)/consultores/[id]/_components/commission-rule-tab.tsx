"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatInstantDate } from "@/lib/date.utils";
import { MODE_LABEL, buildRulePayload, ruleToForm, type RuleFormValues } from "@/lib/commissions/rule-form";
import type { CommissionMode } from "@/lib/commissions/types";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useCommissionRules,
  useCreateCommissionRule,
} from "@/modules/admin/application/use-admin-consultant-commissions";

const MODES = Object.keys(MODE_LABEL) as CommissionMode[];

export function CommissionRuleTab({ consultantId }: { consultantId: string }) {
  const rules = useCommissionRules(consultantId);
  const save = useCreateCommissionRule(consultantId);
  const [form, setForm] = useState<RuleFormValues>(ruleToForm(null));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rules.data) setForm(ruleToForm(rules.data.current));
  }, [rules.data]);

  if (rules.isLoading) {
    return <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-[#eca826]" />;
  }

  const handleSave = async () => {
    const built = buildRulePayload(form);
    if (built.ok === false) {
      setError(built.error);
      return;
    }
    setError(null);
    try {
      await save.mutateAsync(built.payload);
      toast.success("Regra salva. Vale para serviços concluídos a partir de agora.");
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível salvar a regra."));
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 sm:p-6">
        <p className="mb-4 text-sm text-[#737373]">
          Vigente: <span className="font-medium text-[#1d1d1b]">{rules.data?.current?.description ?? "Comissão desligada"}</span>
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rule-mode">Modo</Label>
            <select
              id="rule-mode"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value as CommissionMode })}
            >
              {MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_LABEL[mode]}
                </option>
              ))}
            </select>
          </div>

          {form.mode === "PERCENT_OF_FEE" && (
            <div className="space-y-1.5">
              <Label htmlFor="rule-percent">Porcentagem da taxa (%)</Label>
              <Input
                id="rule-percent"
                inputMode="decimal"
                value={form.percent}
                onChange={(e) => setForm({ ...form, percent: e.target.value })}
                placeholder="Ex.: 10"
              />
            </div>
          )}
          {(form.mode === "FIXED_PER_HIRE" || form.mode === "FIXED_PER_CLIENT") && (
            <div className="space-y-1.5">
              <Label htmlFor="rule-amount">Valor fixo (R$)</Label>
              <Input
                id="rule-amount"
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="Ex.: 5,00"
              />
            </div>
          )}
          {form.mode !== "OFF" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="rule-duration">Prazo (meses desde o cadastro do cliente)</Label>
                <Input
                  id="rule-duration"
                  inputMode="numeric"
                  value={form.durationMonths}
                  onChange={(e) => setForm({ ...form, durationMonths: e.target.value })}
                  placeholder="Vazio = sem prazo"
                />
              </div>
              <fieldset className="space-y-2 sm:col-span-2">
                <legend className="text-sm font-medium text-[#1d1d1b]">Produtos que geram comissão</legend>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.includeEmpresa}
                    onChange={(e) => setForm({ ...form, includeEmpresa: e.target.checked })}
                  />
                  Empresa (bares e restaurantes)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.includeCasa}
                    onChange={(e) => setForm({ ...form, includeCasa: e.target.checked })}
                  />
                  Em Casa
                </label>
              </fieldset>
            </>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSave} disabled={save.isPending} className="w-full sm:w-auto">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar regra
          </Button>
        </div>
        <p className="mt-2 text-xs text-[#737373]">
          Salvar cria uma nova versão. Ela vale para serviços concluídos a partir de agora; o que já foi lançado não muda.
        </p>
      </div>

      <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 sm:p-6">
        <h3 className="mb-2 text-sm font-semibold text-[#1d1d1b]">Histórico de versões</h3>
        {rules.data?.history.length ? (
          <ul className="divide-y divide-[#f1f1f1]">
            {rules.data.history.map((rule) => (
              <li key={rule.id} className="py-2 text-sm">
                <p className="text-[#1d1d1b]">{rule.description}</p>
                <p className="text-xs text-[#737373]">desde {formatInstantDate(rule.effectiveFrom)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#737373]">Nenhuma regra salva ainda.</p>
        )}
      </div>
    </div>
  );
}

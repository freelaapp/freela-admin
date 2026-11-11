"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { orientationErrorMessage } from "@/modules/admin/application/orientation-presentation";
import { useUpdateOrientationSettings } from "@/modules/admin/application/use-orientation";
import type { OrientationSettingsView } from "@/modules/admin/infrastructure/orientation-api";
import {
  buildSettingsPatch,
  SETTING_FIELDS,
  settingsToForm,
  type NumericSettingKey,
} from "../_lib/settings-form";

export function DefaultsForm({ settings }: { settings: OrientationSettingsView }) {
  const incoming = settingsToForm(settings);
  const incomingKey = JSON.stringify(incoming);
  const [form, setForm] = useState(incoming);
  const [base, setBase] = useState(incomingKey);
  // Valores novos do servidor: só entram se a pessoa não mexeu em nada; edição local é mantida.
  if (incomingKey !== base) {
    setBase(incomingKey);
    if (JSON.stringify(form) === base) setForm(incoming);
  }
  const update = useUpdateOrientationSettings();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const built = buildSettingsPatch(form, settings);
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    update.mutate(built.payload, {
      onSuccess: (saved) => {
        setForm(settingsToForm(saved));
        toast.success("Padrões salvos. Valem em até 1 minuto.");
      },
      onError: (err) => toast.error(orientationErrorMessage(err, "Não foi possível salvar os padrões.")),
    });
  };

  const set = (key: NumericSettingKey, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <form onSubmit={submit} className="rounded-xl border border-[#e5e5e5] bg-white p-5">
      <h2 className="text-base font-semibold text-[#1d1d1b]">Padrões das turmas</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {SETTING_FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`setting-${f.key}`}>{f.label}</Label>
            <Input
              id={`setting-${f.key}`}
              inputMode="numeric"
              value={form[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              aria-describedby={f.hint ? `hint-${f.key}` : undefined}
            />
            {f.hint && (
              <p id={`hint-${f.key}`} className="text-xs text-[#737373]">
                {f.hint}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 rounded-b-xl border-t border-[#e5e5e5] bg-white p-4">
        <Button type="submit" className="min-h-11 w-full md:w-auto" disabled={update.isPending}>
          {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar padrões
        </Button>
      </div>
    </form>
  );
}

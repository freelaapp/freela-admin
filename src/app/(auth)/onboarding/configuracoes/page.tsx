"use client";

import { Loader2 } from "lucide-react";
import { formatInstantDateTime } from "@/lib/date.utils";
import { useOrientationSettings } from "@/modules/admin/application/use-orientation";
import { DefaultsForm } from "./_components/defaults-form";
import { GateModeSection } from "./_components/gate-mode-section";

export default function ConfiguracoesOnboardingPage() {
  const settings = useOrientationSettings();

  if (settings.isLoading) {
    return (
      <div role="status" aria-label="Carregando" className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }
  if (!settings.data) {
    return (
      <p className="py-8 text-sm text-[#737373]">
        Não consegui carregar as configurações.{" "}
        <button type="button" className="underline" onClick={() => void settings.refetch()}>
          Tentar de novo
        </button>
      </p>
    );
  }

  const s = settings.data;
  const changedBy =
    s.updatedByAdminName && s.updatedAt
      ? `Configuração alterada por ${s.updatedByAdminName} em ${formatInstantDateTime(s.updatedAt)}`
      : "Ninguém alterou ainda";

  return (
    <div className="mx-auto max-w-5xl py-4">
      <p className="mb-4 text-xs text-[#737373]">{changedBy}</p>
      <GateModeSection settings={s} />
      <DefaultsForm settings={s} />
    </div>
  );
}

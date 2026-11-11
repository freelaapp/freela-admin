"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { useOrientationSettings } from "@/modules/admin/application/use-orientation";
import { OnboardingTabs } from "./_components/onboarding-tabs";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const { isChecking, allowed } = useAreaGuard("ORIENTATION");
  const settings = useOrientationSettings();
  const gateOff = !!settings.data && settings.data.gateWired !== true;

  if (isChecking) {
    return (
      <div role="status" aria-label="Conferindo acesso" className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }
  if (!allowed) return null;

  return (
    <>
      <OnboardingTabs />
      {gateOff && (
        <p role="status" className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          A trava de vagas ainda não está ligada: reprovar fica registrado, mas a pessoa continua vendo vagas até a
          próxima versão.
        </p>
      )}
      {children}
    </>
  );
}

"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { OnboardingTabs } from "./_components/onboarding-tabs";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const { isChecking, allowed } = useAreaGuard("ORIENTATION");

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
      {children}
    </>
  );
}

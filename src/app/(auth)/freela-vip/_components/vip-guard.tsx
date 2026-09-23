"use client";

import { Loader2 } from "lucide-react";
import { useAnyAreaGuard } from "@/modules/auth/application/use-any-area-guard";
import { VIP_PERMISSIONS_ANY } from "@/modules/admin/application/freela-vip-role";

/** Entra na área com QUALQUER permissão VIP; sem nenhuma, redireciona. */
export function VipGuard({ children }: { children: React.ReactNode }) {
  const { isChecking, allowed } = useAnyAreaGuard(VIP_PERMISSIONS_ANY);
  if (isChecking || !allowed) {
    return (
      <div className="flex items-center justify-center py-16 text-[#94A3B8]">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }
  return <>{children}</>;
}

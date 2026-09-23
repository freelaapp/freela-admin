"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./use-auth";
import type { AdminPermission } from "@/modules/auth/domain/permissions";

/**
 * Como `useAreaGuard`, mas libera quando o admin tem QUALQUER uma das
 * permissões (área Freela VIP: admin, leitura ou antecedentes). Super-admin
 * passa sempre (`hasPermission` já devolve `true`).
 */
export function useAnyAreaGuard(permissions: readonly AdminPermission[]) {
  const router = useRouter();
  const { isHydrated, isAuthenticated, isSessionLoading, hasPermission } = useAuth();

  const allowed = permissions.some((p) => hasPermission(p));
  const isChecking = !isHydrated || !isAuthenticated || isSessionLoading;

  useEffect(() => {
    if (isChecking) return;
    if (!allowed) router.replace("/dashboard");
  }, [isChecking, allowed, router]);

  return { isChecking, allowed };
}

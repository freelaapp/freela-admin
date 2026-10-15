"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "./use-auth";
import type { AdminPermission } from "@/modules/auth/domain/permissions";
import { SESSION_ERROR_MESSAGE, SESSION_ERROR_TOAST_ID } from "./use-area-guard";

/**
 * Como `useAreaGuard`, mas libera quando o admin tem QUALQUER uma das
 * permissões (área Freela VIP: admin, leitura ou antecedentes). Super-admin
 * passa sempre (`hasPermission` já devolve `true`).
 */
export function useAnyAreaGuard(permissions: readonly AdminPermission[]) {
  const router = useRouter();
  const { isHydrated, isAuthenticated, isSessionLoading, isSessionError, hasPermission } = useAuth();

  const allowed = permissions.some((p) => hasPermission(p));
  const isChecking = !isHydrated || !isAuthenticated || isSessionLoading;

  useEffect(() => {
    if (isChecking) return;
    if (allowed) return;
    // Sem `/me` não dá para saber se a área está liberada: avisa em vez de só
    // sumir com a tela (antes parecia "sem permissão").
    if (isSessionError) toast.error(SESSION_ERROR_MESSAGE, { id: SESSION_ERROR_TOAST_ID });
    router.replace("/dashboard");
  }, [isChecking, allowed, isSessionError, router]);

  return { isChecking, allowed };
}

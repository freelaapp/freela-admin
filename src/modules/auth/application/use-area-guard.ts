"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./use-auth";
import type { AdminPermission } from "@/modules/auth/domain/permissions";

/**
 * Guarda de rota por permissão de área (`admins.permissions`).
 *
 * Substitui o antigo `if (!isSuperAdmin) router.replace('/dashboard')` das telas
 * restritas: agora quem manda é a permissão (super-admin passa sempre). O
 * redirect só acontece depois que `GET /v1/admins/me` responde — antes disso não
 * dá para afirmar que o admin NÃO tem a área, e redirecionar cedo jogaria todo
 * mundo para o dashboard no primeiro render.
 *
 * Use `isChecking` para mostrar o spinner e `allowed` para renderizar a tela.
 */
export function useAreaGuard(permission: AdminPermission) {
  const router = useRouter();
  const { isHydrated, isAuthenticated, isSessionLoading, hasPermission } = useAuth();

  const allowed = hasPermission(permission);
  // Sem sessão quem manda é o guard do layout (`/login`) — mandar para o
  // dashboard aqui só criaria um pinga-pinga de redirects.
  const isChecking = !isHydrated || !isAuthenticated || isSessionLoading;

  useEffect(() => {
    if (isChecking) return;
    if (!allowed) router.replace("/dashboard");
  }, [isChecking, allowed, router]);

  return { isChecking, allowed };
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "./use-auth";
import type { AdminPermission } from "@/modules/auth/domain/permissions";

/** Um aviso só, mesmo com várias telas/guardas reagindo à mesma falha. */
export const SESSION_ERROR_TOAST_ID = "admin-me-error";
export const SESSION_ERROR_MESSAGE =
  "Não foi possível conferir suas permissões agora (o servidor não respondeu). Você voltou ao início; tente abrir a área de novo em instantes.";

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
  const { isHydrated, isAuthenticated, isSessionLoading, isSessionError, hasPermission } = useAuth();

  const allowed = hasPermission(permission);
  // Sem sessão quem manda é o guard do layout (`/login`) — mandar para o
  // dashboard aqui só criaria um pinga-pinga de redirects.
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

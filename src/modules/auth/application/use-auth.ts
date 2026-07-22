"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "./auth.store";
import { loginApi } from "@/modules/auth/infrastructure/auth.api";
import { getAdminMe } from "@/modules/auth/infrastructure/admin-session.api";
import { LoginPayload, AuthUser } from "@/modules/auth/domain/types";
import type { AdminPermission } from "@/modules/auth/domain/permissions";
import { toast } from "sonner";

export const ADMIN_ME_QUERY_KEY = ["admin", "me"] as const;

function decodeJwtRole(token: string): AuthUser["role"] {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return (json.role as AuthUser["role"]) ?? "ADMIN";
  } catch {
    return "ADMIN";
  }
}

export function useAuth() {
  const { user: storedUser, isHydrated, setUser, hydrate, clear } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isHydrated) {
      hydrate();
    }
  }, [isHydrated, hydrate]);

  // Papel e permissões vêm de `GET /v1/admins/me`, não do JWT: o token carrega o
  // papel do momento em que foi emitido, então conceder/revogar uma área só
  // valeria depois de relogar. `staleTime` curto (30s) faz a tela reagir a uma
  // mudança feita em /usuarios-painel sem martelar a API a cada navegação.
  const meQuery = useQuery({
    queryKey: ADMIN_ME_QUERY_KEY,
    queryFn: getAdminMe,
    enabled: isHydrated && !!storedUser?.accessToken,
    staleTime: 30_000,
    retry: 1,
  });

  const session = meQuery.data;

  // Enquanto /me não responde não dá para afirmar que o admin NÃO tem uma
  // permissão — as telas usam esta flag para não redirecionar antes da hora.
  const isSessionLoading = !isHydrated || (!!storedUser && meQuery.isPending);

  const sessionId = session?.id;
  const sessionName = session?.name;
  const sessionEmail = session?.email;
  const sessionRole = session?.role;

  const user = useMemo<AuthUser | null>(() => {
    if (!storedUser) return null;
    if (!sessionId) return storedUser;
    return {
      ...storedUser,
      id: sessionId,
      name: sessionName || storedUser.name,
      email: sessionEmail || storedUser.email,
      role: sessionRole || storedUser.role,
    };
  }, [storedUser, sessionId, sessionName, sessionEmail, sessionRole]);

  const login = useCallback(
    async (payload: LoginPayload) => {
      try {
        const response = await loginApi(payload);
        const emailLocal = payload.email.split("@")[0];
        const name = emailLocal
          .split(/[._-]+/)
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        const authUser: AuthUser = {
          id: "admin",
          name: name || "Admin",
          email: payload.email,
          role: decodeJwtRole(response.data.accessToken),
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
        };
        setUser(authUser);
        // Sessão de outra conta que tenha ficado no cache desta aba não pode
        // vazar papel/permissões para quem acabou de entrar.
        queryClient.removeQueries({ queryKey: ADMIN_ME_QUERY_KEY });
        toast.success("Login realizado com sucesso!");
        return authUser;
      } catch (error) {
        toast.error("Email ou senha inválidos");
        throw error;
      }
    },
    [setUser, queryClient]
  );

  const logout = useCallback(() => {
    clear();
    queryClient.removeQueries({ queryKey: ADMIN_ME_QUERY_KEY });
    toast.info("Você saiu do sistema");
    window.location.href = "/login";
  }, [clear, queryClient]);

  // Papel efetivo: o do banco quando /me já respondeu, senão o do token — assim
  // o guard de rota continua funcionando no primeiro render, sem piscar.
  const role = user?.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const isSuperAdmin = role === "SUPER_ADMIN";

  const permissions = useMemo(() => session?.permissions ?? [], [session?.permissions]);

  const hasPermission = useCallback(
    (key: AdminPermission | string) => {
      // Super admin ignora a lista por definição — tem tudo, sempre.
      if (isSuperAdmin) return true;
      return permissions.includes(key);
    },
    [isSuperAdmin, permissions],
  );

  return {
    user,
    isHydrated,
    isAuthenticated: !!storedUser,
    isAdmin,
    isSuperAdmin,
    /** Áreas liberadas para este admin (vazio para SUPER_ADMIN — ele tem tudo). */
    permissions,
    hasPermission,
    /** `true` enquanto a sessão (papel + permissões) ainda não foi resolvida. */
    isSessionLoading,
    login,
    logout,
  };
}

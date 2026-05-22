"use client";

import { useCallback, useEffect } from "react";
import { useAuthStore } from "./auth.store";
import { loginApi } from "@/modules/auth/infrastructure/auth.api";
import { LoginPayload, AuthUser } from "@/modules/auth/domain/types";
import { toast } from "sonner";

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
  const { user, isHydrated, setUser, hydrate, clear } = useAuthStore();

  useEffect(() => {
    if (!isHydrated) {
      hydrate();
    }
  }, [isHydrated, hydrate]);

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
        toast.success("Login realizado com sucesso!");
        return authUser;
      } catch (error) {
        toast.error("Email ou senha inválidos");
        throw error;
      }
    },
    [setUser]
  );

  const logout = useCallback(() => {
    clear();
    toast.info("Você saiu do sistema");
    window.location.href = "/login";
  }, [clear]);

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  return {
    user,
    isHydrated,
    isAuthenticated: !!user,
    isAdmin,
    isSuperAdmin,
    login,
    logout,
  };
}

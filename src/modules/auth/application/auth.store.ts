import { create } from "zustand";
import { AuthUser } from "@/modules/auth/domain/types";
import { decodeJwtPayload, isJwtExpired } from "@/modules/shared/infrastructure/jwt";

/** `true` quando o token diz que a senha ainda é a temporária. */
export function tokenRequiresPasswordChange(token: string | undefined | null): boolean {
  if (!token) return false;
  return decodeJwtPayload(token)?.mustChangePassword === true;
}

interface AuthState {
  user: AuthUser | null;
  isHydrated: boolean;
  setUser: (user: AuthUser | null) => void;
  hydrate: () => void;
  clear: () => void;
}

const STORAGE_KEY = "authUser";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isHydrated: false,
  setUser: (user) => {
    set({ user });
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthUser;
        // Sessão com token vencido é descartada na hidratação — senão o guard
        // considera autenticado, o /login fica inalcançável e o dashboard
        // quebra em 401 silencioso.
        if (isJwtExpired(parsed.accessToken)) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          // Sessão gravada antes do campo existir: lê do token uma vez. Depois
          // da troca o campo fica `false` e o token antigo não manda mais.
          const user =
            parsed.mustChangePassword === undefined
              ? { ...parsed, mustChangePassword: tokenRequiresPasswordChange(parsed.accessToken) }
              : parsed;
          set({ user, isHydrated: true });
          return;
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    set({ isHydrated: true });
  },
  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null });
  },
}));

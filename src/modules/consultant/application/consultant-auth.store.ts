import { create } from "zustand";
import type { ConsultantSession } from "@/modules/consultant/domain/types";
import { CONSULTANT_STORAGE_KEY } from "@/modules/consultant/infrastructure/consultant-api";
import { isJwtExpired } from "@/modules/shared/infrastructure/jwt";

interface ConsultantAuthState {
  session: ConsultantSession | null;
  isHydrated: boolean;
  setSession: (session: ConsultantSession | null) => void;
  hydrate: () => void;
  clear: () => void;
}

export const useConsultantAuthStore = create<ConsultantAuthState>((set) => ({
  session: null,
  isHydrated: false,
  setSession: (session) => {
    set({ session });
    if (session) {
      localStorage.setItem(CONSULTANT_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(CONSULTANT_STORAGE_KEY);
    }
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(CONSULTANT_STORAGE_KEY);
    if (stored) {
      try {
        const session = JSON.parse(stored) as ConsultantSession;
        // Mesma proteção do staff: sessão com token vencido não hidrata,
        // senão o consultor fica preso fora do /consultor/login.
        if (isJwtExpired(session.accessToken)) {
          localStorage.removeItem(CONSULTANT_STORAGE_KEY);
        } else {
          set({ session, isHydrated: true });
          return;
        }
      } catch {
        localStorage.removeItem(CONSULTANT_STORAGE_KEY);
      }
    }
    set({ isHydrated: true });
  },
  clear: () => {
    localStorage.removeItem(CONSULTANT_STORAGE_KEY);
    set({ session: null });
  },
}));

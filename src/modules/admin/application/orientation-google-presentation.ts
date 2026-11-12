import type {
  GoogleConnectionView,
  OrientationGoogleSyncStatus,
  OrientationMeetSource,
} from "../infrastructure/orientation-api";

export type GoogleCardState =
  | "hidden"
  | "not-configured"
  | "disconnected"
  | "connected"
  | "needs-reconnect";

/** `null` (API velha) ou chave desligada: o cartão nem aparece. */
export function googleCardState(v: GoogleConnectionView | null): GoogleCardState {
  if (!v || !v.enabled) return "hidden";
  if (!v.configured) return "not-configured";
  if (!v.connection) return "disconnected";
  return v.connection.status === "ACTIVE" ? "connected" : "needs-reconnect";
}

export type GoogleSyncTone = "ok" | "wait" | "error" | "none";

export function googleSyncBadge(s: {
  googleSyncStatus: OrientationGoogleSyncStatus;
  googleSyncError: string | null;
  meetSource: OrientationMeetSource | null;
}): { label: string; tone: GoogleSyncTone } {
  switch (s.googleSyncStatus) {
    case "SYNCED":
      return s.meetSource === "MANUAL"
        ? { label: "Link colado, na agenda do Google", tone: "ok" }
        : { label: "Meet criado no Google", tone: "ok" };
    case "PENDING":
    case "SYNCING":
      if (s.meetSource === "MANUAL") return { label: "Pondo o link colado na agenda do Google…", tone: "wait" };
      return { label: "Criando o Meet no Google…", tone: "wait" };
    case "DELETE_PENDING":
      return { label: "Criando o Meet no Google…", tone: "wait" };
    case "FAILED":
      return { label: s.googleSyncError || "Não deu para criar o Meet no Google.", tone: "error" };
    default:
      return s.meetSource === "MANUAL"
        ? { label: "Link colado", tone: "none" }
        : { label: "Sem link", tone: "none" };
  }
}

const GENERIC = "Não deu para conectar o Google agora. Tente de novo.";

/** Erro do Google sempre genérico na tela; só dois códigos têm texto próprio. */
export function googleErrorMessage(code: string | undefined): string {
  if (code === "GOOGLE_STATE_INVALID") return "Este pedido de conexão venceu. Toque em Conectar de novo.";
  if (code === "GOOGLE_SCOPE_MISSING")
    return "Para criar as aulas, marque a permissão da agenda na tela do Google.";
  return GENERIC;
}

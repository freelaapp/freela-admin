import { describe, expect, it } from "vitest";
import type { GoogleConnectionView } from "../infrastructure/orientation-api";
import {
  googleCardState,
  googleErrorMessage,
  googleSyncBadge,
} from "./orientation-google-presentation";

const on: GoogleConnectionView = {
  enabled: true,
  configured: true,
  scope: "app.created",
  connection: null,
};
const c = {
  googleEmail: "a@b.com",
  status: "ACTIVE" as const,
  lastError: null,
  connectedAt: "2026-11-11T10:00:00.000Z",
  calendarMode: "SECONDARY" as const,
};

describe("googleCardState", () => {
  it("esconde sem visão ou com a chave desligada", () => {
    expect(googleCardState(null)).toBe("hidden");
    expect(googleCardState({ ...on, enabled: false })).toBe("hidden");
  });
  it("não configurado, desconectado, conectado e reconectar", () => {
    expect(googleCardState({ ...on, configured: false })).toBe("not-configured");
    expect(googleCardState(on)).toBe("disconnected");
    expect(googleCardState({ ...on, connection: c })).toBe("connected");
    expect(googleCardState({ ...on, connection: { ...c, status: "REVOKED" } })).toBe("needs-reconnect");
    expect(googleCardState({ ...on, connection: { ...c, status: "ERROR" } })).toBe("needs-reconnect");
  });
});

describe("googleSyncBadge", () => {
  const base = { googleSyncError: null, meetSource: null } as const;
  it("MANUAL: SYNCED mostra link colado na agenda (ok); PENDING/SYNCING pondo o link (wait); GOOGLE segue igual", () => {
    expect(googleSyncBadge({ ...base, googleSyncStatus: "SYNCED", meetSource: "MANUAL" })).toEqual({
      label: "Link colado, na agenda do Google",
      tone: "ok",
    });
    for (const st of ["PENDING", "SYNCING"] as const) {
      expect(googleSyncBadge({ ...base, googleSyncStatus: st, meetSource: "MANUAL" })).toEqual({
        label: "Pondo o link colado na agenda do Google…",
        tone: "wait",
      });
    }
    expect(googleSyncBadge({ ...base, googleSyncStatus: "SYNCED", meetSource: "GOOGLE" }).label).toBe(
      "Meet criado no Google",
    );
  });

  it("Meet do Google, link colado e falha", () => {
    expect(googleSyncBadge({ ...base, googleSyncStatus: "SYNCED", meetSource: "GOOGLE" })).toEqual({
      label: "Meet criado no Google",
      tone: "ok",
    });
    expect(googleSyncBadge({ ...base, googleSyncStatus: "NOT_CONNECTED", meetSource: "MANUAL" })).toEqual({
      label: "Link colado",
      tone: "none",
    });
    const failed = googleSyncBadge({
      googleSyncStatus: "FAILED",
      googleSyncError: "O Google não respondeu. Tentamos de novo em até 15 minutos.",
      meetSource: null,
    });
    expect(failed.tone).toBe("error");
    expect(failed.label).toContain("O Google não respondeu");
  });
  it("em andamento e sem nada", () => {
    expect(googleSyncBadge({ ...base, googleSyncStatus: "PENDING" }).tone).toBe("wait");
    expect(googleSyncBadge({ ...base, googleSyncStatus: "SYNCING" }).tone).toBe("wait");
    expect(googleSyncBadge({ ...base, googleSyncStatus: "DELETE_PENDING" }).tone).toBe("wait");
    expect(googleSyncBadge({ ...base, googleSyncStatus: "NOT_CONNECTED" }).tone).toBe("none");
  });
});

describe("googleErrorMessage", () => {
  it("textos por código e genérico", () => {
    expect(googleErrorMessage("GOOGLE_STATE_INVALID")).toBe(
      "Este pedido de conexão venceu. Toque em Conectar de novo.",
    );
    expect(googleErrorMessage("GOOGLE_SCOPE_MISSING")).toBe(
      "Para criar as aulas, marque a permissão da agenda na tela do Google.",
    );
    expect(googleErrorMessage("GOOGLE_EXCHANGE_FAILED")).toBe("Não deu para conectar o Google agora. Tente de novo.");
    expect(googleErrorMessage(undefined)).toBe("Não deu para conectar o Google agora. Tente de novo.");
  });
});

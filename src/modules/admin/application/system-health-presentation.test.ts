import { describe, expect, it } from "vitest";

import {
  DOCUMENT_KEYS,
  channelLabel,
  documentBadge,
  formatAgo,
  statusLabel,
  statusTone,
  toneClasses,
} from "./system-health-presentation";

describe("statusTone", () => {
  it("mapeia os quatro estados de canal", () => {
    expect(statusTone("OK")).toBe("ok");
    expect(statusTone("DEGRADED")).toBe("warn");
    expect(statusTone("DOWN")).toBe("down");
    expect(statusTone("IDLE")).toBe("idle");
  });

  it("scheduler: ERROR é down e nunca rodou (null) é idle", () => {
    expect(statusTone("ERROR")).toBe("down");
    expect(statusTone(null)).toBe("idle");
    expect(statusTone(undefined)).toBe("idle");
  });

  it("aceita minúsculas e estados desconhecidos caem em idle", () => {
    expect(statusTone("ok")).toBe("ok");
    expect(statusTone("degraded")).toBe("warn");
    expect(statusTone("QUALQUER_COISA")).toBe("idle");
  });
});

describe("statusLabel", () => {
  it("rótulos em PT-BR", () => {
    expect(statusLabel("OK")).toBe("Operando");
    expect(statusLabel("DEGRADED")).toBe("Degradado");
    expect(statusLabel("DOWN")).toBe("Fora do ar");
    expect(statusLabel("IDLE")).toBe("Sem envios");
    expect(statusLabel("ERROR")).toBe("Erro");
    expect(statusLabel(null)).toBe("Nunca rodou");
  });

  it("estado desconhecido devolve o texto cru para não esconder nada", () => {
    expect(statusLabel("WEIRD")).toBe("WEIRD");
  });
});

describe("toneClasses", () => {
  it("cada tom tem classes próprias (a cor é o sinal do card)", () => {
    const tons = ["ok", "warn", "down", "idle"] as const;
    const classes = tons.map((t) => toneClasses(t).card);
    expect(new Set(classes).size).toBe(4);
    expect(toneClasses("ok").card).toContain("green");
    expect(toneClasses("warn").card).toContain("amber");
    expect(toneClasses("down").card).toContain("red");
  });
});

describe("channelLabel", () => {
  it("nomeia os quatro canais", () => {
    expect(channelLabel("EMAIL")).toBe("E-mail");
    expect(channelLabel("WHATSAPP")).toBe("WhatsApp");
    expect(channelLabel("WHATSAPP_GROUP")).toBe("WhatsApp (grupos)");
    expect(channelLabel("PUSH")).toBe("Push");
  });

  it("canal desconhecido devolve o texto cru", () => {
    expect(channelLabel("SMS")).toBe("SMS");
  });
});

describe("documentBadge", () => {
  it("OK é verde com ✓", () => {
    expect(documentBadge("OK")).toEqual({ label: "Emitido", tone: "ok", symbol: "✓" });
  });

  it("PENDING é amarelo", () => {
    expect(documentBadge("PENDING")).toEqual({ label: "Pendente", tone: "warn", symbol: "…" });
  });

  it("FAILED é vermelho com ✗", () => {
    expect(documentBadge("FAILED")).toEqual({ label: "Falhou", tone: "down", symbol: "✗" });
  });

  it("MISSING avisa que falta, sem confundir com falha", () => {
    expect(documentBadge("MISSING")).toEqual({ label: "Faltando", tone: "warn", symbol: "!" });
  });

  it("NA é neutro", () => {
    expect(documentBadge("NA")).toEqual({ label: "Não se aplica", tone: "idle", symbol: "–" });
  });

  it("valor desconhecido (API mais nova que o painel) cai em neutro com o texto cru", () => {
    expect(documentBadge("NOVO")).toEqual({ label: "NOVO", tone: "idle", symbol: "?" });
  });
});

describe("DOCUMENT_KEYS", () => {
  it("segue a ordem Contrato · Recibo · RPA · NF-e com siglas curtas", () => {
    expect(DOCUMENT_KEYS.map((d) => d.key)).toEqual(["contract", "receipt", "rpa", "nfse"]);
    expect(DOCUMENT_KEYS.map((d) => d.short)).toEqual(["C", "R", "RPA", "NF"]);
    expect(DOCUMENT_KEYS.map((d) => d.label)).toEqual(["Contrato", "Recibo", "RPA", "NF-e"]);
  });
});

describe("formatAgo", () => {
  it("segundos, minutos e horas", () => {
    expect(formatAgo(0)).toBe("agora");
    expect(formatAgo(3)).toBe("agora");
    expect(formatAgo(12)).toBe("há 12 s");
    expect(formatAgo(59)).toBe("há 59 s");
    expect(formatAgo(60)).toBe("há 1 min");
    expect(formatAgo(185)).toBe("há 3 min");
    expect(formatAgo(3600)).toBe("há 1 h");
    expect(formatAgo(7300)).toBe("há 2 h");
  });

  it("valor negativo (relógio adiantado) não vira texto estranho", () => {
    expect(formatAgo(-5)).toBe("agora");
  });
});

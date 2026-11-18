import { describe, expect, it } from "vitest";
import {
  RULES_HELP,
  countsLegend,
  statusFilterOptions,
  suspensionTagText,
} from "./freelancers-status-presentation";

describe("Freelancers — textos da situação (D5, fatia B)", () => {
  it("etiqueta da suspensão: data de volta (Brasília), conversa ou os dois", () => {
    expect(suspensionTagText(null)).toBeNull();
    expect(suspensionTagText(undefined)).toBeNull();
    expect(suspensionTagText({ endsAt: "2026-11-14T03:00:00.000Z", requiresConversation: false })).toBe(
      "Suspensa, volta em sáb 14/11",
    );
    expect(suspensionTagText({ endsAt: null, requiresConversation: true })).toBe("Suspensa até a conversa");
    expect(suspensionTagText({ endsAt: "2026-11-14T03:00:00.000Z", requiresConversation: true })).toBe(
      "Suspensa, volta em sáb 14/11 depois da conversa",
    );
  });

  it("filtro: API antiga = Ativo/Inativo; nova = as situações, com 'Inativas (qualquer motivo)'", () => {
    expect(statusFilterOptions(false).map((o) => o.value)).toEqual(["active", "inactive"]);
    expect(statusFilterOptions(true).map((o) => o.label)).toEqual([
      "Ativas",
      "Suspensas agora",
      "Banidas",
      "Exclusão pedida",
      "Perfil desativado",
      "Inativas (qualquer motivo)",
    ]);
  });

  it("legenda: a conta, a fonte e a hora em Brasília; perfil desativado só quando > 0", () => {
    const c = {
      active: 10,
      banned: 2,
      deletionRequested: 3,
      profileInactive: 0,
      inactive: 5,
      suspended: 1,
      noOrientation: 4,
      deleted: 7,
      total: 15,
      computedAt: "2026-11-18T17:32:00.000Z",
    };
    expect(countsLegend(c)).toContain("Ativas (10) + Banidas (2) + Exclusão pedida (3) = 15");
    expect(countsLegend(c)).toContain("Atualizado às 14h32");
    expect(countsLegend(c)).not.toContain("Perfil desativado");
    expect(countsLegend({ ...c, profileInactive: 1, total: 16 })).toContain("+ Perfil desativado (1) = 16");
    expect(RULES_HELP.map((r) => r.title)).toContain("Inativas (qualquer motivo)");
  });
});

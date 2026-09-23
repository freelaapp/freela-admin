import { describe, expect, it } from "vitest";
import {
  VIP_EMPTY_LIST_WARNING,
  VIP_GROUP_STATUS_LABELS,
  VIP_WHATSAPP_STATE_LABELS,
  vipAddResultMessage,
  vipEmptyListWarning,
  vipEnsureResultMessage,
  vipGroupActionLabel,
  vipGroupStatusVariant,
  vipMembersPendingAdd,
  vipRemoveResultMessage,
  vipStorePendingSummary,
  vipSyncResultMessage,
  vipWhatsappStateVariant,
} from "./vip-groups-presentation";

describe("vip-groups-presentation", () => {
  it("rótulos e cores do status do grupo", () => {
    expect(VIP_GROUP_STATUS_LABELS).toEqual({ NONE: "Sem grupo", PENDING: "Pendente", ACTIVE: "Ativo", FAILED: "Falhou" });
    expect(vipGroupStatusVariant("ACTIVE")).toBe("success");
    expect(vipGroupStatusVariant("FAILED")).toBe("destructive");
    expect(vipGroupStatusVariant("PENDING")).toBe("warning");
    expect(vipGroupStatusVariant("NONE")).toBe("outline");
  });

  it("rótulos e cores do estado no WhatsApp", () => {
    expect(VIP_WHATSAPP_STATE_LABELS.REMOVE_PENDING).toBe("Remover no WhatsApp");
    expect(vipWhatsappStateVariant("IN_GROUP")).toBe("success");
    expect(vipWhatsappStateVariant("FAILED")).toBe("destructive");
    expect(vipWhatsappStateVariant("PENDING")).toBe("warning");
  });

  it("resumo de pendências da loja", () => {
    expect(vipStorePendingSummary({ pendingAdd: 0, pendingRemove: 0 })).toBe("Tudo em dia");
    expect(vipStorePendingSummary({ pendingAdd: 1, pendingRemove: 0 })).toBe("1 fora do grupo");
    expect(vipStorePendingSummary({ pendingAdd: 3, pendingRemove: 2 })).toBe("3 fora do grupo · 2 para remover no WhatsApp");
  });

  it("lista vazia avisa que as vagas estão públicas", () => {
    expect(vipEmptyListWarning(0)).toBe(VIP_EMPTY_LIST_WARNING);
    expect(VIP_EMPTY_LIST_WARNING).toBe("Lista vazia: as vagas desta loja estão públicas.");
    expect(vipEmptyListWarning(4)).toBeNull();
  });

  it("botão de criar grupo por status", () => {
    expect(vipGroupActionLabel("NONE")).toBe("Criar grupo");
    expect(vipGroupActionLabel("FAILED")).toBe("Tentar criar de novo");
    expect(vipGroupActionLabel("PENDING")).toBe("Tentar criar de novo");
    expect(vipGroupActionLabel("ACTIVE")).toBeNull();
  });

  it("conta membros fora do grupo (PENDING/FAILED)", () => {
    expect(
      vipMembersPendingAdd([
        { whatsappState: "IN_GROUP" },
        { whatsappState: "PENDING" },
        { whatsappState: "FAILED" },
      ]),
    ).toBe(2);
  });

  it("freela banido fora do grupo não conta como pendente (o sync da API o pula)", () => {
    expect(
      vipMembersPendingAdd([
        { whatsappState: "PENDING", providerActive: true },
        { whatsappState: "PENDING", providerActive: false },
        { whatsappState: "FAILED", providerActive: false },
        { whatsappState: "IN_GROUP", providerActive: false },
      ]),
    ).toBe(1);
  });

  it("mensagens de resultado", () => {
    expect(vipEnsureResultMessage({ status: "ACTIVE", lastError: null })).toEqual({ ok: true, text: "Grupo VIP ativo." });
    expect(vipEnsureResultMessage({ status: "FAILED", lastError: "Bot desconectado" })).toEqual({
      ok: false,
      text: "Grupo não criado: Bot desconectado",
    });
    expect(vipEnsureResultMessage({ status: "FAILED", lastError: null })).toEqual({
      ok: false,
      text: "Grupo não criado: erro no WhatsApp",
    });
    expect(vipSyncResultMessage({ attempted: 0, added: 0, failed: 0 })).toBe("Ninguém pendente para adicionar.");
    expect(vipSyncResultMessage({ attempted: 3, added: 2, failed: 1 })).toBe("2 de 3 adicionados ao grupo. Veja o erro de quem ficou de fora.");
    expect(vipSyncResultMessage({ attempted: 2, added: 2, failed: 0 })).toBe("2 de 2 adicionados ao grupo.");
    expect(vipAddResultMessage({ whatsappState: "IN_GROUP" })).toBe("VIP adicionado e colocado no grupo.");
    expect(vipAddResultMessage({ whatsappState: "PENDING" })).toBe("VIP adicionado à lista (ainda fora do grupo do WhatsApp).");
    expect(vipRemoveResultMessage({ whatsappState: "REMOVE_PENDING" })).toBe(
      "Tirado da lista. Falta remover no grupo do WhatsApp e marcar “Feito”.",
    );
    expect(vipRemoveResultMessage({ whatsappState: "PENDING" })).toBe("Tirado da lista.");
  });
});

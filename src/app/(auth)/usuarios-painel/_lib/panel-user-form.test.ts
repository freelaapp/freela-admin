import { describe, expect, it } from "vitest";
import type { PanelUser } from "@/modules/admin/infrastructure/panel-users-api";
import { BR_PHONE_MESSAGES } from "@/modules/consultant/application/phone-mask";
import {
  buildPanelUserUpdatePayload,
  isPanelUserDeleted,
  panelUserDeleteBlock,
  panelUserToForm,
} from "./panel-user-form";

const user = (overrides: Partial<PanelUser> = {}): PanelUser => ({
  id: "a1",
  name: "Rebeca Rocha",
  email: "rebeca@freela.com",
  phone: "+5511987654321",
  role: "ADMIN",
  permissions: ["JOBS"],
  isActive: true,
  mustChangePassword: false,
  deletedAt: null,
  createdAt: "2026-09-01T12:00:00Z",
  updatedAt: "2026-09-01T12:00:00Z",
  ...overrides,
});

describe("panelUserToForm", () => {
  it("preserva o papel de recrutador (antes virava Admin ao editar)", () => {
    expect(panelUserToForm(user({ role: "RECRUITER" })).role).toBe("RECRUITER");
  });

  it("mostra o telefone com máscara", () => {
    expect(panelUserToForm(user()).phone).toBe("(11) 98765-4321");
  });
});

describe("buildPanelUserUpdatePayload", () => {
  it("nada mudou além do nome: e-mail e telefone não vão", () => {
    const original = user();
    const form = { ...panelUserToForm(original), name: "  Rebeca R. " };

    expect(buildPanelUserUpdatePayload(form, original)).toEqual({
      ok: true,
      payload: { name: "Rebeca R.", role: "ADMIN", permissions: ["JOBS"] },
    });
  });

  it("e-mail trocado vai normalizado; mudar só maiúsculas não conta como troca", () => {
    const original = user();
    const changed = buildPanelUserUpdatePayload(
      { ...panelUserToForm(original), email: " Rebeca.Nova@Freela.com " },
      original,
    );
    expect(changed.ok && changed.payload.email).toBe("rebeca.nova@freela.com");

    const sameEmail = buildPanelUserUpdatePayload(
      { ...panelUserToForm(original), email: "REBECA@freela.com" },
      original,
    );
    expect(sameEmail.ok && "email" in sameEmail.payload).toBe(false);
  });

  it("e-mail vazio ou inválido: erro", () => {
    const original = user();
    expect(buildPanelUserUpdatePayload({ ...panelUserToForm(original), email: " " }, original).ok).toBe(false);
    expect(buildPanelUserUpdatePayload({ ...panelUserToForm(original), email: "rebeca@" }, original)).toEqual({
      ok: false,
      error: "E-mail inválido.",
    });
  });

  it("telefone legado torto e intocado não trava a edição", () => {
    const original = user({ phone: "1234" });
    const result = buildPanelUserUpdatePayload(
      { ...panelUserToForm(original), name: "Outro Nome" },
      original,
    );
    expect(result.ok).toBe(true);
    expect(result.ok && "phone" in result.payload).toBe(false);
  });

  it("telefone trocado e inválido: mensagem da régua BR", () => {
    const original = user();
    expect(
      buildPanelUserUpdatePayload({ ...panelUserToForm(original), phone: "(11) 1234" }, original),
    ).toEqual({ ok: false, error: BR_PHONE_MESSAGES.INVALID_ANY });
  });

  it("telefone trocado (fixo aceito) vai em E.164; apagado vai vazio", () => {
    const original = user();
    const fixo = buildPanelUserUpdatePayload(
      { ...panelUserToForm(original), phone: "(11) 3333-4444" },
      original,
    );
    expect(fixo.ok && fixo.payload.phone).toBe("+551133334444");

    const apagado = buildPanelUserUpdatePayload({ ...panelUserToForm(original), phone: "" }, original);
    expect(apagado.ok && apagado.payload.phone).toBe("");
  });

  it("super admin não manda lista de áreas", () => {
    const original = user();
    const result = buildPanelUserUpdatePayload(
      { ...panelUserToForm(original), role: "SUPER_ADMIN" },
      original,
    );
    expect(result.ok && result.payload.permissions).toEqual([]);
  });
});

describe("panelUserDeleteBlock", () => {
  const superA = user({ id: "s1", role: "SUPER_ADMIN", permissions: [] });
  const superB = user({ id: "s2", role: "SUPER_ADMIN", permissions: [] });

  it("não exclui a si mesmo", () => {
    expect(panelUserDeleteBlock(superA, "s1", [superA, superB])).toMatch(/próprio usuário/);
  });

  it("não exclui o último super admin ativo", () => {
    expect(panelUserDeleteBlock(superA, "x", [superA, user()])).toMatch(/último super admin/);
  });

  it("super admin excluído ou inativo não conta como o outro ativo", () => {
    const inactive = user({ id: "s3", role: "SUPER_ADMIN", isActive: false });
    const deleted = user({ id: "s4", role: "SUPER_ADMIN", deletedAt: "2026-09-29T12:00:00Z", isActive: false });
    expect(panelUserDeleteBlock(superA, "x", [superA, inactive, deleted])).toMatch(/último super admin/);
  });

  it("com outro super admin ativo, ou admin comum: pode", () => {
    expect(panelUserDeleteBlock(superA, "x", [superA, superB])).toBeNull();
    expect(panelUserDeleteBlock(user(), "s1", [superA, user()])).toBeNull();
  });
});

describe("isPanelUserDeleted", () => {
  it("usa deletedAt (API antiga sem o campo = não excluído)", () => {
    expect(isPanelUserDeleted(user({ deletedAt: "2026-09-29T12:00:00Z" }))).toBe(true);
    expect(isPanelUserDeleted(user({ deletedAt: undefined }))).toBe(false);
  });
});

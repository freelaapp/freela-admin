import { describe, expect, it } from "vitest";
import { BR_PHONE_MESSAGES } from "@/modules/consultant/application/phone-mask";
import { buildUserUpdatePayload, userToEditForm } from "./user-edit-form";

const original = { name: "Ana Souza", email: "ana@x.com", phone: "+5511987654321" };

describe("userToEditForm", () => {
  it("telefone com máscara e campos nulos viram vazio", () => {
    expect(userToEditForm(original)).toEqual({
      name: "Ana Souza",
      email: "ana@x.com",
      phone: "(11) 98765-4321",
    });
    expect(userToEditForm({ name: null, email: null, phone: null })).toEqual({
      name: "",
      email: "",
      phone: "",
    });
  });
});

describe("buildUserUpdatePayload", () => {
  it("só vai o que mudou", () => {
    expect(
      buildUserUpdatePayload({ ...userToEditForm(original), name: " Ana S. " }, original),
    ).toEqual({ ok: true, payload: { name: "Ana S." } });
  });

  it("nada mudou: erro amigável", () => {
    expect(buildUserUpdatePayload(userToEditForm(original), original)).toEqual({
      ok: false,
      error: "Nada para alterar.",
    });
  });

  it("e-mail trocado vai normalizado; só maiúsculas diferentes não conta", () => {
    const changed = buildUserUpdatePayload(
      { ...userToEditForm(original), email: " Ana.Nova@X.com " },
      original,
    );
    expect(changed).toEqual({ ok: true, payload: { email: "ana.nova@x.com" } });
    expect(
      buildUserUpdatePayload({ ...userToEditForm(original), email: "ANA@x.com" }, original).ok,
    ).toBe(false);
  });

  it("e-mail inválido ou apagado: erro", () => {
    expect(
      buildUserUpdatePayload({ ...userToEditForm(original), email: "ana@" }, original),
    ).toEqual({ ok: false, error: "E-mail inválido." });
    expect(
      buildUserUpdatePayload({ ...userToEditForm(original), email: "" }, original),
    ).toEqual({ ok: false, error: "Informe o e-mail." });
  });

  it("conta sem e-mail (só telefone) pode ficar sem e-mail", () => {
    const semEmail = { name: "Zé", email: null, phone: "+5511987654321" };
    expect(
      buildUserUpdatePayload({ ...userToEditForm(semEmail), name: "Zé Silva" }, semEmail),
    ).toEqual({ ok: true, payload: { name: "Zé Silva" } });
  });

  it("nome curto: erro", () => {
    expect(buildUserUpdatePayload({ ...userToEditForm(original), name: "A" }, original)).toEqual({
      ok: false,
      error: "Informe o nome (mínimo 2 letras).",
    });
  });

  it("telefone: celular BR em E.164; fixo recusado (login/WhatsApp)", () => {
    const ok = buildUserUpdatePayload(
      { ...userToEditForm(original), phone: "(21) 99999-8888" },
      original,
    );
    expect(ok).toEqual({ ok: true, payload: { phone: "+5521999998888" } });

    expect(
      buildUserUpdatePayload({ ...userToEditForm(original), phone: "(21) 3333-4444" }, original),
    ).toEqual({ ok: false, error: BR_PHONE_MESSAGES.INVALID_MOBILE });
  });

  it("telefone legado torto e intocado não trava a edição", () => {
    const legado = { name: "Ana", email: "ana@x.com", phone: "1234" };
    expect(
      buildUserUpdatePayload({ ...userToEditForm(legado), name: "Ana Maria" }, legado),
    ).toEqual({ ok: true, payload: { name: "Ana Maria" } });
  });

  it("telefone apagado vai null", () => {
    expect(
      buildUserUpdatePayload({ ...userToEditForm(original), phone: "" }, original),
    ).toEqual({ ok: true, payload: { phone: null } });
  });
});

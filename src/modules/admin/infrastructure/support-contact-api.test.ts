import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("@/modules/shared/infrastructure/authed-client", () => ({ createAuthedClient: () => http }));

import { getSupportContact, updateSupportContact } from "./support-contact-api";

describe("support-contact-api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lê o contato com e-mail e emailIsDefault", async () => {
    http.get.mockResolvedValue({ data: { data: { email: "a@b.com", emailIsDefault: false } } });
    const view = await getSupportContact();
    expect(http.get).toHaveBeenCalledWith("/support-contact");
    expect(view.email).toBe("a@b.com");
  });

  it("PUT manda só o que veio", async () => {
    http.put.mockResolvedValue({ data: { data: {} } });
    await updateSupportContact({ email: "a@b.com" });
    expect(http.put).toHaveBeenLastCalledWith("/support-contact", { email: "a@b.com" });
    await updateSupportContact({ whatsapp: "5511971777563" });
    expect(http.put).toHaveBeenLastCalledWith("/support-contact", { whatsapp: "5511971777563" });
  });
});

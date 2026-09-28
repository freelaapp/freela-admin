import { describe, expect, it } from "vitest";
import { buildReferralShareText, buildWhatsAppShareUrl } from "./referral-share";

const LINK = "https://freelaservicos.com.br/cadastro?ref=ANDRE2K";

describe("buildReferralShareText", () => {
  it("usa o texto aprovado com o link no fim", () => {
    expect(buildReferralShareText(LINK)).toBe(
      "Faça seu cadastro no Freela Serviços pelo meu link: https://freelaservicos.com.br/cadastro?ref=ANDRE2K",
    );
  });
});

describe("buildWhatsAppShareUrl", () => {
  it("abre o wa.me com o texto inteiro codificado (o ?ref= não vaza para a URL do WhatsApp)", () => {
    const url = buildWhatsAppShareUrl(LINK);
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(url).not.toContain("?ref=");
    expect(decodeURIComponent(url.slice("https://wa.me/?text=".length))).toBe(
      buildReferralShareText(LINK),
    );
  });
});

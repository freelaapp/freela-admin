import { describe, expect, it } from "vitest";
import {
  formatSupportWhatsappInput,
  normalizeSupportWhatsapp,
  whatsappTestUrl,
} from "./support-whatsapp";

describe("support-whatsapp", () => {
  it("máscara tira o DDI colado e formata celular", () => {
    expect(formatSupportWhatsappInput("+55 11 97177-7563")).toBe("(11) 97177-7563");
    expect(formatSupportWhatsappInput("1197")).toBe("(11) 97");
    expect(formatSupportWhatsappInput("")).toBe("");
  });

  it("mesma regra da API: só celular, DDD 55 do RS preservado", () => {
    expect(normalizeSupportWhatsapp("(11) 97177-7563")).toBe("5511971777563");
    expect(normalizeSupportWhatsapp("(55) 99876-5432")).toBe("5555998765432");
    expect(normalizeSupportWhatsapp("(11) 3456-7890")).toBeNull();
  });

  it("link de teste abre a conversa do número digitado", () => {
    expect(whatsappTestUrl("5511971777563")).toBe("https://wa.me/5511971777563");
  });
});

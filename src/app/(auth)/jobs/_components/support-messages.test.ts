import { describe, expect, it } from "vitest";

import { MENSAGENS, montarMensagem, whatsappLink } from "./support-messages";

describe("montarMensagem", () => {
  it("preenche os marcadores do template da ação", () => {
    const texto = montarMensagem("saudacao", {
      contato: "Marcos",
      cargo: "Garçom",
      data: "12/08",
      turno: "18:00 - 00:00",
    });
    expect(texto).toContain("Olá, Marcos!");
    expect(texto).toContain("vaga de Garçom para 12/08, 18:00 - 00:00");
  });

  // Mensagem com "{freelancer}" aparecendo é a que o suporte manda sem revisar
  // e o cliente recebe torta.
  it("apaga o marcador sem valor em vez de deixá-lo na tela", () => {
    const texto = montarMensagem("checar_chegada", { empresa: "" });
    expect(texto).not.toMatch(/\{\w+\}/);
  });

  it("cai no texto genérico quando a ação não tem template", () => {
    const texto = montarMensagem("registrar_ocorrencia", { cargo: "Cozinheiro" });
    expect(texto).toContain("suporte da Freela");
    expect(texto).toContain("Cozinheiro");
  });

  it("nenhum template deixa marcador desconhecido para trás", () => {
    const conhecidos = new Set(["cargo", "empresa", "data", "turno", "freelancer", "contato"]);
    for (const [id, template] of Object.entries(MENSAGENS)) {
      for (const [, chave] of template.matchAll(/\{(\w+)\}/g)) {
        expect(conhecidos, `${id} usa {${chave}}`).toContain(chave);
      }
    }
  });
});

describe("whatsappLink", () => {
  it("põe o 55 no número nacional", () => {
    expect(whatsappLink("(11) 98765-4321", "oi")).toBe("https://wa.me/5511987654321?text=oi");
  });

  // DDD 55 existe (Santa Maria/RS): testar prefixo mandaria a mensagem para o
  // número errado. O que decide é o tamanho.
  it("não confunde DDD 55 com código do país", () => {
    expect(whatsappLink("55987654321", "oi")).toBe("https://wa.me/5555987654321?text=oi");
    expect(whatsappLink("5511987654321", "oi")).toBe("https://wa.me/5511987654321?text=oi");
  });

  it("devolve null quando não há número usável", () => {
    expect(whatsappLink(null, "oi")).toBeNull();
    expect(whatsappLink("", "oi")).toBeNull();
    expect(whatsappLink("1234", "oi")).toBeNull();
  });

  it("escapa o texto para o link não quebrar na quebra de linha", () => {
    const link = whatsappLink("11987654321", "linha 1\nlinha 2 & fim");
    expect(link).toContain("linha%201%0Alinha%202%20%26%20fim");
  });
});

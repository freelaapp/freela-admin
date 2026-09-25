import { describe, expect, it } from "vitest";
import { canOpenDocument, withNoScriptPolicy } from "./vacancy-documents-open";

describe("canOpenDocument", () => {
  it("abre qualquer documento emitido", () => {
    for (const key of ["contract", "receipt", "rpa", "nfse"] as const) {
      expect(canOpenDocument(key, "OK")).toBe(true);
    }
  });

  it("contrato pendente (falta uma assinatura) também abre — o documento existe", () => {
    expect(canOpenDocument("contract", "PENDING")).toBe(true);
  });

  it("fiscal pendente/falhou/faltando não abre — não há documento para mostrar", () => {
    for (const key of ["receipt", "rpa", "nfse"] as const) {
      for (const state of ["PENDING", "FAILED", "MISSING", "NA"]) {
        expect(canOpenDocument(key, state)).toBe(false);
      }
    }
  });

  it("contrato faltando ou sem estado não abre", () => {
    expect(canOpenDocument("contract", "MISSING")).toBe(false);
    expect(canOpenDocument("contract", "NA")).toBe(false);
    expect(canOpenDocument("contract", null)).toBe(false);
    expect(canOpenDocument("contract", undefined)).toBe(false);
  });

  it("aceita estado em minúsculas", () => {
    expect(canOpenDocument("receipt", "ok")).toBe(true);
  });
});

describe("withNoScriptPolicy", () => {
  const csp = `<meta http-equiv="Content-Security-Policy" content="script-src 'none'">`;

  it("injeta a política logo depois do <head>", () => {
    const html = "<!DOCTYPE html><html><head><title>x</title></head><body>oi</body></html>";
    expect(withNoScriptPolicy(html)).toBe(
      `<!DOCTYPE html><html><head>${csp}<title>x</title></head><body>oi</body></html>`,
    );
  });

  it("respeita <head> com atributos e maiúsculas", () => {
    const html = '<html><HEAD lang="pt"><title>x</title></HEAD></html>';
    expect(withNoScriptPolicy(html)).toBe(`<html><HEAD lang="pt">${csp}<title>x</title></HEAD></html>`);
  });

  it("sem <head>, coloca a política no começo", () => {
    expect(withNoScriptPolicy("<p>oi</p>")).toBe(`${csp}<p>oi</p>`);
  });
});

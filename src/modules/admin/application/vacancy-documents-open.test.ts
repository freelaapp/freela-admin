import { describe, expect, it } from "vitest";
import {
  canOpenDocument,
  invoicedNfseLink,
  isInvoicedVacancy,
  withNoScriptPolicy,
} from "./vacancy-documents-open";

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

describe("NFS-e da vaga faturada (AD2c.3)", () => {
  it("com o id da fatura da API: o detalhe da fatura, sem olhar o texto", () => {
    expect(
      invoicedNfseLink(
        { invoiceId: "inv-123", number: "FAT-2026-000123" },
        "NFS-e na fatura FAT-2026-000999: texto antigo",
      ),
    ).toEqual({ href: "/financeiro/faturas/inv-123", number: "FAT-2026-000123" });
  });

  it("fallback: só o número no formato FAT-AAAA-N (regex FAT-\\d{4}-\\d+), o primeiro do texto, para a aba Faturas", () => {
    const fallback = (text: string | null) => invoicedNfseLink(undefined, text);
    expect(fallback("NFS-e na fatura FAT-2026-000131: emissão falhou")).toEqual({
      href: "/financeiro?aba=faturas",
      number: "FAT-2026-000131",
    });
    expect(fallback("NFS-e na fatura FAT-2027-7")).toEqual({
      href: "/financeiro?aba=faturas",
      number: "FAT-2027-7",
    });
    expect(fallback("FAT-2026-000001 e FAT-2026-000002")?.number).toBe("FAT-2026-000001");
    // Fora do formato: nenhum link (só o texto da API).
    expect(fallback("NFS-e na fatura FAT-26-000131")).toBeNull();
    expect(fallback("NFS-e na fatura fat-2026-000131")).toBeNull();
    expect(fallback("NFS-e na fatura XFAT-2026-000131")).toBeNull();
    expect(fallback("NFS-e na fatura FAT-2026-")).toBeNull();
    expect(fallback("NFS-e na fatura: sai depois que a fatura for paga")).toBeNull();
    expect(fallback("Sem NFS-e: o cupom CORTESIA cobriu a vaga")).toBeNull();
    expect(fallback(null)).toBeNull();
    // `nfseInvoice: null` (antes do fechamento) também cai no texto.
    expect(invoicedNfseLink(null, "NFS-e na fatura FAT-2026-000131")?.href).toBe("/financeiro?aba=faturas");
  });

  it("faturada = pagamento INVOICE, ou a API mandou a fatura da nota (nfseInvoice preenchido)", () => {
    expect(isInvoicedVacancy("INVOICE", undefined)).toBe(true);
    expect(isInvoicedVacancy("invoice", undefined)).toBe(true);
    expect(isInvoicedVacancy("INVOICE", null)).toBe(true);
    expect(isInvoicedVacancy(null, { invoiceId: "inv-1", number: "FAT-2026-000131" })).toBe(true);
    expect(isInvoicedVacancy("PIX", undefined)).toBe(false);
    expect(isInvoicedVacancy(undefined, undefined)).toBe(false);
  });

  it("nfseInvoice null NÃO marca faturada: a lista manda null para toda vaga, inclusive a paga por Pix", () => {
    expect(isInvoicedVacancy("PIX", null)).toBe(false);
    expect(isInvoicedVacancy(null, null)).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SAMPLE_CONTRACTOR_DETAIL,
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_BEFORE_MEASUREMENT,
  SAMPLE_OVERVIEW_WITHOUT_INDICATORS,
} from "@/modules/admin/application/engagement.test-fixtures";

// Mesmo jeito de contractor-report-pdf.test.ts: o fake grava o TEXTO escrito
// no PDF (o que o leitor vê), não a renderização.
const { textCalls, imageCalls } = vi.hoisted(() => ({
  textCalls: [] as string[],
  imageCalls: [] as unknown[][],
}));

vi.mock("jspdf", () => {
  class FakeJsPDF {
    text(text: string) {
      textCalls.push(text);
    }
    addImage(...args: unknown[]) {
      imageCalls.push(args);
    }
    setFontSize() {}
    setFont() {}
    setTextColor() {}
    setFillColor() {}
    setDrawColor() {}
    setLineWidth() {}
    rect() {}
    line() {}
    addPage() {}
    setPage() {}
    getNumberOfPages() {
      return 1;
    }
    getTextWidth() {
      return 0;
    }
    save() {}
  }
  return { jsPDF: FakeJsPDF };
});

import { buildContractorReportPdf, buildOverviewPdf } from "./engagement-pdf";

const NOW = new Date("2026-10-07T15:00:00.000Z");

beforeEach(() => {
  textCalls.length = 0;
  imageCalls.length = 0;
});

describe("PDF do painel", () => {
  it("cabeçalho, filtros, as 2 tabelas de indicadores, cidades e rodapé", () => {
    buildOverviewPdf(SAMPLE_OVERVIEW, "Período: 01/09/2026 a 30/09/2026 · Cidade: Todas", null, NOW);
    expect(textCalls).toContain("Engajamento na Freela");
    expect(textCalls).toContain("Período: 01/09/2026 a 30/09/2026 · Cidade: Todas");
    expect(textCalls).toContain("Contratante");
    expect(textCalls).toContain("Freelancer");
    for (const head of ["Indicador", "Período", "Anterior", "Parcelas", "Como calcular", "Fonte"]) {
      expect(textCalls).toContain(head);
    }
    // Linha completa, na ordem das colunas (o fake não quebra linha: largura de texto 0).
    const i = textCalls.indexOf("Abriu a 1ª vaga");
    expect(textCalls.slice(i, i + 6)).toEqual([
      "Abriu a 1ª vaga",
      "40%",
      "33,3% (+20%)",
      "Período: 2 de 5 cadastrados · Anterior: 1 de 3 cadastrados",
      "% dos cadastrados no período que já abriram ao menos 1 vaga (até hoje)",
      "Cadastros do período × vagas abertas por eles (qualquer data)",
    ]);
    expect(textCalls).toContain("Candidatou e não trabalhou");
    expect(textCalls).toContain("Juiz de Fora - MG");
    expect(textCalls.some((t) => t.includes("gerado em 07/10/2026 12:00 · página 1 de 1"))).toBe(true);
    expect(imageCalls).toHaveLength(0);
  });

  it("sem o bloco indicators (API antiga): escreve o aviso e segue com o resto", () => {
    buildOverviewPdf(SAMPLE_OVERVIEW_WITHOUT_INDICATORS, "x", null, NOW);
    expect(textCalls).toContain("Indicadores atualizando — publique a API");
    expect(textCalls).not.toContain("Abriu a 1ª vaga");
    expect(textCalls).toContain("Juiz de Fora - MG");
  });

  it("antes da medição: aviso e '—' (nunca 0) nos acessos", () => {
    buildOverviewPdf(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT, "x", null, NOW);
    expect(textCalls.some((t) => t.startsWith("Acessos medidos desde 07/10/2026"))).toBe(true);
    const i = textCalls.indexOf("Acessou");
    expect(textCalls.slice(i + 1, i + 3)).toEqual(["—", "—"]);
  });

  it("com o PNG do gráfico, desenha a imagem e a legenda", () => {
    buildOverviewPdf(SAMPLE_OVERVIEW, "x", "data:image/png;base64,AAA", NOW);
    expect(imageCalls).toHaveLength(1);
    expect(imageCalls[0].slice(0, 2)).toEqual(["data:image/png;base64,AAA", "PNG"]);
    expect(textCalls).toContain("Evolução no período");
    expect(textCalls).toContain("Freelancers que acessaram");
  });

  it("só caracteres que a fonte do PDF tem (sem − ≤ ≥)", () => {
    buildOverviewPdf(SAMPLE_OVERVIEW, "x", null, NOW);
    expect(textCalls.join("\n")).not.toMatch(/[−≤≥]/);
  });
});

describe("relatório para o cliente", () => {
  it("tem o nome, os números e as vagas da empresa", () => {
    buildContractorReportPdf(SAMPLE_CONTRACTOR_DETAIL, NOW);
    expect(textCalls).toContain("Bar do Zé");
    expect(textCalls).toContain("Relatório de vagas · 01/09/2026 a 30/09/2026");
    expect(textCalls).toContain("Garçom para sábado");
    expect(textCalls).toContain("Ana");
    expect(textCalls).toContain("Cancelada pela empresa");
  });

  it("NUNCA leva telefone, e-mail ou documento", () => {
    buildContractorReportPdf(SAMPLE_CONTRACTOR_DETAIL, NOW);
    const all = textCalls.join("\n");
    const s = SAMPLE_CONTRACTOR_DETAIL.summary;
    for (const secret of [s.phone, s.email, s.document]) expect(all).not.toContain(String(secret));
    expect(all).not.toContain("@");
    expect(all).not.toMatch(/3215/);
    expect(all).not.toMatch(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
  });
});

describe("revisão final", () => {
  it("empresa sem nome cadastrado: o relatório do cliente não usa o e-mail como título", () => {
    const d = {
      ...SAMPLE_CONTRACTOR_DETAIL,
      summary: { ...SAMPLE_CONTRACTOR_DETAIL.summary, name: "dono@bar.com" },
    };
    buildContractorReportPdf(d, NOW);
    expect(textCalls.some((t) => t.includes("@"))).toBe(false);
    expect(textCalls).toContain("Relatório da empresa");
  });

  it("PDF do painel avisa da medição quando a janela anterior começa antes dela", () => {
    const o = { ...SAMPLE_OVERVIEW, measuredSince: "2026-08-15", openedAvailable: { current: true, previous: true } };
    buildOverviewPdf(o, "filtros", null, NOW);
    expect(textCalls.some((t) => t.includes("Acessos medidos desde 15/08/2026"))).toBe(true);
  });
});

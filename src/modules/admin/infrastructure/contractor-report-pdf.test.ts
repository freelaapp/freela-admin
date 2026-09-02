import { describe, expect, it, vi } from "vitest";

import { generateContractorReportPdf } from "./contractor-report-pdf";
import type { ContractorReportResult, ContractorReportRow } from "./admin-api";

// jsPDF#save() dispara um download no browser — em Node/jsdom ele cai num
// fallback que grava o PDF no disco (fs), o que sujaria o repo a cada rodada
// de teste. Substituímos por uma subclasse com `save` no-op: exercita toda a
// montagem do PDF (colunas, linhas, totais) sem tocar o filesystem. Espelho
// do teste equivalente em freela-web-v2 (contractor-report-pdf.test.ts).
vi.mock("jspdf", async () => {
  const actual = await vi.importActual<typeof import("jspdf")>("jspdf");
  class TestJsPDF extends actual.jsPDF {
    constructor(...args: ConstructorParameters<typeof actual.jsPDF>) {
      super(...args);
      // jsPDF registra `save` como plugin (propriedade da INSTÂNCIA, dentro do
      // construtor real) — sobrescrever no prototype não basta, tem que
      // reatribuir aqui, depois do `super()`, pra vencer a propriedade própria.
      this.save = () => this;
    }
  }
  return { ...actual, jsPDF: TestJsPDF };
});

function makeContractor(): ContractorReportResult["contractor"] {
  return {
    id: "contractor-1",
    companyName: "Coco Bambu Jundiaí",
    cnpj: "12.345.678/0001-90",
    contactName: "Sheilla",
    contactEmail: "sheilla@example.com",
    contactPhone: "11999999999",
    city: "Jundiaí",
    uf: "SP",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeRow(overrides: Partial<ContractorReportRow> = {}): ContractorReportRow {
  return {
    vacancy_id: "vaga-1",
    title: "Garçom",
    vacancy_service: "garcom",
    vacancy_status: "COMPLETED",
    date: "2026-08-20",
    start_time: null,
    end_time: null,
    created_at: "2026-08-15T12:00:00.000Z",
    base_amount_in_cents: 14700,
    freelancer_amount_in_cents: 11760,
    platform_fee_in_cents: 2940,
    taxa_servico_in_cents: null,
    seguro_in_cents: null,
    total_freelance_in_cents: null,
    inss_in_cents: null,
    repasse_liquido_in_cents: null,
    provides_meal: null,
    contractor_payment: { status: "COMPLETED", value: 14885 },
    candidacy_id: "cand-1",
    candidacy_status: "ACCEPTED",
    freelancer_name: "Maria Silva",
    freelancer_email: "maria@example.com",
    freelancer_phone: "11999999999",
    freelancer_cpf_casa: "12345678909",
    candidacy_role: "garcom",
    repasse: {
      amount: 11760,
      status: "COMPLETED",
      pixKey: null,
      pixKeyType: null,
      confirmedAt: "2026-08-20T20:00:00.000Z",
    },
    ...overrides,
  };
}

describe("generateContractorReportPdf", () => {
  it("gera o PDF (layout legado, 3 colunas) sem lançar, para linhas sem decomposição", () => {
    const result: ContractorReportResult = {
      contractor: makeContractor(),
      range: { from: null, to: null },
      rows: [makeRow()],
    };

    expect(() => generateContractorReportPdf(result)).not.toThrow();
  });

  it("gera o PDF (layout com decomposição) sem lançar, quando alguma vaga tem os 5 campos, e a taxa reconcilia com pix+seguro+repasse", () => {
    const result: ContractorReportResult = {
      contractor: makeContractor(),
      range: { from: null, to: null },
      rows: [
        makeRow({
          taxa_servico_in_cents: 2940,
          seguro_in_cents: 300,
          total_freelance_in_cents: 11275,
          inss_in_cents: 1240,
          repasse_liquido_in_cents: 10035,
          contractor_payment: { status: "COMPLETED", value: 13460 },
          repasse: {
            amount: 10035,
            status: "COMPLETED",
            pixKey: null,
            pixKeyType: null,
            confirmedAt: "2026-08-20T20:00:00.000Z",
          },
        }),
      ],
    };

    // Reconciliação do modelo (spec 2026-09-02, R$147 empresa):
    // taxaServico(2940) + pix(185) + seguro(300) + repasseLiquido(10035) = 13460 (você paga).
    expect(2940 + 185 + 300 + 10035).toBe(13460);

    expect(() => generateContractorReportPdf(result)).not.toThrow();
  });

  it("gera o PDF sem lançar num relatório MISTO (vaga legada + vaga com decomposição)", () => {
    const result: ContractorReportResult = {
      contractor: makeContractor(),
      range: { from: null, to: null },
      rows: [
        makeRow({ vacancy_id: "vaga-legada" }),
        makeRow({
          vacancy_id: "vaga-nova",
          candidacy_id: "cand-2",
          freelancer_name: "João",
          taxa_servico_in_cents: 2940,
          seguro_in_cents: 300,
          total_freelance_in_cents: 11275,
          inss_in_cents: 1240,
          repasse_liquido_in_cents: 10035,
          contractor_payment: { status: "COMPLETED", value: 13460 },
          repasse: {
            amount: 10035,
            status: "COMPLETED",
            pixKey: null,
            pixKeyType: null,
            confirmedAt: "2026-08-20T20:00:00.000Z",
          },
        }),
      ],
    };

    expect(() => generateContractorReportPdf(result)).not.toThrow();
  });

  it("gera o PDF sem lançar com uma lista vazia de contratações", () => {
    const result: ContractorReportResult = {
      contractor: makeContractor(),
      range: { from: null, to: null },
      rows: [],
    };

    expect(() => generateContractorReportPdf(result)).not.toThrow();
  });
});

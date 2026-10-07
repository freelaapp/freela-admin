import { describe, expect, it } from "vitest";
import type { FilterEntry } from "./engagement-filters";
import {
  cityTable,
  contractorListSheets,
  contractorReportTables,
  freelancerDetailSheets,
  freelancerListSheets,
  overviewSheets,
  overviewSummaryTables,
} from "./engagement-export";
import {
  SAMPLE_CONTRACTOR_DETAIL,
  SAMPLE_CONTRACTOR_ROW,
  SAMPLE_FREELANCER_DETAIL,
  SAMPLE_FREELANCER_ROW,
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_BEFORE_MEASUREMENT,
} from "./engagement.test-fixtures";

const NOW = new Date("2026-10-07T15:00:00.000Z");
const ENTRIES: FilterEntry[] = [
  { label: "Período", value: "01/09/2026 a 30/09/2026" },
  { label: "Cidade", value: "Todas" },
];
const plain = (s: unknown) => String(s).replace(/ /g, " ");
const find = (rows: unknown[][], first: string, second?: string) =>
  rows.find((r) => r[0] === first && (second === undefined || r[1] === second));

describe("Excel do painel", () => {
  it("4 abas e filtros com a data de geração em Brasília", () => {
    const sheets = overviewSheets(SAMPLE_OVERVIEW, ENTRIES, NOW);
    expect(sheets.map((s) => s.name)).toEqual(["Filtros", "Resumo", "Série", "Cidades"]);
    expect(sheets[0].rows).toContainEqual(["Período", "01/09/2026 a 30/09/2026"]);
    expect(sheets[0].rows).toContainEqual(["Comparado com", "02/08/2026 a 31/08/2026"]);
    expect(sheets[0].rows).toContainEqual(["Gerado em", "07/10/2026 12:00"]);
  });

  it("Resumo: número fica número; variação em %", () => {
    const resumo = overviewSheets(SAMPLE_OVERVIEW, ENTRIES, NOW)[1].rows;
    expect(resumo[0]).toEqual(["Grupo", "Indicador", "Atual", "Anterior", "Variação (%)"]);
    expect(find(resumo, "Vagas", "Vagas publicadas")).toEqual(["Vagas", "Vagas publicadas", 3, 1, 200]);
    expect(find(resumo, "Vagas", "Vagas com candidato (%)")).toEqual([
      "Vagas",
      "Vagas com candidato (%)",
      66.7,
      100,
      -33.3,
    ]);
  });

  it("antes da medição: aberturas ficam VAZIAS (null), nunca 0", () => {
    const sheets = overviewSheets(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT, ENTRIES, NOW);
    expect(find(sheets[1].rows, "Freelancers", "Abriram o app ou site")).toEqual([
      "Freelancers",
      "Abriram o app ou site",
      null,
      null,
      null,
    ]);
    expect(sheets[2].rows).toHaveLength(31);
    expect(sheets[2].rows[1]).toEqual(["01/09/2026", 0, 0, 0, null, null]);
    expect(sheets[3].rows[1]).toEqual(["Juiz de Fora", "MG", 3, 2, 0.67, null]);
  });
});

describe("Excel das listas", () => {
  it("lista de freelancers com contato e link do WhatsApp", () => {
    const page = { rows: [SAMPLE_FREELANCER_ROW], total: 1, page: 1, limit: 20000, truncated: false };
    const [filtros, lista] = freelancerListSheets(page, ENTRIES, "Abriram e não se candidataram", NOW);
    expect(filtros.rows).toContainEqual(["Segmento", "Abriram e não se candidataram"]);
    expect(filtros.rows.some((r) => r[0] === "Atenção")).toBe(false);
    expect(lista.rows[0].slice(0, 4)).toEqual(["Nome", "Telefone", "WhatsApp", "E-mail"]);
    expect(lista.rows[1].slice(0, 4)).toEqual([
      "Ana Souza",
      "(32) 99876-5432",
      "https://wa.me/5532998765432",
      "ana@exemplo.com",
    ]);
  });

  it("corte da exportação vira aviso na aba Filtros", () => {
    const page = { rows: [SAMPLE_CONTRACTOR_ROW], total: 25000, page: 1, limit: 20000, truncated: true };
    const [filtros, lista] = contractorListSheets(page, ENTRIES, "Todas", NOW);
    expect(plain(find(filtros.rows, "Atenção")?.[1])).toContain("25.000");
    expect(lista.rows[0].slice(0, 2)).toEqual(["Empresa", "CNPJ"]);
    expect(lista.rows[1][1]).toBe("12.345.678/0001-90");
  });
});

describe("Excel da ficha", () => {
  it("resumo, números com anterior e candidaturas", () => {
    const [, resumo, cands] = freelancerDetailSheets(SAMPLE_FREELANCER_DETAIL, ENTRIES, NOW);
    expect(resumo.rows).toContainEqual(["Status", "Esfriando"]);
    expect(resumo.rows).toContainEqual(["Candidaturas", 2, 1, 100]);
    expect(cands.rows[1]).toEqual([
      "05/09/2026",
      "06/09/2026",
      "Bar do Zé",
      "Garçom para sábado",
      "Empresa",
      "Aceita",
      "Sim",
    ]);
  });
});

describe("tabelas do PDF", () => {
  it("antes da medição: '—' nas aberturas (nunca '0')", () => {
    const [freelas] = overviewSummaryTables(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT);
    expect(freelas.rows.find((r) => r[0] === "Abriram o app ou site")).toEqual([
      "Abriram o app ou site",
      "—",
      "—",
      "—",
    ]);
    expect(cityTable(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT).rows[0]).toEqual([
      "Juiz de Fora - MG",
      "3",
      "2",
      "0,67",
      "—",
    ]);
  });

  it("relatório do cliente: números e vagas, sem contato nem documento", () => {
    const { numbers, vacancies } = contractorReportTables(SAMPLE_CONTRACTOR_DETAIL);
    expect(numbers.rows.map((r) => r[0])).toEqual([
      "Vagas publicadas",
      "Vagas concluídas",
      "Vagas canceladas",
      "Vagas sem candidato",
      "Candidaturas recebidas",
      "Candidaturas por vaga",
      "Freelancers contratados",
      "Valor contratado",
    ]);
    expect(plain(numbers.rows[7][1])).toBe("R$ 360,00");
    expect(vacancies.rows[0]).toEqual(["06/09/2026", "Garçom para sábado", "Juiz de Fora", "1", "Concluída", "Ana"]);
    expect(vacancies.rows[2]).toEqual(["20/09/2026", "Barman", "Juiz de Fora", "0", "Cancelada pela empresa", "—"]);
    const all = JSON.stringify({ numbers, vacancies });
    const s = SAMPLE_CONTRACTOR_DETAIL.summary;
    for (const secret of [s.phone, s.email, s.document]) expect(all).not.toContain(String(secret));
  });
});

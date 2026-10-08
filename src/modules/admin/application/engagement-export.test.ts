import { describe, expect, it } from "vitest";
import type { FilterEntry } from "./engagement-filters";
import {
  INDICATOR_HEAD,
  cityTable,
  contractorListSheets,
  contractorReportTables,
  freelancerDetailSheets,
  freelancerListSheets,
  indicatorPdfTables,
  overviewSheets,
} from "./engagement-export";
import {
  SAMPLE_CONTRACTOR_DETAIL,
  SAMPLE_CONTRACTOR_ROW,
  SAMPLE_FREELANCER_DETAIL,
  SAMPLE_FREELANCER_ROW,
  SAMPLE_OVERVIEW,
  SAMPLE_OVERVIEW_BEFORE_MEASUREMENT,
  SAMPLE_OVERVIEW_WITHOUT_INDICATORS,
} from "./engagement.test-fixtures";

const NOW = new Date("2026-10-07T15:00:00.000Z");
const ENTRIES: FilterEntry[] = [
  { label: "Período", value: "01/09/2026 a 30/09/2026" },
  { label: "Cidade", value: "Todas" },
];
const plain = (s: unknown) => String(s).replace(/ /g, " ");
const find = (rows: unknown[][], first: string, second?: string) =>
  rows.find((r) => r[0] === first && (second === undefined || r[1] === second));

const ACCESS_SOURCE = 'Registro de acessos (medido desde 07/10/2026; antes disso aparece "—")';

describe("Excel do painel", () => {
  it("5 abas e filtros com a data de geração em Brasília", () => {
    const sheets = overviewSheets(SAMPLE_OVERVIEW, ENTRIES, NOW);
    expect(sheets.map((s) => s.name)).toEqual(["Filtros", "Contratante", "Freelancer", "Série", "Cidades"]);
    expect(sheets[0].rows).toContainEqual(["Período", "01/09/2026 a 30/09/2026"]);
    expect(sheets[0].rows).toContainEqual(["Comparado com", "02/08/2026 a 31/08/2026"]);
    expect(sheets[0].rows).toContainEqual(["Gerado em", "07/10/2026 12:00"]);
  });

  it("indicadores: as 6 colunas, número fica número, parcelas, conta e fonte", () => {
    const [, contratante, freelancer] = overviewSheets(SAMPLE_OVERVIEW, ENTRIES, NOW);
    expect(contratante.rows[0]).toEqual(["Indicador", "Período", "Anterior", "Parcelas", "Como calcular", "Fonte"]);
    expect(contratante.rows).toHaveLength(11);
    expect(find(contratante.rows, "Abriu a 1ª vaga (%)")).toEqual([
      "Abriu a 1ª vaga (%)",
      40,
      33.3,
      "Período: 2 de 5 cadastrados · Anterior: 1 de 3 cadastrados",
      "% dos cadastrados no período que já abriram ao menos 1 vaga (até hoje)",
      "Cadastros do período × vagas abertas por eles (qualquer data)",
    ]);
    expect(find(contratante.rows, "Tempo até a 1ª vaga (dias)")?.slice(1, 4)).toEqual([
      4.5,
      2,
      "Período: entre 2 que abriram · Anterior: entre 1 que abriu",
    ]);
    // Dinheiro em reais; contagem sem conta deixa "Parcelas" vazia.
    expect(find(contratante.rows, "Faturamento (R$)")?.slice(1, 4)).toEqual([360, 180, null]);
    expect(find(contratante.rows, "Receita do Freela (R$)")?.slice(1, 3)).toEqual([72, 36]);
    expect(find(contratante.rows, "Acessou")?.[5]).toBe(
      'Registro de acessos (medido desde 20/07/2026; antes disso aparece "—")',
    );
    expect(freelancer.rows).toHaveLength(7);
    expect(find(freelancer.rows, "Serviços por freela")?.slice(1, 4)).toEqual([
      1.5,
      1,
      "Período: 3 serviços ÷ 2 freelas que trabalharam · Anterior: 1 serviço ÷ 1 freela que trabalhou",
    ]);
    expect(find(freelancer.rows, "Voltou")?.slice(1, 4)).toEqual([
      1,
      0,
      "Período: 1 de 1 que trabalhou antes (100%) · Anterior: 0 de 0 que trabalharam no período antes do anterior",
    ]);
  });

  it("sem o bloco indicators (API antiga): as abas trazem o aviso, sem quebrar", () => {
    const sheets = overviewSheets(SAMPLE_OVERVIEW_WITHOUT_INDICATORS, ENTRIES, NOW);
    expect(sheets.map((s) => s.name)).toEqual(["Filtros", "Contratante", "Freelancer", "Série", "Cidades"]);
    expect(sheets[1].rows).toEqual([INDICATOR_HEAD, ["Indicadores atualizando — publique a API"]]);
    expect(sheets[2].rows).toEqual([INDICATOR_HEAD, ["Indicadores atualizando — publique a API"]]);
  });

  it("antes da medição: acessos ficam VAZIOS (null), nunca 0", () => {
    const sheets = overviewSheets(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT, ENTRIES, NOW);
    expect(find(sheets[1].rows, "Acessou")).toEqual([
      "Acessou",
      null,
      null,
      "Período: sem medição neste período · Anterior: sem medição neste período",
      "Quantos entraram no app ou no site no período",
      ACCESS_SOURCE,
    ]);
    expect(sheets[3].rows).toHaveLength(31);
    expect(sheets[3].rows[1]).toEqual(["01/09/2026", 0, 0, 0, null, null]);
    expect(sheets[4].rows[1]).toEqual(["Juiz de Fora", "MG", 3, 2, 0.67, null]);
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
  it("indicadores: valor, anterior com a variação, parcelas, conta e fonte", () => {
    const [contratante, freelancer] = indicatorPdfTables(SAMPLE_OVERVIEW);
    expect(contratante.title).toBe("Contratante");
    expect(contratante.head).toEqual(INDICATOR_HEAD);
    const row = (label: string) => contratante.rows.find((r) => r[0] === label)?.map(plain);
    expect(row("Abriu a 1ª vaga")?.slice(0, 4)).toEqual([
      "Abriu a 1ª vaga",
      "40%",
      "33,3% (+20%)",
      "Período: 2 de 5 cadastrados · Anterior: 1 de 3 cadastrados",
    ]);
    expect(row("Tempo até a 1ª vaga")?.slice(1, 3)).toEqual(["4,5 dias", "2 dias (+125%)"]);
    expect(row("Vagas por contratante ativo")?.slice(1, 3)).toEqual(["1,50", "1,00 (+50%)"]);
    expect(row("Faturamento")?.slice(1, 4)).toEqual(["R$ 360,00", "R$ 180,00 (+100%)", ""]);
    // Anterior 0: sem % (não há base).
    expect(row("Voltou")?.slice(1, 3)).toEqual(["1", "0"]);
    expect(freelancer.rows.map((r) => r[0])).toEqual([
      "Cadastrou",
      "Ativo",
      "Candidaturas por freela ativo",
      "Serviços por freela",
      "Candidatou e não trabalhou",
      "Voltou",
    ]);
    expect(freelancer.rows[0].slice(1, 3)).toEqual(["1.250", "12 (+10.317%)"]);
  });

  it("sem o bloco indicators: nenhuma tabela (o PDF escreve o aviso)", () => {
    expect(indicatorPdfTables(SAMPLE_OVERVIEW_WITHOUT_INDICATORS)).toEqual([]);
  });

  it("antes da medição: '—' nos acessos (nunca '0')", () => {
    const [contratante] = indicatorPdfTables(SAMPLE_OVERVIEW_BEFORE_MEASUREMENT);
    expect(contratante.rows.find((r) => r[0] === "Acessou")).toEqual([
      "Acessou",
      "—",
      "—",
      "Período: sem medição neste período · Anterior: sem medição neste período",
      "Quantos entraram no app ou no site no período",
      ACCESS_SOURCE,
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

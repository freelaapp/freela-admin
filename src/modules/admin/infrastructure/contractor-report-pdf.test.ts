import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ContractorReportResult, ContractorReportRow } from "./admin-api"

// Captura tudo que o gerador escreve no PDF: o teste confere o TEXTO das
// células (o que o cliente lê e soma), não a renderização.
const { textCalls } = vi.hoisted(() => ({
  textCalls: [] as { text: string; x: number; y: number }[],
}))

vi.mock("jspdf", () => {
  class FakeJsPDF {
    text(text: string, x: number, y: number) {
      textCalls.push({ text, x, y })
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
      return 1
    }
    getTextWidth() {
      return 0
    }
    save() {}
  }
  return { jsPDF: FakeJsPDF }
})

import { generateContractorReportPdf } from "./contractor-report-pdf"

// Posição x (borda direita) das colunas numéricas: COLS[i].x + w − 1.
const X_REPASSE = 174 + 34 - 1
const X_TAXA = 208 + 30 - 1
const X_PAGO = 238 + 47 - 1

const cents = (s: string) => {
  const n = s.replace(/[^\d,]/g, "").replace(",", ".")
  return n ? Math.round(parseFloat(n) * 100) : null
}

/** Linhas (dados + TOTAIS) com as 3 colunas numéricas lidas de volta em centavos. */
function numericRows() {
  const byY = new Map<number, Map<number, string>>()
  for (const c of textCalls) {
    if (!byY.has(c.y)) byY.set(c.y, new Map())
    byY.get(c.y)!.set(c.x, c.text)
  }
  return [...byY.values()]
    // cabeçalho da tabela (repetido a cada página) também cai nessas colunas
    .filter((m) => m.has(X_PAGO) && m.get(X_PAGO) !== "Valor pago")
    .map((m) => ({
      repasse: cents(m.get(X_REPASSE) ?? ""),
      taxa: cents(m.get(X_TAXA) ?? ""),
      pago: cents(m.get(X_PAGO) ?? ""),
      pagoText: m.get(X_PAGO) ?? "",
    }))
}

const allText = () => textCalls.map((c) => c.text).join("\n")

const contractor: ContractorReportResult["contractor"] = {
  id: "ct-1",
  companyName: "COCO BAMBU OSASCO",
  cnpj: null,
  contactName: "Gerente",
  contactEmail: null,
  contactPhone: null,
  city: "Osasco",
  uf: "SP",
  createdAt: "2026-06-10T00:00:00.000Z",
}

function row(over: Partial<ContractorReportRow>): ContractorReportRow {
  return {
    vacancy_id: "v1",
    title: "Garçom",
    vacancy_service: "garcom",
    vacancy_status: "CLOSED",
    date: "2026-08-11",
    start_time: null,
    end_time: null,
    created_at: "2026-08-01T00:00:00.000Z",
    base_amount_in_cents: 12600,
    freelancer_amount_in_cents: 10080,
    platform_fee_in_cents: 2520,
    provides_meal: null,
    contractor_payment: { status: "COMPLETED", value: 12155 },
    wallet_refund_in_cents: 0,
    candidacy_id: "c1",
    candidacy_status: "ACCEPTED",
    freelancer_name: "Ana",
    freelancer_email: null,
    freelancer_phone: null,
    freelancer_cpf_casa: null,
    candidacy_role: "Garçom",
    repasse: { amount: 10080, status: "COMPLETED", pixKey: null, pixKeyType: null, confirmedAt: null },
    ...over,
  }
}

describe("generateContractorReportPdf — estorno à carteira", () => {
  beforeEach(() => {
    textCalls.length = 0
  })

  it(`"Valor pago" sai líquido do estorno e repasse + taxa = valor pago em cada linha e nos totais`, () => {
    // Coco Bambu Osasco: corte por atraso devolve R$ 5,60 à carteira; R$ 4,48
    // saem do freelancer (repasse 96,32) e R$ 1,12 da nossa taxa.
    generateContractorReportPdf({
      contractor,
      range: { from: null, to: null },
      rows: [
        row({
          vacancy_id: "v1",
          date: "2026-08-11",
          wallet_refund_in_cents: 560,
          repasse: { amount: 9632, status: "COMPLETED", pixKey: null, pixKeyType: null, confirmedAt: null },
        }),
        row({ vacancy_id: "v2", date: "2026-08-12", candidacy_id: "c2", freelancer_name: "Bia" }),
      ],
    })

    const rows = numericRows()
    expect(rows).toHaveLength(3) // 2 vagas + TOTAIS
    for (const r of rows) {
      expect(r.repasse! + r.taxa!).toBe(r.pago)
    }

    const [v1, v2, totais] = rows
    expect(v1.pagoText).toBe("R$ 115,95†") // 121,55 − 5,60, marcado
    expect(v1.taxa).toBe(1963) // 115,95 − 96,32
    expect(v2.pagoText).toBe("R$ 121,55") // sem estorno, sem marcador
    expect(v2.taxa).toBe(2075)
    expect(totais.pago).toBe(11595 + 12155)
    expect(totais.repasse).toBe(9632 + 10080)
    expect(totais.taxa).toBe(1963 + 2075)

    const text = allText()
    expect(text).toContain("† Valor pago líquido de R$ 5,60 estornados à carteira (corte por atraso/ajuste).")
    expect(text).toContain("Taxa = valor pago líquido de estornos - repasse")
  })

  it("sem estorno (ou campo ausente, API antiga): sem marcador † e sem rodapé de estorno", () => {
    const semCampo = row({}) as Partial<ContractorReportRow>
    delete semCampo.wallet_refund_in_cents
    generateContractorReportPdf({
      contractor,
      range: { from: null, to: null },
      rows: [semCampo as ContractorReportRow, row({ vacancy_id: "v2", wallet_refund_in_cents: null })],
    })

    const rows = numericRows()
    expect(rows).toHaveLength(3)
    for (const r of rows) expect(r.repasse! + r.taxa!).toBe(r.pago)
    expect(rows[0].pagoText).toBe("R$ 121,55")
    expect(rows[2].pago).toBe(12155 * 2)
    expect(allText()).not.toContain("†")
  })

  it(`estorno só desconta de pagamento LIQUIDADO: cobrança pendente continua sem "Valor pago"`, () => {
    generateContractorReportPdf({
      contractor,
      range: { from: null, to: null },
      rows: [row({ contractor_payment: { status: "PENDING", value: 12155 }, wallet_refund_in_cents: 560 })],
    })

    const rows = numericRows()
    expect(rows[0].pagoText).toBe("—")
    expect(rows[0].taxa).toBeNull()
    expect(rows[rows.length - 1].pago).toBe(0) // TOTAIS
    expect(allText()).not.toContain("†")
  })

  // A fonte padrão do jsPDF (WinAnsi) não tem o sinal de menos U+2212: no PDF do
  // Coco Bambu Osasco (25/08) a legenda saiu como `Taxa = valor pago " repasse`.
  it("legenda e células não usam glifos fora da fonte padrão", () => {
    textCalls.length = 0
    generateContractorReportPdf({
      contractor,
      range: { from: null, to: null },
      rows: [row({ wallet_refund_in_cents: 245 })],
    })
    const todos = allText()
    expect(todos).not.toMatch(/[\u2212]/)
    expect(todos).toMatch(/Taxa = valor pago l[ií]quido de estornos - repasse/)
  })
})

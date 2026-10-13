import type {
  AdminInvoiceListItem,
  BillingSummary,
  SummaryCard,
} from "../infrastructure/billing-api";

/** Dados de teste da aba Faturas (UX 7): hoje = ter 20/10/2026. */
const card = (over: Partial<SummaryCard>): SummaryCard => ({
  label: "",
  valueInCents: 0,
  count: 0,
  calc: "",
  source: "",
  meta: "",
  help: "",
  ...over,
});

export const SUMMARY: BillingSummary = {
  period: { preset: "this_month", start: "", end: "", label: "outubro/2026" },
  generatedAt: "2026-10-20T12:00:00.000Z",
  cards: {
    upcoming: {
      ...card({
        label: "A receber: faturas a vencer",
        valueInCents: 341290,
        count: 4,
        calc: "soma do total de 4 faturas emitidas com vencimento hoje ou depois = R$ 3.412,90",
        source: "Faturas emitidas (ISSUED) com vencimento em ou depois de hoje, em Brasília.",
        meta: "4 faturas · a próxima vence seg 26/10",
        help: "Soma do total das faturas emitidas que ainda não venceram.",
      }),
      nextDueDate: "2026-10-26",
    },
    overdue: {
      ...card({
        label: "Vencido",
        valueInCents: 124860,
        count: 1,
        calc: "soma do total de 1 fatura vencida (1 empresa) = R$ 1.248,60",
        source: "Faturas emitidas (ISSUED), não pagas, com vencimento antes de hoje, em Brasília.",
        meta: "1 fatura · 1 empresa · a mais antiga há 1 dia",
        help: "Faturas emitidas, não pagas, com vencimento antes de hoje.",
      }),
      companies: 1,
      oldestDays: 1,
    },
    blockedCompanies: {
      ...card({
        label: "Empresas bloqueadas",
        count: 0,
        calc: "bloqueio desligado: 0 empresas",
        source: "Faturas emitidas com o bloqueio em vigor agora.",
        meta: "R$ 0,00 em faturas bloqueadas",
        help: "Empresas com fatura vencida desde o 4º dia.",
      }),
      blockEnabled: false,
    },
    received: {
      ...card({
        label: "Recebido no período",
        valueInCents: 873015,
        count: 9,
        calc: "Pix R$ 8.730,15 (9) + baixa manual R$ 0,00 (0) = R$ 8.730,15",
        source: "Faturas pagas (PAID) com data de pagamento em outubro/2026.",
        meta: "9 faturas pagas em outubro/2026: Pix R$ 8.730,15 + baixa manual R$ 0,00",
        help: "Soma do valor pago das faturas com data de pagamento no período (Brasília).",
      }),
      pix: { count: 9, valueInCents: 873015 },
      manual: { count: 0, valueInCents: 0 },
    },
    unbilled: {
      ...card({
        label: "Ainda não faturado",
        valueInCents: 210540,
        count: 17,
        calc: "soma, por empresa, de máx(débitos − créditos, 0) das linhas sem fatura = R$ 2.105,40",
        source: "Livro do faturado: linhas ainda sem fatura.",
        meta: "17 serviços realizados, aguardando o próximo fechamento",
        help: "Serviços realizados e confirmados que ainda não entraram em nenhuma fatura.",
      }),
      companies: 3,
      lineCount: 19,
    },
    advanced: {
      ...card({
        label: "Adiantado aos freelancers, ainda não recebido",
        valueInCents: 523170,
        count: 30,
        calc: "repasses pagos em vagas faturadas R$ 9.000,00 (40) − já cobertos por fatura paga R$ 3.768,30 (10) = R$ 5.231,70",
        source: "Repasses concluídos de vagas com pagamento faturado (INVOICE).",
        meta: "repasses já pagos de serviços faturados − faturas pagas",
        help: "Dinheiro que o Freela já pagou aos freelancers em vagas faturadas.",
      }),
      frontedInCents: 900000,
      frontedCount: 40,
      coveredInCents: 376830,
      coveredCount: 10,
    },
  },
  receivableTotal: {
    label: "A receber no total",
    valueInCents: 676690,
    calc: "a vencer R$ 3.412,90 + vencido R$ 1.248,60 + ainda não faturado R$ 2.105,40 = R$ 6.766,90",
    source: "Faturas emitidas e não pagas (a vencer e vencidas) mais as linhas do livro ainda sem fatura.",
  },
  doublePayments: { count: 0, text: null, calc: "", source: "", latest: [] },
};

export const OVERDUE_INVOICE: AdminInvoiceListItem = {
  id: "inv-123",
  number: "FAT-2026-000123",
  company: { contractorUserId: "owner-1", name: "Bar do Zé", document: "12345678000190" },
  mode: "INVOICED_7",
  modeLabel: "Faturado semanal",
  periodStart: "2026-10-09",
  periodEnd: "2026-10-15",
  closedAt: "2026-10-16T11:00:00.000Z",
  dueDate: "2026-10-19",
  totalInCents: 124860,
  total: "R$ 1.248,60",
  status: "ISSUED",
  situation: { code: "VENCIDA", label: "Vencida há 1 dia", overdueDays: 1, waivedUntil: null },
  paidAt: null,
  paidVia: null,
  lastMessage: {
    step: "D_PLUS_1",
    label: "D+1",
    at: "2026-10-20T12:00:00.000Z",
    by: "SYSTEM",
    channels: { push: "sent", email: "sent", whatsapp: "skipped:not_enabled" },
  },
};

export const PAID_INVOICE: AdminInvoiceListItem = {
  ...OVERDUE_INVOICE,
  id: "inv-118",
  number: "FAT-2026-000118",
  company: { contractorUserId: "owner-2", name: "Rede X", document: "98765432000110" },
  mode: "INVOICED_15",
  modeLabel: "Faturado quinzenal",
  status: "PAID",
  situation: { code: "PAGA", label: "Paga em 05/10", overdueDays: 0, waivedUntil: null },
  paidAt: "2026-10-05T15:00:00.000Z",
  paidVia: "PIX",
  lastMessage: null,
};


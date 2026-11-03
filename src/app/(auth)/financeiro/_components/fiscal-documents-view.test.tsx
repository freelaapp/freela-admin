import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/modules/admin/infrastructure/fiscal-documents-api", () => ({
  listAdminFiscalDocuments: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/billing-api", () => ({
  reissueInvoiceNfse: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/vacancy-documents-api", () => ({
  reissueVacancyNfse: vi.fn(),
}));

import { toast } from "sonner";
import { reissueInvoiceNfse } from "@/modules/admin/infrastructure/billing-api";
import {
  listAdminFiscalDocuments,
  type FiscalDocumentItem,
  type FiscalDocumentList,
} from "@/modules/admin/infrastructure/fiscal-documents-api";
import { reissueVacancyNfse } from "@/modules/admin/infrastructure/vacancy-documents-api";
import { FiscalDocumentsView, sinceKey } from "./fiscal-documents-view";

function apiError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("falhou", String(status), config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: { error: { code: "X", message: "X" } },
  });
}

const doc = (over: Partial<FiscalDocumentItem> = {}): FiscalDocumentItem => ({
  id: "fd-inv",
  kind: "INVOICE",
  kindLabel: "Fatura (faturado)",
  status: "FAILED",
  statusLabel: "Recusada",
  number: null,
  failureReason: "E160 IBS/CBS: informe o cClassTrib",
  pdfUrl: null,
  company: { contractorUserId: "u-1", name: "Coco Bambu Jundiaí" },
  subject: {
    invoiceId: "inv-1",
    invoiceNumber: "FAT-2026-000120",
    invoiceStatus: "PAID",
    vacancyId: null,
    vacancyTitle: null,
    subscriptionChargeId: null,
    label: "Fatura FAT-2026-000120",
  },
  amount: {
    inCents: 12481,
    formatted: "R$ 124,81",
    calc: "taxa R$ 124,81 = R$ 124,81",
    source: "Valor da nota da fatura: a taxa da Freela nos serviços da fatura.",
  },
  issuedAt: null,
  createdAt: "2026-10-30T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
  reissue: { via: "INVOICE", enabled: true, reason: null },
  ...over,
});

const LIST = (items: FiscalDocumentItem[], over: Partial<FiscalDocumentList> = {}): FiscalDocumentList => ({
  items,
  page: 1,
  pageSize: 30,
  total: items.length,
  hasMore: false,
  since: "2026-10-20",
  summary: {
    total: {
      count: 4,
      label: "Notas no período",
      calc: "na prefeitura 1 + emitida 2 + recusada 1 = 4 (notas de fatura, vaga e mensalidade com mudança desde 20/10/2026)",
      source: "Notas fiscais (NFS-e) registradas pela Freela (tabela shared.fiscal_documents).",
    },
    byStatus: [
      { status: "PENDING", label: "Na prefeitura", count: 1, calc: "1 = …na prefeitura", source: "fonte" },
      { status: "ISSUED", label: "Emitida", count: 2, calc: "2 = …emitida", source: "fonte" },
      { status: "FAILED", label: "Recusada", count: 1, calc: "1 = …recusada", source: "fonte" },
    ],
  },
  ...over,
});

const VACANCY_FAILED = doc({
  id: "fd-vac",
  kind: "VACANCY",
  kindLabel: "Vaga (pré-pago)",
  failureReason: "Contratante sem CPF/CNPJ no cadastro.",
  company: { contractorUserId: "u-2", name: "Bar do Zé" },
  subject: {
    invoiceId: null,
    invoiceNumber: null,
    invoiceStatus: null,
    vacancyId: "vac-9",
    vacancyTitle: "Garçom",
    subscriptionChargeId: null,
    label: "Vaga Garçom",
  },
  amount: { inCents: 3720, formatted: "R$ 37,20", calc: null, source: "taxa da vaga" },
  reissue: { via: "VACANCY", enabled: true, reason: null },
});
const ISSUED = doc({
  id: "fd-ok",
  kind: "SUBSCRIPTION",
  kindLabel: "Mensalidade (assinatura)",
  status: "ISSUED",
  statusLabel: "Emitida",
  number: "127",
  failureReason: null,
  pdfUrl: "https://nf.example/127.pdf",
  issuedAt: "2026-11-01T12:05:00.000Z",
  company: { contractorUserId: "u-3", name: "Spoleto Centro" },
  subject: { ...doc().subject, invoiceId: null, invoiceNumber: null, subscriptionChargeId: "ch-1", label: "Mensalidade do plano" },
  reissue: { via: null, enabled: false, reason: "A nota da mensalidade ainda não tem reemissão pelo painel." },
});

function renderView() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <FiscalDocumentsView />
    </QueryClientProvider>,
  );
}
const table = () => within(screen.getByTestId("data-table-desktop"));
const rowOf = (text: string) => table().getByText(text).closest("tr") as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listAdminFiscalDocuments).mockResolvedValue(LIST([doc(), VACANCY_FAILED, ISSUED]));
});

describe("FiscalDocumentsView — Financeiro > Notas fiscais", () => {
  it("abre nos últimos 14 dias (as recusadas antigas não poluem) e diz o período", async () => {
    renderView();

    await screen.findAllByText("Coco Bambu Jundiaí");
    expect(listAdminFiscalDocuments).toHaveBeenCalledWith({
      since: sinceKey(14),
      status: undefined,
      type: undefined,
      page: 1,
    });
    expect(
      screen.getByText(
        "Mostrando as notas com mudança (pedido, emissão, recusa ou reemissão) desde 20/10/2026.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Últimos 14 dias" })).toHaveAttribute("aria-pressed", "true");
  });

  it("cada contagem do topo diz o que é, com a conta e a fonte", async () => {
    renderView();

    const total = await screen.findByTestId("fiscal-kpi-total");
    expect(within(total).getByText("Notas no período")).toBeInTheDocument();
    expect(within(total).getByText("4")).toBeInTheDocument();
    expect(total).toHaveTextContent(
      "Conta: na prefeitura 1 + emitida 2 + recusada 1 = 4 (notas de fatura, vaga e mensalidade com mudança desde 20/10/2026)",
    );
    expect(total).toHaveTextContent("shared.fiscal_documents");
    expect(within(screen.getByTestId("fiscal-kpi-FAILED")).getByText("Recusada")).toBeInTheDocument();
  });

  it("a linha mostra número, empresa, valor com a conta, status, motivo da recusa, data e PDF", async () => {
    renderView();
    await screen.findAllByText("Coco Bambu Jundiaí");

    const failed = rowOf("Coco Bambu Jundiaí");
    expect(within(failed).getByText("Sem número")).toBeInTheDocument();
    expect(within(failed).getByText("Fatura (faturado)")).toBeInTheDocument();
    expect(within(failed).getByRole("link", { name: "Fatura FAT-2026-000120" })).toHaveAttribute(
      "href",
      "/financeiro/faturas/inv-1",
    );
    expect(within(failed).getByText("R$ 124,81")).toBeInTheDocument();
    expect(failed).toHaveTextContent("Conta: taxa R$ 124,81 = R$ 124,81");
    expect(within(failed).getByText("Motivo: E160 IBS/CBS: informe o cClassTrib")).toBeInTheDocument();

    const issued = rowOf("Spoleto Centro");
    expect(within(issued).getByText("nº 127")).toBeInTheDocument();
    expect(within(issued).getByText("Emitida")).toBeInTheDocument();
    expect(within(issued).getByRole("link", { name: "PDF" })).toHaveAttribute("href", "https://nf.example/127.pdf");
    expect(within(issued).queryByRole("button", { name: "Reemitir nota" })).not.toBeInTheDocument();
  });

  it("filtro de status e de período mandam para a API e voltam para a página 1", async () => {
    renderView();
    await screen.findAllByText("Coco Bambu Jundiaí");

    fireEvent.click(screen.getByRole("button", { name: "Recusadas" }));
    await waitFor(() =>
      expect(listAdminFiscalDocuments).toHaveBeenLastCalledWith({
        since: sinceKey(14),
        status: "FAILED",
        type: undefined,
        page: 1,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Últimos 90 dias" }));
    await waitFor(() =>
      expect(listAdminFiscalDocuments).toHaveBeenLastCalledWith(
        expect.objectContaining({ since: sinceKey(90), status: "FAILED" }),
      ),
    );
    fireEvent.change(screen.getByLabelText("De onde é a nota"), { target: { value: "VACANCY" } });
    await waitFor(() =>
      expect(listAdminFiscalDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ type: "VACANCY" })),
    );
  });

  it("reemitir a nota da fatura pede o motivo e usa a rota da fatura", async () => {
    vi.mocked(reissueInvoiceNfse).mockResolvedValue({ status: "PENDING", number: null, failureReason: null });
    renderView();
    await screen.findAllByText("Coco Bambu Jundiaí");

    fireEvent.click(within(rowOf("Coco Bambu Jundiaí")).getByRole("button", { name: "Reemitir nota" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("E160 IBS/CBS: informe o cClassTrib")).toBeInTheDocument();
    const submit = within(dialog).getByRole("button", { name: "Reemitir nota" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Motivo (obrigatório)"), {
      target: { value: "Contador mandou os códigos" },
    });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(reissueInvoiceNfse).toHaveBeenCalledWith("inv-1", { reason: "Contador mandou os códigos" }),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Nota enviada à prefeitura. A resposta chega em alguns minutos."),
    );
  });

  it("reemitir a nota da vaga usa a rota da vaga (sem motivo)", async () => {
    vi.mocked(reissueVacancyNfse).mockResolvedValue({
      status: "FAILED",
      number: null,
      failureReason: "CNPJ inválido",
    });
    renderView();
    await screen.findAllByText("Bar do Zé");

    fireEvent.click(within(rowOf("Bar do Zé")).getByRole("button", { name: "Reemitir nota" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText("Motivo (obrigatório)")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Reemitir nota" }));

    await waitFor(() => expect(reissueVacancyNfse).toHaveBeenCalledWith("vac-9"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A prefeitura recusou de novo: CNPJ inválido"));
  });

  it("recusada sem rota de reemissão: diz por quê, sem botão", async () => {
    vi.mocked(listAdminFiscalDocuments).mockResolvedValue(
      LIST([{ ...ISSUED, status: "FAILED", statusLabel: "Recusada", failureReason: "x" }]),
    );
    renderView();
    await screen.findAllByText("Spoleto Centro");

    const row = rowOf("Spoleto Centro");
    expect(within(row).getByText("A nota da mensalidade ainda não tem reemissão pelo painel.")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Reemitir nota" })).not.toBeInTheDocument();
  });

  it("vazio: diz o período e os filtros, nunca uma tabela em branco", async () => {
    vi.mocked(listAdminFiscalDocuments).mockResolvedValue(LIST([]));
    renderView();

    expect(
      await screen.findByText(
        "Nenhuma nota com mudança (pedido, emissão, recusa ou reemissão) desde 20/10/2026 com estes filtros.",
      ),
    ).toBeInTheDocument();
  });

  it("404 (API ainda sem a rota): aviso calmo, não erro", async () => {
    vi.mocked(listAdminFiscalDocuments).mockRejectedValue(apiError(404));
    renderView();

    expect(
      await screen.findByText("A lista de notas fiscais ainda não está disponível neste ambiente."),
    ).toBeInTheDocument();
  });

  it("erro: 'Tentar de novo', nunca zero", async () => {
    vi.mocked(listAdminFiscalDocuments).mockRejectedValue(apiError(400));
    renderView();

    expect(await screen.findByText("Não conseguimos carregar as notas fiscais.")).toBeInTheDocument();
    expect(screen.queryByTestId("fiscal-kpi-total")).not.toBeInTheDocument();
  });
});

describe("sinceKey", () => {
  it("hoje − N dias no calendário de Brasília", () => {
    // 03/11 01:00 em Brasília (04:00 UTC): ainda dia 03.
    expect(sinceKey(14, new Date("2026-11-03T04:00:00.000Z"))).toBe("2026-10-20");
    // 02/11 23:30 em Brasília (03/11 02:30 UTC): ainda dia 02.
    expect(sinceKey(1, new Date("2026-11-03T02:30:00.000Z"))).toBe("2026-11-01");
  });
});

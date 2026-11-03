import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/modules/admin/infrastructure/billing-api", () => ({
  getBillingCompanies: vi.fn(),
  closeInvoiceNow: vi.fn(),
  listAdminInvoices: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/billing-mode-api", () => ({
  getBillingModeSettings: vi.fn(),
  updateBillingMode: vi.fn(),
}));
// A aba Cobrança tem testes próprios; aqui só importa abrir na aba certa, da empresa certa.
vi.mock("../../empresas/_components/preferences-dialog", () => ({
  PreferencesDialog: (props: { companyName: string; initialTab?: string; companyDocument?: string | null }) => (
    <div data-testid="preferences">{`${props.companyName} · ${props.initialTab} · ${props.companyDocument}`}</div>
  ),
}));

import { COMPANIES, VALINHOS } from "@/modules/admin/application/billing.test-fixtures";
import { toast } from "sonner";
import {
  closeInvoiceNow,
  getBillingCompanies,
  listAdminInvoices,
} from "@/modules/admin/infrastructure/billing-api";
import { getBillingModeSettings } from "@/modules/admin/infrastructure/billing-mode-api";
import { BillingCompaniesView } from "./billing-companies-view";

function apiError(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("falhou", String(status), config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: { error: { code, message: code } },
  });
}

function renderView(onSeeInvoices = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <BillingCompaniesView onSeeInvoices={onSeeInvoices} />
    </QueryClientProvider>,
  );
  return { onSeeInvoices };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBillingCompanies).mockResolvedValue(COMPANIES);
});

describe("BillingCompaniesView — o relato do dono (15/10)", () => {
  it("as empresas do faturado aparecem pelo nome e CNPJ, antes de qualquer fatura", async () => {
    renderView();

    // Tabela (desktop) e cartão (celular) mostram a mesma empresa.
    expect(await screen.findAllByText("Chopp e Espeto Valinhos")).toHaveLength(2);
    expect(screen.getAllByText("Coco Bambu Jundiaí")).toHaveLength(2);
    expect(screen.getAllByText("CNPJ 12.345.678/0001-90")).toHaveLength(2);
    expect(screen.getAllByText("desde 15/10/2026")).not.toHaveLength(0);
    expect(screen.getAllByText("sex 16/10, 08:00 · vence seg 19/10")).not.toHaveLength(0);
    // O aviso de que o 1º fechamento ainda não tem o que cobrar.
    expect(screen.getAllByText(VALINHOS.nextClose!.note!)).not.toHaveLength(0);
    expect(screen.getAllByText("2 vagas · R$ 249,62")).toHaveLength(2);
    expect(screen.getAllByText("Em dia")).not.toHaveLength(0);
  });

  it("três cards no topo, com a conta e a fonte", async () => {
    renderView();

    const companies = await screen.findByTestId("companies-kpi-companies");
    expect(within(companies).getByText("Empresas no faturado")).toBeInTheDocument();
    expect(within(companies).getByText("2")).toBeInTheDocument();
    expect(companies).toHaveTextContent("Conta: semanal 2 + quinzenal 0 + mensal 0 = 2");
    const accepted = screen.getByTestId("companies-kpi-accepted");
    expect(within(accepted).getByText("R$ 249,62")).toBeInTheDocument();
    expect(accepted).toHaveTextContent("2 vagas · + 0 em conferência de presença (R$ 0,00)");
    expect(within(screen.getByTestId("companies-kpi-unbilled")).getByText("R$ 0,00")).toBeInTheDocument();
  });

  it("cada número da linha abre a conta e a fonte", async () => {
    renderView();

    await screen.findAllByText("Chopp e Espeto Valinhos");
    const table = screen.getByRole("table");
    const row = within(table).getByText("Chopp e Espeto Valinhos").closest("tr") as HTMLElement;
    expect(row).toHaveTextContent(`Conta: ${VALINHOS.acceptedUpcoming.calc}`);
    expect(row).toHaveTextContent(`Conta: ${VALINHOS.nextClose!.calc}`);
  });

  it("'Ver faturas' leva a empresa para a aba Faturas", async () => {
    const { onSeeInvoices } = renderView();

    await screen.findAllByText("Chopp e Espeto Valinhos");
    const table = screen.getByRole("table");
    const row = within(table).getByText("Chopp e Espeto Valinhos").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Ver faturas" }));

    expect(onSeeInvoices).toHaveBeenCalledWith({
      contractorUserId: "dono-valinhos",
      name: "Chopp e Espeto Valinhos",
    });
  });

  it("'Cobrança' (e o nome) abre Documentos e cobrança da empresa, já na aba Cobrança", async () => {
    renderView();

    await screen.findAllByText("Chopp e Espeto Valinhos");
    const table = screen.getByRole("table");
    const row = within(table).getByText("Coco Bambu Jundiaí").closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Cobrança" }));

    expect(screen.getByTestId("preferences")).toHaveTextContent(
      "Coco Bambu Jundiaí · cobranca · 98765432000110",
    );
  });
});

describe("BillingCompaniesView — estados", () => {
  it("vazio: diz onde ligar o faturado", async () => {
    vi.mocked(getBillingCompanies).mockResolvedValue({ ...COMPANIES, items: [] });
    renderView();

    expect(
      await screen.findByText(
        "Nenhuma empresa no faturado. Para ligar: Empresas > Documentos e cobrança > Cobrança.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("faturamento desligado no servidor: aviso, não lista vazia", async () => {
    vi.mocked(getBillingCompanies).mockResolvedValue({
      ...COMPANIES,
      invoicingEnabled: false,
      items: [],
    });
    renderView();

    expect(await screen.findByText("O faturamento está desligado no servidor.")).toBeInTheDocument();
  });

  it("erro: 'Não conseguimos carregar…' com 'Tentar de novo', nunca zero", async () => {
    vi.mocked(getBillingCompanies).mockRejectedValue(apiError(400, "BAD_REQUEST"));
    renderView();

    expect(
      await screen.findByText("Não conseguimos carregar as empresas faturadas."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Empresas no faturado")).not.toBeInTheDocument();
    vi.mocked(getBillingCompanies).mockResolvedValue(COMPANIES);
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findAllByText("Chopp e Espeto Valinhos")).toHaveLength(2);
  });

  it("403 (sem a permissão Financeiro): diz que não tem acesso, sem 'Tentar de novo'", async () => {
    vi.mocked(getBillingCompanies).mockRejectedValue(apiError(403, "FORBIDDEN"));
    renderView();

    expect(await screen.findByText("Você não tem acesso ao financeiro.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).not.toBeInTheDocument();
  });

  it("serviço sem desfecho há mais de 35 dias: à parte, em vermelho, com a conta pedindo o suporte", async () => {
    const stale = {
      valueInCents: 24962,
      count: 2,
      oldestEndDate: "2026-08-03",
      label: "2 vagas · R$ 249,62",
      calc: "2 serviços terminados há mais de 35 dias sem confirmação de presença nem cancelamento = R$ 249,62 (o mais antigo terminou seg 03/08); precisam de ação do suporte: confirmar a presença, ou cancelar a vaga para não cobrar",
      source: "Pagamentos faturados.",
    };
    vi.mocked(getBillingCompanies).mockResolvedValue({ ...COMPANIES, items: [{ ...VALINHOS, stale }] });
    renderView();

    await screen.findAllByText("Chopp e Espeto Valinhos");
    const row = within(screen.getByRole("table"))
      .getByText("Chopp e Espeto Valinhos")
      .closest("tr") as HTMLElement;
    expect(within(row).getByText("Sem desfecho há mais de 35 dias: 2 vagas · R$ 249,62")).toBeInTheDocument();
    expect(row).toHaveTextContent(`Conta: ${stale.calc}`);
  });

  it("404 (API anterior a esta aba): aviso calmo", async () => {
    vi.mocked(getBillingCompanies).mockRejectedValue(apiError(404, "NOT_FOUND"));
    renderView();

    expect(
      await screen.findByText("As empresas faturadas ainda não estão disponíveis neste ambiente."),
    ).toBeInTheDocument();
  });
});

describe("BillingCompaniesView — 'Fechar agora' na linha da empresa", () => {
  const openDialog = async () => {
    await screen.findAllByText("Chopp e Espeto Valinhos");
    const row = within(screen.getByRole("table"))
      .getByText("Chopp e Espeto Valinhos")
      .closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Fechar agora a fatura de Chopp e Espeto Valinhos" }));
    return screen.getByRole("dialog");
  };

  beforeEach(() => {
    vi.mocked(getBillingModeSettings).mockResolvedValue({
      openPreview: {
        lineCount: 3,
        debitsInCents: 45000,
        creditsInCents: 0,
        totalInCents: 45000,
        calc: "R$ 450,00 − R$ 0,00 = R$ 450,00",
      },
      extraordinaryInvoice: { closeDate: "2026-11-03", dueDate: "2026-11-06", blockFromDate: "2026-11-10" },
    } as never);
    // A fatura aberta foi cancelada: o período volta para depois da última que vale.
    vi.mocked(listAdminInvoices).mockResolvedValue({
      items: [
        { id: "inv-c", number: "FAT-2026-000120", status: "CANCELLED", periodStart: "2026-10-26", periodEnd: "2026-11-01" },
        { id: "inv-p", number: "FAT-2026-000101", status: "PAID", periodStart: "2026-10-19", periodEnd: "2026-10-25" },
      ] as never,
      page: 1,
      pageSize: 20,
      total: 2,
      hasMore: false,
    });
  });

  it("o diálogo diz o que fecha: valor, vencimento, período e a cancelada que não conta", async () => {
    renderView();
    const dialog = await openDialog();

    expect(
      await within(dialog).findByText(
        "Fechar agora uma fatura com os lançamentos ainda não faturados de Chopp e Espeto Valinhos (3 lançamentos, R$ 450,00)? Vence em sex 06/11.",
      ),
    ).toBeInTheDocument();
    expect(
      await within(dialog).findByText(
        "Período: seg 26/10 até hoje, ter 03/11. Começa no dia seguinte ao fim da FAT-2026-000101 (dom 25/10), a última fatura que vale.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "A fatura FAT-2026-000120 foi cancelada e não conta: os serviços dela voltam e entram nesta.",
      ),
    ).toBeInTheDocument();
    expect(listAdminInvoices).toHaveBeenCalledWith({ contractorUserId: "dono-valinhos" });
  });

  it("motivo com menos de 5 letras não deixa fechar", async () => {
    renderView();
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText("Motivo (obrigatório)"), { target: { value: "ok" } });
    expect(within(dialog).getByRole("button", { name: "Fechar fatura agora" })).toBeDisabled();
  });

  it("fecha com o motivo e avisa o número da fatura, com o link para abrir", async () => {
    vi.mocked(closeInvoiceNow).mockResolvedValue({
      id: "inv-new",
      number: "FAT-2026-000130",
      total: "R$ 450,00",
      totalInCents: 45000,
      dueDate: "2026-11-06",
    } as never);
    renderView();
    const dialog = await openDialog();
    fireEvent.change(within(dialog).getByLabelText("Motivo (obrigatório)"), {
      target: { value: "Fatura cancelada, refaturar" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar fatura agora" }));

    await waitFor(() =>
      expect(closeInvoiceNow).toHaveBeenCalledWith("dono-valinhos", { reason: "Fatura cancelada, refaturar" }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const [message, options] = vi.mocked(toast.success).mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
    expect(message).toBe("Fatura FAT-2026-000130 fechada para Chopp e Espeto Valinhos: R$ 450,00, vence sex 06/11.");
    expect(options.action.label).toBe("Abrir fatura");
    // Da lista, não sai da tela: o link do aviso é que abre a fatura.
    expect(push).not.toHaveBeenCalled();
    options.action.onClick();
    expect(push).toHaveBeenCalledWith("/financeiro/faturas/inv-new");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sem lançamento sem fatura: diz que não há o que fechar e não deixa enviar", async () => {
    vi.mocked(getBillingModeSettings).mockResolvedValue({
      openPreview: { lineCount: 0, debitsInCents: 0, creditsInCents: 0, totalInCents: 0, calc: "R$ 0,00" },
      extraordinaryInvoice: { closeDate: "2026-11-03", dueDate: "2026-11-06", blockFromDate: "2026-11-10" },
    } as never);
    renderView();
    const dialog = await openDialog();
    expect(
      await within(dialog).findByText("Não há lançamentos sem fatura: não há o que fechar agora."),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Motivo (obrigatório)"), { target: { value: "Refaturar" } });
    expect(within(dialog).getByRole("button", { name: "Fechar fatura agora" })).toBeDisabled();
  });

  it("cancelada que terminava hoje não trava: o botão libera e fecha (a API ignora a cancelada desde 03/11)", async () => {
    // A extraordinária de hoje (ter 03/11) saiu errada e foi cancelada: refaturar no mesmo dia.
    vi.mocked(listAdminInvoices).mockResolvedValue({
      items: [
        { id: "inv-h", number: "FAT-2026-000140", status: "CANCELLED", periodStart: "2026-11-02", periodEnd: "2026-11-03" },
        { id: "inv-p", number: "FAT-2026-000101", status: "PAID", periodStart: "2026-10-26", periodEnd: "2026-11-01" },
      ] as never,
      page: 1,
      pageSize: 20,
      total: 2,
      hasMore: false,
    });
    vi.mocked(closeInvoiceNow).mockResolvedValue({
      id: "inv-new",
      number: "FAT-2026-000141",
      total: "R$ 450,00",
      totalInCents: 45000,
      dueDate: "2026-11-06",
    } as never);
    renderView();
    const dialog = await openDialog();

    // Espera a lista de faturas: sem ela o diálogo não sabe da cancelada e nada travaria.
    expect(
      await within(dialog).findByText(
        "A fatura FAT-2026-000140 foi cancelada e não conta: os serviços dela voltam e entram nesta.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Período: seg 02/11 até hoje, ter 03/11. Começa no dia seguinte ao fim da FAT-2026-000101 (dom 01/11), a última fatura que vale.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/feche amanhã/)).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Motivo (obrigatório)"), {
      target: { value: "Valor errado na FAT-2026-000140, refaturar" },
    });
    const submit = within(dialog).getByRole("button", { name: "Fechar fatura agora" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(closeInvoiceNow).toHaveBeenCalledWith("dono-valinhos", {
        reason: "Valor errado na FAT-2026-000140, refaturar",
      }),
    );
  });
});

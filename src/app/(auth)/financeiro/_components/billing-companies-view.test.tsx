import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/admin/infrastructure/billing-api", () => ({
  getBillingCompanies: vi.fn(),
}));
// A aba Cobrança tem testes próprios; aqui só importa abrir na aba certa, da empresa certa.
vi.mock("../../empresas/_components/preferences-dialog", () => ({
  PreferencesDialog: (props: { companyName: string; initialTab?: string; companyDocument?: string | null }) => (
    <div data-testid="preferences">{`${props.companyName} · ${props.initialTab} · ${props.companyDocument}`}</div>
  ),
}));

import { COMPANIES, VALINHOS } from "@/modules/admin/application/billing.test-fixtures";
import { getBillingCompanies } from "@/modules/admin/infrastructure/billing-api";
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

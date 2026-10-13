import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/admin/infrastructure/billing-mode-api", () => ({
  getBillingModeSettings: vi.fn(),
  updateBillingMode: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/contractor-settings-api", () => ({
  getContractorSettings: vi.fn(),
  getContractorSettingsHistory: vi.fn(),
  updateContractorSettings: vi.fn(),
}));

import {
  getBillingModeSettings,
  type BillingModeSettings,
} from "@/modules/admin/infrastructure/billing-mode-api";
import { BillingTab } from "./billing-tab";

const BILLING_VIEW: BillingModeSettings = {
  mode: "PREPAID",
  since: null,
  email: null,
  contactEmail: "contato@bardoze.com.br",
  editable: true,
  requirements: { missing: [] },
  appUsage: { lastAppDay: null },
  previews: {
    INVOICED_7: {
      period: { start: "2026-10-09", end: "2026-10-15" },
      closeDate: "2026-10-16",
      dueDate: "2026-10-19",
      blockFromDate: "2026-10-23",
    },
    INVOICED_15: {
      period: { start: "2026-10-01", end: "2026-10-15" },
      closeDate: "2026-10-16",
      dueDate: "2026-10-19",
      blockFromDate: "2026-10-23",
    },
    INVOICED_30: {
      period: { start: "2026-10-01", end: "2026-10-31" },
      closeDate: "2026-11-01",
      dueDate: "2026-11-04",
      blockFromDate: "2026-11-08",
    },
  },
  openPreview: null,
  extraordinaryInvoice: null,
};

function renderTab(props: Partial<React.ComponentProps<typeof BillingTab>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BillingTab
        contractorUserId="owner-1"
        companyName="Bar do Zé"
        companyDocument="12.345.678/0001-90"
        onClose={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBillingModeSettings).mockResolvedValue(BILLING_VIEW);
});

describe("BillingTab — modos e pré-requisitos", () => {
  it("quatro modos com a descrição de cada ciclo", async () => {
    renderTab();

    const group = await screen.findByRole("group", { name: "Modo de cobrança" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(screen.getByText("Modo atual:")).toBeInTheDocument();
    expect(screen.getByText("Pré-pago (Pix a cada contratação)")).toBeInTheDocument();
    expect(
      within(group).getByRole("radio", { name: "Pré-pago: Pix a cada contratação (padrão)" }),
    ).toBeChecked();
    expect(
      within(group).getByRole("radio", { name: 'Faturado semanal ("boleto 7")' }),
    ).toHaveAccessibleDescription(
      "Serviços de sexta a quinta. Fecha sexta às 08:00 e vence segunda (ou no próximo dia útil).",
    );
    expect(
      within(group).getByRole("radio", { name: 'Faturado quinzenal ("boleto 15")' }),
    ).toHaveAccessibleDescription(
      "Serviços de 1 a 15 e de 16 ao fim do mês. Fecha nos dias 16 e 1 e vence 3 dias depois (ou no próximo dia útil).",
    );
    expect(
      within(group).getByRole("radio", { name: 'Faturado mensal ("boleto 30")' }),
    ).toHaveAccessibleDescription(
      "Serviços do mês. Fecha no dia 1 e vence no dia 4 (ou no próximo dia útil).",
    );
  });

  it("pré-requisito faltando: os três faturados desabilitados com 'Falta o número do endereço.' (ícone + texto)", async () => {
    vi.mocked(getBillingModeSettings).mockResolvedValue({
      ...BILLING_VIEW,
      requirements: { missing: ["number"] },
    });
    renderTab();

    const group = await screen.findByRole("group", { name: "Modo de cobrança" });
    for (const name of [
      'Faturado semanal ("boleto 7")',
      'Faturado quinzenal ("boleto 15")',
      'Faturado mensal ("boleto 30")',
    ]) {
      const radio = within(group).getByRole("radio", { name });
      expect(radio).toBeDisabled();
      expect(radio).toHaveAccessibleDescription(expect.stringContaining("Falta o número do endereço."));
    }
    expect(within(group).getByRole("radio", { name: /Pré-pago/ })).toBeEnabled();
    // Ícone acompanha o texto, e a lista de pré-requisitos diz o que falta.
    expect(within(group).getAllByTestId("missing-icon")).toHaveLength(3);
    expect(screen.getByText("Para faturar, o cadastro precisa de:")).toBeInTheDocument();
    expect(screen.getByText("Endereço completo: falta o número")).toBeInTheDocument();
    expect(screen.getByText("CNPJ: 12.345.678/0001-90")).toBeInTheDocument();
    expect(screen.getByText("E-mail: contato@bardoze.com.br")).toBeInTheDocument();
  });

  it("'Corrigir cadastro' abre o modal Editar Empresa", async () => {
    vi.mocked(getBillingModeSettings).mockResolvedValue({
      ...BILLING_VIEW,
      requirements: { missing: ["number"] },
    });
    const onEditCompany = vi.fn();
    renderTab({ onEditCompany });

    fireEvent.click(await screen.findByRole("button", { name: "Corrigir cadastro" }));

    expect(onEditCompany).toHaveBeenCalledTimes(1);
  });

  it("e-mail do financeiro com a ajuda 'Vazio: vão para o e-mail de contato ({e-mail})'", async () => {
    renderTab();

    const email = await screen.findByLabelText("E-mail do financeiro (opcional)");
    expect(email).toHaveValue("");
    expect(email).toHaveAccessibleDescription(
      "As faturas vão para este e-mail. Vazio: vão para o e-mail de contato (contato@bardoze.com.br).",
    );
  });

  it("'O que muda' com a 1ª fatura das prévias do servidor", async () => {
    renderTab({ blockEnabled: true });

    expect(screen.queryByText("O que muda")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("radio", { name: 'Faturado semanal ("boleto 7")' }));

    const region = screen.getByRole("region", { name: "O que muda" });
    expect(region).toHaveTextContent(
      "1ª fatura: fecha sex 16/10 às 08:00 com os serviços realizados até qui 15/10; vence seg 19/10.",
    );
    expect(region).toHaveTextContent(
      "Se não pagar, publicar e aprovar ficam bloqueados a partir de sex 23/10.",
    );
    await waitFor(() => expect(getBillingModeSettings).toHaveBeenCalledWith("owner-1"));
  });
});

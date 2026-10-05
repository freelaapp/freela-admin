import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommissionRuleTab } from "./commission-rule-tab";
import { CommissionStatementTab } from "./commission-statement-tab";

const api = vi.hoisted(() => ({
  getCommissionRules: vi.fn(),
  createCommissionRule: vi.fn(),
  getCommissionStatement: vi.fn(),
  previewCommissionPayout: vi.fn(),
  registerCommissionPayout: vi.fn(),
  addCommissionAdjustment: vi.fn(),
  reverseCommissionPayout: vi.fn(),
  getCommissionDashboard: vi.fn(),
  getCommissionsSummary: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/consultant-commissions-api", () => api);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("CommissionRuleTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCommissionRules.mockResolvedValue({ current: null, history: [] });
    api.createCommissionRule.mockResolvedValue({ id: "r1" });
  });

  it("salva uma nova versão com % e produtos", async () => {
    wrap(<CommissionRuleTab consultantId="c1" />);
    fireEvent.change(await screen.findByLabelText("Modo"), { target: { value: "PERCENT_OF_FEE" } });
    fireEvent.change(screen.getByLabelText("Porcentagem da taxa (%)"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar regra/i }));
    await waitFor(() =>
      expect(api.createCommissionRule).toHaveBeenCalledWith("c1", {
        mode: "PERCENT_OF_FEE",
        percent: 10,
        amountInCents: null,
        durationMonths: null,
        includeEmpresa: true,
        includeCasa: false,
      }),
    );
  });

  it("erro de validação aparece e não chama a API", async () => {
    wrap(<CommissionRuleTab consultantId="c1" />);
    fireEvent.change(await screen.findByLabelText("Modo"), { target: { value: "FIXED_PER_HIRE" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar regra/i }));
    expect(await screen.findByText("Informe um valor fixo maior que zero.")).toBeInTheDocument();
    expect(api.createCommissionRule).not.toHaveBeenCalled();
  });
});

describe("CommissionStatementTab — pagamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCommissionStatement.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
      balances: { openInCents: 315, paidInCents: 0 },
    });
    api.previewCommissionPayout.mockResolvedValue({ periodEnd: "2026-10-05", amountInCents: 315, entries: [] });
    api.registerCommissionPayout.mockResolvedValue({ id: "p1" });
  });

  it("registra com o valor da prévia e o comprovante", async () => {
    wrap(<CommissionStatementTab consultantId="c1" />);
    fireEvent.click(await screen.findByRole("button", { name: /registrar pagamento/i }));
    fireEvent.change(screen.getByLabelText("Quitar até"), { target: { value: "2026-10-05" } });
    expect(await screen.findByText(/Total a pagar: R\$ 3,15/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Data do PIX"), { target: { value: "2026-10-06" } });
    fireEvent.change(screen.getByLabelText("Comprovante (txid do PIX)"), { target: { value: "E123" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar pagamento/i }));
    await waitFor(() =>
      expect(api.registerCommissionPayout).toHaveBeenCalledWith("c1", {
        periodEnd: "2026-10-05",
        paidAt: "2026-10-06",
        paymentProof: "E123",
        expectedAmountInCents: 315,
      }),
    );
  });
});

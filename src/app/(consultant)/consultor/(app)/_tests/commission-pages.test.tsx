import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PainelPage from "../painel/page";
import CarteiraPage from "../carteira/page";

const api = vi.hoisted(() => ({
  getMyCommissionDashboard: vi.fn(),
  getMyWallet: vi.fn(),
  getMyStatement: vi.fn(),
}));
vi.mock("@/modules/consultant/infrastructure/consultant-commissions-api", () => api);

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("portal do consultor — comissão", () => {
  beforeEach(() => {
    api.getMyCommissionDashboard.mockResolvedValue({
      period: { from: "2026-10-01", to: "2026-10-15" },
      rule: { description: "10% da taxa da Freela em cada serviço concluído · Empresa · sem prazo", mode: "PERCENT_OF_FEE" },
      registrations: { total: 1, empresa: 1, casa: 0, freelancer: 0, semPerfil: 0 },
      vacancies: { published: 1, hires: 1, completed: 1 },
      commission: { generatedInCents: 315, paidInCents: 0, openInCents: 315 },
      clients: [],
    });
    api.getMyWallet.mockResolvedValue({ openInCents: 315, paidInCents: 1000 });
    api.getMyStatement.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
  });

  it("Painel mostra a regra em texto simples", async () => {
    wrap(<PainelPage />);
    expect(await screen.findByText(/Você ganha: 10% da taxa da Freela/)).toBeInTheDocument();
  });

  it("Carteira mostra a receber e já recebido", async () => {
    wrap(<CarteiraPage />);
    expect(await screen.findByText("R$ 3,15")).toBeInTheDocument();
    expect(screen.getByText("R$ 10,00")).toBeInTheDocument();
    expect(screen.getByText(/nenhum lançamento/i)).toBeInTheDocument();
  });
});

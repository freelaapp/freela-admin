import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_CONTRACTOR_DETAIL } from "@/modules/admin/application/engagement.test-fixtures";

const { guard, detailHook, pdf, save } = vi.hoisted(() => ({
  guard: { allowed: true },
  detailHook: vi.fn(),
  pdf: vi.fn(),
  save: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "u-c1" }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/engajamento/empresa/u-c1",
  useSearchParams: () => new URLSearchParams("periodo=last_month&cidade=Juiz+de+Fora&uf=MG&aba=empresas"),
}));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: guard.allowed }),
}));
vi.mock("@/modules/admin/application/use-engagement", () => ({ useContractorEngagement: detailHook }));
vi.mock("@/modules/admin/infrastructure/engagement-pdf", () => ({ buildContractorReportPdf: pdf }));
vi.mock("@/modules/admin/infrastructure/engagement-xlsx", () => ({ downloadSheets: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

import ContractorEngagementPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  guard.allowed = true;
  pdf.mockReturnValue({ save });
  detailHook.mockReturnValue({
    data: SAMPLE_CONTRACTOR_DETAIL,
    isLoading: false,
    isError: false,
    error: null,
    isPlaceholderData: false,
    refetch: vi.fn(),
  });
});

describe("ficha da empresa", () => {
  it("sem COMPANIES não consulta nem mostra a ficha (o guard redireciona)", () => {
    guard.allowed = false;
    render(<ContractorEngagementPage />);
    expect(detailHook).not.toHaveBeenCalled();
    expect(screen.queryByText("Bar do Zé")).not.toBeInTheDocument();
  });

  it("mostra números, vagas e a volta com todos os filtros", () => {
    render(<ContractorEngagementPage />);
    expect(screen.getByRole("heading", { name: "Bar do Zé" })).toBeInTheDocument();
    expect(screen.getByText("Vagas publicadas")).toBeInTheDocument();
    expect(screen.getAllByText("Garçom para sábado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cancelada pela empresa").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Voltar/ })).toHaveAttribute(
      "href",
      "/engajamento?periodo=last_month&cidade=Juiz+de+Fora&uf=MG&aba=empresas",
    );
    expect(detailHook).toHaveBeenCalledWith("u-c1", expect.objectContaining({ period: "last_month" }));
  });

  it("relatório para o cliente gera o PDF da empresa e salva com nome e período", () => {
    render(<ContractorEngagementPage />);
    fireEvent.click(screen.getByRole("button", { name: /Relatório para o cliente/ }));
    expect(pdf).toHaveBeenCalledWith(SAMPLE_CONTRACTOR_DETAIL, expect.any(Date));
    expect(save).toHaveBeenCalledWith("relatorio-bar-do-ze-2026-09-01.pdf");
  });
});

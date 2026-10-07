import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_FREELANCER_DETAIL } from "@/modules/admin/application/engagement.test-fixtures";

const { guard, detailHook, downloadSheets } = vi.hoisted(() => ({
  guard: { allowed: true },
  detailHook: vi.fn(),
  downloadSheets: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "u-f1" }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/engajamento/freelancer/u-f1",
  useSearchParams: () => new URLSearchParams("periodo=custom&de=2026-09-01&ate=2026-09-30&aba=freelancers"),
}));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: guard.allowed }),
}));
vi.mock("@/modules/admin/application/use-engagement", () => ({ useFreelancerEngagement: detailHook }));
vi.mock("@/modules/admin/infrastructure/engagement-xlsx", () => ({ downloadSheets }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

import FreelancerEngagementPage from "../page";

beforeEach(() => {
  vi.clearAllMocks();
  guard.allowed = true;
  detailHook.mockReturnValue({
    data: SAMPLE_FREELANCER_DETAIL,
    isLoading: false,
    isError: false,
    error: null,
    isPlaceholderData: false,
    refetch: vi.fn(),
  });
});

describe("ficha do freelancer", () => {
  it("sem FREELANCERS não consulta nem mostra a ficha (o guard redireciona)", () => {
    guard.allowed = false;
    render(<FreelancerEngagementPage />);
    expect(detailHook).not.toHaveBeenCalled();
    expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument();
  });

  it("mostra a pessoa, o WhatsApp, as candidaturas, só o filtro de período e a volta com os filtros", () => {
    render(<FreelancerEngagementPage />);
    expect(screen.getByRole("heading", { name: "Ana Souza" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /99876-5432/ })).toHaveAttribute("href", "https://wa.me/5532998765432");
    expect(screen.getAllByText("Garçom para sábado").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Cidade")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar/ })).toHaveAttribute(
      "href",
      "/engajamento?periodo=custom&de=2026-09-01&ate=2026-09-30&aba=freelancers",
    );
    expect(detailHook).toHaveBeenCalledWith("u-f1", expect.objectContaining({ period: "custom", from: "2026-09-01" }));
  });

  it("Exportar Excel gera Filtros, Resumo e Candidaturas", async () => {
    render(<FreelancerEngagementPage />);
    fireEvent.click(screen.getByRole("button", { name: /Exportar Excel/ }));
    await waitFor(() => expect(downloadSheets).toHaveBeenCalled());
    const [name, sheets] = downloadSheets.mock.calls[0];
    expect(name).toBe("engajamento-freelancer-ana-souza");
    expect(sheets.map((s: { name: string }) => s.name)).toEqual(["Filtros", "Resumo", "Candidaturas"]);
  });
});

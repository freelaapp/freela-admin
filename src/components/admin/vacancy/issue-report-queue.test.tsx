import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IssueReportQueue } from "./issue-report-queue";
import type { AdminJobIssueReport } from "@/modules/admin/infrastructure/issue-reports-api";

const api = vi.hoisted(() => ({ dismissJobIssueReport: vi.fn() }));

vi.mock("@/modules/admin/infrastructure/issue-reports-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  dismissJobIssueReport: api.dismissJobIssueReport,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function report(overrides: Partial<AdminJobIssueReport> = {}): AdminJobIssueReport {
  return {
    id: "rep-1",
    jobId: "job-1",
    vacancyId: "vac-1",
    module: "FREELA_EM_CASA",
    contractorUserId: "c-1",
    contractorName: "Daiane Cidade",
    category: "NO_SHOW",
    description: "Não veio",
    status: "OPEN",
    jobStatus: "COMPLETED",
    resolutionNote: null,
    resolvedAt: null,
    // 19/05/2026 23:29 em Brasília
    createdAt: "2026-05-20T02:29:00.000Z",
    ...overrides,
  };
}

function renderQueue(reports: AdminJobIssueReport[], onOpen = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <IssueReportQueue reports={reports} onOpen={onOpen} />
    </QueryClientProvider>,
  );
  return { onOpen };
}

describe("IssueReportQueue", () => {
  beforeEach(() => {
    api.dismissJobIssueReport.mockReset();
    api.dismissJobIssueReport.mockResolvedValue(report({ status: "DISMISSED" }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mostra a data do relato (relato antigo fica visível como antigo)", () => {
    renderQueue([report()]);
    expect(screen.getByText(/19\/05\/2026/)).toBeInTheDocument();
  });

  it("arquiva direto da fila depois de confirmar, sem precisar abrir a vaga", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderQueue([report()]);

    fireEvent.click(screen.getByRole("button", { name: /arquivar/i }));

    await waitFor(() => expect(api.dismissJobIssueReport).toHaveBeenCalledWith("rep-1", undefined));
  });

  it("não arquiva quando a confirmação é cancelada", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderQueue([report()]);

    fireEvent.click(screen.getByRole("button", { name: /arquivar/i }));

    expect(api.dismissJobIssueReport).not.toHaveBeenCalled();
  });

  it("Abrir vaga continua chamando onOpen com o id da vaga", () => {
    const { onOpen } = renderQueue([report()]);
    fireEvent.click(screen.getByRole("button", { name: /abrir vaga/i }));
    expect(onOpen).toHaveBeenCalledWith("vac-1");
  });
});

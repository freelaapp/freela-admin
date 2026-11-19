import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("@/modules/admin/infrastructure/occurrences-api", () => ({
  listOccurrences: vi.fn(),
  getOccurrence: vi.fn(),
  decideOccurrence: vi.fn(),
  revokeOccurrenceDecision: vi.fn(),
}));

import { listOccurrences } from "@/modules/admin/infrastructure/occurrences-api";
import {
  occurrenceItem,
  occurrenceList,
} from "@/modules/admin/application/occurrences.test-fixtures";
import OcorrenciasPage from "../page";

function apiError(status: number, code: string) {
  return new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code, message: "x" } },
  });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <OcorrenciasPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Ocorrências (D5, fatia C2): a fila", () => {
  it("chave desligada: avisa que as faltas continuam em Suspensões", async () => {
    vi.mocked(listOccurrences).mockRejectedValue(apiError(404, "FEATURE_DISABLED"));
    renderPage();
    expect(
      await screen.findByText(
        "As ocorrências ainda não estão ligadas. As faltas continuam em Suspensões.",
      ),
    ).toBeInTheDocument();
  });

  it("sem data de início: fila vazia com a explicação", async () => {
    vi.mocked(listOccurrences).mockResolvedValue(
      occurrenceList({ since: null, items: [], openCount: 0 }),
    );
    renderPage();
    expect(
      await screen.findByText(
        "A fila ainda não tem data de início, por isso está vazia. As faltas continuam em Suspensões.",
      ),
    ).toBeInTheDocument();
  });

  it("linhas: pessoa, vaga, o que foi aplicado, contestação e o link para o caso", async () => {
    vi.mocked(listOccurrences).mockResolvedValue(
      occurrenceList({
        items: [
          occurrenceItem(),
          occurrenceItem({
            infractionId: "inf-2",
            person: { providerGlobalId: "pg-2", name: "João Lima", email: null, phone: null },
            status: "CONTESTED",
            needsContestAnswer: true,
            contest: {
              status: "SENT",
              contestedAt: "2026-11-20T12:00:00.000Z",
              until: null,
              reason: "EMERGENCY",
              justification: "Fiquei doente",
            },
          }),
        ],
        openCount: 2,
      }),
    );
    renderPage();
    expect((await screen.findAllByText("Maria Souza")).length).toBeGreaterThan(0);
    expect(screen.getByRole("radio", { name: "Para decidir (2)" })).toBeInTheDocument();
    expect(screen.getAllByText("Garçom · qui 19/11, 18h").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7 dias + conversa · volta qui 26/11").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contestação a responder").length).toBeGreaterThan(0);
    const links = screen.getAllByRole("link", { name: "Abrir" });
    expect(links[0]).toHaveAttribute("href", "/ocorrencias/inf-1");
  });

  it("busca no navegador e troca de aba pede a aba à API", async () => {
    vi.mocked(listOccurrences).mockResolvedValue(occurrenceList());
    renderPage();
    await screen.findAllByText("Maria Souza");
    fireEvent.change(screen.getByPlaceholderText("Nome, telefone, empresa ou cidade"), {
      target: { value: "ninguém assim" },
    });
    expect(screen.getByText("Nenhuma ocorrência com esses filtros.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getAllByText("Maria Souza").length).toBeGreaterThan(0);

    vi.mocked(listOccurrences).mockResolvedValue(
      occurrenceList({ tab: "decided", items: [], openCount: 1 }),
    );
    fireEvent.click(screen.getByRole("radio", { name: "Decididas" }));
    await waitFor(() => expect(listOccurrences).toHaveBeenLastCalledWith("decided"));
    expect(await screen.findByText("Nenhuma decisão registrada ainda.")).toBeInTheDocument();
  });
});

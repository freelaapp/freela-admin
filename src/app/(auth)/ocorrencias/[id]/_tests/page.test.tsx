import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "inf-1" }),
}));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/modules/admin/infrastructure/occurrences-api", () => ({
  listOccurrences: vi.fn(),
  getOccurrence: vi.fn(),
  decideOccurrence: vi.fn(),
  revokeOccurrenceDecision: vi.fn(),
}));

import { toast } from "sonner";
import {
  decideOccurrence,
  getOccurrence,
  revokeOccurrenceDecision,
} from "@/modules/admin/infrastructure/occurrences-api";
import {
  decisionRecord,
  occurrenceDetail,
  occurrenceItem,
} from "@/modules/admin/application/occurrences.test-fixtures";
import OcorrenciaPage from "../page";

function apiError(status: number, code: string, extra: Record<string, unknown> = {}) {
  return new AxiosError("x", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code, message: "x", ...extra } },
  });
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <OcorrenciaPage />
    </QueryClientProvider>,
  );
}

function fillBasics() {
  fireEvent.change(screen.getByLabelText("O que aconteceu"), {
    target: { value: "A empresa disse que ela não apareceu." },
  });
  fireEvent.click(screen.getByRole("radio", { name: "Liguei e falei" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Ocorrência (D5, fatia C2): o caso", () => {
  it("blocos do caso: o que o sistema registrou, o aplicado, a vaga e o histórico", async () => {
    vi.mocked(getOccurrence).mockResolvedValue(occurrenceDetail());
    renderPage();
    expect(await screen.findByText(/A empresa respondeu "Não compareceu"/)).toBeInTheDocument();
    expect(screen.getByText("−5 pontos (nota de 100 para 95)")).toBeInTheDocument();
    expect(screen.getByText("7 dias + conversa · volta qui 26/11")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir a vaga em outra aba/ })).toHaveAttribute(
      "href",
      "/jobs?vaga=vac-1",
    );
    expect(
      screen.getByText(
        "Últimos 90 dias, em Empresas: 2 faltas sem aviso · 1 desistência em cima da hora · 1 suspensão.",
      ),
    ).toBeInTheDocument();
  });

  it("sem preencher: mostra os erros e não chama a API", async () => {
    vi.mocked(getOccurrence).mockResolvedValue(occurrenceDetail());
    renderPage();
    await screen.findByText("Decidir o caso");
    fireEvent.click(screen.getByRole("radio", { name: "Liberar agora" }));
    fireEvent.click(screen.getByRole("button", { name: "Liberar agora" }));
    expect(screen.getByText("Escreva pelo menos 10 letras.")).toBeInTheDocument();
    expect(screen.getByText("Diga se falou com Maria.")).toBeInTheDocument();
    expect(decideOccurrence).not.toHaveBeenCalled();
  });

  it("Liberar com advertência: manda WARNING e mostra a mensagem com [Próximo caso]", async () => {
    vi.mocked(getOccurrence).mockResolvedValue(occurrenceDetail());
    vi.mocked(decideOccurrence).mockResolvedValue({
      outcome: "DECIDED",
      decision: decisionRecord({ decision: "WARNING", suspensionDays: null }),
      contestAnswer: null,
      effects: {
        conversationRegistered: false,
        liftedAutomatic: true,
        suspendedUntil: null,
        pointsReturned: null,
        stillSuspended: false,
      },
    });
    renderPage();
    await screen.findByText("Decidir o caso");
    fillBasics();
    fireEvent.click(screen.getByRole("radio", { name: "Liberar agora" }));
    fireEvent.click(screen.getByRole("radio", { name: "Liberar com advertência" }));
    expect(
      screen.getByText("A advertência fica registrada no histórico. O aviso pelo WhatsApp ainda não está ligado."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Liberar agora" }));
    await waitFor(() =>
      expect(decideOccurrence).toHaveBeenCalledWith("inf-1", {
        whatHappened: "A empresa disse que ela não apareceu.",
        contactResult: "CALL",
        decision: "RELEASE",
        warning: true,
      }),
    );
    expect(await screen.findByText("Maria já pode se candidatar. Mandamos o aviso pelo app.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Próximo caso" })).toHaveAttribute("href", "/ocorrencias");
    expect(toast.success).toHaveBeenCalled();
  });

  it("Suspender 30: confirma antes, com a regra publicada", async () => {
    vi.mocked(getOccurrence).mockResolvedValue(occurrenceDetail());
    vi.mocked(decideOccurrence).mockResolvedValue({
      outcome: "DECIDED",
      decision: decisionRecord(),
      contestAnswer: null,
      effects: {
        conversationRegistered: false,
        liftedAutomatic: true,
        suspendedUntil: "2026-12-19T03:00:00.000Z",
        pointsReturned: null,
        stillSuspended: true,
      },
    });
    renderPage();
    await screen.findByText("Decidir o caso");
    fillBasics();
    fireEvent.click(screen.getByRole("radio", { name: "Suspender por…" }));
    fireEvent.click(screen.getByRole("radio", { name: "30 dias" }));
    fireEvent.click(screen.getByRole("button", { name: "Suspender até sáb 19/12" }));
    expect(await screen.findByText("Suspender Maria por 30 dias?")).toBeInTheDocument();
    expect(screen.getByText(/A regra publicada para este caso é 7 dias\./)).toBeInTheDocument();
    expect(decideOccurrence).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Suspender até 19/12" }));
    await waitFor(() =>
      expect(decideOccurrence).toHaveBeenCalledWith(
        "inf-1",
        expect.objectContaining({ decision: "SUSPEND", days: 30 }),
      ),
    );
  });

  it("409 de outra pessoa: texto pelo código e o que foi escrito continua", async () => {
    vi.mocked(getOccurrence).mockResolvedValue(occurrenceDetail());
    vi.mocked(decideOccurrence).mockRejectedValue(
      apiError(409, "OCCURRENCE_ALREADY_DECIDED", {
        details: {
          decision: "KEEP",
          suspensionDays: null,
          decidedAt: "2026-11-20T13:05:00.000Z",
          decidedByName: "Ana",
          decidedByMe: false,
        },
      }),
    );
    renderPage();
    await screen.findByText("Decidir o caso");
    fillBasics();
    fireEvent.click(screen.getByRole("radio", { name: "Liberar agora" }));
    fireEvent.click(screen.getByRole("button", { name: "Liberar agora" }));
    expect(
      await screen.findByText(
        "Outra pessoa já decidiu este caso (Ana, 10h05: manter o que o sistema aplicou). Sua escolha não foi aplicada. O que você escreveu continua aqui.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("O que aconteceu")).toHaveValue("A empresa disse que ela não apareceu.");
    expect(screen.getByRole("button", { name: "Ver o caso de novo" })).toBeInTheDocument();
  });

  // Revisão final: a decisão recarrega o caso, que volta JÁ decidido (`canDecide: false`). A
  // mensagem de sucesso e o 409 moram no formulário: ele não pode sumir com o recarregamento.
  const decided = () =>
    occurrenceDetail({
      decisions: [decisionRecord({ decision: "RELEASE", suspensionDays: null })],
      options: { ...occurrenceDetail().options, canDecide: false },
    });

  it("depois de decidir, o caso recarrega decidido e a mensagem e o [Próximo caso] continuam", async () => {
    vi.mocked(getOccurrence).mockResolvedValueOnce(occurrenceDetail()).mockResolvedValue(decided());
    vi.mocked(decideOccurrence).mockResolvedValue({
      outcome: "DECIDED",
      decision: decisionRecord({ decision: "RELEASE", suspensionDays: null }),
      contestAnswer: null,
      effects: {
        conversationRegistered: false,
        liftedAutomatic: true,
        suspendedUntil: null,
        pointsReturned: null,
        stillSuspended: false,
      },
    });
    renderPage();
    await screen.findByText("Decidir o caso");
    fillBasics();
    fireEvent.click(screen.getByRole("radio", { name: "Liberar agora" }));
    fireEvent.click(screen.getByRole("button", { name: "Liberar agora" }));
    expect(await screen.findByText("Maria já pode se candidatar. Mandamos o aviso pelo app.")).toBeInTheDocument();
    // O recarregamento já trouxe a decisão: a linha dela aparece e a mensagem continua.
    expect(await screen.findByText(/^Decidido por Ana em/)).toBeInTheDocument();
    expect(getOccurrence).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Maria já pode se candidatar. Mandamos o aviso pelo app.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Próximo caso" })).toBeInTheDocument();
  });

  it("409 de outra pessoa com o caso recarregado decidido: o erro e o texto continuam; 'Ver o caso de novo' fecha", async () => {
    vi.mocked(getOccurrence).mockResolvedValueOnce(occurrenceDetail()).mockResolvedValue(decided());
    vi.mocked(decideOccurrence).mockRejectedValue(apiError(409, "OCCURRENCE_ALREADY_DECIDED"));
    renderPage();
    await screen.findByText("Decidir o caso");
    fillBasics();
    fireEvent.click(screen.getByRole("radio", { name: "Liberar agora" }));
    fireEvent.click(screen.getByRole("button", { name: "Liberar agora" }));
    expect(await screen.findByText(/^Outra pessoa já decidiu este caso/)).toBeInTheDocument();
    await waitFor(() => expect(getOccurrence).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/^Outra pessoa já decidiu este caso/)).toBeInTheDocument();
    expect(screen.getByLabelText("O que aconteceu")).toHaveValue("A empresa disse que ela não apareceu.");
    fireEvent.click(screen.getByRole("button", { name: "Ver o caso de novo" }));
    await waitFor(() => expect(screen.queryByText("Decidir o caso")).not.toBeInTheDocument());
  });

  it("contestada: aceitar vira anular (com confirmação), sem as outras opções", async () => {
    const item = occurrenceItem({
      status: "CONTESTED",
      needsContestAnswer: true,
      contest: {
        status: "SENT",
        contestedAt: "2026-11-20T12:00:00.000Z",
        until: null,
        reason: "EMERGENCY",
        justification: "Fiquei doente",
      },
    });
    vi.mocked(getOccurrence).mockResolvedValue(
      occurrenceDetail({
        item,
        options: { ...occurrenceDetail().options, needsContestAnswer: true },
      }),
    );
    vi.mocked(decideOccurrence).mockResolvedValue({
      outcome: "ANNULLED",
      decision: decisionRecord({ decision: "ANNUL", suspensionDays: null, contestAnswer: "ACCEPTED" }),
      contestAnswer: "ACCEPTED",
      effects: {
        conversationRegistered: false,
        liftedAutomatic: false,
        suspendedUntil: null,
        pointsReturned: 5,
        stillSuspended: false,
      },
    });
    renderPage();
    expect(await screen.findByText('Maria contestou: "Fiquei doente". Você aceita?')).toBeInTheDocument();
    fillBasics();
    fireEvent.click(screen.getByRole("radio", { name: "Aceitar: não foi falta" }));
    expect(screen.queryByText("O que fazer agora")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Anular a falta" }));
    expect(await screen.findByText("Anular a falta de Maria?")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Anular a falta" }).at(-1)!);
    await waitFor(() =>
      expect(decideOccurrence).toHaveBeenCalledWith(
        "inf-1",
        expect.objectContaining({ contestAnswer: "ACCEPTED", decision: "ANNUL" }),
      ),
    );
    expect(await screen.findByText("Falta anulada. Os pontos voltaram.")).toBeInTheDocument();
  });

  it("decidido: mostra a linha da decisão e desfaz com motivo", async () => {
    vi.mocked(getOccurrence).mockResolvedValue(
      occurrenceDetail({
        decisions: [decisionRecord()],
        options: { ...occurrenceDetail().options, canDecide: false },
      }),
    );
    vi.mocked(revokeOccurrenceDecision).mockResolvedValue({});
    renderPage();
    expect(
      await screen.findByText(
        "Decidido por Ana em sex 20/11 às 10h05: suspender por 30 dias (até sáb 19/12).",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Decidir o caso")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer a decisão" }));
    expect(await screen.findByText(/A suspensão até 19\/12 sai agora/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Por que desfazer?"), { target: { value: "Era outra pessoa" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Desfazer a decisão" }).at(-1)!);
    await waitFor(() => expect(revokeOccurrenceDecision).toHaveBeenCalledWith("dec-1", "Era outra pessoa"));
  });

  it("fora da fila: 404 OCCURRENCE_NOT_FOUND com a explicação", async () => {
    vi.mocked(getOccurrence).mockRejectedValue(apiError(404, "OCCURRENCE_NOT_FOUND"));
    renderPage();
    expect(
      await screen.findByText("Este caso não está na fila (não é falta sem aviso desde o início da fila)."),
    ).toBeInTheDocument();
  });
});

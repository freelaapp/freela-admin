import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VacancySelectionRoundSection } from "./vacancy-selection-round-section";
import type {
  AdminSelectionPerson,
  AdminSelectionRoundView,
} from "@/modules/admin/infrastructure/selection-round-api";

const api = vi.hoisted(() => ({ getVacancySelectionRound: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/selection-round-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getVacancySelectionRound: api.getVacancySelectionRound,
}));

/** Fluxo v2, fatia E: a seção "Rodada de seleção" do modal da vaga (designer, lote 2 §5.6). */
function axios404(code: string | null) {
  const headers = new AxiosHeaders();
  return new AxiosError("Not Found", "ERR_BAD_REQUEST", { headers }, null, {
    status: 404,
    statusText: "Not Found",
    data: code
      ? { error: { code, message: "Este recurso ainda não está disponível." } }
      : { message: "Cannot GET /v1/bars-restaurants/admin/vacancies/vac-1/selection-round" },
    headers,
    config: { headers },
  });
}

const pessoa = (over: Partial<AdminSelectionPerson>): AdminSelectionPerson => ({
  candidacyId: `c-${over.position}`,
  position: 1,
  batch: 1,
  name: "Ana Souza",
  rankReason: "APPLIED_FIRST",
  workedHereCount: 0,
  situation: "ASKED",
  reservePosition: null,
  waitlistPosition: null,
  answer: null,
  askedAt: "2026-11-06T16:00:00.000Z",
  answerDeadlineAt: "2026-11-06T17:00:00.000Z",
  answeredAt: null,
  answeredVia: null,
  ...over,
});

const VIEW: AdminSelectionRoundView = {
  round: {
    id: "r1",
    stage: "aguardando_contratante",
    phase: "OPTIONS_SENT",
    band: "HOURS_24_TO_48",
    preselectionSize: 10,
    windowClosedAt: "2026-11-06T16:00:00.000Z",
    availabilityDeadlineAt: "2026-11-06T17:00:00.000Z", // sex 14h em Brasília
    optionsSentAt: "2026-11-06T17:00:00.000Z",
    contractorDeadlineAt: "2026-11-06T19:00:00.000Z", // sex 16h
    otherNamesUsed: 0,
    otherNamesMax: 2,
    closedAt: null,
    closedReason: null,
    closedByKind: null,
    waitlistBuiltAt: null,
    waitlistEndedAt: null,
  },
  people: [
    pessoa({
      position: 1,
      name: "Ana Souza",
      rankReason: "WORKED_HERE",
      workedHereCount: 3,
      situation: "SENT_TO_CONTRACTOR",
      answer: "AVAILABLE",
      answeredAt: "2026-11-06T16:10:00.000Z",
      answeredVia: "WHATSAPP",
    }),
    pessoa({ position: 2, name: "Maria Lima", rankReason: "DISTANCE_BAND", situation: "RESERVE", reservePosition: 1 }),
    pessoa({ position: 3, name: "Pedro Reis", rankReason: "SCORE", situation: "WAITLIST", waitlistPosition: 2 }),
    pessoa({ position: 4, name: "João Dias", situation: "NOT_AVAILABLE" }),
    pessoa({ position: 5, name: "Bia Rocha", situation: "NO_RESPONSE" }),
    pessoa({ position: 11, batch: 2, name: "Caio Melo", situation: "ASKED" }),
  ],
};

let client: QueryClient;
const ui = () => (
  <QueryClientProvider client={client}>
    <VacancySelectionRoundSection vacancyId="vac-1" />
  </QueryClientProvider>
);

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  api.getVacancySelectionRound.mockReset();
});

describe("VacancySelectionRoundSection", () => {
  it("chave da API desligada (404 FEATURE_DISABLED): a seção não aparece", async () => {
    api.getVacancySelectionRound.mockRejectedValue(axios404("FEATURE_DISABLED"));
    const { container } = render(ui());
    await vi.waitFor(() => expect(api.getVacancySelectionRound).toHaveBeenCalledWith("vac-1"));
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByText("Rodada de seleção")).not.toBeInTheDocument();
  });

  it.each([
    ["sem código (API de antes, sem a rota)", null],
    ["com outro código", "NOT_FOUND"],
  ])("404 %s: a seção não aparece, nem o erro (revisão 04/11, E7)", async (_label, code) => {
    api.getVacancySelectionRound.mockRejectedValue(axios404(code));
    const { container } = render(ui());
    await vi.waitFor(() => expect(api.getVacancySelectionRound).toHaveBeenCalledWith("vac-1"));
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
    // 404 não tenta de novo.
    expect(api.getVacancySelectionRound).toHaveBeenCalledTimes(1);
  });

  it("carregando: nada, nem o \"Carregando a rodada…\" (o modal não pisca; revisão 04/11, E7)", async () => {
    api.getVacancySelectionRound.mockReturnValue(new Promise(() => undefined));
    const { container } = render(ui());
    await vi.waitFor(() => expect(api.getVacancySelectionRound).toHaveBeenCalledWith("vac-1"));
    expect(container).toBeEmptyDOMElement();
  });

  it("vaga sem rodada: o texto do designer", async () => {
    api.getVacancySelectionRound.mockResolvedValue({ round: null, people: [] });
    render(ui());
    expect(await screen.findByText("Esta vaga não teve rodada de seleção.")).toBeInTheDocument();
    expect(screen.getByText("Rodada de seleção")).toBeInTheDocument();
  });

  it("outro erro: tenta de novo (2 vezes) e não desenha nada (revisão 04/11, E7)", async () => {
    api.getVacancySelectionRound.mockRejectedValue(new Error("rede"));
    const { container } = render(ui());
    await vi.waitFor(() => expect(api.getVacancySelectionRound).toHaveBeenCalledTimes(3), {
      timeout: 8000,
    });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Não foi possível carregar a rodada de seleção.")).not.toBeInTheDocument();
  }, 10_000);

  const serverError = (status: number) => {
    const headers = new AxiosHeaders();
    return new AxiosError("Server", "ERR_BAD_RESPONSE", { headers }, null, {
      status,
      statusText: "Server",
      data: { error: { code: "INTERNAL", message: "Erro" } },
      headers,
      config: { headers },
    });
  };

  it("revisão D1: 502 no primeiro carregamento (deploy): a seção não aparece, nem a caixa de erro", async () => {
    api.getVacancySelectionRound.mockRejectedValue(serverError(502));
    const { container } = render(ui());
    await vi.waitFor(() => expect(api.getVacancySelectionRound).toHaveBeenCalledTimes(3), {
      timeout: 8000,
    });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Não foi possível carregar a rodada de seleção.")).not.toBeInTheDocument();
  }, 12_000);

  it("revisão D1: vaga do piloto sem rodada e uma leitura seguinte que falha: sem caixa de erro", async () => {
    api.getVacancySelectionRound.mockResolvedValueOnce({ round: null, people: [] });
    render(ui());
    expect(await screen.findByText("Esta vaga não teve rodada de seleção.")).toBeInTheDocument();
    api.getVacancySelectionRound.mockRejectedValue(serverError(500));
    await client.refetchQueries({ queryKey: ["admin", "selection-round", "vac-1"] }, { throwOnError: false });
    await vi.waitFor(
      () => expect(client.getQueryState(["admin", "selection-round", "vac-1"])?.status).toBe("error"),
      { timeout: 8000 },
    );
    expect(screen.getByText("Esta vaga não teve rodada de seleção.")).toBeInTheDocument();
    expect(screen.queryByText("Não foi possível carregar a rodada de seleção.")).not.toBeInTheDocument();
  }, 12_000);

  it("lote 3, item 14: rodada já no modal e a leitura seguinte dá 500: a linha com \"Tentar de novo\"", async () => {
    api.getVacancySelectionRound.mockResolvedValueOnce(VIEW);
    render(ui());
    expect(await screen.findByText("Opções enviadas à empresa")).toBeInTheDocument();
    api.getVacancySelectionRound.mockRejectedValue(serverError(500));
    await client.refetchQueries({ queryKey: ["admin", "selection-round", "vac-1"] }, { throwOnError: false });
    expect(
      await screen.findByText("Não foi possível carregar a rodada de seleção.", {}, { timeout: 8000 }),
    ).toBeInTheDocument();
    // A tabela continua à vista.
    expect(screen.getByText("Opções enviadas à empresa")).toBeInTheDocument();
    api.getVacancySelectionRound.mockResolvedValue(VIEW);
    screen.getByRole("button", { name: "Tentar de novo" }).click();
    await vi.waitFor(() =>
      expect(screen.queryByText("Não foi possível carregar a rodada de seleção.")).not.toBeInTheDocument(),
    );
  }, 15_000);

  it("com rodada: a linha dos prazos e a tabela Posição · Pessoa · Por que está aqui · Situação", async () => {
    api.getVacancySelectionRound.mockResolvedValue(VIEW);
    render(ui());
    expect(
      await screen.findByText("Disponibilidade até sex 14h · Empresa até sex 16h · Outros nomes: 0 de 2"),
    ).toBeInTheDocument();
    expect(screen.getByText("Opções enviadas à empresa")).toBeInTheDocument();
    for (const header of ["Posição", "Pessoa", "Por que está aqui", "Situação", "Perguntado às", "Respondeu às"]) {
      expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
    }
    const linhas = screen.getAllByRole("row").slice(1);
    expect(linhas).toHaveLength(6);
    expect(linhas[0]).toHaveTextContent("Ana Souza");
    expect(linhas[0]).toHaveTextContent("Já trabalhou aqui: 3 turnos");
    expect(linhas[0]).toHaveTextContent("Enviado à empresa");
    expect(linhas[0]).toHaveTextContent("pelo WhatsApp");
    expect(linhas[1]).toHaveTextContent("Suplente 1");
    expect(linhas[1]).toHaveTextContent("Mora mais perto");
    expect(linhas[2]).toHaveTextContent("Fila de espera nº 2");
    expect(linhas[3]).toHaveTextContent("Não pode");
    expect(linhas[4]).toHaveTextContent("Sem resposta");
    expect(linhas[5]).toHaveTextContent("Perguntado");
    expect(linhas[5]).toHaveTextContent("(outros nomes)");
  });
});

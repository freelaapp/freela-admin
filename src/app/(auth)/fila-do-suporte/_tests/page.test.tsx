import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({ user: { id: "adm-1", name: "Bruna Lima" } }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/modules/admin/infrastructure/support-cases-api", () => ({
  listSupportCases: vi.fn(),
  getSupportCase: vi.fn(),
  assumeSupportCase: vi.fn(),
  recordSupportContact: vi.fn(),
  closeSupportCase: vi.fn(),
}));
// Os painéis do modal da vaga têm testes próprios; aqui só importa que aparecem.
vi.mock("@/components/admin/vacancy/compatible-invite-section", () => ({
  CompatibleInviteSection: ({ vacancyId }: { vacancyId: string }) => (
    <div data-testid="compatible-invite">{vacancyId}</div>
  ),
}));
vi.mock("@/components/admin/vacancy/vacancy-reserves-section", () => ({
  VacancyReservesSection: ({ vacancyId }: { vacancyId: string }) => (
    <div data-testid="vacancy-reserves">{vacancyId}</div>
  ),
}));

import { toast } from "sonner";
import {
  assumeSupportCase,
  closeSupportCase,
  getSupportCase,
  listSupportCases,
  recordSupportContact,
} from "@/modules/admin/infrastructure/support-cases-api";
import {
  supportCaseDetail,
  supportCaseItem,
  supportCaseList,
} from "@/modules/admin/application/support-queue.test-fixtures";
import FilaDoSuportePage from "../page";

function apiError(status: number, code: string, message = "x") {
  return new AxiosError(message, "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code, message } },
  });
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <FilaDoSuportePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("Fila do suporte (admin)", () => {
  it("carregando: 3 cartões-esqueleto", () => {
    vi.mocked(listSupportCases).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getAllByTestId("support-case-skeleton")).toHaveLength(3);
  });

  it("chave da API desligada (404 FEATURE_DISABLED): avisa que não está ligada, sem erro e sem insistir", async () => {
    vi.mocked(listSupportCases).mockRejectedValue(
      apiError(404, "FEATURE_DISABLED"),
    );
    renderPage();
    expect(
      await screen.findByText("A fila do suporte ainda não está ligada."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(listSupportCases).toHaveBeenCalledTimes(1);
  });

  it("erro: mensagem e Tentar de novo", async () => {
    vi.mocked(listSupportCases).mockRejectedValue(new Error("Network Error"));
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Não foi possível carregar a fila. Confira a conexão e toque em Tentar de novo.",
    );
    vi.mocked(listSupportCases).mockResolvedValue(
      supportCaseList({ items: [] }),
    );
    fireEvent.click(
      within(alert).getByRole("button", { name: "Tentar de novo" }),
    );
    expect(
      await screen.findByText(
        "Nenhum caso aberto. O sistema está dando conta sozinho.",
      ),
    ).toBeInTheDocument();
  });

  it("vazio por aba: abertos, comigo e fechados hoje", async () => {
    vi.mocked(listSupportCases).mockResolvedValue(
      supportCaseList({
        items: [],
        counts: { open: 0, mine: 0, closedToday: 0 },
      }),
    );
    renderPage();
    expect(
      await screen.findByText(
        "Nenhum caso aberto. O sistema está dando conta sozinho.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Fechados hoje 0" }));
    expect(
      await screen.findByText("Nenhum caso fechado hoje."),
    ).toBeInTheDocument();
    expect(listSupportCases).toHaveBeenLastCalledWith("closed_today");
  });

  it("um caso: motivo, relógio, contatos, abrir a vaga, ligar e a faixa fora do horário", async () => {
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      now: new Date("2026-11-07T17:18:00Z"),
    });
    vi.mocked(listSupportCases).mockResolvedValue(
      supportCaseList({
        supportHours: {
          open: false,
          label: "seg a sáb, 8h às 18h",
          nextOpeningAt: "2026-11-09T11:00:00Z",
          nextOpeningLabel: "seg 09/11 às 8h",
        },
      }),
    );
    renderPage();
    const card = await screen.findByRole("article", {
      name: "Garçom · Ninguém aceitou o chamado",
    });
    expect(card).toHaveTextContent("hoje 18h · em 3h42");
    expect(card).toHaveTextContent(
      "Dar notícia à empresa até 14h30 · faltam 12 min",
    );
    expect(card).toHaveTextContent("Contatos: nenhum");
    expect(card).toHaveTextContent("Ação sugerida: Resgate de vaga");
    expect(
      within(card).getByRole("link", { name: "Abrir a vaga" }),
    ).toHaveAttribute("href", "/jobs?vaga=vac-1");
    expect(
      within(card).getByRole("link", { name: "Ligar para a empresa" }),
    ).toHaveAttribute("href", "tel:5511988887777");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Fora do horário do suporte (seg a sáb, 8h às 18h). Os casos novos esperam a abertura: seg 09/11 às 8h.",
    );
    expect(screen.getByRole("tab", { name: "Abertos 1" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it('assumir caso que outra pessoa pegou: "Fulana já assumiu este caso às 14h05."', async () => {
    vi.mocked(listSupportCases).mockResolvedValue(supportCaseList());
    vi.mocked(assumeSupportCase).mockRejectedValue(
      apiError(
        409,
        "SUPPORT_CASE_ALREADY_ASSUMED",
        "Fulana já assumiu este caso às 14h05.",
      ),
    );
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Assumir" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Fulana já assumiu este caso às 14h05.",
      ),
    );
    expect(assumeSupportCase).toHaveBeenCalledWith("case-1");
  });

  it("mensagens prontas: A a E com o caso, e copiar avisa", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    vi.mocked(listSupportCases).mockResolvedValue(supportCaseList());
    vi.mocked(getSupportCase).mockResolvedValue(supportCaseDetail());
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Mensagens prontas" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Mensagens prontas",
    });
    expect(
      await within(dialog).findByText(
        "Olá, Carla! Aqui é Bruna, do suporte do Freela. Já estou cuidando da sua vaga de Garçom para sáb 07/11 às 18h. Te dou notícia até 14h30.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Copiar E" }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Mensagem copiada"),
    );
    expect(writeText.mock.calls[0][0]).toMatch(
      /^VAGA URGENTE – Garçom em Pinheiros/,
    );
  });

  it("registrar contato com alguém da lista", async () => {
    vi.mocked(listSupportCases).mockResolvedValue(supportCaseList());
    vi.mocked(getSupportCase).mockResolvedValue(
      supportCaseDetail({
        people: [
          {
            candidacyId: "c-ana",
            name: "Ana Souza",
            phone: "5511900000000",
            role: "PRINCIPAL",
            position: null,
            confirmed: true,
          },
        ],
      }),
    );
    vi.mocked(recordSupportContact).mockResolvedValue(supportCaseDetail());
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Registrar contato" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Registrar contato",
    });
    fireEvent.click(
      await within(dialog).findByRole("radio", {
        name: "Ana Souza (escolhido)",
      }),
    );
    fireEvent.click(within(dialog).getByRole("radio", { name: "Vai" }));
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Registrar contato" }),
    );
    await waitFor(() =>
      expect(recordSupportContact).toHaveBeenCalledWith("case-1", {
        kind: "PROVIDER",
        candidacyId: "c-ana",
        channel: "CALL",
        result: "WILL_GO",
      }),
    );
  });

  it('fechar como "Não conseguimos" exige o motivo', async () => {
    vi.mocked(listSupportCases).mockResolvedValue(supportCaseList());
    vi.mocked(closeSupportCase).mockResolvedValue(supportCaseDetail());
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Fechar caso" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Fechar o caso?",
    });
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Não conseguimos" }),
    );
    const submit = within(dialog).getByRole("button", { name: "Fechar caso" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Motivo (obrigatório)"), {
      target: { value: "Ninguém da lista atendeu." },
    });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(closeSupportCase).toHaveBeenCalledWith("case-1", {
        outcome: "NOT_SAVED",
        note: "Ninguém da lista atendeu.",
      }),
    );
  });

  it("ações da vaga: ligar para a lista e os painéis que já existem no modal", async () => {
    vi.mocked(listSupportCases).mockResolvedValue(supportCaseList());
    vi.mocked(getSupportCase).mockResolvedValue(
      supportCaseDetail({
        people: [
          {
            candidacyId: "c-joao",
            name: "João",
            phone: "5511922223333",
            role: "RESERVE",
            position: 1,
            confirmed: false,
          },
        ],
      }),
    );
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ações da vaga" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Ações da vaga" });
    expect(
      await within(dialog).findByRole("link", { name: /João \(suplente 1\)/ }),
    ).toHaveAttribute("href", "tel:5511922223333");
    expect(within(dialog).getByTestId("compatible-invite")).toHaveTextContent(
      "vac-1",
    );
    expect(within(dialog).getByTestId("vacancy-reserves")).toHaveTextContent(
      "vac-1",
    );
  });

  it("ações da vaga: a mesma candidatura como escolhido e como suplente não repete a chave do React", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.mocked(listSupportCases).mockResolvedValue(supportCaseList());
    vi.mocked(getSupportCase).mockResolvedValue(
      supportCaseDetail({
        people: [
          {
            candidacyId: "c-ana",
            name: "Ana",
            phone: "5511911112222",
            role: "PRINCIPAL",
            position: null,
            confirmed: true,
          },
          {
            candidacyId: "c-ana",
            name: "Ana",
            phone: "5511911112222",
            role: "RESERVE",
            position: 1,
            confirmed: false,
          },
        ],
      }),
    );
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ações da vaga" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Ações da vaga" });
    expect(
      await within(dialog).findByRole("link", { name: /Ana \(escolhido\)/ }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: /Ana \(suplente 1\)/ }),
    ).toBeInTheDocument();
    const repetida = consoleError.mock.calls.some((args) =>
      args.some((a) => typeof a === "string" && a.includes("same key")),
    );
    consoleError.mockRestore();
    expect(repetida).toBe(false);
  });

  it("a página usa os minutos da notícia que vêm da API, sem 30 fixo", async () => {
    vi.mocked(listSupportCases).mockResolvedValue({
      ...supportCaseList(),
      firstNewsMinutes: 45,
    });
    renderPage();
    expect(
      await screen.findByText(/nunca fica mais de 45 min sem notícia/),
    ).toBeInTheDocument();
  });

  it("caso fechado: como terminou, sem as ações", async () => {
    vi.mocked(listSupportCases).mockResolvedValue(
      supportCaseList({
        items: [
          supportCaseItem({
            status: "NOT_SAVED",
            closeReason: "NO_ONE_FOUND",
            closeNote: "Ninguém atendeu.",
            closedBy: { kind: "ADMIN", adminId: "adm-2", name: "Fulana" },
            closedAt: "2026-11-07T19:00:00Z",
          }),
        ],
      }),
    );
    renderPage();
    const card = await screen.findByRole("article");
    expect(card).toHaveTextContent("Não conseguimos");
    expect(card).toHaveTextContent(
      "Fechado por Fulana. Motivo: Ninguém atendeu.",
    );
    expect(
      within(card).queryByRole("button", { name: "Assumir" }),
    ).not.toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Fechar caso" }),
    ).not.toBeInTheDocument();
  });
});

describe("Fila do suporte: casos do mesmo lote (fatia 6)", () => {
  const lot = { id: "lot-9", casesInLot: 2, leadCaseId: "c1", caseIds: ["c1", "c2"] };

  it("agrupa os casos do corte do mesmo lote, com 'Lote: 2 casos' e o link para o lote", async () => {
    vi.mocked(listSupportCases).mockResolvedValue(
      supportCaseList({
        items: [
          supportCaseItem({ id: "c1", reason: "DAILY_CUTOFF", lot }),
          supportCaseItem({ id: "c2", vacancyId: "vac-2", reason: "DAILY_CUTOFF", lot }),
        ],
      }),
    );
    renderPage();
    const group = await screen.findByTestId("support-lot-group");
    expect(group).toHaveTextContent("Lote: 2 casos");
    expect(within(group).getByRole("link", { name: "Abrir o lote" })).toHaveAttribute("href", "/lotes/lot-9");
    expect(within(group).getAllByRole("article")).toHaveLength(2);
  });

  it("sem o campo `lot`: nenhum grupo, a tela é a de sempre", async () => {
    vi.mocked(listSupportCases).mockResolvedValue(
      supportCaseList({ items: [supportCaseItem({ id: "c1" })] }),
    );
    renderPage();
    expect(await screen.findAllByRole("article")).toHaveLength(1);
    expect(screen.queryByTestId("support-lot-group")).toBeNull();
  });
});

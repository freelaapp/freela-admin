import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/modules/admin/infrastructure/suspensions-api", () => ({
  listSuspensions: vi.fn(),
  createSuspension: vi.fn(),
  liftSuspension: vi.fn(),
  registerSuspensionConversation: vi.fn(),
  keepInfraction: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/admin-api", () => ({
  getAdminProviders: vi.fn(),
}));

import { toast } from "sonner";
import {
  createSuspension,
  keepInfraction,
  liftSuspension,
  listSuspensions,
  registerSuspensionConversation,
} from "@/modules/admin/infrastructure/suspensions-api";
import { getAdminProviders } from "@/modules/admin/infrastructure/admin-api";
import {
  suspensionItem,
  suspensionList,
} from "@/modules/admin/application/suspensions.test-fixtures";
import SuspensoesPage from "../page";

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
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <SuspensoesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/suspensoes");
});

/** Fluxo v2, fatia G: a página "Suspensões" do admin (designer, lote 2 §5.5). */
describe("Suspensões (admin)", () => {
  it("carregando: esqueleto", () => {
    vi.mocked(listSuspensions).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getAllByTestId("suspension-skeleton")).toHaveLength(3);
  });

  it("chave da API desligada (404 FEATURE_DISABLED): avisa, sem erro e sem insistir", async () => {
    vi.mocked(listSuspensions).mockRejectedValue(apiError(404, "FEATURE_DISABLED"));
    renderPage();
    expect(await screen.findByText("As consequências novas ainda não estão ligadas.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspender" })).not.toBeInTheDocument();
    expect(listSuspensions).toHaveBeenCalledTimes(1);
  });

  it("erro: mensagem e Tentar de novo; vazio: o texto do designer", async () => {
    vi.mocked(listSuspensions).mockRejectedValue(new Error("Network Error"));
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Não conseguimos carregar as suspensões. Verifique a conexão e clique em Tentar de novo. Seus filtros continuam aqui.",
    );
    vi.mocked(listSuspensions).mockResolvedValue(suspensionList([]));
    fireEvent.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Ninguém está sem poder se candidatar agora.")).toBeInTheDocument();
  });

  it("lista: as colunas, o aviso do jurídico e a situação", async () => {
    vi.mocked(listSuspensions).mockResolvedValue(suspensionList());
    renderPage();
    expect(await screen.findByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText(/não pode ser ligada antes do OK do jurídico/)).toBeInTheDocument();
    const row = screen.getByText("Ana Souza").closest("tr")!;
    expect(within(row).getByText("Falta sem aviso")).toBeInTheDocument();
    expect(within(row).getByText("sáb 14/11, depois da conversa")).toBeInTheDocument();
    expect(within(row).getByText("Pendente")).toBeInTheDocument();
    expect(within(row).getByText("Garçom, sáb 07/11 · pode contestar até ter 10/11 às 18h")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "all" } });
    await waitFor(() => expect(listSuspensions).toHaveBeenLastCalledWith("all"));
  });

  it("\"Conversa atrasada\" na linha e a ordem da API (a conversa pendente primeiro)", async () => {
    vi.mocked(listSuspensions).mockResolvedValue(
      suspensionList([
        suspensionItem({
          id: "atrasada",
          person: { providerGlobalId: "g-caio", name: "Caio Reis", email: null, phone: null },
          state: "CONVERSATION_ONLY",
          conversationOverdue: true,
        }),
        suspensionItem({
          id: "feita",
          conversationAt: "2026-11-10T15:00:00.000Z",
          conversationOverdue: false,
        }),
      ]),
    );
    renderPage();
    const caio = (await screen.findByText("Caio Reis")).closest("tr")!;
    expect(within(caio).getByText("Conversa atrasada")).toBeInTheDocument();
    const ana = screen.getByText("Ana Souza").closest("tr")!;
    expect(within(ana).queryByText("Conversa atrasada")).not.toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toBe(caio);
    expect(rows[1]).toBe(ana);
  });

  it("levantar: \"Outro\" pede a nota; com ela, chama a rota com o motivo", async () => {
    vi.mocked(listSuspensions).mockResolvedValue(suspensionList());
    vi.mocked(liftSuspension).mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Levantar suspensão" }));
    const dialog = screen.getByRole("dialog", { name: "Levantar suspensão?" });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Outro" }));
    const submit = within(dialog).getByRole("button", { name: "Levantar suspensão" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/O que aconteceu/), {
      target: { value: "Pedido do dono." },
    });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(liftSuspension).toHaveBeenCalledWith("susp-1", { reason: "OTHER", note: "Pedido do dono." }),
    );
    expect(toast.success).toHaveBeenCalledWith("Suspensão levantada.");
  });

  it("registrar conversa e manter a ocorrência contestada (P-G4)", async () => {
    const contested = suspensionItem({
      source: {
        ...suspensionItem().source!,
        status: "CONTESTED",
        justification: "Eu estava lá.",
        contestReason: "EMERGENCY",
        contest: { status: "SENT", until: null },
      },
    });
    vi.mocked(listSuspensions).mockResolvedValue(suspensionList([contested]));
    vi.mocked(registerSuspensionConversation).mockResolvedValue({});
    vi.mocked(keepInfraction).mockResolvedValue({});
    renderPage();
    expect(await screen.findByText(/Emergência: “Eu estava lá.”/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Registrar conversa" }));
    const conv = screen.getByRole("dialog", { name: "Registrar conversa" });
    fireEvent.click(within(conv).getByRole("button", { name: "Registrar conversa" }));
    await waitFor(() => expect(registerSuspensionConversation).toHaveBeenCalledWith("susp-1", {}));

    fireEvent.click(screen.getByRole("button", { name: "Manter a ocorrência" }));
    const keep = screen.getByRole("dialog", { name: "Manter a ocorrência?" });
    const submit = within(keep).getByRole("button", { name: "Manter a ocorrência" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(keep).getByLabelText(/Por que mantém/), { target: { value: "Sem prova." } });
    fireEvent.click(submit);
    await waitFor(() => expect(keepInfraction).toHaveBeenCalledWith("inf-1", "Sem prova."));
  });

  it("suspender: os dias são obrigatórios (1 a 90), mesmo com a conversa marcada", async () => {
    vi.mocked(listSuspensions).mockResolvedValue(suspensionList([]));
    vi.mocked(getAdminProviders).mockResolvedValue({
      data: [{ id: "p1", providerGlobalId: "g-bia", name: "Bia Lima", phone: "5511977776666", email: null } as never],
      total: 1,
      page: 1,
      limit: 5,
    });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Suspender" }));
    const dialog = screen.getByRole("dialog", { name: "Suspender freelancer" });
    fireEvent.change(within(dialog).getByLabelText(/Freelancer \(nome/), { target: { value: "Bia" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Buscar" }));
    fireEvent.click(await within(dialog).findByRole("radio", { name: /Bia Lima/ }));
    fireEvent.change(within(dialog).getByLabelText(/Motivo \(obrigatório/), {
      target: { value: "Desrespeitou a equipe da loja." },
    });
    const days = within(dialog).getByLabelText(/Dias sem se candidatar \(1 a 90\)/);
    const submit = within(dialog).getByRole("button", { name: "Suspender" });
    expect(within(dialog).getByRole("checkbox")).toBeChecked();
    for (const bad of ["", "0", "91", "2,5"]) {
      fireEvent.change(days, { target: { value: bad } });
      expect(submit).toBeDisabled();
    }
    fireEvent.change(days, { target: { value: "90" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() =>
      expect(createSuspension).toHaveBeenCalledWith(expect.objectContaining({ days: 90 })),
    );
  });

  it("suspender: busca a pessoa, dias e motivo obrigatório", async () => {
    vi.mocked(listSuspensions).mockResolvedValue(suspensionList([]));
    vi.mocked(getAdminProviders).mockResolvedValue({
      data: [{ id: "p1", providerGlobalId: "g-bia", name: "Bia Lima", phone: "5511977776666", email: null } as never],
      total: 1,
      page: 1,
      limit: 5,
    });
    vi.mocked(createSuspension).mockResolvedValue({});
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Suspender" }));
    const dialog = screen.getByRole("dialog", { name: "Suspender freelancer" });
    fireEvent.change(within(dialog).getByLabelText(/Freelancer \(nome/), { target: { value: "Bia" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Buscar" }));
    fireEvent.click(await within(dialog).findByRole("radio", { name: /Bia Lima/ }));
    const submit = within(dialog).getByRole("button", { name: "Suspender" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Motivo \(obrigatório/), {
      target: { value: "Desrespeitou a equipe da loja." },
    });
    fireEvent.click(submit);
    await waitFor(() =>
      expect(createSuspension).toHaveBeenCalledWith({
        providerGlobalId: "g-bia",
        days: 7,
        requiresConversation: true,
        reason: "Desrespeitou a equipe da loja.",
      }),
    );
  });

  describe("D5, fatia A1: filtros e detalhe", () => {
    const caio = () =>
      suspensionItem({
        id: "susp-2",
        person: { providerGlobalId: "g-caio", name: "Caio Reis", email: "caio@x.test", phone: null },
        reasonKey: "MANUAL",
        manualReason: "Briga na loja",
        source: null,
        vacancy: null,
        createdByKind: "ADMIN",
        requiresConversation: false,
        state: "DATED",
        startsAt: "2026-11-12T15:00:00.000Z",
      });

    it("o pedido à API não muda: só a situação, sem limit", async () => {
      vi.mocked(listSuspensions).mockResolvedValue(suspensionList());
      renderPage();
      await screen.findByText("Ana Souza");
      expect(vi.mocked(listSuspensions).mock.calls[0]).toEqual(["active"]);
      // As "Valendo…" filtram no navegador, sem novo pedido.
      fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "active_overdue" } });
      expect(listSuspensions).toHaveBeenCalledTimes(1);
    });

    it("busca, motivo, contador e Limpar filtros", async () => {
      vi.mocked(listSuspensions).mockResolvedValue(suspensionList([suspensionItem(), caio()]));
      renderPage();
      await screen.findByText("Ana Souza");
      expect(screen.getByText("Mostrando 2 de 2 suspensões carregadas.")).toBeInTheDocument();
      expect(screen.getByText(/A lista carrega até 100 suspensões/)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Buscar"), { target: { value: "caio" } });
      expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument();
      expect(screen.getByText("Caio Reis")).toBeInTheDocument();
      expect(screen.getByText("Mostrando 1 de 2 suspensões carregadas.")).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "no_show" } });
      expect(screen.getByText("Nenhuma suspensão com esses filtros entre as 2 carregadas.")).toBeInTheDocument();

      fireEvent.click(screen.getAllByRole("button", { name: "Limpar filtros" })[0]);
      expect(screen.getByText("Ana Souza")).toBeInTheDocument();
      expect(screen.getByText("Caio Reis")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
    });

    it("ordem: 'Mais recentes primeiro' reordena pelo início", async () => {
      vi.mocked(listSuspensions).mockResolvedValue(suspensionList([suspensionItem(), caio()]));
      renderPage();
      await screen.findByText("Ana Souza");
      let rows = screen.getAllByRole("row").slice(1);
      expect(within(rows[0]).getByText("Ana Souza")).toBeInTheDocument();
      fireEvent.change(screen.getByLabelText("Ordem"), { target: { value: "newest" } });
      rows = screen.getAllByRole("row").slice(1);
      expect(within(rows[0]).getByText("Caio Reis")).toBeInTheDocument();
    });

    it("ao bater 100 linhas, avisa que as mais antigas não aparecem", async () => {
      const many = Array.from({ length: 100 }, (_, i) => suspensionItem({ id: `s-${i}` }));
      vi.mocked(listSuspensions).mockResolvedValue(suspensionList(many));
      renderPage();
      expect(
        await screen.findByText("Chegou ao limite de 100: as suspensões mais antigas não aparecem aqui."),
      ).toBeInTheDocument();
    });

    it("detalhe: abre pelo botão, grava ?s= e mostra a vaga com o link do /jobs", async () => {
      vi.mocked(listSuspensions).mockResolvedValue(suspensionList([suspensionItem(), caio()]));
      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Ver detalhe de Ana Souza" }));
      const panel = screen.getByRole("complementary", { name: "Detalhe da suspensão" });
      expect(window.location.search).toBe("?s=susp-1");
      expect(within(panel).getByText("Automática, pela regra de faltas e desistências")).toBeInTheDocument();
      expect(within(panel).getByText("Falta sem aviso, registrada em sáb 07/11 às 18h")).toBeInTheDocument();
      expect(within(panel).getByText("Pode contestar até ter 10/11 às 18h")).toBeInTheDocument();
      expect(within(panel).getByText("Garçom · sáb 07/11, 18h")).toBeInTheDocument();
      expect(within(panel).getByRole("link", { name: /Abrir a vaga em outra aba/ })).toHaveAttribute(
        "href",
        "/jobs?vaga=v1",
      );
      // A ação do painel abre o mesmo diálogo da linha.
      fireEvent.click(within(panel).getByRole("button", { name: "Levantar suspensão" }));
      expect(screen.getByRole("dialog", { name: "Levantar suspensão?" })).toBeInTheDocument();
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));

      fireEvent.click(within(panel).getByRole("button", { name: "Fechar o detalhe" }));
      expect(screen.queryByRole("complementary", { name: "Detalhe da suspensão" })).not.toBeInTheDocument();
      expect(window.location.search).toBe("");
    });

    it("detalhe pelo endereço (?s=), e a suspensão sem vaga", async () => {
      window.history.replaceState(null, "", "/suspensoes?s=susp-2");
      vi.mocked(listSuspensions).mockResolvedValue(suspensionList([suspensionItem(), caio()]));
      renderPage();
      const panel = await screen.findByRole("complementary", { name: "Detalhe da suspensão" });
      expect(within(panel).getByText("Feita pelo suporte: “Briga na loja”")).toBeInTheDocument();
      expect(within(panel).getByText("Feita pelo suporte, sem vaga ligada.")).toBeInTheDocument();
      expect(within(panel).queryByRole("link")).not.toBeInTheDocument();
    });

    it("?s= fora das carregadas: oferece procurar em Todas", async () => {
      window.history.replaceState(null, "", "/suspensoes?s=levantada-1");
      vi.mocked(listSuspensions).mockResolvedValue(suspensionList());
      renderPage();
      const panel = await screen.findByRole("complementary", { name: "Detalhe da suspensão" });
      expect(within(panel).getByText(/não está entre as carregadas/)).toBeInTheDocument();
      fireEvent.click(within(panel).getByRole("button", { name: "Procurar em Todas" }));
      await waitFor(() => expect(listSuspensions).toHaveBeenLastCalledWith("all"));
    });
  });

  describe("D5, fatia A2b: empresa e cidade", () => {
    const novo = (id: string, name: string, company: { userId: string; name: string } | null, city: string | null) => {
      const base = suspensionItem({ id, person: { providerGlobalId: `g-${id}`, name, email: null, phone: null } });
      return {
        ...base,
        vacancy: { ...base.vacancy!, jobId: `job-${id}`, company, city, uf: city ? "SP" : null },
        liftedByName: null,
        conversationByName: null,
        createdByAdminName: null,
      };
    };

    it("API antiga: sem filtros de empresa e cidade, com o aviso; o resto funciona", async () => {
      vi.mocked(listSuspensions).mockResolvedValue(suspensionList());
      renderPage();
      await screen.findByText("Ana Souza");
      expect(screen.queryByLabelText("Empresa")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Cidade")).not.toBeInTheDocument();
      expect(
        screen.getByText("Empresa e cidade ainda não chegam do servidor. Os outros filtros funcionam."),
      ).toBeInTheDocument();
      expect(screen.queryByText("Empresa · cidade")).not.toBeInTheDocument();
    });

    it("API nova: filtra por empresa e cidade, com a coluna e o aviso das sem vaga", async () => {
      vi.mocked(listSuspensions).mockResolvedValue(
        suspensionList([
          novo("1", "Ana Souza", { userId: "u-coco", name: "Coco Bambu Osasco" }, "Osasco"),
          novo("2", "Bia Lima", { userId: "u-spo", name: "Spoleto Campinas" }, "Campinas"),
        ]),
      );
      renderPage();
      await screen.findByText("Ana Souza");
      expect(screen.getByText("Empresa · cidade")).toBeInTheDocument();
      expect(screen.getByText("Coco Bambu Osasco · Osasco/SP")).toBeInTheDocument();
      expect(screen.queryByText(/ainda não chegam do servidor/)).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Empresa"), { target: { value: "u-spo" } });
      expect(screen.queryByText("Ana Souza")).not.toBeInTheDocument();
      expect(screen.getByText("Bia Lima")).toBeInTheDocument();
      expect(
        screen.getByText("Com empresa ou cidade escolhida, as suspensões feitas pelo suporte sem vaga não aparecem."),
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Empresa"), { target: { value: "" } });
      fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "Osasco|SP" } });
      expect(screen.getByText("Ana Souza")).toBeInTheDocument();
      expect(screen.queryByText("Bia Lima")).not.toBeInTheDocument();
      // O pedido continua o mesmo: sem limit.
      expect(vi.mocked(listSuspensions).mock.calls.every((c) => c.length === 1)).toBe(true);
    });
  });
});

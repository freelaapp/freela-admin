import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "sonner";
import { useChooseFlow } from "@/modules/admin/application/use-choose-flow";
import type { VacancyCandidacyItem, VacancyReservesView } from "@/modules/admin/infrastructure/admin-api";
import type {
  AdminHurryOption,
  AdminSelectionHurry,
  AdminSelectionRoundView,
} from "@/modules/admin/infrastructure/selection-round-api";
import { AccelerateVacancyBar } from "./accelerate-vacancy-bar";
import { VacancyCandidacyList } from "./vacancy-candidacy-list";

const api = vi.hoisted(() => ({
  getVacancySelectionRound: vi.fn(),
  hurryVacancySelection: vi.fn(),
  chooseVacancyTeam: vi.fn(),
  releaseVacancyCandidateList: vi.fn(),
  getVacancyReserves: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/admin/infrastructure/selection-round-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getVacancySelectionRound: api.getVacancySelectionRound,
  hurryVacancySelection: api.hurryVacancySelection,
  chooseVacancyTeam: api.chooseVacancyTeam,
  releaseVacancyCandidateList: api.releaseVacancyCandidateList,
}));
vi.mock("@/modules/admin/infrastructure/admin-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getVacancyReserves: api.getVacancyReserves,
}));

// 05/11 20h = 23h UTC. Horas de Brasília: 19h58 + N min + 2 min.
const iso = (hhmmBrt: string) => `2026-11-06T${String((Number(hhmmBrt.slice(0, 2)) + 3) % 24).padStart(2, "0")}:${hhmmBrt.slice(3)}:00.000Z`;

const option = (minutes: 10 | 20 | 45, over: Partial<AdminHurryOption> = {}): AdminHurryOption => ({
  minutes,
  allowed: true,
  reason: null,
  answersBy: iso(minutes === 10 ? "20:08" : minutes === 20 ? "20:18" : "20:43"),
  optionsBy: iso(`${minutes === 10 ? "20:10" : minutes === 20 ? "20:20" : "20:45"}`),
  ...over,
});

const hurryBlock = (over: Partial<AdminSelectionHurry> = {}): AdminSelectionHurry => ({
  available: true,
  reason: null,
  message: null,
  pendingCount: 17,
  askUpTo: 10,
  normalMinutes: 45,
  contractorMinutes: 60,
  currentOptionsBy: iso("21:36"),
  listHidden: true,
  startTime: "2099-01-01T20:00:00.000Z",
  options: [option(10), option(20), option(45)],
  computedAt: iso("19:58"),
  ...over,
});

const view = (hurry: AdminSelectionHurry | null | undefined): AdminSelectionRoundView => ({
  round: null,
  people: [],
  companyView: {
    mode: "HIDDEN",
    curated: true,
    stage: "RECEIVING",
    optionsBy: iso("21:36"),
    reason: null,
    releasedAt: null,
    applicants: 17,
    asked: null,
    options: 0,
    listReleasedByKind: null,
    listReleaseNote: null,
    openTrigger: null,
  },
  ...(hurry === undefined ? {} : { hurry }),
});

const cand = (id: string, name: string, over: Partial<VacancyCandidacyItem> = {}): VacancyCandidacyItem => ({
  id,
  providerId: `p-${id}`,
  providerName: name,
  providerPhone: null,
  providerEmail: null,
  status: "PENDING",
  createdAt: "2026-11-05T19:00:00.000Z",
  ...over,
});
const CANDS = [
  cand("c1", "Ana Souza"),
  cand("c2", "João Lima"),
  cand("c3", "Maria Alves"),
  cand("c4", "Carlos Mendes"),
];

const reservesView = (over: Partial<VacancyReservesView> = {}): VacancyReservesView =>
  ({
    enabled: true,
    max: 2,
    holdUntil: "2099-01-01T00:00:00.000Z",
    principal: null,
    chosen: [],
    candidates: [
      { candidacyId: "c2", name: "João Lima" },
      { candidacyId: "c3", name: "Maria Alves" },
      { candidacyId: "c4", name: "Carlos Mendes" },
    ],
    canChoose: true,
    autoFill: true,
    reserves: [],
    eligible: [],
    openCall: null,
    history: { calls: [], principalChanges: [] },
    ...over,
  }) as VacancyReservesView;

function apiError(status: number, code: string, message: string | null) {
  const headers = new AxiosHeaders();
  return new AxiosError("x", "ERR_BAD_REQUEST", { headers }, null, {
    status,
    statusText: "x",
    data: { error: { code, ...(message ? { message } : {}) } },
    headers,
    config: { headers },
  });
}

let client: QueryClient;

/** Faz o papel da página: a barra entra pelo `actions` e a lista recebe o modo de marcação. */
function Harness({
  candidacies = CANDS,
  vacancyOpen = true,
  billingMode = "INVOICED_7",
}: {
  candidacies?: VacancyCandidacyItem[];
  vacancyOpen?: boolean;
  billingMode?: string;
}) {
  const choose = useChooseFlow("vac-1");
  return (
    <VacancyCandidacyList
      candidacies={candidacies}
      loading={false}
      scrollable={false}
      onConfirm={vi.fn()}
      confirming={false}
      onAccept={vi.fn()}
      onUnlink={vi.fn()}
      actions={
        <AccelerateVacancyBar
          vacancyId="vac-1"
          vacancyOpen={vacancyOpen}
          startTime="2099-01-01T20:00:00.000Z"
          candidacies={candidacies}
          loadingCandidacies={false}
          company="Empresa Teste"
          billingMode={billingMode}
          valueLabel="R$ 160,00"
          subtitle="Atendente · sex 06/11, 17:00 - 22:00"
          choose={choose}
        />
      }
      chooseMode={
        choose.active
          ? {
              selection: choose.selection,
              onToggle: choose.toggle,
              reserveEligibleIds: choose.reserveEligibleIds,
              maxReserves: choose.maxReserves,
              onReview: choose.openReview,
            }
          : undefined
      }
    />
  );
}

function renderHarness(props: Parameters<typeof Harness>[0] = {}) {
  return render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  api.getVacancySelectionRound.mockResolvedValue(view(hurryBlock()));
  api.getVacancyReserves.mockResolvedValue(reservesView());
});

describe("Barra 'Acelerar esta vaga'", () => {
  it("aparece em Vagas Empresa com os dois botões e a linha do que a empresa vê", async () => {
    renderHarness();
    const barra = await screen.findByTestId("acelerar-barra");
    expect(within(barra).getByText("Acelerar esta vaga")).toBeInTheDocument();
    expect(within(barra).getByText(/A empresa vê "Estamos selecionando"/)).toBeInTheDocument();
    expect(within(barra).getByRole("button", { name: /Selecionar agora/ })).toBeInTheDocument();
    expect(await within(barra).findByRole("button", { name: /Escolher titular e suplentes/ })).toBeInTheDocument();
    expect(within(barra).getByRole("button", { name: "Liberar a lista agora" })).toBeInTheDocument();
  });

  it.each([
    ["sem o bloco hurry (API de antes)", undefined],
    ["hurry nulo", null],
    ["options vazio", hurryBlock({ options: [] })],
  ])("o 'Selecionar agora' some: %s", async (_nome, hurry) => {
    api.getVacancySelectionRound.mockResolvedValue(view(hurry));
    renderHarness();
    await screen.findByTestId("acelerar-barra");
    expect(screen.queryByRole("button", { name: /Selecionar agora/ })).not.toBeInTheDocument();
  });

  it("available=false: botão desligado (aria-disabled), com a message visível e ligada por aria-describedby", async () => {
    const message = "Entre 22h e 8h não perguntamos aos freelancers.";
    api.getVacancySelectionRound.mockResolvedValue(
      view(hurryBlock({ available: false, reason: "QUIET_HOURS", message })),
    );
    renderHarness();
    const botao = await screen.findByRole("button", { name: /Selecionar agora/ });
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(message)).toBeInTheDocument();
    const id = botao.getAttribute("aria-describedby") as string;
    expect(document.getElementById(id)).toHaveTextContent(message);
    fireEvent.click(botao);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("rodada 404: só o 'Escolher' (sem situação nem 'Selecionar agora')", async () => {
    api.getVacancySelectionRound.mockRejectedValue(apiError(404, "FEATURE_DISABLED", null));
    renderHarness();
    expect(await screen.findByRole("button", { name: /Escolher titular e suplentes/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Selecionar agora/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/A empresa vê/)).not.toBeInTheDocument();
  });

  it("outro erro da rodada: linha de erro com 'Tentar de novo' e o 'Escolher' continua", async () => {
    // O hook tenta de novo em erro 5xx; sem espera entre as tentativas, o teste não demora.
    client.setQueryDefaults(["admin", "selection-round"], { retryDelay: 0 });
    api.getVacancySelectionRound.mockRejectedValue(apiError(500, "X", null));
    renderHarness();
    expect(await screen.findByText("Não foi possível ver a situação da seleção.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Selecionar agora/ })).not.toBeInTheDocument();
  });

  it("com alguém já aceito, a vaga fechada ou sem pendentes de escolha, a barra some", async () => {
    const { unmount } = renderHarness({ candidacies: [cand("c1", "Ana", { status: "ACCEPTED" })] });
    await waitFor(() => expect(screen.queryByTestId("acelerar-barra")).not.toBeInTheDocument());
    unmount();
    renderHarness({ vacancyOpen: false });
    expect(screen.queryByTestId("acelerar-barra")).not.toBeInTheDocument();
  });

  it("'Escolher' não aparece com os suplentes desligados", async () => {
    api.getVacancyReserves.mockResolvedValue(reservesView({ enabled: false }));
    renderHarness();
    await screen.findByRole("button", { name: /Selecionar agora/ });
    expect(screen.queryByRole("button", { name: /Escolher titular e suplentes/ })).not.toBeInTheDocument();
  });
});

describe("Diálogo 'Selecionar agora'", () => {
  async function abrir() {
    renderHarness();
    fireEvent.click(await screen.findByRole("button", { name: /Selecionar agora/ }));
    return screen.findByRole("dialog");
  }

  it("20 min já vem marcado e mostra a hora da empresa (Brasília), com a conta", async () => {
    const dialog = await abrir();
    expect(within(dialog).getByRole("radio", { name: /^20 minutos/ })).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).getByRole("radio", { name: /^20 minutos, opções às 20h20/ })).toBeInTheDocument();
    expect(within(dialog).getByText(/Nesta vaga o normal seria 45 min/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Conta: agora, 19h58 \+ 20 min para responder/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Selecionar agora (20 min)" })).toBeInTheDocument();
  });

  it("tempo desligado mostra o motivo; sem o de 20, vem marcado o maior permitido", async () => {
    api.getVacancySelectionRound.mockResolvedValue(
      view(
        hurryBlock({
          options: [
            option(10),
            option(20, { allowed: false, reason: "NO_TIME_LEFT" }),
            option(45, { allowed: false, reason: "LATER_THAN_PROMISED" }),
          ],
        }),
      ),
    );
    const dialog = await abrir();
    expect(within(dialog).getByRole("radio", { name: /^10 minutos/ })).toHaveAttribute("aria-checked", "true");
    expect(within(dialog).getByRole("radio", { name: /^45 minutos, indisponível/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(dialog).getByText(/45 min: as opções chegariam às 20h45, depois das 21h36 prometidas/)).toBeInTheDocument();
    expect(within(dialog).getByText(/20 min: não sobra 1 h da empresa/)).toBeInTheDocument();
  });

  it("envia { minutes, note } e, no sucesso, avisa a hora nova de hurried.optionsBy e fecha", async () => {
    api.hurryVacancySelection.mockResolvedValue({
      ...view(hurryBlock({ available: false })),
      hurried: { roundId: "r1", asked: 10, answersBy: iso("20:18"), optionsBy: iso("20:20") },
    });
    const dialog = await abrir();
    fireEvent.click(within(dialog).getByRole("radio", { name: /^45 minutos/ }));
    fireEvent.change(within(dialog).getByLabelText(/Motivo/), { target: { value: "  pressa  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Selecionar agora (45 min)" }));
    await waitFor(() =>
      expect(api.hurryVacancySelection).toHaveBeenCalledWith("vac-1", { minutes: 45, note: "  pressa  " }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Perguntamos a 10 freelancers"));
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("a empresa recebe as opções até 20h20"));
  });

  it("os atalhos do motivo preenchem o campo", async () => {
    const dialog = await abrir();
    fireEvent.click(within(dialog).getByRole("button", { name: "A empresa ligou com pressa" }));
    expect(within(dialog).getByLabelText(/Motivo/)).toHaveValue("A empresa ligou com pressa");
  });

  it("422: a message da API aparece dentro do diálogo, que continua aberto", async () => {
    api.hurryVacancySelection.mockRejectedValue(
      apiError(422, "SELECTION_HURRY_QUIET_HOURS", "Entre 22h e 8h não perguntamos aos freelancers. Nada mudou."),
    );
    const dialog = await abrir();
    fireEvent.click(within(dialog).getByRole("button", { name: "Selecionar agora (20 min)" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Nada mudou.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("422 sem message: usa o texto do código; rede: botão vira 'Tentar de novo'", async () => {
    api.hurryVacancySelection.mockRejectedValueOnce(apiError(422, "SELECTION_HURRY_NO_CANDIDATES", null));
    const dialog = await abrir();
    fireEvent.click(within(dialog).getByRole("button", { name: "Selecionar agora (20 min)" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ninguém se candidatou a esta vaga ainda. Nada mudou.");
    api.hurryVacancySelection.mockRejectedValueOnce(new Error("rede"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Selecionar agora (20 min)" }));
    expect(await within(dialog).findByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("setas do teclado trocam o tempo", async () => {
    const dialog = await abrir();
    const vinte = within(dialog).getByRole("radio", { name: /^20 minutos/ });
    fireEvent.keyDown(vinte, { key: "ArrowRight" });
    expect(within(dialog).getByRole("radio", { name: /^45 minutos/ })).toHaveAttribute("aria-checked", "true");
  });
});

describe("Modo 'Escolher titular e suplentes'", () => {
  async function iniciar() {
    renderHarness();
    fireEvent.click(await screen.findByRole("button", { name: /Escolher titular e suplentes/ }));
  }
  const marca = (nome: string) => screen.getByRole("checkbox", { name: new RegExp(nome) });

  it("o 1º toque é o titular, depois suplente 1 e 2; o 4º não marca (cheio)", async () => {
    await iniciar();
    fireEvent.click(marca("Ana"));
    fireEvent.click(marca("João"));
    fireEvent.click(marca("Maria"));
    expect(screen.getByRole("checkbox", { name: "Ana Souza, titular" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "João Lima, suplente 1" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Maria Alves, suplente 2" })).toBeInTheDocument();
    fireEvent.click(marca("Carlos"));
    expect(marca("Carlos")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/Máximo de 2 suplentes/)).toBeInTheDocument();
    expect(screen.getByTestId("escolher-faixa")).toHaveTextContent("Titular: Ana Souza");
  });

  it("desmarcar deixa o lugar vazio e ninguém sobe sozinho", async () => {
    await iniciar();
    fireEvent.click(marca("Ana"));
    fireEvent.click(marca("João"));
    fireEvent.click(marca("Ana"));
    const faixa = screen.getByTestId("escolher-faixa");
    expect(faixa).toHaveTextContent("Titular: toque em quem vai trabalhar");
    expect(faixa).toHaveTextContent("1 João Lima");
    expect(screen.getByRole("button", { name: "Revisar e aprovar" })).toBeDisabled();
    // O próximo toque preenche o lugar de titular, não o do suplente.
    fireEvent.click(marca("Carlos"));
    expect(screen.getByRole("checkbox", { name: "Carlos Mendes, titular" })).toBeInTheDocument();
  });

  it("some 'Colocar na vaga' e 'Desvincular' dos cartões enquanto o modo está ligado", async () => {
    renderHarness();
    expect(screen.getAllByRole("button", { name: /Colocar na vaga/ }).length).toBeGreaterThan(0);
    fireEvent.click(await screen.findByRole("button", { name: /Escolher titular e suplentes/ }));
    expect(screen.queryByRole("button", { name: /Colocar na vaga/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Desvincular/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getAllByRole("button", { name: /Colocar na vaga/ }).length).toBeGreaterThan(0);
  });

  it("quem não pode ser suplente só ocupa o lugar de titular", async () => {
    await iniciar();
    api.getVacancyReserves.mockResolvedValue(reservesView());
    fireEvent.click(marca("João"));
    // Ana não está na lista de suplentes do servidor.
    fireEvent.click(marca("Ana"));
    expect(marca("Ana")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/Não dá para ser suplente/)).toBeInTheDocument();
  });

  async function ate3() {
    await iniciar();
    fireEvent.click(marca("Ana"));
    fireEvent.click(marca("João"));
    fireEvent.click(marca("Maria"));
    fireEvent.click(screen.getByRole("button", { name: "Revisar e aprovar" }));
    return screen.findByRole("alertdialog");
  }

  it("a confirmação mostra os 3 nomes e o texto de fatura", async () => {
    const dialog = await ate3();
    expect(within(dialog).getByText("Aprovar Ana Souza para trabalhar?")).toBeInTheDocument();
    expect(within(dialog).getByText("João Lima")).toBeInTheDocument();
    expect(within(dialog).getByText("Maria Alves")).toBeInTheDocument();
    expect(dialog).toHaveTextContent("entra agora na fatura da Empresa Teste");
    expect(dialog).toHaveTextContent("Os outros 1 candidato passam");
    expect(within(dialog).getByRole("button", { name: "Aprovar e lançar na fatura" })).toBeInTheDocument();
  });

  it("empresa pré-paga: texto e botão do Pix", async () => {
    renderHarness({ billingMode: "PREPAID" });
    fireEvent.click(await screen.findByRole("button", { name: /Escolher titular e suplentes/ }));
    fireEvent.click(marca("Ana"));
    fireEvent.click(screen.getByRole("button", { name: "Revisar e aprovar" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("recebe o pedido para pagar R$ 160,00 por Pix");
    expect(dialog).toHaveTextContent("Os 2 suplentes que faltam o sistema escolhe sozinho depois do pagamento");
    expect(within(dialog).getByRole("button", { name: "Aprovar e pedir o Pix" })).toBeInTheDocument();
  });

  it("envia o corpo certo; no sucesso fecha o modo, avisa e recarrega lista, rodada e suplentes", async () => {
    api.chooseVacancyTeam.mockResolvedValue({
      candidacy: { candidacyId: "c1", vacancyId: "vac-1", providerId: "p-c1", status: "ACCEPTED" },
      reserves: null,
      billing: "INVOICE",
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const dialog = await ate3();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aprovar e lançar na fatura" }));
    await waitFor(() =>
      expect(api.chooseVacancyTeam).toHaveBeenCalledWith("vac-1", {
        principalCandidacyId: "c1",
        reserveCandidacyIds: ["c2", "c3"],
      }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith(
      "Ana Souza vai trabalhar. Suplentes: 1 João Lima, 2 Maria Alves. Valor lançado na fatura.",
    );
    expect(screen.queryByTestId("escolher-faixa")).not.toBeInTheDocument();
    const keys = invalidate.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
    expect(keys).toEqual(
      expect.arrayContaining([
        '["admin","selection-round","vac-1"]',
        '["admin","vacancy-candidacies","vac-1"]',
        '["admin","vacancy-reserves","vac-1"]',
      ]),
    );
  });

  it("um erro mantém a marcação e mostra a message da API", async () => {
    api.chooseVacancyTeam.mockRejectedValue(
      apiError(409, "CANDIDACY_NOT_PENDING", "Maria Alves não está mais disponível. Nada foi aprovado."),
    );
    const dialog = await ate3();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aprovar e lançar na fatura" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Nada foi aprovado.");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Voltar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Ana Souza, titular" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Maria Alves, suplente 2" })).toBeInTheDocument();
  });

  it("erro de rede no 'Escolher': diz que não sabemos se deu certo", async () => {
    api.chooseVacancyTeam.mockRejectedValue(new Error("rede"));
    const dialog = await ate3();
    fireEvent.click(within(dialog).getByRole("button", { name: "Aprovar e lançar na fatura" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Não sabemos se deu certo");
    expect(within(dialog).getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

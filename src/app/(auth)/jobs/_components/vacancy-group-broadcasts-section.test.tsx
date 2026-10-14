import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  GroupBroadcastDestination,
  GroupBroadcastPreview,
  GroupBroadcastRound,
  VacancyGroupBroadcasts,
} from "@/modules/admin/infrastructure/vacancy-group-broadcasts-api";
import type { OutreachRecord } from "@/modules/admin/infrastructure/vacancy-outreach-api";

import { VacancyGroupBroadcastsSection } from "./vacancy-group-broadcasts-section";

const api = vi.hoisted(() => ({
  getVacancyGroupBroadcasts: vi.fn(),
  getVacancyGroupBroadcastPreview: vi.fn(),
  resendVacancyGroupMessage: vi.fn(),
}));

vi.mock("@/modules/admin/infrastructure/vacancy-group-broadcasts-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getVacancyGroupBroadcasts: api.getVacancyGroupBroadcasts,
  getVacancyGroupBroadcastPreview: api.getVacancyGroupBroadcastPreview,
}));

vi.mock("@/modules/admin/infrastructure/vacancy-outreach-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resendVacancyGroupMessage: api.resendVacancyGroupMessage,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// 09:12 e 10:40 em Brasília (UTC−3).
const T0912 = "2026-10-14T12:12:00.000Z";
const T1040 = "2026-10-14T13:40:00.000Z";
const AGORA = new Date("2026-10-14T14:05:00.000Z"); // 11:05, 25 min depois das 10:40

function dest(over: Partial<GroupBroadcastDestination> = {}): GroupBroadcastDestination {
  return {
    groupJid: `${over.groupName ?? "Vagas Freela Campinas SP"}@g.us`,
    groupName: "Vagas Freela Campinas SP",
    city: "Campinas",
    uf: "SP",
    distanceKm: 4.2,
    reason: "VACANCY_CITY",
    status: "SENT",
    errorCode: null,
    error: null,
    sentAt: T1040,
    ...over,
  };
}

function round(
  destinations: GroupBroadcastDestination[],
  over: Partial<GroupBroadcastRound> = {},
): GroupBroadcastRound {
  return {
    roundId: "r-manual",
    mode: "MANUAL",
    createdAt: T1040,
    radiusKm: 30,
    centerSource: "VACANCY",
    summary: {
      total: 0, sent: 0, failedCount: 0, failed: [], skipped: 0, pending: 0, ownCity: 0, inRadius: 0, fallback: 0, vip: 0,
    },
    destinations,
    ...over,
  };
}

function broadcasts(over: Partial<VacancyGroupBroadcasts> = {}): VacancyGroupBroadcasts {
  return {
    radiusKm: 30,
    groupBroadcastAt: null,
    inFlight: 0,
    canResend: true,
    resendBlockedReason: null,
    rounds: [],
    ...over,
  };
}

const QUATRO: GroupBroadcastPreview = {
  radiusKm: 30,
  vacancyCity: "Campinas",
  vacancyUf: "SP",
  centerSource: "VACANCY",
  ownCityHasGroup: true,
  fallbackUsed: false,
  canResend: true,
  resendBlockedReason: null,
  destinations: [
    { groupJid: "c", groupName: "Vagas Freela Campinas SP", city: "Campinas", uf: "SP", distanceKm: 4.2, reason: "VACANCY_CITY" },
    { groupJid: "s", groupName: "Vagas Freela Sumaré SP", city: "Sumaré", uf: "SP", distanceKm: 21, reason: "RADIUS" },
    { groupJid: "v", groupName: "Vagas Freela Vinhedo SP", city: "Vinhedo", uf: "SP", distanceKm: 12, reason: "RADIUS" },
    { groupJid: "l", groupName: "Vagas Freela Valinhos SP", city: "Valinhos", uf: "SP", distanceKm: 9.6, reason: "RADIUS" },
  ],
  skipped: [],
};

/** Rodada manual: Campinas ok, Valinhos ok, Vinhedo falhou, Sumaré ok, Jundiaí pulado. */
const PARCIAL = round([
  dest({ groupName: "Vagas Freela Vinhedo SP", city: "Vinhedo", distanceKm: 12, reason: "RADIUS", status: "FAILED", errorCode: "FALHA_NO_ENVIO", error: "O bot não está no grupo." }),
  dest({ groupName: "Vagas Freela Sumaré SP", city: "Sumaré", distanceKm: 21, reason: "RADIUS" }),
  dest(),
  dest({ groupName: "Vagas Freela Valinhos SP", city: "Valinhos", distanceKm: 9.6, reason: "RADIUS" }),
]);

const AUTO_OK = round(
  [dest({ sentAt: T0912 }), dest({ groupName: "Vagas Freela Valinhos SP", city: "Valinhos", distanceKm: 9.6, reason: "RADIUS", sentAt: T0912 })],
  { roundId: "auto:v1", mode: "AUTO", createdAt: T0912 },
);

function erroHttp(status: number, message = "falhou", code = "X") {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: { error: { code, message } } },
  });
}

/** 404 de rota inexistente (API antiga): o filtro da API dá `NOT_FOUND`. */
function rotaInexistente() {
  return erroHttp(404, "Cannot GET /v1/…", "NOT_FOUND");
}

function renderSection(
  props: { record?: OutreachRecord; pollMs?: number } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <VacancyGroupBroadcastsSection
        vacancyId="v1"
        record={props.record}
        pollMs={props.pollMs ?? 20}
        now={AGORA}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.getVacancyGroupBroadcasts.mockReset();
  api.getVacancyGroupBroadcastPreview.mockReset();
  api.resendVacancyGroupMessage.mockReset();
  api.getVacancyGroupBroadcastPreview.mockResolvedValue(QUATRO);
  for (const fn of Object.values(toast)) vi.mocked(fn).mockClear();
});

describe("VacancyGroupBroadcastsSection — estados", () => {
  it("carregando: 2 cartões em esqueleto", () => {
    api.getVacancyGroupBroadcasts.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.getAllByTestId("group-skeleton")).toHaveLength(2);
  });

  it("vazio: 'Ainda não divulgada' e 'Enviar para 4 grupos'", async () => {
    api.getVacancyGroupBroadcasts.mockResolvedValue(broadcasts());
    renderSection();
    expect(await screen.findByText("Ainda não divulgada.")).toBeInTheDocument();
    expect(screen.getByText(/Nenhum grupo recebeu esta vaga\./)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Enviar para 4 grupos" })).toBeInTheDocument();
  });

  it("rodadas: só a última aberta, cidade da vaga primeiro, conta no cabeçalho e nota da distância", async () => {
    api.getVacancyGroupBroadcasts.mockResolvedValue(broadcasts({ rounds: [PARCIAL, AUTO_OK] }));
    renderSection();

    expect(
      await screen.findByText(
        "Recebeu em 3 de 4 grupos na última rodada (1 da cidade da vaga + 2 de 3 a até 30 km).",
      ),
    ).toBeInTheDocument();

    const rodadas = screen.getAllByTestId("group-round");
    expect(rodadas).toHaveLength(2);
    expect(rodadas[0]).toHaveAttribute("open");
    expect(rodadas[1]).not.toHaveAttribute("open");
    expect(within(rodadas[0]).getByText(/Reenvio manual · 14\/10 às 10:40/)).toBeInTheDocument();
    expect(within(rodadas[1]).getByText(/Automático · 14\/10 às 09:12/)).toBeInTheDocument();
    expect(within(rodadas[1]).getByText(/2 de 2 grupos receberam/)).toBeInTheDocument();

    const cartoes = within(rodadas[0]).getAllByTestId("group-card");
    expect(cartoes.map((c) => within(c).getByText(/^Vagas Freela/).textContent)).toEqual([
      "Vagas Freela Campinas SP",
      "Vagas Freela Valinhos SP",
      "Vagas Freela Vinhedo SP",
      "Vagas Freela Sumaré SP",
    ]);
    expect(within(cartoes[0]).getByText("Campinas-SP · 4 km")).toBeInTheDocument();
    expect(within(cartoes[0]).getByText("Cidade da vaga")).toBeInTheDocument();
    expect(within(cartoes[0]).getByText("Enviado às 10:40")).toBeInTheDocument();
    expect(within(cartoes[2]).getByText("Vinhedo-SP · 12 km")).toBeInTheDocument();
    expect(within(cartoes[2]).getByText("Até 30 km")).toBeInTheDocument();
    expect(within(cartoes[2]).getByText("Falhou às 10:40")).toBeInTheDocument();
    expect(within(cartoes[2]).getByText("O bot não está no grupo.")).toBeInTheDocument();

    expect(
      screen.getByText(
        "Distância em linha reta, do local da vaga até o centro da cidade do grupo, arredondada para o km inteiro.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Reenviar para 4 grupos" })).toBeInTheDocument();
  });

  it("sem localização: aviso âmbar acima da lista, e a lista continua", async () => {
    api.getVacancyGroupBroadcasts.mockResolvedValue(
      broadcasts({
        groupBroadcastAt: T1040,
        rounds: [round([dest({ distanceKm: null })], { centerSource: null })],
      }),
    );
    renderSection();
    expect(
      await screen.findByText("Sem localização da vaga: foi só para o grupo da cidade."),
    ).toBeInTheDocument();
    expect(screen.getByText(/os grupos a até 30 km não receberam/)).toBeInTheDocument();
    expect(screen.getAllByTestId("group-card")).toHaveLength(1);
  });

  it("nenhum grupo no raio: explica e leva para Grupos de WhatsApp, sem botão de envio", async () => {
    api.getVacancyGroupBroadcasts.mockResolvedValue(broadcasts());
    api.getVacancyGroupBroadcastPreview.mockResolvedValue({
      ...QUATRO,
      vacancyCity: "Gramado",
      vacancyUf: "RS",
      ownCityHasGroup: false,
      destinations: [],
    });
    renderSection();
    expect(await screen.findByText("Nenhum grupo a até 30 km do local da vaga.")).toBeInTheDocument();
    expect(screen.getByText(/Gramado-RS não tem grupo, e nenhuma cidade a até 30 km tem\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para Grupos de WhatsApp" })).toHaveAttribute(
      "href",
      "/grupos-whatsapp",
    );
    expect(screen.queryByRole("button", { name: /Enviar|Reenviar/ })).not.toBeInTheDocument();
  });

  it("todos falharam: motivo da API e 'Tentar de novo'", async () => {
    api.getVacancyGroupBroadcasts.mockResolvedValue(
      broadcasts({
        rounds: [
          round([
            dest({ status: "FAILED", sentAt: null, errorCode: "FALHA_NO_ENVIO", error: "WhatsApp desconectado." }),
            dest({ groupName: "Vagas Freela Valinhos SP", reason: "RADIUS", status: "FAILED", sentAt: null, errorCode: "FALHA_NO_ENVIO", error: "WhatsApp desconectado." }),
          ]),
        ],
      }),
    );
    renderSection();
    const alerta = await screen.findByText("A vaga não saiu em nenhum grupo.");
    expect(alerta.parentElement).toHaveTextContent(
      "A vaga não saiu em nenhum grupo. WhatsApp desconectado. Tente de novo em alguns minutos.",
    );
    expect(await screen.findByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("registro antigo: diz quando saiu e que não sabemos para quais grupos", async () => {
    api.getVacancyGroupBroadcasts.mockResolvedValue(
      broadcasts({ groupBroadcastAt: "2026-08-11T23:04:00.000Z" }),
    );
    renderSection();
    expect(
      await screen.findByText(
        /Enviada em 11\/08 às 20:04, antes de o painel registrar os grupos\. Não sabemos quais grupos receberam\./,
      ),
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Reenviar para 4 grupos" })).toBeInTheDocument();
  });

  it("erro ao carregar (503): mensagem, o motivo da API e 'Tentar de novo' relê", async () => {
    api.getVacancyGroupBroadcasts.mockRejectedValue(
      erroHttp(503, "Registro da divulgação indisponível agora.", "GROUP_BROADCAST_UNAVAILABLE"),
    );
    renderSection();
    expect(
      await screen.findByText("Não conseguimos carregar a divulgação desta vaga.", undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Registro da divulgação indisponível agora.")).toBeInTheDocument();
    const antes = api.getVacancyGroupBroadcasts.mock.calls.length;
    api.getVacancyGroupBroadcasts.mockResolvedValue(broadcasts());
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(api.getVacancyGroupBroadcasts.mock.calls.length).toBeGreaterThan(antes));
    expect(await screen.findByText("Ainda não divulgada.")).toBeInTheDocument();
  });

  it("API antiga (404): mostra o registro da coluna e reenvia ao grupo da cidade", async () => {
    api.getVacancyGroupBroadcasts.mockRejectedValue(rotaInexistente());
    api.getVacancyGroupBroadcastPreview.mockRejectedValue(rotaInexistente());
    api.resendVacancyGroupMessage.mockResolvedValue({ roundId: null, destinations: [] });
    renderSection({
      record: { vacancyId: "v1", stage: "groupBroadcast", lastSentAt: T0912, sendCount: 1, autoSentAt: T0912 },
    });

    expect(
      await screen.findByText(/Enviada em 14\/10 às 09:12 \(automático\)\. Não sabemos quais grupos receberam\./),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar" }));
    expect(await screen.findByText("Reenviar a vaga ao grupo da cidade?")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reenviar" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Vaga enviada ao grupo da cidade."));
    expect(api.resendVacancyGroupMessage).toHaveBeenCalledWith("v1", "empresa");
  });
});

describe("VacancyGroupBroadcastsSection — reenviar", () => {
  it("confirmação lista os grupos e avisa que vai para todos, com a última divulgação", async () => {
    api.getVacancyGroupBroadcasts.mockResolvedValue(broadcasts({ rounds: [PARCIAL] }));
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar para 4 grupos" }));

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Reenviar a vaga para 4 grupos?")).toBeInTheDocument();
    expect(dialogo).toHaveTextContent(
      "A mensagem vai de novo para todos os grupos a até 30 km do local da vaga, inclusive os que já receberam. Quem já viu vai receber de novo. Última divulgação: hoje às 10:40 (há 25 min).",
    );
    const linhas = within(within(dialogo).getByRole("list", { name: "Grupos que vão receber" }))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(linhas).toEqual([
      "Vagas Freela Campinas SP · Campinas-SP · 4 km",
      "Vagas Freela Valinhos SP · Valinhos-SP · 10 km",
      "Vagas Freela Vinhedo SP · Vinhedo-SP · 12 km",
      "Vagas Freela Sumaré SP · Sumaré-SP · 21 km",
    ]);

    fireEvent.click(within(dialogo).getByRole("button", { name: "Voltar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.resendVacancyGroupMessage).not.toHaveBeenCalled();
  });

  it("clique duplo manda UMA vez; depois relê até não haver grupo na fila e avisa o resultado", async () => {
    const naFila = round(
      [
        dest({ status: "PENDING", sentAt: null }),
        dest({ groupName: "Vagas Freela Vinhedo SP", city: "Vinhedo", distanceKm: 12, reason: "RADIUS", status: "PENDING", sentAt: null }),
      ],
      { roundId: "r-novo", createdAt: "2026-10-14T14:04:00.000Z" },
    );
    const andando = round(
      [
        dest({ sentAt: "2026-10-14T14:04:03.000Z" }),
        dest({ groupName: "Vagas Freela Vinhedo SP", city: "Vinhedo", distanceKm: 12, reason: "RADIUS", status: "SENDING", sentAt: null }),
      ],
      { roundId: "r-novo", createdAt: "2026-10-14T14:04:00.000Z" },
    );
    const fim = round(
      [
        dest({ sentAt: "2026-10-14T14:04:03.000Z" }),
        dest({ groupName: "Vagas Freela Vinhedo SP", city: "Vinhedo", distanceKm: 12, reason: "RADIUS", status: "FAILED", sentAt: null, errorCode: "FALHA_NO_ENVIO", error: "O bot não está no grupo." }),
      ],
      { roundId: "r-novo", createdAt: "2026-10-14T14:04:00.000Z" },
    );

    api.getVacancyGroupBroadcasts
      .mockResolvedValueOnce(broadcasts()) // abertura: nunca saiu
      .mockResolvedValueOnce(broadcasts({ inFlight: 2, canResend: false, rounds: [naFila] })) // logo depois do POST
      .mockResolvedValueOnce(broadcasts({ inFlight: 1, canResend: false, rounds: [andando] }))
      .mockResolvedValue(broadcasts({ rounds: [fim] }));
    let responder: (v: unknown) => void = () => {};
    api.resendVacancyGroupMessage.mockReturnValue(
      new Promise((resolve) => {
        responder = resolve;
      }),
    );

    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Enviar para 4 grupos" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Enviar a vaga para 4 grupos?")).toBeInTheDocument();
    expect(dialogo).toHaveTextContent("A mensagem vai para todos os grupos a até 30 km do local da vaga.");

    const confirmar = within(dialogo).getByRole("button", { name: "Enviar para 4 grupos" });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);
    expect(await within(dialogo).findByRole("button", { name: "Enviando…" })).toBeDisabled();
    responder({ roundId: "r-novo", destinations: QUATRO.destinations.slice(0, 2) });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.resendVacancyGroupMessage).toHaveBeenCalledTimes(1);
    expect(api.resendVacancyGroupMessage).toHaveBeenCalledWith("v1", "empresa");
    expect(toast.info).toHaveBeenCalledWith(
      "Enviando a vaga para 2 grupos, 1 a cada ~3 s. Avisamos quando terminar.",
    );

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        "Vaga enviada a 1 de 2 grupos. Vagas Freela Vinhedo SP não recebeu: O bot não está no grupo. Veja em Detalhes da vaga.",
      ),
    );
    expect(await screen.findByText(/Recebeu em 1 de 2 grupos na última rodada/)).toBeInTheDocument();

    // Parou de reler: sem grupo na fila, nenhuma leitura nova.
    const leituras = api.getVacancyGroupBroadcasts.mock.calls.length;
    await new Promise((r) => setTimeout(r, 120));
    expect(api.getVacancyGroupBroadcasts.mock.calls.length).toBe(leituras);
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it("erro da API no reenvio: mostra a mensagem dela", async () => {
    api.getVacancyGroupBroadcasts.mockResolvedValue(broadcasts({ rounds: [PARCIAL] }));
    api.resendVacancyGroupMessage.mockRejectedValue(
      erroHttp(400, "Nenhum grupo a até 30 km do local da vaga."),
    );
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar para 4 grupos" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Reenviar para 4 grupos" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Nenhum grupo a até 30 km do local da vaga."),
    );
    // A confirmação continua aberta para a pessoa ler e decidir.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sem resposta da API: avisa para atualizar antes de reenviar", async () => {
    api.getVacancyGroupBroadcasts.mockResolvedValue(broadcasts({ rounds: [PARCIAL] }));
    api.resendVacancyGroupMessage.mockRejectedValue(
      Object.assign(new Error("timeout of 30000ms exceeded"), { isAxiosError: true }),
    );
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar para 4 grupos" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reenviar para 4 grupos" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Não conseguimos confirmar o envio. Atualize a página antes de reenviar, para não mandar em dobro.",
      ),
    );
  });
});

describe("VacancyGroupBroadcastsSection — contrato final (bloqueio, 404 e 409)", () => {
  it("404 VACANCY_NOT_FOUND é erro de verdade, não 'API antiga'", async () => {
    api.getVacancyGroupBroadcasts.mockRejectedValue(erroHttp(404, "Vaga não encontrada.", "VACANCY_NOT_FOUND"));
    renderSection();
    expect(await screen.findByText("Não conseguimos carregar a divulgação desta vaga.")).toBeInTheDocument();
    expect(screen.getByText("Vaga não encontrada.")).toBeInTheDocument();
    expect(api.getVacancyGroupBroadcasts).toHaveBeenCalledTimes(1); // 404 não repete
  });

  it("canResend falso: botão travado com o porquê da API", async () => {
    api.getVacancyGroupBroadcasts.mockResolvedValue(
      broadcasts({
        groupBroadcastAt: T1040,
        canResend: false,
        resendBlockedReason: "Só dá para divulgar vaga aberta.",
        rounds: [PARCIAL],
      }),
    );
    api.getVacancyGroupBroadcastPreview.mockResolvedValue({
      ...QUATRO,
      canResend: false,
      resendBlockedReason: "Só dá para divulgar vaga aberta.",
    });
    renderSection();
    expect(await screen.findByText("Só dá para divulgar vaga aberta.")).toBeInTheDocument();
    const botao = screen.getByRole("button", { name: /Reenviar/ });
    expect(botao).toBeDisabled();
    fireEvent.click(botao);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("envio anterior ainda na fila (inFlight): botão 'Enviando…' travado", async () => {
    const naFila = round([dest(), dest({ groupName: "Vagas Freela Vinhedo SP", reason: "RADIUS", status: "PENDING", sentAt: null })]);
    api.getVacancyGroupBroadcasts.mockResolvedValue(
      broadcasts({
        inFlight: 1,
        canResend: false,
        resendBlockedReason: "Ainda estamos enviando a divulgação anterior (1 grupo(s) na fila). Espere terminar para reenviar.",
        rounds: [naFila],
      }),
    );
    renderSection({ pollMs: 60_000 });
    expect(await screen.findByRole("button", { name: "Enviando…" })).toBeDisabled();
    expect(screen.getByText(/Espere terminar para reenviar\./)).toBeInTheDocument();
    expect(screen.getByText(/^Enviando: 1 de 2 grupos já receberam/)).toBeInTheDocument();
  });

  it("POST 409 BROADCAST_IN_PROGRESS: aviso com a mensagem da API, sem tom de erro", async () => {
    api.getVacancyGroupBroadcasts.mockResolvedValue(broadcasts({ groupBroadcastAt: T1040, rounds: [PARCIAL] }));
    api.resendVacancyGroupMessage.mockRejectedValue(
      erroHttp(409, "Ainda estamos enviando a divulgação anterior (2 grupo(s) na fila). Espere terminar para reenviar.", "BROADCAST_IN_PROGRESS"),
    );
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar para 4 grupos" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reenviar para 4 grupos" }));
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        "Ainda estamos enviando a divulgação anterior (2 grupo(s) na fila). Espere terminar para reenviar.",
      ),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("POST 409 VACANCY_NOT_OPEN: mostra a mensagem da API", async () => {
    api.getVacancyGroupBroadcasts.mockResolvedValue(broadcasts({ groupBroadcastAt: T1040, rounds: [PARCIAL] }));
    api.resendVacancyGroupMessage.mockRejectedValue(
      erroHttp(409, "Só dá para divulgar vaga aberta.", "VACANCY_NOT_OPEN"),
    );
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar para 4 grupos" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Reenviar para 4 grupos" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Só dá para divulgar vaga aberta."));
  });

  it("confirmação: cidade sem grupo vai só para as vizinhas, e o teto diz quem fica de fora", async () => {
    api.getVacancyGroupBroadcasts.mockResolvedValue(broadcasts());
    api.getVacancyGroupBroadcastPreview.mockResolvedValue({
      ...QUATRO,
      vacancyCity: "Gramado",
      vacancyUf: "RS",
      centerSource: "CITY_SEAT",
      ownCityHasGroup: false,
      destinations: [
        { groupJid: "c", groupName: "Vagas Freela Canela RS", city: "Canela", uf: "RS", distanceKm: 7.9, reason: "RADIUS" },
      ],
      skipped: [
        { groupJid: "x", groupName: "Vagas Freela Caxias RS", city: "Caxias do Sul", uf: "RS", distanceKm: 28.4, reason: "RADIUS" },
      ],
    });
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Enviar para 1 grupo" }));
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toHaveTextContent(
      "A mensagem vai para todos os grupos a até 30 km do centro da cidade da vaga.",
    );
    expect(within(dialogo).getByText("Gramado-RS não tem grupo: vai só para os grupos de cidades vizinhas.")).toBeInTheDocument();
    expect(
      within(dialogo).getByText("1 grupo fica de fora pelo limite de 8 cidades vizinhas e 20 grupos por vaga:"),
    ).toBeInTheDocument();
    expect(within(dialogo).getByText("Vagas Freela Caxias RS · Caxias do Sul-RS · 28 km")).toBeInTheDocument();
  });
});

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCandidates, choose } = vi.hoisted(() => ({ getCandidates: vi.fn(), choose: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/lot-choice-api", () => ({
  getAdminLotCandidates: getCandidates,
  chooseAdminLot: choose,
}));

import { LotChoiceDialog } from "./lot-choice-dialog";

function httpError(status: number, error: Record<string, unknown>) {
  const err = new AxiosError("x");
  err.response = { status, data: { error } } as never;
  return err;
}

const person = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  id: `cand-${id}`,
  vacancyId: "v1",
  status: "PENDING",
  appliedAt: null,
  workedHereCount: 0,
  hasWarningBadge: false,
  busy: false,
  chosenInOtherFunction: null,
  otherFunctionsThatDay: [],
  choosable: true,
  lastAskOutcome: null,
  provider: { providerGlobalId: id, name, averageRating: 4.5, completedServices: 3 },
  ...over,
});

const view = {
  lotId: "l1",
  groupKey: "k1",
  serviceDate: "2026-11-14",
  title: "Garçom",
  startTime: null,
  endTime: null,
  billing: "PREPAID",
  vacancies: 12,
  free: 7,
  choiceMax: 20,
  askPlan: null,
  chosen: [],
  candidates: [person("g1", "Ana Souza"), person("g2", "João Pereira"), person("g3", "Carla Dias", { choosable: false, busy: true })],
  total: 3,
};

function renderDialog(props: Partial<React.ComponentProps<typeof LotChoiceDialog>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 }, mutations: { retry: false } } });
  const onGroupGone = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <LotChoiceDialog lotId="l1" groupKey="k1" title="Garçom" onClose={vi.fn()} onGroupGone={onGroupGone} {...props} />
    </QueryClientProvider>,
  );
  return { onGroupGone };
}

describe("A4: escolher pelo lote", () => {
  beforeEach(() => vi.clearAllMocks());

  it("avisa que é no lugar da empresa e que pelo admin não há pergunta; quem está ocupado não marca", async () => {
    getCandidates.mockResolvedValue(view);
    renderDialog();
    expect(await screen.findByText("Você está escolhendo no lugar da empresa. Fica registrado no seu nome.")).toBeInTheDocument();
    expect(screen.getByTestId("lot-choice-no-ask")).toHaveTextContent("o suporte");
    expect(await screen.findByLabelText("Escolher Carla Dias")).toBeDisabled();
    expect(screen.getByText("Já escolhida em outro serviço nesse horário.")).toBeInTheDocument();
    expect(screen.getByTestId("lot-choice-counts")).toHaveTextContent("12 vagas = 0 escolhidas + 7 livres");
  });

  it("nada é enviado sem a confirmação; o corpo leva providerGlobalId na ordem dos cliques", async () => {
    getCandidates.mockResolvedValue(view);
    choose.mockResolvedValue({
      summary: { requested: 2, accepted: 2, alreadyChosen: 0, failed: 0, billing: "PREPAID", chosenAmountInCents: 0, dayUnpaidCount: 0, dayUnpaidInCents: 0 },
      items: [],
    });
    renderDialog();
    fireEvent.click(await screen.findByLabelText("Escolher João Pereira"));
    fireEvent.click(screen.getByLabelText("Escolher Ana Souza"));
    fireEvent.click(screen.getByRole("button", { name: "Escolher 2 pessoas" }));
    expect(choose).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText(/Escolher 2 pessoas no lugar da empresa\?/)).toBeInTheDocument();
    expect(confirm).toHaveTextContent("a empresa é quem paga");
    fireEvent.click(within(confirm).getByRole("button", { name: "Confirmar escolha" }));
    await waitFor(() => expect(choose).toHaveBeenCalledTimes(1));
    expect(choose).toHaveBeenCalledWith("l1", { groupKey: "k1", providerGlobalIds: ["g2", "g1"] });
  });

  it("resultado por item: o recusado aparece com a mensagem da API e não esconde o escolhido", async () => {
    getCandidates.mockResolvedValue(view);
    choose.mockResolvedValue({
      summary: { requested: 2, accepted: 1, alreadyChosen: 0, failed: 1, billing: "PREPAID", chosenAmountInCents: 18100, dayUnpaidCount: 1, dayUnpaidInCents: 18100 },
      items: [
        { providerGlobalId: "g1", status: "ACCEPTED", vacancyId: "v1", candidacyId: "c1", vacancyPaid: false, message: "Escolha feita. Falta pagar.", ask: null },
        { providerGlobalId: "g2", status: "SCHEDULE_CONFLICT", vacancyId: null, candidacyId: null, vacancyPaid: false, message: "Acabou de aceitar outro serviço nesse horário.", ask: null },
      ],
    });
    renderDialog();
    fireEvent.click(await screen.findByLabelText("Escolher Ana Souza"));
    fireEvent.click(screen.getByLabelText("Escolher João Pereira"));
    fireEvent.click(screen.getByRole("button", { name: "Escolher 2 pessoas" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Confirmar escolha" }));
    const items = await screen.findAllByTestId("lot-choice-item");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Ana Souza");
    expect(items[0]).toHaveTextContent("Escolha feita. Falta pagar.");
    expect(items[1]).toHaveTextContent("João Pereira");
    expect(items[1]).toHaveTextContent("Não entrou");
    expect(items[1]).toHaveTextContent("Acabou de aceitar outro serviço nesse horário.");
    expect(screen.getByTestId("lot-choice-result")).toHaveTextContent("2 pedidas = 1 escolhidas agora + 0 já estavam escolhidas + 1 recusadas");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    // depois do resultado a marcação recomeça do zero
    expect(screen.getByRole("button", { name: "Escolher" })).toBeDisabled();
  });

  it("a lista é relida depois da escolha (quem entrou vira 'escolhido'): os nomes seguem no resultado e a marcação some", async () => {
    const after = {
      ...view,
      chosen: [{ candidacyId: "c1", vacancyId: "v1", providerGlobalId: "g1", name: "Ana Souza", paid: false, confirmedAt: null, ask: null }],
      candidates: [person("g2", "João Pereira", { choosable: false, busy: true })],
    };
    getCandidates.mockResolvedValueOnce(view).mockResolvedValue(after);
    choose.mockResolvedValue({
      summary: { requested: 2, accepted: 1, alreadyChosen: 0, failed: 1, billing: "PREPAID", chosenAmountInCents: 18100, dayUnpaidCount: 1, dayUnpaidInCents: 18100 },
      items: [
        { providerGlobalId: "g1", status: "ACCEPTED", vacancyId: "v1", candidacyId: "c1", vacancyPaid: false, message: "Escolha feita. Falta pagar.", ask: null },
        { providerGlobalId: "g2", status: "SCHEDULE_CONFLICT", vacancyId: null, candidacyId: null, vacancyPaid: false, message: "Acabou de aceitar outro serviço nesse horário.", ask: null },
      ],
    });
    renderDialog();
    fireEvent.click(await screen.findByLabelText("Escolher Ana Souza"));
    fireEvent.click(screen.getByLabelText("Escolher João Pereira"));
    fireEvent.click(screen.getByRole("button", { name: "Escolher 2 pessoas" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Confirmar escolha" }));
    await waitFor(() => expect(getCandidates).toHaveBeenCalledTimes(2));
    const items = await screen.findAllByTestId("lot-choice-item");
    expect(items[0]).toHaveTextContent("Ana Souza");
    expect(items[1]).toHaveTextContent("João Pereira");
    expect(screen.getAllByTestId("lot-chosen")[0]).toHaveTextContent("Ana Souza");
    expect(screen.getByRole("button", { name: "Escolher" })).toBeDisabled();
  });

  it("com `askPlan`, o topo e a confirmação dizem que a API pergunta sozinha", async () => {
    getCandidates.mockResolvedValue({ ...view, askPlan: { askAt: "2026-11-14T17:02:00.000Z", answerMinutes: 60, delaySeconds: 120 } });
    renderDialog();
    fireEvent.click(await screen.findByLabelText("Escolher Ana Souza"));
    expect(screen.getByTestId("lot-choice-no-ask")).toHaveTextContent("a API pergunta “Ainda pode vir?” sozinha");
    fireEvent.click(screen.getByRole("button", { name: "Escolher 1 pessoa" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("recebe a pergunta “Ainda pode vir?” no lugar do aviso de escolha");
    expect(confirm).not.toHaveTextContent("recebe o aviso de que foi escolhida");
  });

  it("422 LOT_CHOICE_TOO_MANY: mostra o máximo na confirmação e nada é dado como feito", async () => {
    getCandidates.mockResolvedValue(view);
    choose.mockRejectedValue(httpError(422, { code: "LOT_CHOICE_TOO_MANY", message: "m", max: 20 }));
    renderDialog();
    fireEvent.click(await screen.findByLabelText("Escolher Ana Souza"));
    fireEvent.click(screen.getByRole("button", { name: "Escolher 1 pessoa" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Confirmar escolha" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("O máximo por escolha é 20.");
    expect(screen.queryByTestId("lot-choice-result")).toBeNull();
  });

  it("LOT_GROUP_NOT_FOUND ao escolher: avisa e manda o pai reler o lote", async () => {
    getCandidates.mockResolvedValue(view);
    choose.mockRejectedValue(httpError(404, { code: "LOT_GROUP_NOT_FOUND", message: "m" }));
    const { onGroupGone } = renderDialog();
    fireEvent.click(await screen.findByLabelText("Escolher Ana Souza"));
    fireEvent.click(screen.getByRole("button", { name: "Escolher 1 pessoa" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Confirmar escolha" }));
    await waitFor(() => expect(onGroupGone).toHaveBeenCalled());
  });

  it("404 VACANCY_LOT_CHOICE_DISABLED nos candidatos: 'recurso desligado', sem botão de escolher ativo", async () => {
    getCandidates.mockRejectedValue(httpError(404, { code: "VACANCY_LOT_CHOICE_DISABLED", message: "m" }));
    renderDialog();
    expect(await screen.findByTestId("lot-choice-off")).toHaveTextContent("recurso desligado");
    expect(screen.getByRole("button", { name: "Escolher" })).toBeDisabled();
    expect(getCandidates).toHaveBeenCalledTimes(1);
  });
});

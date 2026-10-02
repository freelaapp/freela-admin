import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  initialWizardState,
  type WizardKind,
  type WizardState,
} from "../_lib/campaign-wizard";
import { ExternalListPicker } from "./external-list-picker";
import { WizardAudienceStep } from "./wizard-audience-step";

const api = vi.hoisted(() => ({
  getAudienceOptions: vi.fn(),
  previewCampaignAudience: vi.fn(),
  previewExternalList: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/referrals-api", async (orig) => ({
  ...(await orig<object>()),
  ...api,
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const NOW = new Date("2026-10-01T12:00:00.000Z");

function Harness({
  kind,
  initial,
  locked,
  onState,
}: {
  kind: WizardKind;
  initial: WizardState;
  locked?: boolean;
  onState?: (state: WizardState) => void;
}) {
  const [state, setState] = useState(initial);
  useEffect(() => onState?.(state), [state, onState]);
  return (
    <WizardAudienceStep
      kind={kind}
      state={state}
      locked={locked}
      onChange={(patch) => setState((current) => ({ ...current, ...patch }))}
    />
  );
}

function renderStep(
  kind: WizardKind = "avulsa",
  over: Partial<WizardState> = {},
  locked = false,
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onState = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <Harness
        kind={kind}
        initial={{ ...initialWizardState(kind, { now: NOW }), ...over }}
        locked={locked}
        onState={onState}
      />
    </QueryClientProvider>,
  );
  return {
    onState,
    last: () =>
      onState.mock.calls[onState.mock.calls.length - 1][0] as WizardState,
  };
}

describe("WizardAudienceStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAudienceOptions.mockResolvedValue({
      total: 425,
      cities: [
        { city: "Campinas", uf: "SP", total: 300 },
        { city: "Rio de Janeiro", uf: "RJ", total: 125 },
      ],
    });
    api.previewCampaignAudience.mockResolvedValue({
      total: 425,
      byChannel: { WHATSAPP: 418, EMAIL: 7 },
      semCoordenada: 0,
      excludedByOptOut: 12,
    });
  });

  it("conta com WhatsApp, só e-mail e quem já pediu para não receber", async () => {
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Contar" }));

    const count = await screen.findByTestId("audience-count");
    await waitFor(() => expect(count).toHaveTextContent("425 pessoas"));
    expect(count).toHaveTextContent(
      "418 com WhatsApp · 7 só e-mail · 12 já pediram para não receber (ficam de fora)",
    );
    expect(api.previewCampaignAudience).toHaveBeenCalledWith({
      audience: "CONTRACTORS_ALL",
    });
  });

  it("UF, cidade e tipo de conta entram no recorte e zeram a contagem", async () => {
    const { last } = renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Contar" }));
    await screen.findByText("425 pessoas");

    fireEvent.click(await screen.findByRole("button", { name: "SP" }));
    expect(last().count).toBeNull();
    // Com SP marcado, só as cidades de SP aparecem.
    expect(
      screen.queryByRole("button", { name: /^Rio de Janeiro/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Campinas/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Empresa (bares e restaurantes)" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Contar" }));

    await waitFor(() =>
      expect(api.previewCampaignAudience).toHaveBeenLastCalledWith({
        audience: "CONTRACTORS_ALL",
        filters: {
          cities: ["Campinas"],
          ufs: ["SP"],
          modules: ["bars-restaurants"],
        },
      }),
    );
  });

  it("planilha: mostra o arquivo e a caixa de aceite, que começa desmarcada", () => {
    const { last } = renderStep();
    fireEvent.change(screen.getByLabelText("Quem recebe"), {
      target: { value: "EXTERNAL_LIST" },
    });

    expect(screen.getByText("Escolher arquivo")).toBeInTheDocument();
    const optIn = screen.getByRole("checkbox", {
      name: /Essas pessoas aceitaram receber mensagens da Freela\./,
    });
    expect(optIn).not.toBeChecked();
    expect([last().messagesPerHour, last().dailyCap]).toEqual([20, 100]);

    fireEvent.click(optIn);
    expect(last().optInConfirmed).toBe(true);
  });

  it("automática: sem planilha e sem raio; freelancer sem tipo de conta", async () => {
    renderStep("automatica");
    const options = Array.from(
      (screen.getByLabelText("Quem recebe") as HTMLSelectElement).options,
    ).map((o) => o.textContent);
    expect(options).not.toContain("Planilha (pessoas que aceitaram receber)");
    expect(
      screen.queryByLabelText("Raio a partir de uma cidade"),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Quem recebe"), {
      target: { value: "PROVIDERS_NEVER_APPLIED" },
    });
    expect(screen.queryByText("Tipo de conta")).not.toBeInTheDocument();
  });

  it("rascunho já criado: público congelado, só o nome muda", () => {
    renderStep("avulsa", { name: "Apresentação" }, true);
    expect(screen.queryByLabelText("Quem recebe")).not.toBeInTheDocument();
    expect(screen.getByText("Todos os contratantes")).toBeInTheDocument();
    expect(
      screen.getByText(
        "O público foi congelado quando a campanha foi criada. Para mudar, encerre esta campanha e crie outra.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome da campanha")).toHaveValue(
      "Apresentação",
    );
  });

  it("nome: limite de 120 e aviso de 3 a 120", () => {
    renderStep("avulsa", { name: "ab" });
    expect(screen.getByLabelText("Nome da campanha")).toHaveAttribute(
      "maxLength",
      "120",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "O nome precisa ter de 3 a 120 caracteres.",
    );
  });

  it("celular: alvos de 44 px e contagem em coluna", () => {
    renderStep();
    expect(screen.getByLabelText("Nome da campanha")).toHaveClass("min-h-11");
    expect(screen.getByLabelText("Quem recebe")).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Contar" })).toHaveClass(
      "min-h-11",
    );
    expect(screen.getByTestId("audience-count").parentElement).toHaveClass(
      "flex-col",
      "sm:flex-row",
    );
  });
});

describe("ExternalListPicker", () => {
  const sheet = {
    fileName: "lista.xlsx",
    sheetName: "Contatos",
    headers: ["Nome", "Telefone"],
    rows: [
      ["Ana", "11999990001"],
      ["Bia", "11999990002"],
    ],
  };

  function renderPicker(
    value: Parameters<typeof ExternalListPicker>[0]["value"],
  ) {
    const qc = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const onChange = vi.fn();
    render(
      <QueryClientProvider client={qc}>
        <ExternalListPicker value={value} onChange={onChange} />
      </QueryClientProvider>,
    );
    return { onChange };
  }

  beforeEach(() => vi.clearAllMocks());

  it("confere a lista na API com os contatos normalizados", async () => {
    const preview = {
      valid: 2,
      invalid: [],
      duplicates: 0,
      alreadyRegistered: 0,
      alreadyRegisteredRows: [],
      byChannel: { whatsapp: 2, email: 0 },
      excludedByOptOut: 1,
    };
    api.previewExternalList.mockResolvedValue(preview);
    const { onChange } = renderPicker({
      sheet,
      mapping: { name: 0, phone: 1, email: null },
      preview: null,
      skipRegistered: true,
    });

    fireEvent.click(screen.getByTestId("check-list-button"));

    await waitFor(() =>
      expect(api.previewExternalList).toHaveBeenCalledWith([
        { name: "Ana", phone: "+5511999990001" },
        { name: "Bia", phone: "+5511999990002" },
      ]),
    );
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ preview }));
  });

  it("lista conferida: quem entra e quem já saiu (fica de fora)", () => {
    renderPicker({
      sheet,
      mapping: { name: 0, phone: 1, email: null },
      preview: {
        valid: 2,
        invalid: [],
        duplicates: 0,
        alreadyRegistered: 0,
        alreadyRegisteredRows: [],
        byChannel: { whatsapp: 2, email: 0 },
        excludedByOptOut: 1,
      },
      skipRegistered: true,
    });
    expect(screen.getByTestId("will-send")).toHaveTextContent(
      "Vão entrar na campanha: 2 contatos.",
    );
    expect(
      screen.getByText("1 já pediu para não receber (fica de fora)."),
    ).toBeInTheDocument();
  });
});

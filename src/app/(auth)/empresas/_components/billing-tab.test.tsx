import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/admin/infrastructure/billing-mode-api", () => ({
  getBillingModeSettings: vi.fn(),
  updateBillingMode: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/contractor-settings-api", () => ({
  getContractorSettings: vi.fn(),
  getContractorSettingsHistory: vi.fn(),
  updateContractorSettings: vi.fn(),
}));

import { AxiosError, AxiosHeaders } from "axios";
import { toast } from "sonner";
import {
  getBillingModeSettings,
  updateBillingMode,
  type BillingModeSettings,
} from "@/modules/admin/infrastructure/billing-mode-api";
import { getContractorSettings } from "@/modules/admin/infrastructure/contractor-settings-api";
import { BillingTab } from "./billing-tab";

const BILLING_VIEW: BillingModeSettings = {
  mode: "PREPAID",
  since: null,
  email: null,
  contactEmail: "contato@bardoze.com.br",
  editable: true,
  requirements: { missing: [] },
  appUsage: { lastAppDay: null },
  previews: {
    INVOICED_7: {
      period: { start: "2026-10-09", end: "2026-10-15" },
      closeDate: "2026-10-16",
      dueDate: "2026-10-19",
      blockFromDate: "2026-10-23",
    },
    INVOICED_15: {
      period: { start: "2026-10-01", end: "2026-10-15" },
      closeDate: "2026-10-16",
      dueDate: "2026-10-19",
      blockFromDate: "2026-10-23",
    },
    INVOICED_30: {
      period: { start: "2026-10-01", end: "2026-10-31" },
      closeDate: "2026-11-01",
      dueDate: "2026-11-04",
      blockFromDate: "2026-11-08",
    },
  },
  openPreview: null,
  extraordinaryInvoice: null,
};

function renderTab(props: Partial<React.ComponentProps<typeof BillingTab>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BillingTab
        contractorUserId="owner-1"
        companyName="Bar do Zé"
        companyDocument="12.345.678/0001-90"
        onClose={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getBillingModeSettings).mockResolvedValue(BILLING_VIEW);
});

describe("BillingTab — modos e pré-requisitos", () => {
  it("quatro modos com a descrição de cada ciclo", async () => {
    renderTab();

    const group = await screen.findByRole("group", { name: "Modo de cobrança" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(screen.getByText("Modo atual:")).toBeInTheDocument();
    expect(screen.getByText("Pré-pago (Pix a cada contratação)")).toBeInTheDocument();
    expect(
      within(group).getByRole("radio", { name: "Pré-pago: Pix a cada contratação (padrão)" }),
    ).toBeChecked();
    expect(
      within(group).getByRole("radio", { name: 'Faturado semanal ("boleto 7")' }),
    ).toHaveAccessibleDescription(
      "Serviços de segunda a domingo. Fecha segunda às 08:00 e vence terça (ou no próximo dia útil).",
    );
    expect(
      within(group).getByRole("radio", { name: 'Faturado quinzenal ("boleto 15")' }),
    ).toHaveAccessibleDescription(
      "Serviços de 1 a 15 e de 16 ao fim do mês. Fecha nos dias 16 e 1 e vence no dia seguinte (ou no próximo dia útil).",
    );
    expect(
      within(group).getByRole("radio", { name: 'Faturado mensal ("boleto 30")' }),
    ).toHaveAccessibleDescription(
      "Serviços do mês. Fecha no dia 1 e vence no dia 2 (ou no próximo dia útil).",
    );
  });

  it("pré-requisito faltando: os três faturados desabilitados com 'Falta o número do endereço.' (ícone + texto)", async () => {
    vi.mocked(getBillingModeSettings).mockResolvedValue({
      ...BILLING_VIEW,
      requirements: { missing: ["number"] },
    });
    renderTab();

    const group = await screen.findByRole("group", { name: "Modo de cobrança" });
    for (const name of [
      'Faturado semanal ("boleto 7")',
      'Faturado quinzenal ("boleto 15")',
      'Faturado mensal ("boleto 30")',
    ]) {
      const radio = within(group).getByRole("radio", { name });
      expect(radio).toBeDisabled();
      expect(radio).toHaveAccessibleDescription(expect.stringContaining("Falta o número do endereço."));
    }
    expect(within(group).getByRole("radio", { name: /Pré-pago/ })).toBeEnabled();
    // Ícone acompanha o texto, e a lista de pré-requisitos diz o que falta.
    expect(within(group).getAllByTestId("missing-icon")).toHaveLength(3);
    expect(screen.getByText("Para faturar, o cadastro precisa de:")).toBeInTheDocument();
    expect(screen.getByText("Endereço completo: falta o número")).toBeInTheDocument();
    expect(screen.getByText("CNPJ: 12.345.678/0001-90")).toBeInTheDocument();
    expect(screen.getByText("E-mail: contato@bardoze.com.br")).toBeInTheDocument();
  });

  it("'Corrigir cadastro' abre o modal Editar Empresa", async () => {
    vi.mocked(getBillingModeSettings).mockResolvedValue({
      ...BILLING_VIEW,
      requirements: { missing: ["number"] },
    });
    const onEditCompany = vi.fn();
    renderTab({ onEditCompany });

    fireEvent.click(await screen.findByRole("button", { name: "Corrigir cadastro" }));

    expect(onEditCompany).toHaveBeenCalledTimes(1);
  });

  it("e-mail do financeiro com a ajuda 'Vazio: vão para o e-mail de contato ({e-mail})'", async () => {
    renderTab();

    const email = await screen.findByLabelText("E-mail do financeiro (opcional)");
    expect(email).toHaveValue("");
    expect(email).toHaveAccessibleDescription(
      "As faturas vão para este e-mail. Vazio: vão para o e-mail de contato (contato@bardoze.com.br).",
    );
  });

  it("mostra o horário que a API devolve (descrição do semanal e 1ª fatura)", async () => {
    vi.mocked(getBillingModeSettings).mockResolvedValue({ ...BILLING_VIEW, closeHourLabel: "06:00" });
    renderTab({ blockEnabled: true });

    const weekly = await screen.findByRole("radio", { name: 'Faturado semanal ("boleto 7")' });
    expect(weekly).toHaveAccessibleDescription(
      "Serviços de segunda a domingo. Fecha segunda às 06:00 e vence terça (ou no próximo dia útil).",
    );
    fireEvent.click(weekly);
    expect(screen.getByRole("region", { name: "O que muda" })).toHaveTextContent(
      "1ª fatura: fecha sex 16/10 às 06:00 com os serviços realizados até qui 15/10; vence seg 19/10.",
    );
  });

  it("'O que muda' com a 1ª fatura das prévias do servidor", async () => {
    renderTab({ blockEnabled: true });

    expect(screen.queryByText("O que muda")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("radio", { name: 'Faturado semanal ("boleto 7")' }));

    const region = screen.getByRole("region", { name: "O que muda" });
    expect(region).toHaveTextContent(
      "1ª fatura: fecha sex 16/10 às 08:00 com os serviços realizados até qui 15/10; vence seg 19/10.",
    );
    expect(region).toHaveTextContent(
      "Se não pagar, publicar e aprovar ficam bloqueados a partir de sex 23/10.",
    );
    await waitFor(() => expect(getBillingModeSettings).toHaveBeenCalledWith("owner-1"));
  });
});

/** Erro do axios com o corpo `{ error: { code, message, ... } }` do filtro global. */
function apiError(status: number, error: Record<string, unknown>): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("falhou", String(status), config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: { error },
  });
}

const REASON_ERROR = "Escreva o motivo (pelo menos 5 caracteres).";
const saveButton = () => screen.getByRole("button", { name: "Salvar cobrança" });
const reasonField = () => screen.getByLabelText("Motivo da mudança (obrigatório)");

describe("BillingTab — validação e salvar", () => {
  it("'Salvar cobrança' desabilitado sem mudança ou com motivo < 5", async () => {
    renderTab();
    await screen.findByRole("group", { name: "Modo de cobrança" });

    expect(saveButton()).toBeDisabled();
    fireEvent.change(reasonField(), { target: { value: "Contrato assinado" } });
    expect(saveButton()).toBeDisabled(); // nada mudou

    fireEvent.click(screen.getByRole("radio", { name: 'Faturado semanal ("boleto 7")' }));
    fireEvent.change(reasonField(), { target: { value: "abc" } });
    expect(saveButton()).toBeDisabled();
    fireEvent.change(reasonField(), { target: { value: "abcde" } });
    expect(saveButton()).toBeEnabled();
  });

  it("ao sair do campo curto: 'Escreva o motivo (pelo menos 5 caracteres).'", async () => {
    renderTab();
    fireEvent.click(await screen.findByRole("radio", { name: 'Faturado semanal ("boleto 7")' }));

    fireEvent.change(reasonField(), { target: { value: "abc" } });
    fireEvent.blur(reasonField());

    expect(screen.getByRole("alert")).toHaveTextContent(REASON_ERROR);
    expect(reasonField()).toHaveAttribute("aria-invalid", "true");
  });

  it("só o e-mail mudou: salva sem confirmação, manda só billingEmail + reason e avisa", async () => {
    vi.mocked(updateBillingMode).mockResolvedValue({
      ...BILLING_VIEW,
      email: "contas@bardoze.com.br",
    });
    renderTab();

    fireEvent.change(await screen.findByLabelText("E-mail do financeiro (opcional)"), {
      target: { value: "contas@bardoze.com.br" },
    });
    fireEvent.change(reasonField(), { target: { value: "Cliente pediu por e-mail" } });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(updateBillingMode).toHaveBeenCalledWith("owner-1", {
        billingEmail: "contas@bardoze.com.br",
        reason: "Cliente pediu por e-mail",
      }),
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith(
      "Salvo. E-mail do financeiro: contas@bardoze.com.br.",
    );
  });

  it("trocar o modo abre a confirmação; confirmar manda billingMode + reason", async () => {
    vi.mocked(updateBillingMode).mockResolvedValue({ ...BILLING_VIEW, mode: "INVOICED_7" });
    renderTab();

    fireEvent.click(await screen.findByRole("radio", { name: 'Faturado semanal ("boleto 7")' }));
    fireEvent.change(reasonField(), { target: { value: "Contrato comercial assinado" } });
    fireEvent.click(saveButton());

    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Ligar o faturado semanal para Bar do Zé?")).toBeInTheDocument();
    expect(updateBillingMode).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Ligar faturado semanal" }));

    await waitFor(() =>
      expect(updateBillingMode).toHaveBeenCalledWith("owner-1", {
        billingMode: "INVOICED_7",
        reason: "Contrato comercial assinado",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith("Salvo. Modo de cobrança: Faturado semanal.");
  });

  it("422 BILLING_REQUIRES_COMPANY_DATA lista os campos de `missing`", async () => {
    vi.mocked(updateBillingMode).mockRejectedValue(
      apiError(422, {
        code: "BILLING_REQUIRES_COMPANY_DATA",
        message: "Para faturar, complete o cadastro: número do endereço, bairro.",
        missing: ["number", "neighborhood"],
      }),
    );
    const onEditCompany = vi.fn();
    renderTab({ onEditCompany });

    fireEvent.click(await screen.findByRole("radio", { name: 'Faturado mensal ("boleto 30")' }));
    fireEvent.change(reasonField(), { target: { value: "Contrato comercial assinado" } });
    fireEvent.click(saveButton());
    fireEvent.click(screen.getByRole("button", { name: "Ligar faturado mensal" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Para faturar, complete o cadastro: o número do endereço e o bairro.",
    );
    fireEvent.click(within(alert).getByRole("button", { name: "Corrigir cadastro" }));
    expect(onEditCompany).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("422 REASON_REQUIRED aparece no campo", async () => {
    vi.mocked(updateBillingMode).mockRejectedValue(
      apiError(422, { code: "REASON_REQUIRED", message: REASON_ERROR }),
    );
    renderTab();

    fireEvent.change(await screen.findByLabelText("E-mail do financeiro (opcional)"), {
      target: { value: "contas@bardoze.com.br" },
    });
    fireEvent.change(reasonField(), { target: { value: "     ok   " } });
    fireEvent.change(reasonField(), { target: { value: "motivo" } });
    fireEvent.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(REASON_ERROR);
    expect(reasonField()).toHaveAttribute("aria-invalid", "true");
  });

  it("422 BILLING_EMAIL_INVALID aparece no campo do e-mail", async () => {
    vi.mocked(updateBillingMode).mockRejectedValue(
      apiError(422, {
        code: "BILLING_EMAIL_INVALID",
        message: "O e-mail do financeiro não parece válido. Confira e tente de novo.",
      }),
    );
    renderTab();

    const email = await screen.findByLabelText("E-mail do financeiro (opcional)");
    fireEvent.change(email, { target: { value: "contas@" } });
    fireEvent.change(reasonField(), { target: { value: "Cliente pediu" } });
    fireEvent.click(saveButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O e-mail do financeiro não parece válido. Confira e tente de novo.",
    );
    expect(email).toHaveAttribute("aria-invalid", "true");
  });
});

/** `AAAA-MM-DD` de N dias atrás, no calendário de Brasília. */
function daysAgoKey(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

describe("BillingTab — estados", () => {
  it("sem FINANCE (403): modo atual em texto e o aviso, rádios desabilitados", async () => {
    vi.mocked(getBillingModeSettings).mockRejectedValue(
      apiError(403, { code: "FORBIDDEN", message: "Sem permissão." }),
    );
    vi.mocked(getContractorSettings).mockResolvedValue({ billingMode: "INVOICED_7" } as never);
    renderTab();

    expect(
      await screen.findByText("Só quem tem acesso ao Financeiro muda o modo de cobrança."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Faturado semanal")).toBeInTheDocument();
    const radios = within(screen.getByRole("group", { name: "Modo de cobrança" })).getAllByRole(
      "radio",
    );
    expect(radios).toHaveLength(4);
    radios.forEach((radio) => expect(radio).toBeDisabled());
    expect(screen.getByRole("radio", { name: 'Faturado semanal ("boleto 7")' })).toBeChecked();
    expect(screen.queryByRole("button", { name: "Salvar cobrança" })).not.toBeInTheDocument();
  });

  it("editable false (chave do faturamento desligada): só o modo atual", async () => {
    vi.mocked(getBillingModeSettings).mockResolvedValue({ ...BILLING_VIEW, editable: false });
    renderTab();

    expect(
      await screen.findByText(
        "O faturamento ainda não está ligado. Por enquanto, toda empresa segue no pré-pago.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Pré-pago (Pix a cada contratação)")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar cobrança" })).not.toBeInTheDocument();
  });

  it("PATCH 404 FEATURE_DISABLED: vira só o modo atual, sem erro", async () => {
    vi.mocked(updateBillingMode).mockRejectedValue(
      apiError(404, { code: "FEATURE_DISABLED", message: "Recurso desligado." }),
    );
    renderTab();

    fireEvent.change(await screen.findByLabelText("E-mail do financeiro (opcional)"), {
      target: { value: "contas@bardoze.com.br" },
    });
    fireEvent.change(reasonField(), { target: { value: "Cliente pediu" } });
    fireEvent.click(saveButton());

    expect(
      await screen.findByText(
        "O faturamento ainda não está ligado. Por enquanto, toda empresa segue no pré-pago.",
      ),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("appUsage.lastAppDay recente: aviso para preferir quem usa o site", async () => {
    const lastAppDay = daysAgoKey(2);
    vi.mocked(getBillingModeSettings).mockResolvedValue({
      ...BILLING_VIEW,
      appUsage: { lastAppDay },
    });
    renderTab();

    const ddmm = `${lastAppDay.slice(8, 10)}/${lastAppDay.slice(5, 7)}`;
    expect(
      await screen.findByText(
        `Esta empresa usou o app em ${ddmm}. O app ainda não mostra o faturado; prefira começar por quem usa o site.`,
      ),
    ).toBeInTheDocument();
  });

  it("uso do app antigo (mais de 30 dias): sem aviso", async () => {
    vi.mocked(getBillingModeSettings).mockResolvedValue({
      ...BILLING_VIEW,
      appUsage: { lastAppDay: daysAgoKey(45) },
    });
    renderTab();

    await screen.findByRole("group", { name: "Modo de cobrança" });
    expect(screen.queryByText(/usou o app/)).not.toBeInTheDocument();
  });

  it("modo faturado mostra desde quando vale", async () => {
    vi.mocked(getBillingModeSettings).mockResolvedValue({
      ...BILLING_VIEW,
      mode: "INVOICED_7",
      since: "2026-10-11T18:20:00.000Z",
    });
    renderTab();

    expect(await screen.findByText("desde 11/10/2026")).toBeInTheDocument();
  });
});

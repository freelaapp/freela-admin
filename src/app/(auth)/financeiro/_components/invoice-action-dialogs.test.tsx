import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "inv-123" }),
  useRouter: () => ({ push, replace: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ isChecking: false, allowed: true }),
}));
vi.mock("@/modules/admin/infrastructure/billing-api", () => ({
  getAdminInvoice: vi.fn(),
  downloadAdminInvoicePdf: vi.fn(),
  resendInvoice: vi.fn(),
  issueSecondCopy: vi.fn(),
  markInvoicePaid: vi.fn(),
  waiveInvoiceBlock: vi.fn(),
  createBillingAdjustment: vi.fn(),
  closeInvoiceNow: vi.fn(),
  getBillingSummary: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/billing-mode-api", () => ({
  getBillingModeSettings: vi.fn(),
  updateBillingMode: vi.fn(),
}));

import { toast } from "sonner";
import { DETAIL } from "@/modules/admin/application/billing.test-fixtures";
import {
  closeInvoiceNow,
  createBillingAdjustment,
  getAdminInvoice,
  issueSecondCopy,
  markInvoicePaid,
  resendInvoice,
  waiveInvoiceBlock,
  type AdminInvoiceDetail,
} from "@/modules/admin/infrastructure/billing-api";
import { getBillingModeSettings } from "@/modules/admin/infrastructure/billing-mode-api";
import InvoiceDetailPage from "../faturas/[id]/page";
import { actionErrorMessage, InvoiceActions } from "./invoice-action-dialogs";

function apiError(status: number, code: string, message = code): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("falhou", String(status), config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: { error: { code, message } },
  });
}

function renderActions(detail: AdminInvoiceDetail = DETAIL) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <InvoiceActions detail={detail} />
    </QueryClientProvider>,
  );
}

const REASON_HINT = "Escreva o motivo (pelo menos 5 caracteres).";
const dialog = () => screen.getByRole("dialog");
const reason = () => within(dialog()).getByLabelText("Motivo (obrigatório)");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdminInvoice).mockResolvedValue(DETAIL);
});

describe("Ações da fatura", () => {
  it("botão com o verbo e o valor ('Dar baixa de R$ 1.248,60'), que segue o valor digitado", async () => {
    vi.mocked(markInvoicePaid).mockResolvedValue({
      invoice: {
        id: "inv-123",
        number: "FAT-2026-000123",
        status: "PAID",
        paidVia: "MANUAL",
        paidAt: "2026-10-20T15:00:00.000Z",
        paidAmountInCents: 124860,
        totalInCents: 124860,
      },
      pendingCharge: "CANCELLED",
    });
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Dar baixa manual" }));
    expect(within(dialog()).getByText("Dar baixa manual em FAT-2026-000123?")).toBeInTheDocument();
    expect(within(dialog()).getByLabelText("Data do pagamento")).toHaveValue("2026-10-20");
    expect(within(dialog()).getByLabelText("Valor recebido (R$)")).toHaveValue("1.248,60");
    fireEvent.change(reason(), { target: { value: "Transferência recebida no Itaú" } });

    const submit = within(dialog()).getByRole("button", { name: "Dar baixa de R$ 1.248,60" });
    fireEvent.click(submit);

    await waitFor(() =>
      expect(markInvoicePaid).toHaveBeenCalledWith("inv-123", {
        reason: "Transferência recebida no Itaú",
        paidAt: "2026-10-20",
        amountInCents: 124860,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Baixa de R$ 1.248,60 registrada. O Pix pendente foi cancelado.",
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("valor diferente do total: avisa e o botão mostra o valor novo", () => {
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Dar baixa manual" }));

    fireEvent.change(within(dialog()).getByLabelText("Valor recebido (R$)"), {
      target: { value: "1.000,00" },
    });

    expect(
      within(dialog()).getByText(
        "O valor é diferente do total da fatura (R$ 1.248,60). Explique no motivo.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog()).getByRole("button", { name: "Dar baixa de R$ 1.000,00" }),
    ).toBeInTheDocument();
  });

  it("motivo < 5: botão desabilitado com o porquê embaixo do campo", () => {
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar cobrança" }));

    const submit = within(dialog()).getByRole("button", { name: "Reenviar por push e e-mail" });
    expect(submit).toBeDisabled();
    expect(reason()).toHaveAccessibleDescription(REASON_HINT);
    fireEvent.change(reason(), { target: { value: "abcd" } });
    expect(submit).toBeDisabled();
    fireEvent.change(reason(), { target: { value: "abcde" } });
    expect(submit).toBeEnabled();
    expect(within(dialog()).queryByText(REASON_HINT)).not.toBeInTheDocument();
  });

  it("reenviar: canais escolhidos no botão e no pedido", async () => {
    vi.mocked(resendInvoice).mockResolvedValue({
      copy: "D_PLUS_1",
      label: "D+1",
      channels: { push: "skipped:not_selected", email: "sent", whatsapp: "skipped:not_enabled" },
    });
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar cobrança" }));

    expect(within(dialog()).getByLabelText("WhatsApp (ainda não ligado)")).toBeDisabled();
    fireEvent.click(within(dialog()).getByLabelText("Push"));
    fireEvent.change(reason(), { target: { value: "Cliente pediu de novo" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Reenviar por e-mail" }));

    await waitFor(() =>
      expect(resendInvoice).toHaveBeenCalledWith("inv-123", {
        reason: "Cliente pediu de novo",
        channels: ["email"],
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Cobrança reenviada: e-mail enviado.");
  });

  it("409 INVOICE_NOT_OPEN: 'Esta fatura já foi paga ou cancelada. Recarregue a página.'", async () => {
    vi.mocked(resendInvoice).mockRejectedValue(apiError(409, "INVOICE_NOT_OPEN"));
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Reenviar cobrança" }));
    fireEvent.change(reason(), { target: { value: "Cliente pediu de novo" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Reenviar por push e e-mail" }));

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
      "Esta fatura já foi paga ou cancelada. Recarregue a página.",
    );
  });

  it("503 da 2ª via: 'O código Pix ainda não está disponível.'", async () => {
    vi.mocked(issueSecondCopy).mockRejectedValue(apiError(503, "CHARGE_PROVIDER_UNAVAILABLE"));
    renderActions({
      ...DETAIL,
      actions: { ...DETAIL.actions, secondCopy: { enabled: true, reason: null } },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gerar 2ª via do Pix" }));
    expect(
      within(dialog()).getByText(
        "Gerar um novo código Pix? O código atual deixa de valer, inclusive o que está no e-mail já enviado.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(reason(), { target: { value: "Cliente perdeu o código" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Gerar novo código" }));

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
      "O código Pix ainda não está disponível.",
    );
  });

  it("ação desabilitada pela API mostra o porquê", () => {
    renderActions();

    expect(screen.getByRole("button", { name: "Gerar 2ª via do Pix" })).toBeDisabled();
    expect(
      screen.getByText(
        "Gerar 2ª via do Pix: O código Pix ainda não pode ser gerado: a cobrança Pix não está ligada.",
      ),
    ).toBeInTheDocument();
  });

  it("liberar bloqueio: data sugerida, botão 'Liberar até 27/10'", async () => {
    vi.mocked(waiveInvoiceBlock).mockResolvedValue({
      invoice: {
        id: "inv-123",
        number: "FAT-2026-000123",
        status: "ISSUED",
        blockWaivedUntil: "2026-10-28T02:59:59.999Z",
      },
      until: "2026-10-27",
      situation: DETAIL.situation,
    });
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Liberar bloqueio até…" }));

    expect(
      within(dialog()).getByText(
        "Liberar publicar e aprovar para Bar do Zé até 27/10? A fatura continua em aberto e a régua continua.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(reason(), { target: { value: "Cliente paga na sexta" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Liberar até 27/10" }));

    await waitFor(() =>
      expect(waiveInvoiceBlock).toHaveBeenCalledWith("inv-123", {
        reason: "Cliente paga na sexta",
        until: "2026-10-27",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Bloqueio liberado até 27/10.");
  });

  it("ajuste: requestId gerado ao abrir; clique duplo manda o mesmo; reabrir gera outro", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    vi.mocked(createBillingAdjustment)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)) as never)
      .mockResolvedValue({ line: { id: "l9" }, replayed: true } as never);
    renderActions();

    fireEvent.click(screen.getByRole("button", { name: "Lançar ajuste" }));
    fireEvent.click(within(dialog()).getByLabelText("Desconto (crédito)"));
    fireEvent.change(within(dialog()).getByLabelText("Valor (R$)"), { target: { value: "48,60" } });
    fireEvent.change(reason(), { target: { value: "Desconto combinado" } });
    const submit = within(dialog()).getByRole("button", { name: "Lançar desconto de R$ 48,60" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(createBillingAdjustment).toHaveBeenCalled());
    // O segundo clique não lança de novo (botão trava enquanto salva).
    expect(createBillingAdjustment).toHaveBeenCalledTimes(1);
    const firstId = vi.mocked(createBillingAdjustment).mock.calls[0][1].requestId;
    expect(firstId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(createBillingAdjustment).toHaveBeenCalledWith("owner-1", {
      direction: "CREDIT",
      amountInCents: 4860,
      reason: "Desconto combinado",
      vacancyId: null,
      requestId: firstId,
    });
    // Enquanto salva, o botão trava; se a rede repetir, o id é o mesmo.
    expect(vi.mocked(createBillingAdjustment).mock.calls.every((c) => c[1].requestId === firstId)).toBe(true);
    resolveFirst({ line: { id: "l9" }, replayed: false });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalledWith(
      "Desconto de R$ 48,60 lançado para Bar do Zé. Entra na próxima fatura.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Lançar ajuste" }));
    // O tipo é escolha explícita: sem ele, o botão não diz o que vai lançar.
    fireEvent.change(within(dialog()).getByLabelText("Valor (R$)"), { target: { value: "10" } });
    fireEvent.change(reason(), { target: { value: "Cobrança combinada" } });
    expect(within(dialog()).getByRole("button", { name: "Lançar ajuste" })).toBeDisabled();
    expect(within(dialog()).getByText("Escolha o tipo: desconto ou cobrança.")).toBeInTheDocument();
    fireEvent.click(within(dialog()).getByLabelText("Cobrança (débito)"));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Lançar cobrança de R$ 10,00" }));
    await waitFor(() => expect(createBillingAdjustment).toHaveBeenCalledTimes(2));
    const secondId = vi.mocked(createBillingAdjustment).mock.calls[1][1].requestId;
    expect(secondId).not.toBe(firstId);
    expect(toast.info).toHaveBeenCalledWith("Este ajuste já tinha sido lançado.");
  });

  it("fechar agora: texto com os lançamentos e o vencimento; 409 NOTHING_TO_INVOICE", async () => {
    vi.mocked(getBillingModeSettings).mockResolvedValue({
      mode: "INVOICED_7",
      since: null,
      email: null,
      contactEmail: null,
      editable: true,
      requirements: { missing: [] },
      appUsage: { lastAppDay: null },
      previews: DETAIL as never,
      openPreview: {
        lineCount: 5,
        debitsInCents: 70000,
        creditsInCents: 5970,
        totalInCents: 64030,
        calc: "700,00 − 59,70 = 640,30",
      },
      extraordinaryInvoice: { closeDate: "2026-10-20", dueDate: "2026-10-23", blockFromDate: "2026-10-27" },
    });
    vi.mocked(closeInvoiceNow).mockRejectedValue(
      apiError(409, "NOTHING_TO_INVOICE", "Nada a faturar."),
    );
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Fechar agora" }));

    expect(
      await within(dialog()).findByText(
        "Fechar agora uma fatura com os lançamentos ainda não faturados de Bar do Zé (5 lançamentos, R$ 640,30)? Vence em sex 23/10.",
      ),
    ).toBeInTheDocument();
    fireEvent.change(reason(), { target: { value: "Fim do contrato" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Fechar fatura agora" }));

    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
      "Não há serviços a faturar para esta empresa.",
    );
  });

  it("baixa com Pix pendente que não cancelou: aviso de atenção, não só sucesso", async () => {
    vi.mocked(markInvoicePaid).mockResolvedValue({
      invoice: { ...DETAIL.invoice, status: "PAID", paidVia: "MANUAL" } as never,
      pendingCharge: "FAILED",
    });
    renderActions();
    fireEvent.click(screen.getByRole("button", { name: "Dar baixa manual" }));
    fireEvent.change(reason(), { target: { value: "Depósito identificado" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Dar baixa de R$ 1.248,60" }));

    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        "Baixa de R$ 1.248,60 registrada, mas o Pix pendente não foi cancelado na Woovi. Cancele pelo painel da Woovi; se o Pix cair, devolva o valor.",
      ),
    );
  });
});

describe("Detalhe da fatura com as ações", () => {
  it("toast e linha nova em Mensagens depois de cada ação", async () => {
    vi.mocked(resendInvoice).mockResolvedValue({
      copy: "D_PLUS_1",
      label: "D+1",
      channels: { push: "sent", email: "sent", whatsapp: "skipped:not_enabled" },
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <InvoiceDetailPage />
      </QueryClientProvider>,
    );

    const actions = await screen.findByRole("region", { name: "Ações" });
    vi.mocked(getAdminInvoice).mockResolvedValue({
      ...DETAIL,
      history: [
        ...DETAIL.history,
        {
          step: "RESEND",
          label: "Reenvio",
          at: "2026-10-21T13:00:00.000Z",
          by: "João Lima",
          note: "ligação sem resposta",
          channels: { push: "sent", email: "sent", whatsapp: "skipped:not_enabled" },
          pending: false,
        },
      ],
    });
    fireEvent.click(within(actions).getByRole("button", { name: "Reenviar cobrança" }));
    fireEvent.change(reason(), { target: { value: "ligação sem resposta" } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Reenviar por push e e-mail" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Cobrança reenviada: push enviado · e-mail enviado.",
      ),
    );
    const messages = screen.getByRole("region", { name: "Mensagens de cobrança" });
    expect(await within(messages).findAllByText("João Lima")).not.toHaveLength(0);
  });
});

describe("actionErrorMessage — os códigos reais da API", () => {
  it.each([
    ["INVOICE_NOT_OPEN", 409, "Esta fatura já foi paga ou cancelada. Recarregue a página."],
    ["CHARGE_PROVIDER_UNAVAILABLE", 503, "O código Pix ainda não está disponível."],
    ["NOTHING_TO_INVOICE", 409, "Não há serviços a faturar para esta empresa."],
    ["FEATURE_DISABLED", 404, "O faturamento está desligado: esta ação não está disponível agora."],
    ["REASON_REQUIRED", 422, "Escreva o motivo (pelo menos 5 caracteres)."],
    ["PAID_AT_INVALID", 422, "A data do pagamento precisa estar entre o fechamento da fatura e hoje."],
    ["WAIVE_UNTIL_INVALID", 422, "Escolha uma data de hoje até 30 dias à frente."],
    ["INVALID_AMOUNT", 422, "Informe um valor maior que zero e até R$ 1.000.000,00."],
    ["CHANNELS_REQUIRED", 422, "Escolha pelo menos um canal: push ou e-mail."],
    [
      "ALREADY_CLOSED_TODAY",
      409,
      "Esta empresa já teve uma fatura fechada hoje. Os lançamentos novos entram no próximo fechamento.",
    ],
    [
      "IDEMPOTENCY_KEY_CONFLICT",
      409,
      "Este ajuste já foi lançado com outros dados. Feche e abra o diálogo de novo.",
    ],
  ] as const)("%s", (code, status, text) => {
    expect(actionErrorMessage(apiError(status, code, "mensagem da API"))).toBe(text);
  });

  it("código que a tela não conhece: a mensagem da API; sem ela, um texto geral", () => {
    expect(actionErrorMessage(apiError(422, "VACANCY_NOT_OF_CONTRACTOR", "A vaga é de outra empresa."))).toBe(
      "A vaga é de outra empresa.",
    );
    expect(actionErrorMessage(new Error("rede"))).toBe("Não foi possível concluir. Tente de novo.");
  });
});

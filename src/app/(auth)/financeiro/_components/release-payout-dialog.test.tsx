import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/admin/infrastructure/held-repasses-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/admin/infrastructure/held-repasses-api")>()),
  releaseHeldRepasse: vi.fn(),
}));

import {
  releaseHeldRepasse,
  type HeldRepasseItem,
} from "@/modules/admin/infrastructure/held-repasses-api";
import { ReleasePayoutDialog } from "./release-payout-dialog";

const ITEM: HeldRepasseItem = {
  repasseId: "rep-1",
  vacancyId: "ab12cd34-0000-0000-0000-000000000000",
  vacancyTitle: "Garçom",
  serviceDate: "2026-10-15",
  freelancer: { providerGlobalId: "pg-1", name: "Ana Souza", hasPixKey: true },
  company: { contractorUserId: "u-1", name: "Bar do Zé" },
  amountInCents: 9500,
  heldAt: "2026-10-16T02:00:00.000Z",
  expectedDate: "2026-10-19",
  effectiveDeadlineAt: "2026-10-23T03:00:00.000Z",
  invoice: { id: "inv-1", number: "FAT-2026-000123", status: "ISSUED", dueDate: "2026-10-19" },
  situation: "invoice_overdue",
  releaseAuthorized: false,
  calc: "",
  source: "",
};

function apiError(status: number, code: string): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("falhou", String(status), config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: { error: { code, message: code } },
  });
}

function renderDialog(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ReleasePayoutDialog item={ITEM} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

const reasonField = () => screen.getByLabelText("Por que pagar agora? (obrigatório)");
const submitButton = () => screen.getByRole("button", { name: "Pagar R$ 95,00 agora" });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReleasePayoutDialog", () => {
  it("diz o valor, para quem, o serviço, a fatura, o teto e o que acontece com o dinheiro", () => {
    renderDialog();
    expect(screen.getByRole("heading", { name: "Pagar agora R$ 95,00 para Ana Souza?" })).toBeInTheDocument();
    expect(screen.getByText(/Garçom · qui 15\/10 · Bar do Zé \(vaga #ab12cd34\)/)).toBeInTheDocument();
    expect(screen.getByText(/a fatura FAT-2026-000123 for paga/)).toBeInTheDocument();
    expect(screen.getByText(/ou no máximo em sex 23\/10 às 00:00/)).toBeInTheDocument();
    expect(screen.getByText("Enviamos R$ 95,00 agora para a chave Pix cadastrada de Ana.")).toBeInTheDocument();
    expect(screen.getByText(/entra em "Adiantado aos freelancers" até Bar do Zé pagar a fatura/)).toBeInTheDocument();
    expect(screen.getByText("A fatura FAT-2026-000123 da empresa não muda (vencimento seg 19/10).")).toBeInTheDocument();
    expect(screen.getByText("Não dá para desfazer.")).toBeInTheDocument();
    // Foco inicial no motivo.
    expect(reasonField()).toHaveFocus();
  });

  it("motivo com menos de 5 caracteres: botão desabilitado e o porquê embaixo do campo", () => {
    renderDialog();
    expect(submitButton()).toBeDisabled();
    fireEvent.change(reasonField(), { target: { value: "abc " } });
    expect(submitButton()).toBeDisabled();
    expect(screen.getByText("Escreva o motivo (pelo menos 5 caracteres).")).toBeInTheDocument();
    fireEvent.change(reasonField(), { target: { value: "Freelancer pediu" } });
    expect(submitButton()).toBeEnabled();
  });

  it("atalho de motivo preenche o campo", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Empresa vai atrasar" }));
    expect(reasonField()).toHaveValue("Empresa vai atrasar");
  });

  it("dois cliques mandam um pedido só; pago → toast e fecha", async () => {
    let resolve: (v: unknown) => void = () => {};
    vi.mocked(releaseHeldRepasse).mockImplementation(
      () => new Promise((r) => (resolve = r as (v: unknown) => void)) as ReturnType<typeof releaseHeldRepasse>,
    );
    const { onClose } = renderDialog();
    fireEvent.change(reasonField(), { target: { value: "Freelancer pediu" } });
    const button = submitButton();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByText("Enviando…")).toBeInTheDocument();
    fireEvent.click(button);
    await waitFor(() => expect(releaseHeldRepasse).toHaveBeenCalled());
    expect(releaseHeldRepasse).toHaveBeenCalledTimes(1);
    expect(releaseHeldRepasse).toHaveBeenCalledWith("rep-1", { reason: "Freelancer pediu" });

    resolve({ repasseId: "rep-1", vacancyId: "v", status: "COMPLETED", failureReason: null });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("R$ 95,00 enviados para Ana Souza.");
  });

  it("409 já liberado: a mensagem fica no diálogo, que não fecha", async () => {
    vi.mocked(releaseHeldRepasse).mockRejectedValue(apiError(409, "REPASSE_ALREADY_RELEASED"));
    const { onClose } = renderDialog();
    fireEvent.change(reasonField(), { target: { value: "Freelancer pediu" } });
    fireEvent.click(submitButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este pagamento já saiu: a fatura foi paga, chegou o teto ou outra pessoa pagou agora. Nada foi enviado de novo.",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("200 com o Pix FAILED vira aviso com o motivo, não sucesso", async () => {
    vi.mocked(releaseHeldRepasse).mockResolvedValue({
      repasseId: "rep-1",
      vacancyId: "v",
      status: "FAILED",
      failureReason: "Chave Pix recusada pelo banco.",
    });
    const { onClose } = renderDialog();
    fireEvent.change(reasonField(), { target: { value: "Freelancer pediu" } });
    fireEvent.click(submitButton());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("Chave Pix recusada pelo banco."));
  });
});

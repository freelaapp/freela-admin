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
  markRepassePaidExternally: vi.fn(),
}));

import { todayBrtKey } from "@/modules/admin/application/held-repasses-presentation";
import { markRepassePaidExternally } from "@/modules/admin/infrastructure/held-repasses-api";
import { MarkPaidExternallyDialog, type PaidExternallyTarget } from "./mark-paid-externally-dialog";

const HELD: PaidExternallyTarget = {
  repasseId: "rep-1",
  vacancyId: "ab12cd34-0000-0000-0000-000000000000",
  amountInCents: 12000,
  freelancerName: "Ana Souza",
  service: "Garçom · 17/11 · Chopp e Espeto",
  companyName: "Chopp e Espeto",
  kind: "held",
  invoice: { number: "FAT-2026-000015", dueDate: "2026-11-24" },
  deadlineAt: "2026-11-28T03:00:00.000Z",
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

function renderDialog(target: PaidExternallyTarget = HELD, onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MarkPaidExternallyDialog target={target} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

const reasonField = () => screen.getByLabelText("Por que foi pago por fora? (obrigatório)");
const submitButton = () => screen.getByRole("button", { name: "Marcar como pago por fora" });
const ok = {
  repasseId: "rep-1",
  vacancyId: "vac-1",
  amountInCents: 12000,
  paidExternally: { at: "2026-11-23T15:00:00.000Z", amountPaidInCents: 12000, reason: "x", proof: null, adminId: "a" },
  differenceInCents: 0,
  pendingBonusInCents: 0,
  alreadyMarked: false,
};

beforeEach(() => vi.clearAllMocks());

describe("MarkPaidExternallyDialog", () => {
  it("diz quem, quanto, que a Freela não envia nada, o que acontece com a fatura e que não dá para desfazer", () => {
    renderDialog();
    expect(
      screen.getByRole("heading", { name: "Marcar R$ 120,00 de Ana Souza como pago por fora?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Garçom · 17\/11 · Chopp e Espeto \(vaga #ab12cd34\)/)).toBeInTheDocument();
    expect(screen.getByText("A Freela não envia nada.")).toBeInTheDocument();
    expect(screen.getByText(/nem quando a fatura for paga, nem no teto \(\S+ 28\/11 às 00:00\)/)).toBeInTheDocument();
    expect(
      screen.getByText(/^A fatura FAT-2026-000015 de Chopp e Espeto não muda e continua sendo cobrada \(vence \S+ 24\/11\)\.$/),
    ).toBeInTheDocument();
    expect(screen.getByText('Ana vê o pagamento como "Pago" no app.')).toBeInTheDocument();
    expect(screen.getByText("Não dá para desfazer pelo painel.")).toBeInTheDocument();
    // Valor e dia já preenchidos; foco no motivo; confirmar só com o motivo.
    expect(screen.getByLabelText("Valor que você pagou (R$)")).toHaveValue("120,00");
    expect(screen.getByLabelText("Dia em que você pagou")).toHaveValue(todayBrtKey());
    expect(reasonField()).toHaveFocus();
    expect(submitButton()).toBeDisabled();
  });

  it("confirma com o motivo (atalho), o dia, o valor e o comprovante; avisa e fecha", async () => {
    vi.mocked(markRepassePaidExternally).mockResolvedValue(ok);
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Empresa vai atrasar a fatura" }));
    fireEvent.change(screen.getByLabelText("Comprovante (opcional)"), { target: { value: "E2E123" } });
    fireEvent.click(submitButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(markRepassePaidExternally).toHaveBeenCalledWith("rep-1", {
      repasseId: "rep-1",
      reason: "Empresa vai atrasar a fatura",
      paidAt: todayBrtKey(),
      amountPaidInCents: 12000,
      proof: "E2E123",
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Pagamento de Ana Souza marcado como pago por fora: R$ 120,00 em 23/11. A Freela não vai pagar de novo.",
    );
  });

  it("valor diferente: avisa com a conta, sem bloquear", () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText("Valor que você pagou (R$)"), { target: { value: "100,00" } });
    fireEvent.change(reasonField(), { target: { value: "Paguei só a parte" } });

    expect(screen.getByText(/R\$ 120,00 − R\$ 100,00 = R\$ 20,00 a menos/)).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it("valor inválido trava o confirmar", () => {
    renderDialog();
    fireEvent.change(reasonField(), { target: { value: "Empresa vai atrasar" } });
    fireEvent.change(screen.getByLabelText("Valor que você pagou (R$)"), { target: { value: "0" } });
    expect(screen.getByText("Informe o valor pago, por exemplo 120,00.")).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it("dois cliques no mesmo instante → um pedido só", async () => {
    let resolve: (value: typeof ok) => void = () => undefined;
    vi.mocked(markRepassePaidExternally).mockImplementation(
      () => new Promise((r) => (resolve = r)),
    );
    renderDialog();
    fireEvent.change(reasonField(), { target: { value: "Empresa vai atrasar" } });

    const button = submitButton();
    fireEvent.click(button);
    fireEvent.click(button);
    resolve(ok);

    await waitFor(() => expect(markRepassePaidExternally).toHaveBeenCalledTimes(1));
  });

  it("a fatura liberou antes: erro dentro do diálogo, nada marcado, campos mantidos", async () => {
    vi.mocked(markRepassePaidExternally).mockRejectedValue(apiError(409, "REPASSE_ALREADY_RELEASED"));
    const { onClose } = renderDialog();
    fireEvent.change(reasonField(), { target: { value: "Empresa vai atrasar" } });

    fireEvent.click(submitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent(/O Pix de R\$ 120,00 para Ana está saindo ou já saiu/);
    expect(onClose).not.toHaveBeenCalled();
    expect(reasonField()).toHaveValue("Empresa vai atrasar");
  });

  it("Pix que falhou: diz o motivo da falha e não fala de fatura", () => {
    renderDialog({ ...HELD, kind: "failed", invoice: undefined, deadlineAt: null, failureReason: "chave Pix inválida" });
    expect(screen.getByText(/O Pix da Freela falhou: chave Pix inválida\./)).toBeInTheDocument();
    expect(screen.queryByText(/continua sendo cobrada/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pix da Freela falhou" })).toBeInTheDocument();
  });
});

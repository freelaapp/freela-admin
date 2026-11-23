import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/modules/admin/infrastructure/held-repasses-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/admin/infrastructure/held-repasses-api")>()),
  getVacancyRepasse: vi.fn(),
}));

import { getVacancyRepasse, type VacancyRepasse } from "@/modules/admin/infrastructure/held-repasses-api";
import { VacancyPayoutBlock } from "./vacancy-payout-block";

const HELD: VacancyRepasse = {
  repasseId: "rep-1",
  vacancyId: "vac-1",
  status: "AWAITING_INVOICE",
  amountInCents: 12000,
  failureReason: null,
  releaseAuthorized: false,
  expectedDate: "2026-11-24",
  deadlineAt: "2026-11-28T03:00:00.000Z",
  paidExternally: null,
  markPaidExternally: { allowed: true, blockedMessage: null },
};

function renderBlock() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <VacancyPayoutBlock
        vacancyId="vac-1"
        vacancyTitle="Garçom"
        serviceDay="17/11/2026"
        companyName="Chopp e Espeto"
        freelancerName="Maria Vithorya"
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("VacancyPayoutBlock (detalhe da vaga)", () => {
  it("retido sem liberação: situação, teto e o 'Marcar como pago por fora', que abre o diálogo", async () => {
    vi.mocked(getVacancyRepasse).mockResolvedValue(HELD);
    renderBlock();

    expect(await screen.findByText("Aguardando a fatura")).toBeInTheDocument();
    expect(screen.getByText(/garantido até \S+ 28\/11 às 00:00/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Marcar como pago por fora o pagamento de R$ 120,00 para Maria Vithorya",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Marcar R$ 120,00 de Maria Vithorya como pago por fora?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/A fatura de Chopp e Espeto não muda e continua sendo cobrada\./)).toBeInTheDocument();
  });

  it("pago por fora: selo e o registro, sem botão", async () => {
    vi.mocked(getVacancyRepasse).mockResolvedValue({
      ...HELD,
      status: "COMPLETED",
      paidExternally: {
        at: "2026-11-23T15:00:00.000Z",
        amountPaidInCents: 12000,
        reason: "Diego pagou por fora",
        proof: null,
        adminId: "adm",
      },
      markPaidExternally: { allowed: false, blockedMessage: "Este pagamento já foi marcado como pago por fora." },
    });
    renderBlock();

    expect(await screen.findByText("Pago por fora")).toBeInTheDocument();
    expect(screen.getByText("Pago por fora em 23/11 · Diego pagou por fora")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar como pago por fora/ })).not.toBeInTheDocument();
  });

  it("vaga sem repasse: não aparece", async () => {
    vi.mocked(getVacancyRepasse).mockResolvedValue(null);
    const { container } = renderBlock();
    await waitFor(() => expect(getVacancyRepasse).toHaveBeenCalledWith("vac-1"));
    expect(container).toBeEmptyDOMElement();
  });
});

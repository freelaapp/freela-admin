import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotBroadcastBadge, VacancyNotBroadcastNotice } from "./vacancy-not-broadcast";

const api = vi.hoisted(() => ({ resendVacancyGroupMessage: vi.fn() }));

vi.mock("@/modules/admin/infrastructure/vacancy-outreach-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resendVacancyGroupMessage: api.resendVacancyGroupMessage,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const SEM_GRUPO =
  'Não existe o grupo "Vagas Freela Brejetuba ES". Crie o grupo em Grupos WhatsApp e reenvie.';

function renderNotice() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <VacancyNotBroadcastNotice vacancyId="vac-1" module="casa" record={undefined} />
    </QueryClientProvider>,
  );
}

describe("NotBroadcastBadge", () => {
  it("mostra 'Não divulgada'", () => {
    render(<NotBroadcastBadge />);
    expect(screen.getByText("Não divulgada")).toBeInTheDocument();
  });
});

describe("VacancyNotBroadcastNotice", () => {
  beforeEach(() => {
    api.resendVacancyGroupMessage.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("explica e reenvia pelo módulo da vaga", async () => {
    api.resendVacancyGroupMessage.mockResolvedValue(undefined);
    renderNotice();

    expect(screen.getByText("Vaga não divulgada · Reenviar ao grupo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(api.resendVacancyGroupMessage).toHaveBeenCalledWith("vac-1", "casa");
  });

  it("sem grupo: mostra a mensagem da API, não uma genérica", async () => {
    api.resendVacancyGroupMessage.mockRejectedValue(
      Object.assign(new Error("Request failed with status code 400"), {
        isAxiosError: true,
        response: {
          status: 400,
          data: { error: { code: "NO_DESTINATION_GROUP", message: SEM_GRUPO } },
        },
      }),
    );
    renderNotice();

    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(SEM_GRUPO));
  });
});

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { VipStoreSummary } from "@/modules/admin/infrastructure/vip-groups-api";
import { CreateVipGroupDialog } from "./create-vip-group-dialog";

const api = vi.hoisted(() => ({ ensureVipGroup: vi.fn() }));

vi.mock("@/modules/admin/infrastructure/vip-groups-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ensureVipGroup: api.ensureVipGroup,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const loja = (contractorUserId: string, storeName: string, status: VipStoreSummary["status"]) =>
  ({ contractorUserId, storeName, status }) as VipStoreSummary;

const STORES = [
  loja("loja-1", "Outback Campinas", "NONE"),
  loja("loja-2", "Coco Bambu Jundiaí", "NONE"),
  loja("loja-3", "Coco Bambu Recife", "ACTIVE"),
];

function renderDialog(stores = STORES, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CreateVipGroupDialog stores={stores} isLoading={false} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

describe("CreateVipGroupDialog", () => {
  beforeEach(() => {
    api.ensureVipGroup.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("lista só as lojas Grandes Redes sem grupo, com busca", () => {
    renderDialog();
    expect(screen.getByRole("radio", { name: "Coco Bambu Jundiaí" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Outback Campinas" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Coco Bambu Recife" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Buscar loja"), { target: { value: "outback" } });
    expect(screen.queryByRole("radio", { name: "Coco Bambu Jundiaí" })).not.toBeInTheDocument();
  });

  it("escolhe a loja e cria pelo ensure (idempotente)", async () => {
    api.ensureVipGroup.mockResolvedValue({ status: "ACTIVE", lastError: null });
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("radio", { name: "Coco Bambu Jundiaí" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar grupo VIP" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.ensureVipGroup).toHaveBeenCalledWith("loja-2");
    expect(toast.success).toHaveBeenCalledWith("Grupo VIP ativo.");
  });

  it("422 fora do plano: mostra a mensagem da API e fica aberto", async () => {
    api.ensureVipGroup.mockRejectedValue(
      Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: {
          status: 422,
          data: { error: { code: "STORE_NOT_ENTERPRISE", message: "A loja não está no plano Grandes Redes." } },
        },
      }),
    );
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("radio", { name: "Outback Campinas" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar grupo VIP" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("A loja não está no plano Grandes Redes."));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sem loja sem grupo: avisa e não deixa confirmar", () => {
    renderDialog([loja("loja-3", "Coco Bambu Recife", "ACTIVE")]);
    expect(screen.getByText("Nenhuma loja Grandes Redes sem grupo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar grupo VIP" })).toBeDisabled();
  });
});

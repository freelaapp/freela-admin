import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateDedicatedGroupDialog } from "./create-dedicated-group-dialog";

const api = vi.hoisted(() => ({
  createDedicatedGroup: vi.fn(),
  createDedicatedWhatsappGroup: vi.fn(),
}));

vi.mock("@/modules/admin/infrastructure/dedicated-groups-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createDedicatedGroup: api.createDedicatedGroup,
  createDedicatedWhatsappGroup: api.createDedicatedWhatsappGroup,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

function renderDialog(onClose = vi.fn(), defaultPhones = ["5511915375766"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CreateDedicatedGroupDialog defaultPhones={defaultPhones} defaultPhonesLoaded onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

function preencher() {
  fireEvent.change(screen.getByLabelText("Rótulo (empresa + cidade)"), { target: { value: "Coco Bambu Jundiaí" } });
  fireEvent.change(screen.getByLabelText("Termo da empresa"), { target: { value: "coco bambu" } });
  fireEvent.change(screen.getByLabelText("Termo da cidade (opcional)"), { target: { value: "jundia" } });
}

const axiosError = (message: string) =>
  Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status: 503, data: { error: { code: "X", message } } },
  });

describe("CreateDedicatedGroupDialog", () => {
  beforeEach(() => {
    api.createDedicatedGroup.mockReset();
    api.createDedicatedWhatsappGroup.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  });

  it("mostra a prévia do nome e cria regra + grupo, nessa ordem", async () => {
    api.createDedicatedGroup.mockResolvedValue({ id: "rule-1" });
    api.createDedicatedWhatsappGroup.mockResolvedValue({ jid: "g@g.us", name: "Notificações Coco Bambu Jundiaí", participants: 2 });
    const { onClose } = renderDialog();
    preencher();

    expect(screen.getByText("Notificações Coco Bambu Jundiaí")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Criar grupo dedicado" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // TanStack 5.100 chama `mutationFn(variables, context)`: compare só o 1º argumento.
    expect(api.createDedicatedGroup.mock.calls[0][0]).toEqual({
      label: "Coco Bambu Jundiaí",
      companyMatch: "coco bambu",
      cityMatch: "jundia",
    });
    expect(api.createDedicatedWhatsappGroup).toHaveBeenCalledWith("rule-1", []);
    expect(toast.success).toHaveBeenCalledWith('Grupo "Notificações Coco Bambu Jundiaí" criado.');
  });

  it("regra criada e grupo falhou: avisa e FECHA (repetir criaria outra regra)", async () => {
    api.createDedicatedGroup.mockResolvedValue({ id: "rule-1" });
    api.createDedicatedWhatsappGroup.mockRejectedValue(axiosError("Instância desconectada."));
    const { onClose } = renderDialog();
    preencher();

    fireEvent.click(screen.getByRole("button", { name: "Criar grupo dedicado" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Regra criada, mas o grupo não foi criado: Instância desconectada. Tente de novo pelo botão da regra.",
      ),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("regra falhou: não tenta o grupo e o diálogo fica aberto", async () => {
    api.createDedicatedGroup.mockRejectedValue(axiosError("Rótulo já existe."));
    const { onClose } = renderDialog();
    preencher();

    fireEvent.click(screen.getByRole("button", { name: "Criar grupo dedicado" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Rótulo já existe."));
    expect(api.createDedicatedWhatsappGroup).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("sem números padrão e sem participantes: não chama a API", () => {
    renderDialog(vi.fn(), []);
    preencher();
    fireEvent.click(screen.getByRole("button", { name: "Criar grupo dedicado" }));
    expect(toast.error).toHaveBeenCalledWith("Informe ao menos um número ou cadastre os números padrão.");
    expect(api.createDedicatedGroup).not.toHaveBeenCalled();
  });
});

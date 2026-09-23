import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CompatibleInviteSection } from "./compatible-invite-section";
import type { CompatibleFreelancer } from "@/modules/admin/infrastructure/vacancy-outreach-api";

const api = vi.hoisted(() => ({
  getCompatibleFreelancers: vi.fn(),
  sendCompatibleInvites: vi.fn(),
}));

vi.mock("@/modules/admin/infrastructure/vacancy-outreach-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getCompatibleFreelancers: api.getCompatibleFreelancers,
  sendCompatibleInvites: api.sendCompatibleInvites,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function freela(userId: string, name: string, matchScore: number): CompatibleFreelancer {
  return {
    userId,
    providerGlobalId: `pg-${userId}`,
    name,
    phone: "11999990000",
    city: "Jundiaí",
    distanceInKm: 2.5,
    matchScore,
    averageRating: 4.8,
    totalCompletedServices: 12,
  };
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CompatibleInviteSection vacancyId="vac-1" />
    </QueryClientProvider>,
  );
}

describe("CompatibleInviteSection", () => {
  beforeEach(() => {
    api.getCompatibleFreelancers.mockReset();
    api.sendCompatibleInvites.mockReset();
    api.getCompatibleFreelancers.mockResolvedValue({
      vacancyId: "vac-1",
      template: "Oi, {nome}! Vaga de garçom: https://x/vagas/vac-1",
      alreadyInvited: 3,
      candidates: [freela("a", "Ana Lima", 92), freela("b", "Bruno Reis", 81)],
    });
    api.sendCompatibleInvites.mockResolvedValue({
      sent: [{ userId: "a", name: "Ana Lima" }],
      failed: [],
      skipped: 0,
    });
  });

  it("só busca a lista quando o suporte pede", async () => {
    renderSection();
    expect(api.getCompatibleFreelancers).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /ver os 10 mais compatíveis/i }));

    expect(await screen.findByText("Ana Lima")).toBeInTheDocument();
    expect(screen.getByText("92% compatível")).toBeInTheDocument();
    expect(screen.getByText(/já convidados para esta vaga/i)).toHaveTextContent("3");
    expect(api.getCompatibleFreelancers).toHaveBeenCalledWith("vac-1");
  });

  it("envia só para os marcados, com o texto revisado", async () => {
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: /ver os 10 mais compatíveis/i }));
    await screen.findByText("Bruno Reis");

    fireEvent.click(screen.getByLabelText("Convidar Bruno Reis"));
    fireEvent.change(screen.getByLabelText(/mensagem/i), {
      target: { value: "Oi, {nome}! Bora?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar convite para 1 freela/i }));

    await waitFor(() =>
      expect(api.sendCompatibleInvites).toHaveBeenCalledWith("vac-1", ["a"], "Oi, {nome}! Bora?"),
    );
    // Depois do envio a lista é refeita (os convidados saem, entram os próximos).
    await waitFor(() => expect(api.getCompatibleFreelancers).toHaveBeenCalledTimes(2));
  });

  it("sem ninguém marcado, não deixa enviar", async () => {
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: /ver os 10 mais compatíveis/i }));
    await screen.findByText("Ana Lima");

    fireEvent.click(screen.getByLabelText("Convidar Ana Lima"));
    fireEvent.click(screen.getByLabelText("Convidar Bruno Reis"));

    expect(screen.getByRole("button", { name: /enviar convite para 0 freelas/i })).toBeDisabled();
  });
});

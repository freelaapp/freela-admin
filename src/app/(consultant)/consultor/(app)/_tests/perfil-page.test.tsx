import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConsultorPerfilPage from "../perfil/page";
import { buildWhatsAppShareUrl } from "@/modules/consultant/application/referral-share";
import type { ConsultantProfile } from "@/modules/consultant/domain/types";

const api = vi.hoisted(() => ({
  getConsultantProfileApi: vi.fn(),
  updateConsultantProfileApi: vi.fn(),
}));

vi.mock("@/modules/consultant/infrastructure/consultant-api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getConsultantProfileApi: api.getConsultantProfileApi,
  updateConsultantProfileApi: api.updateConsultantProfileApi,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const profile: ConsultantProfile = {
  id: "c1",
  name: "André Souza",
  email: "andre@x.com",
  phone: "+5585999990000",
  code: "ANDRE2K",
  city: "Fortaleza",
  uf: "CE",
  referralLink: "https://freelaservicos.com.br/cadastro?ref=ANDRE2K",
  commissionRate: 10,
  totals: { registrations: 3, freelancers: 1, contractors: 2, contractorsWithVacancy: 1 },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConsultorPerfilPage />
    </QueryClientProvider>,
  );
}

describe("Meu perfil (consultor)", () => {
  beforeEach(() => {
    api.getConsultantProfileApi.mockReset().mockResolvedValue(profile);
    api.updateConsultantProfileApi.mockReset().mockResolvedValue(profile);
  });

  it("mostra o link, copia e compartilha no WhatsApp com o texto pronto", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    renderPage();

    expect(await screen.findByText(profile.referralLink)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copiar/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(profile.referralLink));
    expect(screen.getByRole("link", { name: /compartilhar no whatsapp/i })).toHaveAttribute(
      "href",
      buildWhatsAppShareUrl(profile.referralLink),
    );
  });

  it("mostra e-mail de login, código, cidade/UF, comissão e o atalho para trocar a senha", async () => {
    renderPage();

    expect(await screen.findByText("andre@x.com")).toBeInTheDocument();
    expect(screen.getByText("ANDRE2K")).toBeInTheDocument();
    expect(screen.getByText("Fortaleza/CE")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /trocar senha/i })).toHaveAttribute(
      "href",
      "/consultor/trocar-senha",
    );
  });

  it("salva nome aparado e telefone colado com +55 em E.164", async () => {
    renderPage();

    const name = await screen.findByLabelText("Nome");
    expect(name).toHaveValue("André Souza");
    expect(screen.getByLabelText("Telefone (WhatsApp)")).toHaveValue("(85) 99999-0000");

    fireEvent.change(name, { target: { value: "  André S. Lima  " } });
    fireEvent.change(screen.getByLabelText("Telefone (WhatsApp)"), {
      target: { value: "+55 85 98888-7777" },
    });
    expect(screen.getByLabelText("Telefone (WhatsApp)")).toHaveValue("(85) 98888-7777");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(api.updateConsultantProfileApi).toHaveBeenCalledWith({
        name: "André S. Lima",
        phone: "+5585988887777",
      }),
    );
  });

  it("telefone sem DDD mostra o erro e não chama a API", async () => {
    renderPage();

    const phone = await screen.findByLabelText("Telefone (WhatsApp)");
    fireEvent.change(phone, { target: { value: "98888-7777" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(
      await screen.findByText("Informe o telefone com DDD, ex.: (11) 98888-7777."),
    ).toBeInTheDocument();
    expect(api.updateConsultantProfileApi).not.toHaveBeenCalled();
  });
});

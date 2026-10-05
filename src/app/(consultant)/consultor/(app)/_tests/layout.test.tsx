import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConsultorAppLayout from "../layout";

const nav = vi.hoisted(() => ({ pathname: "/consultor", replace: vi.fn() }));
const auth = vi.hoisted(() => ({ mustChangePassword: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), back: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/modules/consultant/application/use-consultant-auth", () => ({
  useConsultantAuth: () => ({
    isHydrated: true,
    isAuthenticated: true,
    mustChangePassword: auth.mustChangePassword,
    logout: vi.fn(),
  }),
}));

function renderLayout() {
  return render(
    <ConsultorAppLayout>
      <p>conteúdo</p>
    </ConsultorAppLayout>,
  );
}

describe("Layout do painel do consultor", () => {
  beforeEach(() => {
    nav.pathname = "/consultor";
    nav.replace.mockReset();
    auth.mustChangePassword = false;
  });

  it("no celular o menu vai para uma linha própria e inteira, sem esconder 'Meu perfil'", () => {
    renderLayout();

    const menu = screen.getByRole("navigation");
    expect(screen.getByRole("link", { name: "Meu perfil" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Painel" })).toHaveAttribute("href", "/consultor/painel");
    expect(screen.getByRole("link", { name: "Carteira" })).toHaveAttribute("href", "/consultor/carteira");
    // Linha própria abaixo do logo + Sair (quebra de linha no header, menu por último e com
    // largura total); só a partir de `sm` volta para a mesma linha do logo.
    expect(screen.getByRole("banner")).toHaveClass("flex-wrap", "sm:flex-nowrap");
    expect(menu).toHaveClass("order-last", "w-full", "sm:order-none", "sm:w-auto");
    // Nada de rolagem horizontal escondida no celular.
    expect(menu).not.toHaveClass("overflow-x-auto");
  });

  it("trocar a senha por vontade própria (vindo do perfil) mantém o menu para voltar", () => {
    nav.pathname = "/consultor/trocar-senha";
    auth.mustChangePassword = false;
    renderLayout();

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Meu perfil" })).toHaveAttribute(
      "href",
      "/consultor/perfil",
    );
  });

  it("troca de senha OBRIGATÓRIA continua sem menu", () => {
    nav.pathname = "/consultor/trocar-senha";
    auth.mustChangePassword = true;
    renderLayout();

    expect(screen.getByText("conteúdo")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Meu perfil" })).not.toBeInTheDocument();
  });
});

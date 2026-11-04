import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));
vi.mock("@/modules/admin/application/use-new-vacancy-chime", () => ({
  useNewVacancyChime: () => ({
    ativo: false,
    alternar: () => {},
    bloqueado: false,
  }),
}));
vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({
    user: { id: "adm-1", name: "Bruna", email: "bruna@freela.test" },
    logout: () => {},
    isSuperAdmin: false,
    hasPermission: (p: string) => auth.permissions.includes(p),
  }),
}));

import { AdminLayout } from "./admin-layout";

/** Itens do menu lateral (o mesmo `nav` serve o desktop e a gaveta do celular). */
function menuLinks(): string[] {
  const navs = screen.getAllByRole("navigation");
  return navs.flatMap((nav) =>
    within(nav)
      .queryAllByRole("link")
      .map((a) => a.textContent ?? ""),
  );
}

describe("menu do painel: Fila do suporte (fluxo v2, fatia C2)", () => {
  beforeEach(() => {
    auth.permissions = [];
  });

  it("aparece para quem tem a permissão de Vagas, ao lado da Confirmação do dia", () => {
    auth.permissions = ["JOBS"];
    render(
      <AdminLayout>
        <div />
      </AdminLayout>,
    );
    const link = screen.getAllByRole("link", { name: /Fila do suporte/ })[0];
    expect(link).toHaveAttribute("href", "/fila-do-suporte");
    const labels = menuLinks();
    expect(labels.indexOf("Fila do suporte")).toBe(
      labels.indexOf("Confirmação do dia") + 1,
    );
  });

  it("some para quem não tem a permissão de Vagas", () => {
    auth.permissions = ["FINANCE"];
    render(
      <AdminLayout>
        <div />
      </AdminLayout>,
    );
    expect(
      screen.queryByRole("link", { name: /Fila do suporte/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Confirmação do dia/ }),
    ).not.toBeInTheDocument();
  });
});

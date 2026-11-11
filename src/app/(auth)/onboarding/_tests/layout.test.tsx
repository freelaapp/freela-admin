import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.hoisted(() => ({ value: { isChecking: false, allowed: true } }));
const useAreaGuard = vi.hoisted(() => vi.fn());

vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: (p: string) => {
    useAreaGuard(p);
    return guard.value;
  },
}));
const settings = vi.hoisted(() => ({ data: undefined as { gateWired?: boolean } | undefined }));
vi.mock("@/modules/admin/application/use-orientation", () => ({
  useOrientationSettings: () => settings,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/onboarding" }));

import OnboardingLayout from "../layout";

describe("layout do Onboarding", () => {
  beforeEach(() => {
    guard.value = { isChecking: false, allowed: true };
    useAreaGuard.mockClear();
    settings.data = { gateWired: true };
  });

  const BANNER = /A trava de vagas ainda não está ligada: reprovar fica registrado/;

  it("trava ligada: sem faixa", () => {
    render(<OnboardingLayout><p>filho</p></OnboardingLayout>);
    expect(screen.queryByText(BANNER)).not.toBeInTheDocument();
  });

  it.each([{ gateWired: false }, {}])("trava não ligada %o: mostra a faixa", (data) => {
    settings.data = data;
    render(<OnboardingLayout><p>filho</p></OnboardingLayout>);
    expect(screen.getByText(BANNER)).toBeInTheDocument();
  });

  it("pede a permissão ORIENTATION", () => {
    render(<OnboardingLayout><p>filho</p></OnboardingLayout>);
    expect(useAreaGuard).toHaveBeenCalledWith("ORIENTATION");
  });

  it("liberado: mostra as abas e os filhos", () => {
    render(<OnboardingLayout><p>filho</p></OnboardingLayout>);
    expect(screen.getByRole("link", { name: "Turmas" })).toHaveAttribute("href", "/onboarding");
    expect(screen.getByRole("link", { name: "Configurações" })).toHaveAttribute(
      "href",
      "/onboarding/configuracoes",
    );
    expect(screen.getByText("filho")).toBeInTheDocument();
  });

  it("negado: não renderiza os filhos", () => {
    guard.value = { isChecking: false, allowed: false };
    render(<OnboardingLayout><p>filho</p></OnboardingLayout>);
    expect(screen.queryByText("filho")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Turmas" })).not.toBeInTheDocument();
  });

  it("conferindo: spinner, sem filhos", () => {
    guard.value = { isChecking: true, allowed: false };
    render(<OnboardingLayout><p>filho</p></OnboardingLayout>);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("filho")).not.toBeInTheDocument();
  });
});

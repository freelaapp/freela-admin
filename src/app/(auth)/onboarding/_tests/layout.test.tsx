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
vi.mock("next/navigation", () => ({ usePathname: () => "/onboarding" }));

import OnboardingLayout from "../layout";

describe("layout do Onboarding", () => {
  beforeEach(() => {
    guard.value = { isChecking: false, allowed: true };
    useAreaGuard.mockClear();
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

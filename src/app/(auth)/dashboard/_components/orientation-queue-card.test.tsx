import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ allowed: true }));
const summary = vi.hoisted(() => ({ data: undefined as unknown }));
const useOrientationSummary = vi.hoisted(() => vi.fn());

vi.mock("@/modules/auth/application/use-auth", () => ({
  useAuth: () => ({ hasPermission: () => auth.allowed }),
}));
vi.mock("@/modules/admin/application/use-orientation", () => ({
  useOrientationSummary: (enabled: boolean) => {
    useOrientationSummary(enabled);
    return { data: enabled ? summary.data : undefined };
  },
}));

import { OrientationQueueCard } from "./orientation-queue-card";

const base = {
  generatedAt: "2026-11-11T15:30:00.000Z",
  gateMode: "OFF",
  cutoff: "2026-11-11T00:00:00.000Z",
  cutoffStamped: false,
  freelancers: { active: 1000, approved: 40, rejected: 5, withoutGlobal: 10, pending: 955, pendingSinceCutoff: 0 },
  blockedByMode: { OFF: 5, NEW_ONLY: 5, ALL: 960 },
  booked: 20,
  queue: 935,
  nextSession: { id: "s1", startsAt: "2026-11-16T12:00:00.000Z", bookedCount: 8, capacity: 10 },
};

describe("OrientationQueueCard", () => {
  beforeEach(() => {
    auth.allowed = true;
    summary.data = base;
    useOrientationSummary.mockClear();
  });

  it("mostra título, valor e próxima turma", () => {
    render(<OrientationQueueCard />);
    expect(screen.getByText("Fila de onboarding")).toBeInTheDocument();
    expect(screen.getByText("935")).toBeInTheDocument();
    expect(screen.getByText("Próxima turma: seg 16/11, 9h (8/10)")).toBeInTheDocument();
    expect(useOrientationSummary).toHaveBeenCalledWith(true);
  });

  it("'Ver a conta' traz a conta e a fonte com a hora (Brasília)", () => {
    render(<OrientationQueueCard />);
    expect(
      screen.getByText(
        "Conta: 935 = 955 pendentes − 20 com aula marcada. Pendentes = 1.000 ativos − 40 aprovados − 5 reprovados (inclui 10 sem identidade global).",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Fonte: Freelancers ativos do Empresa, situação da aula e inscrições marcadas; contado às 12:30.",
      ),
    ).toBeInTheDocument();
  });

  it("sem turma aberta", () => {
    summary.data = { ...base, nextSession: null };
    render(<OrientationQueueCard />);
    expect(screen.getByText("Nenhuma turma aberta")).toBeInTheDocument();
  });

  it("link para as turmas", () => {
    render(<OrientationQueueCard />);
    expect(screen.getByRole("link", { name: "Ver turmas" })).toHaveAttribute("href", "/onboarding");
  });

  it("sem ORIENTATION: nada aparece e não busca", () => {
    auth.allowed = false;
    const { container } = render(<OrientationQueueCard />);
    expect(container).toBeEmptyDOMElement();
    expect(useOrientationSummary).toHaveBeenCalledWith(false);
  });
});

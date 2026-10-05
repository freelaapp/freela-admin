import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReferralItem } from "@/modules/admin/infrastructure/referrals-api";
import { ReferralDetailDialog } from "./referral-detail-dialog";

const testDoDono: ReferralItem = {
  id: "ref-1",
  status: "REGISTERED",
  rejectionReason: null,
  createdAt: "2026-09-25T15:00:00.000Z",
  qualifiedAt: null,
  qualifyingModule: null,
  code: { code: "DIEGOKMJT" },
  referrer: { id: "d-1", phone: null, email: "dono@x.com", profile: { name: "Diego" } },
  referred: {
    id: "u-1",
    phone: "+5519989819317",
    email: "teste@x.com",
    emailConfirmed: false,
    profile: { name: "Diego Teste" },
  },
  reward: null,
  referredAccount: {
    kind: "EMPRESA",
    stage: "CONCLUIU",
    pendingReason: "VAGA_ABAIXO_DO_MINIMO",
    deadline: "2026-10-25T15:00:00.000Z",
    profiles: { empresa: true, casa: false, freelancer: false },
    company: { name: "Bar Teste", city: "Jundiaí" },
    vacancies: 1,
    lastVacancyAt: "2026-09-25T15:30:00.000Z",
    hires: 1,
    completedJobs: 1,
    firstCompletedJob: {
      vacancyId: "v-1",
      title: "Jardineiro",
      amountInCents: 480,
      endedAt: "2026-09-25T20:00:00.000Z",
    },
  },
};

describe("ReferralDetailDialog", () => {
  it("mostra o caminho, o motivo e o valor da vaga que travou a recompensa", () => {
    render(<ReferralDetailDialog item={testDoDono} onClose={vi.fn()} />);

    expect(screen.getByText("Diego Teste")).toBeInTheDocument();
    expect(screen.getAllByText("Vaga abaixo de R$ 80").length).toBeGreaterThan(0);
    expect(screen.getByText(/Jardineiro · R\$\s?4,80/)).toBeInTheDocument();
    expect(screen.getByText("Bar Teste · Jundiaí")).toBeInTheDocument();
    expect(screen.getByText("(não confirmado)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir em Usuários" })).toHaveAttribute(
      "href",
      "/usuarios?busca=teste%40x.com",
    );
  });

  it("não renderiza sem indicação selecionada", () => {
    const { container } = render(<ReferralDetailDialog item={null} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

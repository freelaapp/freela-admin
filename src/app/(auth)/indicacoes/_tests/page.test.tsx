import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ReferralItem,
  ReferralSummary,
} from "@/modules/admin/infrastructure/referrals-api";
import IndicacoesPage from "../page";

vi.mock("@/modules/auth/application/use-area-guard", () => ({
  useAreaGuard: () => ({ allowed: true, isChecking: false }),
}));
const api = vi.hoisted(() => ({
  getReferralSummary: vi.fn(),
  getReferralMetrics: vi.fn(),
  getReferrals: vi.fn(),
  getReferralRewards: vi.fn(),
}));
vi.mock("@/modules/admin/infrastructure/referrals-api", async (orig) => ({
  ...(await orig<object>()),
  ...api,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const summary: ReferralSummary = {
  referrals: { REGISTERED: 25, QUALIFIED: 0, REJECTED: 336 },
  referredByKind: { EMPRESA: 9, CASA: 2, FREELANCER: 104, SEM_PERFIL: 248 },
  rejectedByPersonaBug: 336,
  pendingByReason: { SO_LOGIN: 21, NAO_E_EMPRESA: 4 },
  rewards: {
    PENDING: { count: 0, amountInCents: 0 },
    APPROVED: { count: 0, amountInCents: 0 },
    PAID: { count: 0, amountInCents: 0 },
    CANCELLED: { count: 0, amountInCents: 0 },
  },
  outstandingInCents: 0,
};

const soLogin: ReferralItem = {
  id: "ref-1",
  status: "REGISTERED",
  rejectionReason: null,
  createdAt: "2026-10-04T12:00:00.000Z",
  qualifiedAt: null,
  qualifyingModule: null,
  code: { code: "MEIRIEWJHM" },
  referrer: { id: "f-1", phone: null, email: null, profile: { name: "Meiriele Mateus" } },
  referrerKind: "FREELANCER",
  referred: {
    id: "u-1",
    phone: "+5511950830172",
    email: "beatriz@x.com",
    profile: { name: "Beatriz Corrêa" },
  },
  reward: null,
  rejectedByPersonaBug: false,
  referredAccount: {
    kind: "SEM_PERFIL",
    stage: "SO_LOGIN",
    pendingReason: "SO_LOGIN",
    deadline: "2026-11-03T12:00:00.000Z",
    profiles: { empresa: false, casa: false, freelancer: false },
    company: null,
    vacancies: 0,
    lastVacancyAt: null,
    hires: 0,
    completedJobs: 0,
    firstCompletedJob: null,
  },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <IndicacoesPage />
    </QueryClientProvider>,
  );
}

describe("IndicacoesPage — aba Indicações", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getReferralSummary.mockResolvedValue(summary);
    api.getReferralMetrics.mockResolvedValue({
      period: { from: null, to: null },
      pageViews: { total: 0, uniqueUsers: 0, byPlatform: { web: 0, app: 0 } },
      linkOpens: { total: 0, uniqueCodes: 0 },
      codesGenerated: 0,
      signups: {
        total: 0,
        byStatus: { REGISTERED: 0, QUALIFIED: 0, REJECTED: 0 },
        byProfile: { empresa: 0, casa: 0, freelancer: 0, semPerfil: 0 },
      },
      vacancies: { total: 0, contractors: 0, byModule: { "bars-restaurants": 0, "home-services": 0 } },
    });
    api.getReferralRewards.mockResolvedValue({ total: 0, page: 1, pageSize: 50, items: [] });
    api.getReferrals.mockResolvedValue({ total: 1, page: 1, pageSize: 50, items: [soLogin] });
  });

  it("mostra por que as indicações abertas não viraram recompensa", async () => {
    renderPage();
    const panel = await screen.findByRole("region", {
      name: /por que as indicações abertas ainda não viraram recompensa/i,
    });
    expect(within(panel).getByText("Parou no 1º passo do cadastro")).toBeInTheDocument();
    expect(within(panel).getByText("21")).toBeInTheDocument();
    expect(within(panel).getByText(/336 recusadas pelo erro de cadastro/)).toBeInTheDocument();
  });

  it("lista o tipo de conta e a etapa, e filtra por tipo de conta no servidor", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Indicações" }));

    expect((await screen.findAllByText("Beatriz Corrêa")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Só criou o login").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Parou no 1º passo (só criou o login)").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Tipo de conta criada"), {
      target: { value: "EMPRESA" },
    });
    await waitFor(() =>
      expect(api.getReferrals).toHaveBeenLastCalledWith(
        expect.objectContaining({ accountKind: "EMPRESA", page: 1 }),
      ),
    );
  });

  it("abre os detalhes da indicação com o link para Usuários", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Indicações" }));
    const [detailsButton] = await screen.findAllByRole("button", { name: /Detalhes/ });
    fireEvent.click(detailsButton);

    expect(await screen.findByRole("link", { name: "Abrir em Usuários" })).toHaveAttribute(
      "href",
      "/usuarios?busca=beatriz%40x.com",
    );
  });
});

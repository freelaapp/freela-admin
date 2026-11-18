import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  VacancyCandidacyItem,
  VacancyCandidacyProvider,
} from "@/modules/admin/infrastructure/admin-api";

const api = vi.hoisted(() => ({ getProviderHistory: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/admin-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/admin/infrastructure/admin-api")>()),
  ...api,
}));

import { VacancyCandidacyList } from "./vacancy-candidacy-list";

const dados = (over: Partial<VacancyCandidacyProvider> = {}): VacancyCandidacyProvider => ({
  profileImage: "https://cdn.freela.test/ester.png?assinada=1",
  jobTitle: "Atendente",
  bio: "Gosto de atender bem.",
  tier: "PRATA",
  tierLabel: "Prata",
  averageRating: 4.75,
  totalRatings: 8,
  completedServices: 6,
  totalCompletedServices: 11,
  age: 24,
  reputationScore: 87,
  lowPriority: false,
  distanceInKm: 6.3,
  distanceApprox: false,
  neighborhood: "Bela Vista",
  city: "São Paulo",
  uf: "SP",
  curriculum: {
    experiences: [{ workplace: "Spoleto", role: "Atendente", durationLabel: "1 ano" }],
    skills: "Atendimento ao público",
  },
  presentationVideoUrl: "https://cdn.freela.test/ester.mp4?assinada=1",
  providerGlobalId: "pg-1",
  ...over,
});

const candidato = (over: Partial<VacancyCandidacyItem> = {}): VacancyCandidacyItem => ({
  id: "cand-1",
  providerId: "prov-1",
  providerName: "Ester Amaral",
  providerPhone: "+5512981944066",
  providerEmail: "ester@teste.test",
  status: "PENDING",
  createdAt: "2026-11-15T12:00:00.000Z",
  matchScore: 74,
  provider: dados(),
  ...over,
});

function renderList(candidacies: VacancyCandidacyItem[], extra: Record<string, unknown> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VacancyCandidacyList
        candidacies={candidacies}
        loading={false}
        onConfirm={vi.fn()}
        confirming={false}
        {...extra}
      />
    </QueryClientProvider>,
  );
}

describe("Candidatos da vaga: dados do freelancer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getProviderHistory.mockResolvedValue([]);
  });

  it("o cartão mostra foto, função, nível, nota, serviços, idade, bairro com km e o score", () => {
    renderList([candidato()]);
    const card = within(screen.getByTestId("lista-candidatos"));

    expect(card.getByAltText("Foto de Ester Amaral")).toHaveAttribute(
      "src",
      "https://cdn.freela.test/ester.png?assinada=1",
    );
    expect(card.getByText("Atendente")).toBeInTheDocument();
    expect(card.getByText("Prata")).toBeInTheDocument();
    expect(card.getByText("4,8 · 8 avaliações")).toBeInTheDocument();
    expect(card.getByText("6 serviços")).toBeInTheDocument();
    expect(card.getByText("24 anos")).toBeInTheDocument();
    // Lugar e distância em linhas separadas; a distância com o texto da empresa.
    expect(card.getByText("Bela Vista, São Paulo – SP")).toBeInTheDocument();
    expect(card.getByText("6,3 km em linha reta até o trabalho")).toBeInTheDocument();
    expect(card.getByText("Score 87")).toBeInTheDocument();
    expect(card.getByText("74% compatível")).toBeInTheDocument();
    expect(card.queryByText("Baixa prioridade")).not.toBeInTheDocument();
  });

  it("distância aproximada: fica o bairro, sem km; sem avaliação não aparece nota zero", () => {
    renderList([
      candidato({
        provider: dados({
          distanceInKm: null,
          distanceApprox: true,
          neighborhood: "Parque Bologne",
          averageRating: null,
          totalRatings: 0,
          completedServices: 0,
          reputationScore: null,
          lowPriority: true,
          profileImage: null,
        }),
      }),
    ]);
    const card = within(screen.getByTestId("lista-candidatos"));

    expect(card.getByText("Parque Bologne, São Paulo – SP")).toBeInTheDocument();
    expect(card.queryByText(/km/)).not.toBeInTheDocument();
    // Sem os dois endereços de rua: "Distância indisponível", nunca "0 km".
    expect(card.getByText("Distância indisponível")).toBeInTheDocument();
    expect(card.getByText("Sem avaliações")).toBeInTheDocument();
    expect(card.getByText("Nenhum serviço ainda")).toBeInTheDocument();
    expect(card.getByText("Baixa prioridade")).toBeInTheDocument();
    expect(card.queryByText(/^Score/)).not.toBeInTheDocument();
    // Sem foto: as iniciais no lugar.
    expect(card.getByText("EA")).toBeInTheDocument();
  });

  it("API antiga ou vertical sem os dados: o cartão fica como era, sem 'Ver perfil'", () => {
    renderList([candidato({ provider: undefined })]);

    expect(screen.getByText("Ester Amaral")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver perfil" })).not.toBeInTheDocument();
    expect(screen.queryByAltText("Foto de Ester Amaral")).not.toBeInTheDocument();
    expect(api.getProviderHistory).not.toHaveBeenCalled();
  });

  it("'Ver perfil' abre currículo, vídeo, contato e as avaliações recebidas", async () => {
    api.getProviderHistory.mockResolvedValue([
      {
        vacancyId: "v1",
        title: "Atendente",
        date: "2026-10-20T12:00:00.000Z",
        payment: 150,
        status: "COMPLETED",
        rating: 5,
        comment: "Pontual e atenciosa.",
        authorName: "João",
        authorCompanyName: "Bar do Zé",
      },
      // Serviço sem avaliação não entra na lista de avaliações.
      {
        vacancyId: "v2",
        title: "Atendente",
        date: "2026-10-25T12:00:00.000Z",
        payment: 150,
        status: "COMPLETED",
        rating: null,
        comment: null,
        authorName: null,
      },
    ]);
    renderList([candidato()]);

    // Antes de abrir, nada é buscado (são dezenas de candidatos por vaga).
    expect(api.getProviderHistory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ver perfil" }));

    const perfil = within(screen.getByRole("dialog", { name: "Perfil de Ester Amaral" }));
    expect(perfil.getByText("Gosto de atender bem.")).toBeInTheDocument();
    expect(perfil.getByText("Atendente", { selector: "p" })).toBeInTheDocument();
    expect(perfil.getByText("· Spoleto")).toBeInTheDocument();
    expect(perfil.getByText("Atendimento ao público")).toBeInTheDocument();
    expect(perfil.getByRole("link", { name: /Abrir no WhatsApp/ })).toHaveAttribute(
      "href",
      "https://wa.me/5512981944066",
    );
    expect(document.querySelector("video")).toHaveAttribute(
      "src",
      "https://cdn.freela.test/ester.mp4?assinada=1",
    );

    await waitFor(() => expect(api.getProviderHistory).toHaveBeenCalledWith("prov-1"));
    expect(await perfil.findByText("Pontual e atenciosa.")).toBeInTheDocument();
    expect(perfil.getByText(/Bar do Zé · Atendente/)).toBeInTheDocument();

    fireEvent.click(perfil.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog", { name: "Perfil de Ester Amaral" })).not.toBeInTheDocument();
  });

  it("perfil sem currículo, sem vídeo e sem avaliações diz isso, em vez de seções vazias", async () => {
    renderList([
      candidato({ provider: dados({ curriculum: null, presentationVideoUrl: null, bio: null }) }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Ver perfil" }));

    const perfil = within(screen.getByRole("dialog", { name: "Perfil de Ester Amaral" }));
    expect(perfil.getByText("Este freelancer ainda não preencheu o currículo.")).toBeInTheDocument();
    expect(perfil.getByText("Sem vídeo de apresentação.")).toBeInTheDocument();
    expect(await perfil.findByText("Nenhuma avaliação recebida até agora.")).toBeInTheDocument();
  });

  it("modo de escolher titular e suplentes: os dados ficam no cartão e o perfil abre sem marcar", () => {
    const onToggle = vi.fn();
    renderList([candidato()], {
      chooseMode: {
        selection: { principal: null, reserves: [] },
        onToggle,
        reserveEligibleIds: new Set(["cand-1"]),
        maxReserves: 2,
        onReview: vi.fn(),
      },
    });

    const caixa = within(screen.getByRole("checkbox", { name: "Ester Amaral" }));
    expect(caixa.getByText("4,8 · 8 avaliações")).toBeInTheDocument();
    expect(caixa.getByText("Bela Vista, São Paulo – SP")).toBeInTheDocument();
    expect(caixa.getByText("6,3 km em linha reta até o trabalho")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver perfil de Ester Amaral" }));

    expect(screen.getByRole("dialog", { name: "Perfil de Ester Amaral" })).toBeInTheDocument();
    // Abrir o perfil não pode marcar a pessoa como titular.
    expect(onToggle).not.toHaveBeenCalled();
  });
});

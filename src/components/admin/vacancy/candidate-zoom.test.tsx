import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  VacancyCandidacyItem,
  VacancyCandidacyProvider,
} from "@/modules/admin/infrastructure/admin-api";
import {
  candidateDistance,
  placeLabel,
  sortByDistance,
} from "@/modules/admin/application/candidate-presentation";

const api = vi.hoisted(() => ({ getProviderHistory: vi.fn() }));
vi.mock("@/modules/admin/infrastructure/admin-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/admin/infrastructure/admin-api")>()),
  ...api,
}));

import { VacancyCandidacyList } from "./vacancy-candidacy-list";

const dados = (over: Partial<VacancyCandidacyProvider> = {}): VacancyCandidacyProvider => ({
  profileImage: "https://cdn.freela.test/foto.png?assinada=1",
  jobTitle: "Garçom",
  bio: null,
  tier: "OURO",
  tierLabel: "Ouro",
  averageRating: 4.9,
  totalRatings: 12,
  completedServices: 9,
  totalCompletedServices: 20,
  age: 30,
  reputationScore: 90,
  lowPriority: false,
  distanceInKm: 6.3,
  distanceApprox: false,
  neighborhood: "Bela Vista",
  city: "São Paulo",
  uf: "SP",
  curriculum: null,
  presentationVideoUrl: null,
  providerGlobalId: "pg-1",
  ...over,
});

const candidato = (id: string, name: string, provider: Partial<VacancyCandidacyProvider> | null) =>
  ({
    id,
    providerId: `prov-${id}`,
    providerName: name,
    providerPhone: null,
    providerEmail: null,
    status: "PENDING",
    createdAt: "2026-11-15T12:00:00.000Z",
    provider: provider === null ? undefined : dados(provider),
  }) as VacancyCandidacyItem;

const VAGA = {
  role: "Garçom",
  company: "Bar do Zé",
  when: "21/11/2026 · 18:00 - 02:00",
  address: "Rua Augusta, 100, São Paulo – SP",
  value: "R$ 180,00",
};

function renderList(candidacies: VacancyCandidacyItem[], vacancy: typeof VAGA | undefined = VAGA) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VacancyCandidacyList
        candidacies={candidacies}
        loading={false}
        onConfirm={vi.fn()}
        confirming={false}
        vacancy={vacancy}
      />
    </QueryClientProvider>,
  );
}

const nomesNaOrdem = () =>
  within(screen.getByTestId("lista-candidatos"))
    .getAllByText(/^(Ana|Bruno|Carla|Davi)$/)
    .map((el) => el.textContent);

describe("distância do candidato (mesma regra da empresa)", () => {
  it("distância nova: o texto da API + 'até o trabalho'; null = indisponível", () => {
    expect(
      candidateDistance({
        distanceInKm: null,
        distance: { km: 19, kind: "STRAIGHT", approx: true, label: "cerca de 19 km em linha reta" },
      }),
    ).toEqual({ km: 19, text: "cerca de 19 km em linha reta até o trabalho", available: true });
    expect(
      candidateDistance({
        distanceInKm: 0,
        distance: { km: 0, kind: "STRAIGHT", approx: false, label: "menos de 100 m em linha reta" },
      }).text,
    ).toBe("menos de 100 m em linha reta até o trabalho");
    // `distance: null` não cai no km legado, mesmo que viesse um.
    expect(candidateDistance({ distanceInKm: 4, distance: null })).toEqual({
      km: null,
      text: "Distância indisponível",
      available: false,
    });
  });

  it("caminho antigo: km só com os dois endereços de rua; nunca '0 km'", () => {
    expect(candidateDistance({ distanceInKm: 6.3 }).text).toBe("6,3 km em linha reta até o trabalho");
    expect(candidateDistance({ distanceInKm: null }).text).toBe("Distância indisponível");
    expect(candidateDistance({ distanceInKm: 0 }).text).toBe(
      "menos de 100 m em linha reta até o trabalho",
    );
    expect(candidateDistance({ distanceInKm: 0 }).text).not.toMatch(/0 km/);
  });

  it("lugar sem a distância", () => {
    expect(placeLabel({ neighborhood: "Bela Vista", city: "São Paulo", uf: "SP" })).toBe(
      "Bela Vista, São Paulo – SP",
    );
    expect(placeLabel({ neighborhood: " ", city: null, uf: null })).toBeNull();
  });

  it("mais perto primeiro; sem distância (ou sem dados) no fim, na ordem de antes", () => {
    const lista = [
      { id: "a", provider: dados({ distanceInKm: null }) },
      { id: "b", provider: dados({ distanceInKm: 12 }) },
      { id: "c" },
      { id: "d", provider: dados({ distanceInKm: 2.5 }) },
      { id: "e", provider: dados({ distanceInKm: null, distance: null }) },
    ];
    expect(sortByDistance(lista).map((x) => x.id)).toEqual(["d", "b", "a", "c", "e"]);
    // Não mexe na lista original.
    expect(lista.map((x) => x.id)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("Modo painel › candidatos da vaga: zoom e ordem por distância", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getProviderHistory.mockResolvedValue([]);
  });

  it("cada cartão diz a distância até o trabalho, ou 'Distância indisponível'", () => {
    renderList([
      candidato("1", "Ana", { distanceInKm: 8.2 }),
      candidato("2", "Bruno", { distanceInKm: null, distanceApprox: true }),
    ]);
    const distancias = screen.getAllByTestId("distancia-candidato").map((el) => el.textContent);
    expect(distancias).toEqual(["8,2 km em linha reta até o trabalho", "Distância indisponível"]);
  });

  it("clicar na FOTO abre o zoom: foto grande, dados do freelancer, distância e a vaga", () => {
    renderList([candidato("1", "Ana", { distanceInKm: 8.2 })]);

    fireEvent.click(screen.getByRole("button", { name: "Ver perfil de Ana" }));

    const zoom = within(screen.getByRole("dialog", { name: "Perfil de Ana" }));
    expect(zoom.getByAltText("Foto de Ana")).toHaveClass("sm:h-40");
    expect(zoom.getByText("Ouro")).toBeInTheDocument();
    expect(zoom.getByText("4,9 · 12 avaliações")).toBeInTheDocument();
    expect(zoom.getByText("9 serviços")).toBeInTheDocument();
    expect(zoom.getByTestId("distancia-zoom")).toHaveTextContent("8,2 km em linha reta até o trabalho");
    expect(zoom.getByText("Vaga")).toBeInTheDocument();
    expect(zoom.getByText("Garçom · Bar do Zé")).toBeInTheDocument();
    expect(zoom.getByText("21/11/2026 · 18:00 - 02:00")).toBeInTheDocument();
    expect(zoom.getByText("Rua Augusta, 100, São Paulo – SP")).toBeInTheDocument();
    expect(zoom.getByText("R$ 180,00")).toBeInTheDocument();
  });

  it("sem coordenada, o zoom diz por que não há distância", () => {
    renderList([candidato("1", "Ana", { distanceInKm: null, distanceApprox: true })]);
    fireEvent.click(screen.getByRole("button", { name: "Ver perfil de Ana" }));
    const zoom = within(screen.getByRole("dialog", { name: "Perfil de Ana" }));
    expect(zoom.getByTestId("distancia-zoom")).toHaveTextContent("Distância indisponível");
    expect(zoom.getByText(/Falta o endereço completo/)).toBeInTheDocument();
  });

  it("ordenar por distância: mais perto primeiro e quem não tem distância no fim", () => {
    renderList([
      candidato("1", "Ana", { distanceInKm: null, distanceApprox: true }),
      candidato("2", "Bruno", { distanceInKm: 12 }),
      candidato("3", "Carla", { distanceInKm: 1.4 }),
      candidato("4", "Davi", { distanceInKm: 5 }),
    ]);
    expect(nomesNaOrdem()).toEqual(["Ana", "Bruno", "Carla", "Davi"]);

    fireEvent.click(screen.getByRole("button", { name: "Mais perto primeiro" }));
    expect(nomesNaOrdem()).toEqual(["Carla", "Davi", "Bruno", "Ana"]);
    expect(screen.getByText("Quem não tem distância fica no fim da lista.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ordem atual" }));
    expect(nomesNaOrdem()).toEqual(["Ana", "Bruno", "Carla", "Davi"]);
  });

  it("ninguém com distância: o botão fica desligado e diz por quê", () => {
    renderList([
      candidato("1", "Ana", { distanceInKm: null }),
      candidato("2", "Bruno", { distanceInKm: null }),
    ]);
    expect(screen.getByRole("button", { name: "Mais perto primeiro" })).toBeDisabled();
    expect(screen.getByText("Nenhum candidato com distância calculada.")).toBeInTheDocument();
  });

  it("lista sem os dados do candidato (Casa / API antiga): sem controle de ordem nem foto clicável", () => {
    renderList([candidato("1", "Ana", null), candidato("2", "Bruno", null)], undefined);
    expect(screen.queryByRole("group", { name: "Ordenar candidatos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver perfil/ })).not.toBeInTheDocument();
  });
});

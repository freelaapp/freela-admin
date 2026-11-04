import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { VacancyStartLocation } from "@/modules/admin/infrastructure/admin-api";
import { VacancyRoadmap, type RoadmapVacancy } from "./vacancy-roadmap";

// Fluxo v2, fatia F2: na etapa "Serviço em andamento", onde o freelancer estava ao tocar
// "Iniciar serviço". Só com dado: sem o campo (chave desligada, API anterior, Casa) ou com
// `null` (a empresa iniciou), o roadmap fica exatamente como era.

const STARTED = "2026-11-14T21:04:00.000Z"; // 18h04 em Brasília

const vaga = (over: Partial<RoadmapVacancy> = {}): RoadmapVacancy => ({
  status: "CLOSED",
  startTime: "2026-11-14T21:00:00.000Z",
  endTime: "2026-11-15T02:00:00.000Z",
  candidacyCount: 3,
  job: { status: "IN_PROGRESS" },
  createdAt: "2026-11-10T12:00:00.000Z",
  timeline: {
    createdAt: "2026-11-10T12:00:00.000Z",
    firstCandidacyAt: "2026-11-10T13:00:00.000Z",
    hiredAt: "2026-11-11T13:00:00.000Z",
    scheduledAt: "2026-11-11T13:05:00.000Z",
    startedAt: STARTED,
    endedAt: null,
    reviewedAt: null,
    providerConfirmedAt: "2026-11-13T20:00:00.000Z",
  },
  ...over,
});

const inside: VacancyStartLocation = {
  status: "INSIDE",
  distanceMeters: 120,
  accuracyMeters: 12,
  radiusMeters: 200,
};

describe("Roadmap da vaga — local do 'Iniciar serviço' (fatia F2)", () => {
  it("com o local: a frase e a conta na etapa 'Serviço em andamento'", () => {
    render(<VacancyRoadmap vacancy={vaga({ startLocation: inside })} />);
    const block = screen.getByTestId("roadmap-start-location");
    expect(block).toHaveTextContent("Iniciou às 18h04 a 120 m do local");
    expect(block).toHaveTextContent("raio de 200 m; GPS com precisão de 12 m");
    // Dentro da etapa certa.
    expect(block.closest("li")).toHaveTextContent("Serviço em andamento");
  });

  it("fora do raio e app sem localização", () => {
    const { rerender } = render(
      <VacancyRoadmap
        vacancy={vaga({
          startLocation: { ...inside, status: "OUTSIDE", distanceMeters: 850 },
        })}
      />,
    );
    expect(screen.getByTestId("roadmap-start-location")).toHaveTextContent(
      "Iniciou às 18h04 fora do raio (850 m)",
    );
    rerender(
      <VacancyRoadmap
        vacancy={vaga({
          startLocation: {
            status: "NOT_SENT",
            distanceMeters: null,
            accuracyMeters: null,
            radiusMeters: null,
          },
        })}
      />,
    );
    expect(screen.getByTestId("roadmap-start-location")).toHaveTextContent(
      "Iniciou às 18h04 · app sem localização",
    );
  });

  it("sem dado (campo ausente ou null): nada novo, o mesmo roadmap de antes", () => {
    const absent = render(<VacancyRoadmap vacancy={vaga()} />);
    const before = absent.container.innerHTML;
    expect(screen.queryByTestId("roadmap-start-location")).toBeNull();
    absent.unmount();

    const empty = render(
      <VacancyRoadmap vacancy={vaga({ startLocation: null })} />,
    );
    expect(empty.container.innerHTML).toBe(before);
    expect(screen.queryByText(/Iniciou/)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import type { VacancyStartLocation } from "../infrastructure/admin-api";
import {
  describeStartLocation,
  distanceLabel,
  startHourLabel,
} from "./start-location-presentation";

/** 18h04 em Brasília (UTC−3). */
const STARTED = "2026-11-14T21:04:00.000Z";

const loc = (over: Partial<VacancyStartLocation>): VacancyStartLocation => ({
  status: "INSIDE",
  distanceMeters: 120,
  accuracyMeters: 12,
  radiusMeters: 200,
  ...over,
});

describe("Local do 'Iniciar serviço' (fluxo v2, fatia F2) — textos", () => {
  it("hora em Brasília: 18h04; hora cheia sem minutos; sem hora válida, null", () => {
    expect(startHourLabel(STARTED)).toBe("18h04");
    expect(startHourLabel("2026-11-14T21:00:00.000Z")).toBe("18h");
    expect(startHourLabel("2026-11-15T02:30:00.000Z")).toBe("23h30");
    expect(startHourLabel(null)).toBeNull();
    expect(startHourLabel("lixo")).toBeNull();
  });

  it("distância: metros até 999; km com uma casa até 10 km; depois, km inteiro", () => {
    expect(distanceLabel(120)).toBe("120 m");
    expect(distanceLabel(999)).toBe("999 m");
    expect(distanceLabel(1234)).toBe("1,2 km");
    expect(distanceLabel(12_500)).toBe("13 km");
  });

  it("a até o raio: 'Iniciou às 18h04 a 120 m do local', com a conta embaixo", () => {
    expect(describeStartLocation(loc({}), STARTED)).toEqual({
      text: "Iniciou às 18h04 a 120 m do local",
      detail:
        'Distância do celular até o endereço da vaga, no toque em "Iniciar serviço" (raio de 200 m; GPS com precisão de 12 m).',
      tone: "ok",
    });
  });

  it("fora do raio: 'Iniciou às 18h04 fora do raio (850 m)'", () => {
    expect(
      describeStartLocation(
        loc({ status: "OUTSIDE", distanceMeters: 850, accuracyMeters: 15 }),
        STARTED,
      ),
    ).toMatchObject({
      text: "Iniciou às 18h04 fora do raio (850 m)",
      tone: "warn",
    });
    expect(
      describeStartLocation(
        loc({ status: "OUTSIDE", distanceMeters: 5400 }),
        STARTED,
      )?.text,
    ).toBe("Iniciou às 18h04 fora do raio (5,4 km)");
  });

  it("GPS impreciso: a precisão na frase e a distância na conta", () => {
    expect(
      describeStartLocation(
        loc({
          status: "LOW_ACCURACY",
          distanceMeters: 189,
          accuracyMeters: 900,
        }),
        STARTED,
      ),
    ).toEqual({
      text: "Iniciou às 18h04 com GPS impreciso (precisão de 900 m)",
      detail:
        "A 189 m do endereço da vaga, mas com essa precisão não dá para dizer se estava no raio de 200 m.",
      tone: "neutral",
    });
    expect(
      describeStartLocation(
        loc({
          status: "LOW_ACCURACY",
          distanceMeters: 189,
          accuracyMeters: null,
        }),
        STARTED,
      )?.text,
    ).toBe("Iniciou às 18h04 com GPS sem precisão informada");
  });

  it("sem localização: permissão negada, sem posição, app antigo; local da vaga sem ponto exato", () => {
    const empty = {
      distanceMeters: null,
      accuracyMeters: null,
      radiusMeters: null,
    };
    expect(
      describeStartLocation(loc({ ...empty, status: "NO_PERMISSION" }), STARTED)
        ?.text,
    ).toBe("Iniciou às 18h04 sem localização (permissão negada)");
    expect(
      describeStartLocation(loc({ ...empty, status: "UNAVAILABLE" }), STARTED)
        ?.text,
    ).toBe("Iniciou às 18h04 sem localização (o celular não deu a posição)");
    expect(
      describeStartLocation(loc({ ...empty, status: "NOT_SENT" }), STARTED),
    ).toEqual({
      text: "Iniciou às 18h04 · app sem localização",
      detail: "Versão do app sem o envio do local, ou início pelo site.",
      tone: "neutral",
    });
    expect(
      describeStartLocation(
        loc({ ...empty, status: "NO_VACANCY_COORDS", accuracyMeters: 10 }),
        STARTED,
      ),
    ).toEqual({
      text: "Iniciou às 18h04 · distância não calculada",
      detail: "O endereço da vaga não tem o ponto exato no mapa (só a cidade).",
      tone: "neutral",
    });
  });

  it("sem dado, ou situação que o painel não conhece: nada", () => {
    expect(describeStartLocation(null, STARTED)).toBeNull();
    expect(describeStartLocation(undefined, STARTED)).toBeNull();
    expect(
      describeStartLocation(
        { ...loc({}), status: "NOVA" as VacancyStartLocation["status"] },
        STARTED,
      ),
    ).toBeNull();
  });

  it("sem o horário do início: a frase sem a hora", () => {
    expect(describeStartLocation(loc({}), null)?.text).toBe(
      "Iniciou a 120 m do local",
    );
  });
});

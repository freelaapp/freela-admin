import { describe, expect, it } from "vitest";

import { resolveVacancyBucket } from "./vacancy-bucket";
import {
  displayVacancyStatus,
  isVacancyNotBroadcast,
  matchesStatusFilter,
  type VacancyDisplayStatus,
} from "./vacancy-display-status";

const AGORA = new Date("2026-09-24T12:00:00.000Z");
const FUTURO = "2026-09-24T21:00:00.000Z";
const PASSADO = "2026-05-10T21:00:00.000Z";

describe("displayVacancyStatus", () => {
  it("aberta com horário passado vira 'lost' (Vencida)", () => {
    const bucket = resolveVacancyBucket({ status: "OPEN", startTime: PASSADO, endTime: PASSADO }, AGORA);
    expect(displayVacancyStatus("open", bucket)).toBe("lost");
  });

  it("aberta no prazo continua 'open', com ou sem candidato", () => {
    expect(displayVacancyStatus("open", resolveVacancyBucket({ status: "OPEN", endTime: FUTURO }, AGORA))).toBe("open");
    expect(
      displayVacancyStatus("open", resolveVacancyBucket({ status: "OPEN", endTime: FUTURO, candidacyCount: 2 }, AGORA)),
    ).toBe("open");
  });

  it("fechada e cancelada nunca viram Vencida", () => {
    expect(displayVacancyStatus("filled", resolveVacancyBucket({ status: "CLOSED", endTime: PASSADO }, AGORA))).toBe("filled");
    expect(
      displayVacancyStatus("cancelled", resolveVacancyBucket({ status: "CANCELLED", endTime: PASSADO }, AGORA)),
    ).toBe("cancelled");
  });
});

describe("matchesStatusFilter — chips de Vagas em Casa", () => {
  const linhas: Array<{ id: string; status: VacancyDisplayStatus }> = [
    { id: "futura", status: displayVacancyStatus("open", resolveVacancyBucket({ status: "OPEN", endTime: FUTURO }, AGORA)) },
    { id: "maio", status: displayVacancyStatus("open", resolveVacancyBucket({ status: "OPEN", endTime: PASSADO }, AGORA)) },
    { id: "fechada", status: "filled" },
  ];
  const ids = (filtro: "all" | VacancyDisplayStatus) =>
    linhas.filter((l) => matchesStatusFilter(l.status, filtro)).map((l) => l.id);

  it("'Abertas' exclui as vencidas", () => expect(ids("open")).toEqual(["futura"]));
  it("'Vencidas' traz só as abertas com data passada", () => expect(ids("lost")).toEqual(["maio"]));
  it("'Todas' traz tudo", () => expect(ids("all")).toEqual(["futura", "maio", "fechada"]));
});

describe("isVacancyNotBroadcast", () => {
  it("aberta (sem candidato ou aguardando seleção) e nunca divulgada → true", () => {
    expect(isVacancyNotBroadcast({ bucket: "open", groupBroadcastAt: null })).toBe(true);
    expect(isVacancyNotBroadcast({ bucket: "awaitingSelection", groupBroadcastAt: null })).toBe(true);
  });

  it("vencida, fechada ou cancelada não ganham o selo", () => {
    expect(isVacancyNotBroadcast({ bucket: "lost", groupBroadcastAt: null })).toBe(false);
    expect(isVacancyNotBroadcast({ bucket: "confirmed", groupBroadcastAt: null })).toBe(false);
    expect(isVacancyNotBroadcast({ bucket: "cancelled", groupBroadcastAt: null })).toBe(false);
  });

  it("já divulgada → false", () => {
    expect(isVacancyNotBroadcast({ bucket: "open", groupBroadcastAt: "2026-09-24T12:00:00.000Z" })).toBe(false);
  });

  it("API anterior ao campo (ausente) não afirma nada", () => {
    expect(isVacancyNotBroadcast({ bucket: "open" })).toBe(false);
  });

  it("reenvio acabou de sair (registro do Disparo) some com o selo sem esperar a lista", () => {
    expect(
      isVacancyNotBroadcast({ bucket: "open", groupBroadcastAt: null, outreachSentAt: "2026-09-24T12:05:00.000Z" }),
    ).toBe(false);
  });
});

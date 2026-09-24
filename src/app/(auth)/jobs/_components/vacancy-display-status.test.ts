import { describe, expect, it } from "vitest";

import {
  GROUP_BROADCAST_STAGE,
  type OutreachRecord,
} from "@/modules/admin/infrastructure/vacancy-outreach-api";

import { resolveVacancyBucket } from "./vacancy-bucket";
import {
  displayVacancyStatus,
  findGroupBroadcastRecord,
  isRowNotBroadcast,
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

// Única definição de `disparoDe`/`naoDivulgada`: Empresa e Casa importam estas
// duas em vez de cada página duplicar o mesmo par de closures (revisão 2026-09-24).
describe("findGroupBroadcastRecord", () => {
  const registro: OutreachRecord = {
    vacancyId: "v1",
    stage: GROUP_BROADCAST_STAGE,
    lastSentAt: "2026-09-24T12:05:00.000Z",
    sendCount: 1,
  };
  const registros = new Map<string, OutreachRecord>([[`v1::${GROUP_BROADCAST_STAGE}`, registro]]);

  it("acha o registro pela vaga", () => {
    expect(findGroupBroadcastRecord(registros, "v1")).toBe(registro);
  });

  it("sem registro para a vaga → undefined", () => {
    expect(findGroupBroadcastRecord(registros, "v2")).toBeUndefined();
  });
});

describe("isRowNotBroadcast", () => {
  const semRegistro = new Map<string, OutreachRecord>();

  it("aberta e nunca divulgada (groupBroadcastAt null) → não divulgada", () => {
    expect(isRowNotBroadcast(semRegistro, { id: "v1", bucket: "open", raw: { groupBroadcastAt: null } })).toBe(true);
  });

  it("groupBroadcastAt já setado → não", () => {
    expect(
      isRowNotBroadcast(semRegistro, {
        id: "v1",
        bucket: "open",
        raw: { groupBroadcastAt: "2026-09-24T12:00:00.000Z" },
      }),
    ).toBe(false);
  });

  it("vencida (bucket 'lost') → não", () => {
    expect(isRowNotBroadcast(semRegistro, { id: "v1", bucket: "lost", raw: { groupBroadcastAt: null } })).toBe(
      false,
    );
  });

  it("groupBroadcastAt ausente (API anterior ao campo, não afirma nada) → não", () => {
    expect(isRowNotBroadcast(semRegistro, { id: "v1", bucket: "open", raw: {} })).toBe(false);
  });

  it("reenvio já registrado no Disparo tira o selo mesmo com groupBroadcastAt null", () => {
    const registros = new Map<string, OutreachRecord>([
      [
        `v1::${GROUP_BROADCAST_STAGE}`,
        { vacancyId: "v1", stage: GROUP_BROADCAST_STAGE, lastSentAt: "2026-09-24T12:05:00.000Z", sendCount: 1 },
      ],
    ]);
    expect(isRowNotBroadcast(registros, { id: "v1", bucket: "open", raw: { groupBroadcastAt: null } })).toBe(false);
  });
});

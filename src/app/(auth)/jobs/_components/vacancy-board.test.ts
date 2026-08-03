import { describe, expect, it } from "vitest";

import { JANELA_DIAS, filtrarRecentes, type BoardVacancy } from "./vacancy-board";

const AGORA = Date.parse("2026-08-03T12:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;

function vaga(over: Partial<BoardVacancy> & { startTime?: string | null }): BoardVacancy {
  const { startTime, ...resto } = over;
  return {
    id: "v1",
    bucket: "awaitingHire",
    empresa: "Coco Bambu",
    cargo: "Garçom",
    cidade: "São Paulo",
    candidatos: 0,
    valor: "R$ 180,00",
    data: "03/08",
    turno: "18:00 - 00:00",
    freelancer: null,
    raw: { startTime: startTime ?? null } as BoardVacancy["raw"],
    ...resto,
  };
}

describe("filtrarRecentes (recorte do painel)", () => {
  // Em 03/08/2026 o painel mostrava ~350 vagas, 251 delas com mais de 30 dias —
  // havia uma em "aguardando pagamento" há 67 dias. Era a coluna inteira virada
  // arquivo, e o que precisava de gente sumia no meio.
  it("tira do painel a vaga muito antiga", () => {
    const antiga = vaga({ startTime: new Date(AGORA - 67 * DIA).toISOString() });
    expect(filtrarRecentes([antiga], AGORA)).toHaveLength(0);
  });

  it("mantém vaga dentro da janela e vaga futura", () => {
    const recente = vaga({ id: "a", startTime: new Date(AGORA - 3 * DIA).toISOString() });
    const futura = vaga({ id: "b", startTime: new Date(AGORA + 5 * DIA).toISOString() });
    expect(filtrarRecentes([recente, futura], AGORA).map((v) => v.id)).toEqual(["a", "b"]);
  });

  it("corta exatamente na janela configurada", () => {
    const dentro = vaga({ id: "dentro", startTime: new Date(AGORA - (JANELA_DIAS - 1) * DIA).toISOString() });
    const fora = vaga({ id: "fora", startTime: new Date(AGORA - (JANELA_DIAS + 1) * DIA).toISOString() });
    expect(filtrarRecentes([dentro, fora], AGORA).map((v) => v.id)).toEqual(["dentro"]);
  });

  // Sumir com um registro por não conseguir ler a data dele seria esconder
  // justamente o caso estranho — que é o que mais interessa a quem vigia.
  it("mantém vaga sem data legível em vez de escondê-la", () => {
    expect(filtrarRecentes([vaga({ startTime: null })], AGORA)).toHaveLength(1);
    expect(filtrarRecentes([vaga({ startTime: "data-invalida" })], AGORA)).toHaveLength(1);
  });
});

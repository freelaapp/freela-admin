import { describe, expect, it } from "vitest";

import { filtrarAtivas, type BoardVacancy } from "./vacancy-board";

// Meio-dia UTC = 09:00 em Brasília, bem longe da virada do dia nos dois fusos.
const AGORA = Date.parse("2026-08-03T12:00:00.000Z");
const HOJE = "2026-08-03";
const ONTEM = "2026-08-02";
const AMANHA = "2026-08-04";

function vaga(
  over: Partial<BoardVacancy> & { date?: string | null; startTime?: string | null },
): BoardVacancy {
  const { date, startTime, ...resto } = over;
  return {
    id: "v1",
    bucket: "awaitingPayment",
    empresa: "Coco Bambu",
    cargo: "Garçom",
    cidade: "São Paulo",
    candidatos: 0,
    valor: "R$ 180,00",
    data: "03/08",
    turno: "18:00 - 00:00",
    freelancer: null,
    raw: { date: date ?? null, startTime: startTime ?? null } as BoardVacancy["raw"],
    ...resto,
  };
}

describe("filtrarAtivas (recorte do painel)", () => {
  it("mantém a vaga de hoje e a futura", () => {
    const hoje = vaga({ id: "hoje", date: HOJE });
    const amanha = vaga({ id: "amanha", date: AMANHA });
    expect(filtrarAtivas([hoje, amanha], AGORA).map((v) => v.id)).toEqual(["hoje", "amanha"]);
  });

  // A vaga de hoje fica o dia INTEIRO, mesmo com o turno já encerrado: é depois
  // do turno que alguém confere se deu certo.
  it("mantém a vaga de hoje cujo turno já terminou", () => {
    const encerrada = vaga({ date: HOJE, startTime: "2026-08-03T09:00:00.000Z" });
    expect(filtrarAtivas([encerrada], AGORA)).toHaveLength(1);
  });

  it("tira do painel a vaga de ontem", () => {
    expect(filtrarAtivas([vaga({ date: ONTEM })], AGORA)).toHaveLength(0);
  });

  // O pedido explícito: em 03/08/2026 havia 140 vagas CLOSED de datas passadas
  // empilhadas em "aguardando pagamento" — uma delas parada havia 67 dias.
  it("tira a vaga em 'aguardando pagamento' cuja data já passou", () => {
    const parada = vaga({ bucket: "awaitingPayment", date: "2026-05-28" });
    expect(filtrarAtivas([parada], AGORA)).toHaveLength(0);
  });

  // Freelancer com check-in aberto e sem check-out passou do dia é anomalia,
  // não histórico — some daqui e ninguém repara que o job ficou preso.
  it("mantém vaga EM ANDAMENTO mesmo com a data já passada", () => {
    const presa = vaga({ bucket: "inProgress", date: ONTEM });
    expect(filtrarAtivas([presa], AGORA)).toHaveLength(1);
  });

  it("cai no horário do turno quando não há data pura legível", () => {
    const ontem = vaga({ id: "ontem", date: null, startTime: "2026-08-02T21:00:00.000Z" });
    const hoje = vaga({ id: "hoje", date: null, startTime: "2026-08-03T21:00:00.000Z" });
    expect(filtrarAtivas([ontem, hoje], AGORA).map((v) => v.id)).toEqual(["hoje"]);
  });

  // Turno que vira o dia: 03/08 23h em Brasília é 04/08 02:00Z. Ler o dia em UTC
  // jogaria a vaga para amanhã; ler em São Paulo a mantém no dia certo.
  it("resolve o dia no fuso de Brasília, não em UTC", () => {
    const virada = vaga({ date: null, startTime: "2026-08-04T02:00:00.000Z" });
    // 03/08 23:00 BRT — é a vaga de HOJE, e hoje ainda está no painel.
    expect(filtrarAtivas([virada], AGORA)).toHaveLength(1);
    // No dia seguinte ela sai, como qualquer vaga de ontem.
    expect(filtrarAtivas([virada], AGORA + 24 * 60 * 60 * 1000)).toHaveLength(0);
  });

  // Sumir com um registro por não conseguir ler a data dele seria esconder
  // justamente o caso estranho — que é o que mais interessa a quem vigia.
  it("mantém vaga sem data legível em vez de escondê-la", () => {
    expect(filtrarAtivas([vaga({ date: null, startTime: null })], AGORA)).toHaveLength(1);
    expect(filtrarAtivas([vaga({ date: "data-invalida" })], AGORA)).toHaveLength(1);
  });
});

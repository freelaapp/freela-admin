import { describe, expect, it } from "vitest";

import {
  ACOES_POR_ETAPA,
  ACOES_SEMPRE,
  acaoEstaCritica,
  acoesDaEtapa,
  calcularJanela,
  compararUrgencia,
  formatarTempoRestante,
  resolverPendencias,
  resolverPrioridade,
  type JanelaDaVaga,
  type SupportAction,
} from "./support-actions";

const AGORA = Date.parse("2026-08-03T12:00:00.000Z");
const HORA = 60 * 60 * 1000;

const janela = (horasAteInicio: number | null, horasDesdeFim: number | null = null): JanelaDaVaga => ({
  horasAteInicio,
  horasDesdeFim,
});

describe("calcularJanela", () => {
  it("lê as duas pontas do turno em horas", () => {
    const j = calcularJanela(
      {
        startTime: new Date(AGORA + 3 * HORA).toISOString(),
        endTime: new Date(AGORA + 9 * HORA).toISOString(),
      },
      AGORA,
    );
    expect(j.horasAteInicio).toBeCloseTo(3);
    // Ainda não terminou: "desde o fim" é negativo, e é isso que impede a etapa
    // de avaliação de escalar antes de o serviço acabar.
    expect(j.horasDesdeFim).toBeCloseTo(-9);
  });

  it("devolve null em data ausente ou ilegível em vez de NaN", () => {
    expect(calcularJanela({ startTime: null, endTime: undefined }, AGORA)).toEqual({
      horasAteInicio: null,
      horasDesdeFim: null,
    });
    expect(calcularJanela({ startTime: "nao-e-data" }, AGORA).horasAteInicio).toBeNull();
  });
});

describe("resolverPrioridade — a régua é o tempo", () => {
  it("escala conforme o turno se aproxima", () => {
    expect(resolverPrioridade("open", janela(72))).toBe("normal");
    expect(resolverPrioridade("open", janela(20))).toBe("atencao");
    expect(resolverPrioridade("open", janela(5))).toBe("urgente");
    expect(resolverPrioridade("open", janela(1))).toBe("critico");
  });

  // O caso que mais dói: vaga cujo turno JÁ começou e o contratante não pagou —
  // é a que o sistema cancela sozinha.
  it("trata turno já iniciado em etapa de espera como crítico", () => {
    expect(resolverPrioridade("awaitingPayment", janela(-2))).toBe("critico");
    expect(resolverPrioridade("awaitingSelection", janela(-0.5))).toBe("critico");
  });

  // Em andamento o tempo-até-o-início é sempre negativo e não diz mais nada:
  // pintar toda vaga em serviço de vermelho apagaria o sinal das que pegam fogo.
  it("não usa o tempo-até-o-início depois que o serviço começou", () => {
    expect(resolverPrioridade("inProgress", janela(-6))).toBe("atencao");
  });

  it("escala a avaliação pelos dias parada — é ela que trava o repasse", () => {
    expect(resolverPrioridade("completedAwaitingReview", janela(-8, 3))).toBe("atencao");
    expect(resolverPrioridade("completedAwaitingReview", janela(-30, 26))).toBe("urgente");
    expect(resolverPrioridade("completedAwaitingReview", janela(-60, 50))).toBe("critico");
  });

  it("não inventa urgência sem data legível, mas também não a esconde", () => {
    expect(resolverPrioridade("open", janela(null))).toBe("atencao");
  });

  it("não cobra nada de vaga encerrada, cancelada ou perdida", () => {
    expect(resolverPrioridade("completedReviewed", janela(-100, 90))).toBe("normal");
    expect(resolverPrioridade("cancelled", janela(1))).toBe("normal");
    expect(resolverPrioridade("lost", janela(-1))).toBe("normal");
  });
});

describe("acaoEstaCritica", () => {
  const comPrazo = (h: number | null): SupportAction => ({
    id: "x",
    label: "x",
    hint: "x",
    criticaAbaixoDeHoras: h,
  });

  it("Infinity = crítica desde que a vaga entra na etapa", () => {
    expect(acaoEstaCritica(comPrazo(Infinity), janela(500))).toBe(true);
  });

  it("null = boa prática, nunca acende o banner", () => {
    expect(acaoEstaCritica(comPrazo(null), janela(-100))).toBe(false);
  });

  it("prazo em horas vira crítica quando o relógio cruza", () => {
    expect(acaoEstaCritica(comPrazo(24), janela(25))).toBe(false);
    expect(acaoEstaCritica(comPrazo(24), janela(24))).toBe(true);
    expect(acaoEstaCritica(comPrazo(24), janela(-3))).toBe(true);
  });

  // Melhor cobrar à toa do que descobrir depois que a vaga sem data era a de
  // hoje à noite.
  it("sem data legível, a ação com prazo conta como crítica", () => {
    expect(acaoEstaCritica(comPrazo(6), janela(null))).toBe(true);
  });
});

describe("acoesDaEtapa", () => {
  it("soma as ações de sempre às da etapa", () => {
    const acoes = acoesDaEtapa("awaitingPayment");
    expect(acoes.slice(0, ACOES_SEMPRE.length)).toEqual(ACOES_SEMPRE);
    expect(acoes.map((a) => a.id)).toContain("cobrar_pagamento");
  });

  // A saudação não pertence a coluna nenhuma: se a vaga andou sem ninguém ter
  // falado com o contratante, o buraco continua aberto na etapa seguinte.
  it("mantém a saudação em todas as etapas ativas", () => {
    for (const bucket of ["open", "awaitingSelection", "awaitingPayment", "confirmed", "inProgress"] as const) {
      expect(acoesDaEtapa(bucket).map((a) => a.id)).toContain("saudacao");
    }
  });

  it("não cobra nada de vaga já avaliada além da saudação", () => {
    expect(ACOES_POR_ETAPA.completedReviewed).toEqual([]);
  });

  it("não repete id de ação dentro de uma etapa", () => {
    for (const bucket of Object.keys(ACOES_POR_ETAPA) as Array<keyof typeof ACOES_POR_ETAPA>) {
      const ids = acoesDaEtapa(bucket).map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("resolverPendencias", () => {
  it("conta o feito e devolve só as críticas que faltam", () => {
    const p = resolverPendencias("open", janela(3), new Set(["saudacao", "divulgar_grupo"]));
    expect(p.feitas).toBe(2);
    expect(p.total).toBe(acoesDaEtapa("open").length);
    expect(p.prioridade).toBe("urgente");
    // Faltando 3h, todas as ações de divulgação já cruzaram o próprio prazo.
    expect(p.criticasPendentes.map((a) => a.id)).toEqual([
      "chamar_base_reputacao",
      "enquete_grupo",
      "divulgar_externo",
      "ligar_freelas",
      "alinhar_contratante_alcance",
    ]);
    expect(p.concluida).toBe(false);
  });

  it("vaga nova e distante só deve o que é crítico desde sempre", () => {
    const p = resolverPendencias("open", janela(120), new Set());
    expect(p.criticasPendentes.map((a) => a.id)).toEqual(["saudacao", "divulgar_grupo"]);
  });

  it("checklist inteiro ticado zera o banner e marca a vaga como concluída", () => {
    const todas = new Set(acoesDaEtapa("confirmed").map((a) => a.id));
    const p = resolverPendencias("confirmed", janela(1), todas);
    expect(p.criticasPendentes).toEqual([]);
    expect(p.concluida).toBe(true);
    expect(p.feitas).toBe(p.total);
  });
});

describe("compararUrgencia", () => {
  it("ordena por prioridade e, no empate, por quem tem menos tempo", () => {
    const itens = [
      { id: "a", prioridade: "atencao" as const, janela: janela(20) },
      { id: "b", prioridade: "critico" as const, janela: janela(1.5) },
      { id: "c", prioridade: "critico" as const, janela: janela(0.5) },
      { id: "d", prioridade: "normal" as const, janela: janela(100) },
    ];
    expect([...itens].sort(compararUrgencia).map((i) => i.id)).toEqual(["c", "b", "a", "d"]);
  });

  it("joga a vaga sem data para o fim do próprio empate", () => {
    const itens = [
      { id: "sem-data", prioridade: "atencao" as const, janela: janela(null) },
      { id: "com-data", prioridade: "atencao" as const, janela: janela(20) },
    ];
    expect([...itens].sort(compararUrgencia).map((i) => i.id)).toEqual(["com-data", "sem-data"]);
  });
});

describe("formatarTempoRestante", () => {
  it("fala como a mesa fala", () => {
    expect(formatarTempoRestante(3.5)).toBe("em 3h30");
    expect(formatarTempoRestante(0.75)).toBe("em 45min");
    expect(formatarTempoRestante(-2)).toBe("há 2h00");
    expect(formatarTempoRestante(72)).toBe("em 3d");
    expect(formatarTempoRestante(null)).toBe("sem data");
  });

  // Zero arredondado para baixo viraria "em 0min", que se lê como "não falta
  // nada" — o mínimo é 1min enquanto o horário não passou.
  it("nunca imprime 'em 0min'", () => {
    expect(formatarTempoRestante(0.004)).toBe("em 1min");
  });
});

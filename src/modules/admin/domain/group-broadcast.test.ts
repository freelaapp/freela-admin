import { describe, expect, it } from "vitest";

import {
  describeRoundOutcome,
  dispatchBadge,
  formatDiaHora,
  formatKm,
  formatQuandoRelativo,
  lastBroadcastAt,
  lastRoundInFlight,
  motivoDoGrupo,
  origemDaDistancia,
  roundHeadline,
  roundShortSummary,
  shouldKeepPolling,
  sortDestinations,
} from "./group-broadcast";
import type {
  GroupBroadcastDestination,
  GroupBroadcastLastRound,
  GroupBroadcastRound,
} from "@/modules/admin/infrastructure/vacancy-group-broadcasts-api";

// 09:12 e 10:40 em Brasília (UTC−3).
const T0912 = "2026-10-14T12:12:00.000Z";
const T1040 = "2026-10-14T13:40:00.000Z";

/** `total` = tentados = ownCity + inRadius + fallback + vip = sent + failedCount + pending. */
function last(over: Partial<GroupBroadcastLastRound> = {}): GroupBroadcastLastRound {
  return {
    roundId: "auto:v1",
    mode: "AUTO",
    at: T0912,
    total: 4,
    sent: 4,
    failedCount: 0,
    failed: [],
    skipped: 0,
    pending: 0,
    ownCity: 1,
    inRadius: 3,
    fallback: 0,
    vip: 0,
    ...over,
  };
}

function dest(over: Partial<GroupBroadcastDestination> = {}): GroupBroadcastDestination {
  return {
    groupJid: "jid",
    groupName: "Vagas Freela Campinas SP",
    city: "Campinas",
    uf: "SP",
    distanceKm: 4.2,
    reason: "VACANCY_CITY",
    status: "SENT",
    errorCode: null,
    error: null,
    sentAt: T1040,
    ...over,
  };
}

function round(destinations: GroupBroadcastDestination[], over: Partial<GroupBroadcastRound> = {}): GroupBroadcastRound {
  return {
    roundId: "r1",
    mode: "MANUAL",
    createdAt: T1040,
    radiusKm: 30,
    centerSource: "VACANCY",
    summary: {
      total: 0, sent: 0, failedCount: 0, failed: [], skipped: 0, pending: 0, ownCity: 0, inRadius: 0, fallback: 0, vip: 0,
    },
    destinations,
    ...over,
  };
}

/** 1 da cidade (enviado) + 3 a até 30 km (2 enviados, 1 falhou) + 1 pulado. */
const RODADA_PARCIAL = round([
  dest({ groupName: "Vagas Freela Vinhedo SP", city: "Vinhedo", distanceKm: 12, reason: "RADIUS", status: "FAILED", sentAt: null, errorCode: "FALHA_NO_ENVIO", error: "O bot não está no grupo." }),
  dest({ groupName: "Vagas Freela Valinhos SP", city: "Valinhos", distanceKm: 9.6, reason: "RADIUS" }),
  dest({ groupName: "Vagas Freela Campinas SP", distanceKm: 4.2 }),
  dest({ groupName: "Vagas Freela Sumaré SP", city: "Sumaré", distanceKm: 21, reason: "RADIUS" }),
  dest({ groupName: "Vagas Freela Jundiaí SP", city: "Jundiaí", distanceKm: 28, reason: "RADIUS", status: "SKIPPED", errorCode: "LIMITE_DE_GRUPOS", error: null }),
]);

describe("dispatchBadge — selo da coluna Disparo (só a última rodada)", () => {
  it("sem registro: ✗ Não divulgada", () => {
    expect(dispatchBadge(undefined)).toMatchObject({
      text: "✗ Não divulgada",
      tone: "red",
      title: "Esta vaga ainda não saiu em nenhum grupo.",
    });
  });

  it("sem registro mas a vaga diz que saiu (groupBroadcastAt): registro antigo", () => {
    expect(dispatchBadge(undefined, T0912)).toMatchObject({ text: "✓ enviado", tone: "gray" });
  });

  it("todos receberam (automático): ✓ 4 grupos · auto 09:12, com a conta no title", () => {
    const selo = dispatchBadge({ lastSentAt: T0912, groupBroadcast: { lastRound: last() } });
    expect(selo).toMatchObject({ text: "✓ 4 grupos · auto", time: "09:12", tone: "green" });
    expect(selo.title).toBe(
      "Última rodada: automática, 14/10 às 09:12. Recebeu em 4 de 4 grupos: 1 da cidade da vaga + 3 a até 30 km.",
    );
  });

  it("reenvio: azul e diz o que houve antes", () => {
    const selo = dispatchBadge({
      autoSentAt: T0912,
      groupBroadcast: { lastRound: last({ mode: "MANUAL", at: T1040 }) },
    });
    expect(selo).toMatchObject({ text: "✓ 4 grupos · reenvio", time: "10:40", tone: "blue" });
    expect(selo.title).toContain("Última rodada: reenvio manual, 14/10 às 10:40.");
    expect(selo.title).toContain("Antes: automática, 14/10 às 09:12.");
  });

  it("parte falhou: ⚠ 3 de 4 grupos · 09:12, com o nome e o motivo de quem não recebeu", () => {
    const selo = dispatchBadge({
      groupBroadcast: {
        lastRound: last({
          sent: 3,
          failedCount: 1,
          failed: [{ groupName: "Vagas Freela Vinhedo SP", errorMessage: "O bot não está no grupo." }],
        }),
      },
    });
    expect(selo).toMatchObject({ text: "⚠ 3 de 4 grupos ·", time: "09:12", tone: "amber" });
    expect(selo.title).toBe(
      "Última rodada: automática, 14/10 às 09:12. Recebeu em 3 de 4 grupos (tentados: 1 da cidade da vaga + 3 a até 30 km). Não recebeu: Vagas Freela Vinhedo SP. Motivo: O bot não está no grupo.",
    );
  });

  it("mais falhas do que os 3 nomes da API: lista os 3 e diz quantos faltam", () => {
    const selo = dispatchBadge({
      groupBroadcast: {
        lastRound: last({
          total: 6,
          sent: 1,
          failedCount: 5,
          inRadius: 5,
          failed: [
            { groupName: "A", errorMessage: "Sem bot" },
            { groupName: "B", errorMessage: null },
            { groupName: "C", errorMessage: "Sem bot." },
          ],
        }),
      },
    });
    expect(selo.title).toContain("Não receberam: A (Sem bot); B; C (Sem bot). E mais 2: veja em Detalhes da vaga.");
  });

  it("todos falharam: ✗ Falhou · 09:12 e o motivo", () => {
    const selo = dispatchBadge({
      lastSentAt: null,
      groupBroadcast: {
        lastRound: last({
          sent: 0,
          failedCount: 4,
          failed: [{ groupName: "Vagas Freela Campinas SP", errorMessage: "WhatsApp desconectado." }],
        }),
      },
    });
    expect(selo).toMatchObject({ text: "✗ Falhou ·", time: "09:12", tone: "red" });
    expect(selo.title).toBe(
      "Tentamos 4 grupos em 14/10 às 09:12 e nenhum recebeu. Motivo: WhatsApp desconectado.",
    );
  });

  it("pulados ficam fora da conta (total já vem sem eles) e o title diz quantos", () => {
    const selo = dispatchBadge({ groupBroadcast: { lastRound: last({ skipped: 2 }) } });
    expect(selo.text).toBe("✓ 4 grupos · auto");
    expect(selo.title).toContain("Recebeu em 4 de 4 grupos");
    expect(selo.title).toContain("2 grupos ficaram de fora (pulados) e não entram na conta.");
  });

  it("grupo de reserva e grupo exclusivo entram na composição", () => {
    const reserva = dispatchBadge({
      groupBroadcast: { lastRound: last({ total: 1, sent: 1, ownCity: 0, inRadius: 0, fallback: 1 }) },
    });
    expect(reserva.title).toContain("Recebeu em 1 de 1 grupo: 1 grupo de reserva.");
    const vip = dispatchBadge({
      groupBroadcast: { lastRound: last({ total: 1, sent: 1, ownCity: 0, inRadius: 0, vip: 1 }) },
    });
    expect(vip.title).toContain("Recebeu em 1 de 1 grupo: 1 exclusivo da empresa.");
  });

  it("ainda na fila (lastSentAt nulo): … enviando 1 de 4 grupos, não '✓ enviado'", () => {
    const r = last({ sent: 1, pending: 3 });
    const selo = dispatchBadge({ lastSentAt: null, groupBroadcast: { lastRound: r } });
    expect(selo).toMatchObject({ text: "… enviando 1 de 4 grupos", tone: "blue", time: null });
    expect(lastRoundInFlight(r)).toBe(true);
    expect(lastRoundInFlight(last())).toBe(false);
  });

  it("composição que não fecha com o total: não afirma a divisão", () => {
    const selo = dispatchBadge({ groupBroadcast: { lastRound: last({ ownCity: 2, inRadius: 5 }) } });
    expect(selo.title).toBe("Última rodada: automática, 14/10 às 09:12. Recebeu em 4 de 4 grupos.");
  });

  it("registro antigo (lastRound nulo): ✓ enviado", () => {
    expect(dispatchBadge({ lastSentAt: T0912, groupBroadcast: { lastRound: null } })).toMatchObject({
      text: "✓ enviado",
      tone: "gray",
      title: "Enviada antes de o painel registrar os grupos. Não sabemos quais grupos receberam.",
    });
  });

  describe("API antiga (sem groupBroadcast): o selo de antes", () => {
    it("automático", () => {
      expect(dispatchBadge({ autoSentAt: T0912 })).toMatchObject({
        text: "✓ automático",
        time: "09:12",
        tone: "green",
      });
    });
    it("manual depois do automático", () => {
      expect(dispatchBadge({ autoSentAt: T0912, manualSentAt: T1040 })).toMatchObject({
        text: "✓ manual",
        time: "10:40",
        tone: "blue",
      });
    });
    it("sem origem", () => {
      expect(dispatchBadge({ lastSentAt: T0912 })).toMatchObject({ text: "✓ enviado", tone: "gray" });
    });
  });
});

describe("rodada no modal", () => {
  it("cabeçalho: recebeu em 3 de 4 (1 da cidade + 2 de 3 a até 30 km); pulado fora", () => {
    expect(roundHeadline(RODADA_PARCIAL)).toBe(
      "Recebeu em 3 de 4 grupos na última rodada (1 da cidade da vaga + 2 de 3 a até 30 km).",
    );
  });

  it("cabeçalho usa o raio DA RODADA", () => {
    expect(roundHeadline({ ...RODADA_PARCIAL, radiusKm: 25 })).toContain("2 de 3 a até 25 km");
  });

  it("cabeçalho enquanto a fila anda", () => {
    const r = round([dest(), dest({ reason: "RADIUS", status: "PENDING", sentAt: null })]);
    expect(roundHeadline(r)).toBe(
      "Enviando: 1 de 2 grupos já receberam (1 da cidade da vaga + 0 de 1 a até 30 km). A mensagem sai em 1 grupo a cada ~3 s.",
    );
  });

  it("resumo da rodada recolhida", () => {
    expect(roundShortSummary(RODADA_PARCIAL)).toBe("3 de 4 grupos receberam");
  });

  it("ordem: cidade da vaga primeiro, depois por distância", () => {
    expect(sortDestinations(RODADA_PARCIAL.destinations).map((d) => d.groupName)).toEqual([
      "Vagas Freela Campinas SP",
      "Vagas Freela Valinhos SP",
      "Vagas Freela Vinhedo SP",
      "Vagas Freela Sumaré SP",
      "Vagas Freela Jundiaí SP",
    ]);
  });

  it("km arredondado para o inteiro mais próximo", () => {
    expect(formatKm(17.6)).toBe("18 km");
    expect(formatKm(0.4)).toBe("menos de 1 km");
    expect(formatKm(null)).toBeNull();
  });

  it("motivo do grupo: o texto da API; sem texto, pelo código", () => {
    expect(motivoDoGrupo({ error: "O bot não está no grupo.", errorCode: "FALHA_NO_ENVIO" })).toBe(
      "O bot não está no grupo.",
    );
    expect(motivoDoGrupo({ error: null, errorCode: "LIMITE_DE_GRUPOS" })).toBe(
      "Passou do limite de grupos por vaga.",
    );
    expect(motivoDoGrupo({ error: null, errorCode: "EXPIRADO" })).toBe("Ficou mais de 2 h na fila e não saiu.");
    expect(motivoDoGrupo({ error: null, errorCode: null })).toBe("Motivo não informado.");
  });

  it("de onde a distância foi medida", () => {
    expect(origemDaDistancia("VACANCY")).toBe("do local da vaga");
    expect(origemDaDistancia("CITY_SEAT", "Gramado", "RS")).toBe(
      "do centro de Gramado-RS (a vaga não tem localização no mapa)",
    );
    expect(origemDaDistancia("CONTRACTOR")).toBe(
      "do endereço da empresa (a vaga não tem localização própria no mapa)",
    );
  });
});

describe("describeRoundOutcome — aviso quando a rodada termina", () => {
  it("todos receberam", () => {
    expect(describeRoundOutcome(round([dest(), dest({ reason: "RADIUS" })]))).toEqual({
      tone: "success",
      message: "Vaga enviada a 2 grupos.",
    });
  });

  it("parte falhou: nome do grupo e motivo", () => {
    expect(describeRoundOutcome(RODADA_PARCIAL)).toEqual({
      tone: "warning",
      message:
        "Vaga enviada a 3 de 4 grupos. Vagas Freela Vinhedo SP não recebeu: O bot não está no grupo. Veja em Detalhes da vaga.",
    });
  });

  it("nenhum recebeu: motivo da API (ou do código)", () => {
    const r = round([
      dest({ status: "FAILED", error: null, errorCode: "WHATSAPP_DESLIGADO", sentAt: null }),
      dest({ status: "FAILED", reason: "RADIUS", errorCode: "WHATSAPP_DESLIGADO", sentAt: null }),
    ]);
    expect(describeRoundOutcome(r)).toEqual({
      tone: "error",
      message:
        "A vaga não saiu em nenhum grupo. A integração com o WhatsApp está desligada. Tente de novo em alguns minutos.",
    });
  });
});

describe("shouldKeepPolling", () => {
  const base = { startedAt: 1_000, now: 2_000, maxMs: 120_000 };

  it("rodada pedida ainda não apareceu: continua", () => {
    expect(shouldKeepPolling({ ...base, rounds: [], watchRoundId: "r1" })).toBe(true);
  });

  it("rodada pedida com grupo na fila: continua", () => {
    const r = round([dest({ status: "PENDING" })]);
    expect(shouldKeepPolling({ ...base, rounds: [r], watchRoundId: "r1" })).toBe(true);
  });

  it("rodada pedida terminou: para", () => {
    expect(shouldKeepPolling({ ...base, rounds: [RODADA_PARCIAL], watchRoundId: "r1" })).toBe(false);
  });

  it("passou do prazo: para", () => {
    expect(
      shouldKeepPolling({ ...base, now: 1_000 + 120_001, rounds: [], watchRoundId: "r1" }),
    ).toBe(false);
  });

  it("sem reenvio: acompanha enquanto a API diz que há grupo na fila", () => {
    const r = round([dest({ status: "SENDING" })]);
    expect(shouldKeepPolling({ ...base, rounds: [r], watchRoundId: null })).toBe(true);
    expect(shouldKeepPolling({ ...base, rounds: [RODADA_PARCIAL], watchRoundId: null })).toBe(false);
    expect(
      shouldKeepPolling({ ...base, rounds: [RODADA_PARCIAL], inFlight: 2, watchRoundId: null }),
    ).toBe(true);
  });
});

describe("datas", () => {
  it("formatDiaHora em Brasília", () => {
    expect(formatDiaHora(T0912)).toBe("14/10 às 09:12");
  });

  it("formatQuandoRelativo", () => {
    expect(formatQuandoRelativo(T0912, new Date("2026-10-14T12:37:00.000Z"))).toBe(
      "hoje às 09:12 (há 25 min)",
    );
    expect(formatQuandoRelativo(T0912, new Date("2026-10-15T15:12:00.000Z"))).toBe(
      "ontem às 09:12 (há 27 h)",
    );
    expect(formatQuandoRelativo("2026-08-11T23:04:00.000Z", new Date("2026-10-14T12:37:00.000Z"))).toBe(
      "11/08 às 20:04 (há 63 dias)",
    );
  });

  it("lastBroadcastAt: o último envio que deu certo (ou o groupBroadcastAt da vaga)", () => {
    const base = { radiusKm: 30, inFlight: 0, canResend: true, resendBlockedReason: null };
    expect(
      lastBroadcastAt({
        ...base,
        groupBroadcastAt: T0912,
        rounds: [
          round([dest({ status: "FAILED", sentAt: null })], { roundId: "r2", createdAt: "2026-10-14T15:00:00.000Z" }),
          RODADA_PARCIAL,
        ],
      }),
    ).toBe(T1040);
    expect(lastBroadcastAt({ ...base, groupBroadcastAt: T0912, rounds: [] })).toBe(T0912);
  });
});

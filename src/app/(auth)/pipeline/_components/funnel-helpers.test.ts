import { describe, expect, it } from "vitest";

import {
  FUNNEL_PRESETS,
  activeFunnelPreset,
  contactStateOf,
  countByContactFilter,
  filterOldSignups,
  filterPipelineCards,
  formatSentAt,
  isContacted,
  locationOptions,
  messageStatusLine,
  messageStatusOf,
  sendConfirmQuestion,
  waLink,
} from "./funnel-helpers";
import type { PipelineCard } from "@/modules/admin/infrastructure/crm-api";

function card(over: Partial<PipelineCard>): PipelineCard {
  return {
    userId: "u1",
    name: "Bar do Zé",
    modules: ["bars-restaurants"],
    state: "SP",
    city: "Jundiaí",
    segment: "Bar",
    whatsappPhone: "5511999990000",
    hiringsCount: 0,
    registeredAt: "2026-07-01T12:00:00.000Z",
    lastMessageSentAt: null,
    messagesSentCount: 0,
    ...over,
  };
}

describe("filterPipelineCards", () => {
  const cards = [
    card({ userId: "u1", name: "Bar do Zé", city: "Jundiaí", segment: "Bar" }),
    card({ userId: "u2", name: "Padaria Trigo", city: "Campinas", segment: "Padaria" }),
  ];

  it("sem termo devolve tudo", () => {
    expect(filterPipelineCards(cards, "  ")).toHaveLength(2);
  });

  it("busca por nome, cidade, ramo e telefone, sem case", () => {
    expect(filterPipelineCards(cards, "PADARIA")).toEqual([cards[1]]);
    expect(filterPipelineCards(cards, "jundiaí")).toEqual([cards[0]]);
    expect(filterPipelineCards(cards, "5511")).toEqual([cards[0], cards[1]]);
  });

  it("ignora campos nulos sem quebrar", () => {
    const semDados = [card({ city: null, state: null, segment: null, whatsappPhone: null })];
    expect(filterPipelineCards(semDados, "campinas")).toHaveLength(0);
  });
});

describe("FUNNEL_PRESETS", () => {
  // Meio-dia local para não esbarrar em borda de fuso do construtor de Date.
  const NOW = new Date(2026, 7, 5, 12, 0, 0); // 05/08/2026

  function range(label: string) {
    return FUNNEL_PRESETS.find((p) => p.label === label)!.compute(NOW);
  }

  it("Hoje e Ontem cobrem um dia só", () => {
    expect(range("Hoje")).toEqual({ from: "2026-08-05", to: "2026-08-05" });
    expect(range("Ontem")).toEqual({ from: "2026-08-04", to: "2026-08-04" });
  });

  it("7 e 30 dias contam o dia atual como último dia", () => {
    expect(range("7 dias")).toEqual({ from: "2026-07-30", to: "2026-08-05" });
    expect(range("30 dias")).toEqual({ from: "2026-07-07", to: "2026-08-05" });
  });

  it("activeFunnelPreset reconhece o atalho e cai em Personalizado fora deles", () => {
    expect(activeFunnelPreset({ from: "2026-08-05", to: "2026-08-05" }, NOW)).toBe("Hoje");
    expect(activeFunnelPreset({ from: "2026-01-01", to: "2026-08-05" }, NOW)).toBeUndefined();
  });
});

describe("waLink", () => {
  it("mantém número já com DDI 55", () => {
    expect(waLink("5511999990000")).toBe("https://wa.me/5511999990000");
  });

  it("adiciona DDI 55 em número local e remove máscara", () => {
    expect(waLink("(11) 99999-0000")).toBe("https://wa.me/5511999990000");
  });
});

describe("formatSentAt", () => {
  const agora = new Date("2026-08-10T18:00:00");

  // O que a equipe precisa saber é se a mensagem saiu HOJE — não o carimbo
  // completo. Data cheia só quando o dia passa a importar mais que a hora.
  it("mostra a hora quando foi hoje", () => {
    expect(formatSentAt("2026-08-10T14:32:00", agora)).toBe("hoje às 14:32");
  });

  it("diz ontem em vez da data", () => {
    expect(formatSentAt("2026-08-09T09:10:00", agora)).toBe("ontem às 09:10");
  });

  it("cai para a data a partir de dois dias", () => {
    expect(formatSentAt("2026-08-03T09:10:00", agora)).toBe("em 03/08");
  });

  // Data inválida não pode quebrar o card inteiro do funil.
  it("não quebra com data inválida", () => {
    expect(formatSentAt("nao-e-data", agora)).toBe("antes");
  });
});

// ─── Situação da mensagem ───────────────────────────────────────────────────

describe("messageStatusOf / isContacted", () => {
  it("API antiga (sem o campo): data de envio é tudo o que se sabe", () => {
    expect(messageStatusOf(card({}))).toBe("NONE");
    expect(messageStatusOf(card({ lastMessageSentAt: "2026-11-10T14:00:00.000Z" }))).toBe("SENT");
  });

  it("só o que saiu conta como contato feito; falha e dúvida não", () => {
    for (const status of ["SENT", "DELIVERED", "READ", "REPLIED"] as const) {
      expect(isContacted(card({ messageStatus: status }))).toBe(true);
    }
    for (const status of ["NONE", "FAILED", "UNCERTAIN"] as const) {
      expect(isContacted(card({ messageStatus: status }))).toBe(false);
    }
  });
});

describe("contactStateOf", () => {
  it("separa quem nunca recebeu nada de quem só recebeu campanha ou por outra conta", () => {
    expect(contactStateOf(card({}))).toBe("NEVER");
    expect(
      contactStateOf(card({ lastCampaign: { name: "Rebeca", sentAt: "2026-10-02T12:00:00.000Z" } })),
    ).toBe("OTHER");
    expect(contactStateOf(card({ samePhoneSentAt: "2026-11-10T14:00:00.000Z" }))).toBe("OTHER");
    expect(contactStateOf(card({ messageStatus: "DELIVERED" }))).toBe("CONTACTED");
    expect(contactStateOf(card({ messageStatus: "FAILED" }))).toBe("PROBLEM");
    expect(contactStateOf(card({ messageStatus: "UNCERTAIN" }))).toBe("PROBLEM");
  });
});

describe("messageStatusLine", () => {
  const agora = new Date(2026, 10, 16, 15, 0);
  const hoje = new Date(2026, 10, 16, 9, 30).toISOString();

  it("sem mensagem não escreve nada", () => {
    expect(messageStatusLine(card({}), agora)).toBeNull();
  });

  it("diz a etapa mais avançada, com quando e quantas vezes", () => {
    expect(
      messageStatusLine(card({ messageStatus: "SENT", lastMessageSentAt: hoje }), agora),
    ).toBe("Enviada hoje às 09:30");
    expect(
      messageStatusLine(
        card({ messageStatus: "READ", messageReadAt: hoje, messagesSentCount: 2 }),
        agora,
      ),
    ).toBe("Lida hoje às 09:30 · 2x");
    expect(
      messageStatusLine(card({ messageStatus: "REPLIED", messageRepliedAt: hoje }), agora),
    ).toBe("Respondeu hoje às 09:30");
  });

  it("falha traz o motivo; dúvida avisa para conferir antes de reenviar", () => {
    expect(
      messageStatusLine(
        card({ messageStatus: "FAILED", messageFailureReason: "Número não está no WhatsApp." }),
        agora,
      ),
    ).toBe("Não chegou: Número não está no WhatsApp.");
    expect(messageStatusLine(card({ messageStatus: "UNCERTAIN" }), agora)).toContain(
      "pode ter sido enviada",
    );
  });
});

describe("sendConfirmQuestion", () => {
  const now = new Date(2026, 10, 16, 15, 0);
  const ontem = new Date(2026, 10, 15, 10, 0).toISOString();

  it("primeiro envio: pergunta simples, com o modelo quando sai pela Meta", () => {
    expect(sendConfirmQuestion(card({}), { now })).toBe(
      "Enviar a mensagem automática de WhatsApp para Bar do Zé?",
    );
    expect(sendConfirmQuestion(card({}), { now, templateName: "Boas-vindas" })).toBe(
      'Enviar a mensagem automática de WhatsApp para Bar do Zé? Sai pelo WhatsApp oficial, com o modelo "Boas-vindas".',
    );
  });

  it("quem já recebeu: avisa quando e quantas vezes", () => {
    expect(
      sendConfirmQuestion(
        card({ messageStatus: "READ", lastMessageSentAt: ontem, messagesSentCount: 2 }),
        { now },
      ),
    ).toBe("Bar do Zé já recebeu a mensagem ontem às 10:00 (2 envios). Enviar de novo?");
  });

  it("dúvida da Meta: diz que pode ter chegado", () => {
    expect(sendConfirmQuestion(card({ messageStatus: "UNCERTAIN" }), { now })).toContain(
      "PODE ter chegado",
    );
  });

  it("mesmo telefone em outra conta e campanha recebida também pedem confirmação própria", () => {
    expect(sendConfirmQuestion(card({ samePhoneSentAt: ontem }), { now })).toContain(
      "MESMO telefone de Bar do Zé já recebeu esta mensagem ontem às 10:00",
    );
    expect(
      sendConfirmQuestion(card({ lastCampaign: { name: "Rebeca", sentAt: ontem } }), { now }),
    ).toContain('recebeu a campanha "Rebeca" ontem às 10:00');
  });
});

// ─── Cadastros antigos ──────────────────────────────────────────────────────

describe("filtros dos cadastros antigos", () => {
  const cards = [
    card({ userId: "u1", name: "Bar do Zé", state: "SP", city: "Jundiaí" }),
    card({ userId: "u2", name: "Padaria Trigo", state: "SP", city: "Campinas", messageStatus: "REPLIED" }),
    card({ userId: "u3", name: "Bistrô Rio", state: "RJ", city: "Niterói", messageStatus: "FAILED" }),
    card({
      userId: "u4",
      name: "Cantina Sul",
      state: "SP",
      city: "Campinas",
      lastCampaign: { name: "Rebeca", sentAt: "2026-10-02T12:00:00.000Z" },
    }),
  ];
  const semFiltro = { q: "", state: "", city: "", contact: "ALL" as const };

  it("estado, cidade, busca e situação se combinam", () => {
    expect(filterOldSignups(cards, semFiltro)).toHaveLength(4);
    expect(filterOldSignups(cards, { ...semFiltro, state: "SP" }).map((c) => c.userId)).toEqual([
      "u1",
      "u2",
      "u4",
    ]);
    expect(
      filterOldSignups(cards, { ...semFiltro, state: "SP", city: "Campinas", contact: "OTHER" }).map(
        (c) => c.userId,
      ),
    ).toEqual(["u4"]);
    expect(filterOldSignups(cards, { ...semFiltro, contact: "NEVER" }).map((c) => c.userId)).toEqual([
      "u1",
    ]);
    expect(filterOldSignups(cards, { ...semFiltro, q: "bistrô" }).map((c) => c.userId)).toEqual(["u3"]);
  });

  it("as contagens das opções de situação seguem estado, cidade e busca — não a situação escolhida", () => {
    expect(countByContactFilter(cards, { ...semFiltro, state: "SP", contact: "NEVER" })).toEqual({
      ALL: 3,
      NEVER: 1,
      OTHER: 1,
      CONTACTED: 1,
      // "Respondeu" é uma fatia de "Mensagem enviada".
      REPLIED: 1,
      PROBLEM: 0,
    });
  });

  it("opções de estado e cidade vêm da própria lista; cidade segue o estado escolhido", () => {
    expect(locationOptions(cards, "")).toEqual({
      states: ["RJ", "SP"],
      cities: ["Campinas", "Jundiaí", "Niterói"],
    });
    expect(locationOptions(cards, "RJ").cities).toEqual(["Niterói"]);
  });
});

describe("campanha de sistema do Pipeline na tela de Campanhas", () => {
  it("tem nome próprio em vez do código cru do público", async () => {
    const { audienceLabel, PIPELINE_AUDIENCE } = await import(
      "../../campanhas/_lib/campaign-wizard"
    );
    expect(PIPELINE_AUDIENCE).toBe("CRM_PIPELINE");
    expect(audienceLabel("CRM_PIPELINE")).toBe("Pipeline (mensagens enviadas uma a uma)");
    // Os públicos de sempre não mudam.
    expect(audienceLabel("CONTRACTORS_ALL")).toBe("Todos os contratantes");
  });
});

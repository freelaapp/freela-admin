import { describe, expect, it } from "vitest";
import type { CampaignTemplate } from "@/modules/admin/infrastructure/campaign-templates-api";
import type { Campaign } from "@/modules/admin/infrastructure/referrals-api";
import {
  AUDIENCE_LABELS,
  audienceOptionsFor,
  audienceSummary,
  automaticSummary,
  buildScheduleBody,
  isValidEmail,
  validateSchedule,
  brasiliaLocalInput,
  buildAutomaticPayload,
  buildCreatePayload,
  buildUpdatePayload,
  changeAudience,
  daysLabel,
  defaultScheduleAt,
  dispatchBlocker,
  estimateRunDays,
  formatBrl,
  formatPrice,
  initialWizardState,
  pacingLabel,
  scheduleIsoFromLocal,
  scheduleLabel,
  selectionFromPicker,
  stateFromAutomatic,
  stateFromCampaign,
  stepBlockers,
  type ExternalPickerState,
  type WizardState,
} from "./campaign-wizard";

// 01/10/2026 09h00 em Brasília.
const NOW = new Date("2026-10-01T12:00:00.000Z");
const ADMIN = "rebeca@freelaservicos.com.br";

const PICKER: ExternalPickerState = {
  sheet: {
    fileName: "lista.xlsx",
    sheetName: "Contatos",
    headers: ["Nome", "Telefone"],
    rows: [
      ["Ana", "11999990001"],
      ["Bia", "11999990002"],
      ["Cid", "11999990003"],
    ],
  },
  mapping: { name: 0, phone: 1, email: null },
  preview: {
    valid: 3,
    invalid: [],
    duplicates: 0,
    alreadyRegistered: 1,
    alreadyRegisteredRows: [{ row: 2, userId: "u2", role: "contractor" }],
    byChannel: { whatsapp: 3, email: 0 },
    excludedByOptOut: 1,
  },
  skipRegistered: true,
};

const avulsa = (): WizardState =>
  initialWizardState("avulsa", { adminEmail: ADMIN, now: NOW });
const automatica = (): WizardState =>
  initialWizardState("automatica", { adminEmail: ADMIN, now: NOW });

describe("estado inicial e público", () => {
  it("avulsa: todos os contratantes, WhatsApp, ritmo da base e e-mail do admin nas respostas", () => {
    const s = avulsa();
    expect(s.audience).toBe("CONTRACTORS_ALL");
    expect(s.channels).toEqual(["WHATSAPP"]);
    expect(s.replyAlertEmail).toBe(ADMIN);
    expect([
      s.messagesPerHour,
      s.dailyCap,
      s.windowStartHour,
      s.windowEndHour,
      s.weekdaysOnly,
    ]).toEqual([60, 200, 9, 18, true]);
    expect(s.when).toBe("now");
    expect(s.scheduleAt).toBe("2026-10-02T10:00");
  });

  it("automática: sem canal até escolher; com 'Usar' já vem com WhatsApp e o modelo", () => {
    expect(automatica().channels).toEqual([]);
    const s = initialWizardState("automatica", {
      marketingTemplateId: "tpl-1",
      now: NOW,
    });
    expect(s.channels).toEqual(["WHATSAPP"]);
    expect(s.marketingTemplateId).toBe("tpl-1");
  });

  it("planilha só existe na avulsa", () => {
    expect(audienceOptionsFor("avulsa")).toContain("EXTERNAL_LIST");
    expect(audienceOptionsFor("automatica")).not.toContain("EXTERNAL_LIST");
    expect(
      initialWizardState("automatica", { audience: "EXTERNAL_LIST", now: NOW })
        .audience,
    ).toBe("CONTRACTORS_ALL");
    expect(AUDIENCE_LABELS.EXTERNAL_LIST).toBe(
      "Planilha (pessoas que aceitaram receber)",
    );
    expect(AUDIENCE_LABELS.CONTRACTORS_ALL).toBe("Todos os contratantes");
  });

  it("trocar para planilha usa o ritmo de planilha e limpa filtros, contagem e aceite", () => {
    const base: WizardState = {
      ...avulsa(),
      cities: ["Campinas"],
      modules: ["home-services"],
      count: {
        total: 1,
        whatsapp: 1,
        email: 0,
        excludedByOptOut: 0,
        semCoordenada: 0,
      },
      optInConfirmed: true,
    };
    const sheet = changeAudience(base, "EXTERNAL_LIST");
    expect([sheet.messagesPerHour, sheet.dailyCap]).toEqual([20, 100]);
    expect(sheet.cities).toEqual([]);
    expect(sheet.count).toBeNull();
    expect(sheet.optInConfirmed).toBe(false);

    const back = changeAudience(sheet, "PROVIDERS_NEVER_APPLIED");
    expect([back.messagesPerHour, back.dailyCap]).toEqual([60, 200]);
    expect(back.modules).toEqual([]);
  });

  it("planilha conferida: quem entra, por canal e quem já saiu", () => {
    expect(selectionFromPicker(PICKER)).toEqual({
      contacts: [
        { name: "Ana", phone: "+5511999990001" },
        { name: "Bia", phone: "+5511999990002" },
        { name: "Cid", phone: "+5511999990003" },
      ],
      listFileName: "lista.xlsx",
      skipRegistered: true,
      willSend: 2,
      whatsapp: 3,
      email: 0,
      excludedByOptOut: 1,
    });
    expect(
      selectionFromPicker({ ...PICKER, skipRegistered: false })?.willSend,
    ).toBe(3);
    expect(selectionFromPicker({ ...PICKER, preview: null })).toBeNull();
  });

  it("resumo do público em uma linha", () => {
    expect(audienceSummary(avulsa())).toBe(
      "Todos os contratantes · Empresas + Casa · todas as cidades",
    );
    expect(
      audienceSummary({
        ...avulsa(),
        modules: ["home-services"],
        ufs: ["SP"],
        cities: ["Campinas"],
      }),
    ).toBe(
      "Todos os contratantes · Em casa (serviços domésticos) · SP · Campinas",
    );
    expect(
      audienceSummary({
        ...avulsa(),
        audience: "PROVIDERS_NEVER_APPLIED",
        radiusCity: "Jundiaí",
        radiusKm: 100,
      }),
    ).toBe("Freelancers que nunca se candidataram · Jundiaí e 100 km em volta");
    expect(
      audienceSummary({
        ...changeAudience(avulsa(), "EXTERNAL_LIST"),
        picker: PICKER,
      }),
    ).toBe("Planilha · lista.xlsx");
  });
});

describe("corpos da API", () => {
  it("avulsa da base: modelo, resposta, ritmo e recorte; sem DevZapp", () => {
    const s: WizardState = {
      ...avulsa(),
      name: "  Apresentação Freela — Rebeca ",
      marketingTemplateId: "tpl-1",
      replyText: " Obrigado! ",
      cities: ["Campinas"],
      ufs: ["SP"],
      modules: ["bars-restaurants"],
    };
    expect(buildCreatePayload(s)).toEqual({
      name: "Apresentação Freela — Rebeca",
      audience: "CONTRACTORS_ALL",
      audienceFilters: {
        cities: ["Campinas"],
        ufs: ["SP"],
        modules: ["bars-restaurants"],
      },
      marketingTemplateId: "tpl-1",
      replyText: "Obrigado!",
      replyAlertEmail: ADMIN,
      messagesPerHour: 60,
      dailyCap: 200,
      windowStartHour: 9,
      windowEndHour: 18,
      weekdaysOnly: true,
    });
  });

  it("raio substitui cidades e UF; resposta e e-mail vazios viram null", () => {
    const s: WizardState = {
      ...avulsa(),
      name: "Campanha",
      marketingTemplateId: "tpl-1",
      cities: ["Campinas"],
      ufs: ["SP"],
      radiusCity: "Jundiaí",
      radiusKm: 100,
      replyAlertEmail: " ",
    };
    const payload = buildCreatePayload(s);
    expect(payload.audienceFilters).toEqual({
      radius: { city: "Jundiaí", km: 100 },
    });
    expect(payload.replyText).toBeNull();
    expect(payload.replyAlertEmail).toBeNull();
  });

  it("planilha: contatos, arquivo, pular cadastrados, o aceite e o ritmo de planilha", () => {
    const s: WizardState = {
      ...changeAudience(avulsa(), "EXTERNAL_LIST"),
      name: "Lista feira",
      marketingTemplateId: "tpl-1",
      picker: PICKER,
      optInConfirmed: true,
    };
    expect(buildCreatePayload(s)).toEqual({
      name: "Lista feira",
      audience: "EXTERNAL_LIST",
      contacts: [
        { name: "Ana", phone: "+5511999990001" },
        { name: "Bia", phone: "+5511999990002" },
        { name: "Cid", phone: "+5511999990003" },
      ],
      listFileName: "lista.xlsx",
      skipRegistered: true,
      optInConfirmed: true,
      marketingTemplateId: "tpl-1",
      replyText: null,
      replyAlertEmail: ADMIN,
      messagesPerHour: 20,
      dailyCap: 100,
      windowStartHour: 9,
      windowEndHour: 18,
      weekdaysOnly: true,
    });
  });

  it("rascunho: edição manda nome, modelo, resposta (vazia limpa) e ritmo", () => {
    const s: WizardState = {
      ...avulsa(),
      name: " Apresentação ",
      marketingTemplateId: "tpl-2",
      replyAlertEmail: "",
    };
    expect(buildUpdatePayload(s)).toEqual({
      name: "Apresentação",
      marketingTemplateId: "tpl-2",
      replyText: null,
      replyAlertEmail: null,
      messagesPerHour: 60,
      dailyCap: 200,
      windowStartHour: 9,
      windowEndHour: 18,
      weekdaysOnly: true,
    });
  });

  it("automática semanal: WhatsApp com modelo e resposta; push só com PUSH; sem DevZapp nem texto livre", () => {
    const s: WizardState = {
      ...initialWizardState("automatica", {
        adminEmail: ADMIN,
        marketingTemplateId: "mkt-1",
        now: NOW,
      }),
      name: " Sextou ",
      weekdays: [5],
      sendHour: 10,
      cities: ["Jundiaí"],
      maxPerRun: 500,
    };
    expect(buildAutomaticPayload(s)).toEqual({
      name: "Sextou",
      scheduleKind: "WEEKLY",
      weekdays: [5],
      sendHour: 10,
      audience: "CONTRACTORS_ALL",
      audienceFilters: { cities: ["Jundiaí"] },
      channels: ["WHATSAPP"],
      marketingTemplateId: "mkt-1",
      replyText: null,
      replyAlertEmail: ADMIN,
      maxPerRun: 500,
    });

    const both = buildAutomaticPayload({
      ...s,
      channels: ["WHATSAPP", "PUSH"],
      pushTitle: " Sextou! ",
      pushBody: " Bora? ",
      imageKey: "freela/images/campaigns/x.png",
      deepLink: " contractor/vagas/nova ",
    });
    expect(both).toMatchObject({
      pushTitle: "Sextou!",
      pushBody: "Bora?",
      imageKey: "freela/images/campaigns/x.png",
      deepLink: "contractor/vagas/nova",
    });
    expect(both).not.toHaveProperty("devzappFunnelUrl");
    expect(both).not.toHaveProperty("whatsappTemplate");

    const pushOnly = buildAutomaticPayload({
      ...s,
      channels: ["PUSH"],
      pushTitle: "a",
      pushBody: "b",
    });
    expect(pushOnly).not.toHaveProperty("marketingTemplateId");
    expect(pushOnly).not.toHaveProperty("replyText");
  });

  it("automática por data: ano só sem 'repetir todo ano'; raio nunca vai (a API não aceita)", () => {
    const s: WizardState = {
      ...automatica(),
      name: "Dia das mães",
      scheduleKind: "DATED",
      targetMonth: 5,
      targetDay: 10,
      leadDays: 3,
      repeatsAnnually: true,
      targetYear: 2027,
      channels: ["PUSH"],
      pushTitle: "a",
      pushBody: "b",
      radiusCity: "Campinas",
      radiusKm: 30,
    };
    const payload = buildAutomaticPayload(s);
    expect(payload).toMatchObject({
      scheduleKind: "DATED",
      targetMonth: 5,
      targetDay: 10,
      leadDays: 3,
    });
    expect(payload.targetYear).toBeUndefined();
    expect(payload).not.toHaveProperty("weekdays");
    expect(payload.audienceFilters).toBeUndefined();
    expect(
      buildAutomaticPayload({ ...s, repeatsAnnually: false }).targetYear,
    ).toBe(2027);
  });

  it("de volta para o formulário: automática salva e avulsa em rascunho", () => {
    const tpl: CampaignTemplate = {
      id: "t1",
      name: "Sextou",
      scheduleKind: "WEEKLY",
      weekdays: [5],
      sendHour: 10,
      audience: "CONTRACTORS_ACTIVE",
      audienceFilters: { ufs: ["SP"], modules: ["bars-restaurants"] },
      channels: ["WHATSAPP", "PUSH"],
      marketingTemplateId: "mkt-1",
      replyText: "Valeu!",
      replyAlertEmail: null,
      pushTitle: "Sextou!",
      pushBody: "Bora?",
      enabled: false,
      lastRunFor: null,
      lastRunAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    const s = stateFromAutomatic(tpl, ADMIN, NOW);
    expect(s).toMatchObject({
      name: "Sextou",
      audience: "CONTRACTORS_ACTIVE",
      ufs: ["SP"],
      modules: ["bars-restaurants"],
      channels: ["WHATSAPP", "PUSH"],
      marketingTemplateId: "mkt-1",
      replyText: "Valeu!",
      replyAlertEmail: ADMIN,
      weekdays: [5],
      sendHour: 10,
      repeatsAnnually: true,
    });
    expect(buildAutomaticPayload(s)).toMatchObject({
      audience: "CONTRACTORS_ACTIVE",
      audienceFilters: { ufs: ["SP"], modules: ["bars-restaurants"] },
      marketingTemplateId: "mkt-1",
    });

    const campaign = {
      id: "camp-1",
      name: "Apresentação",
      status: "DRAFT",
      audience: "CONTRACTORS_ALL",
      audienceNote: null,
      messagesPerHour: 30,
      dailyCap: 150,
      windowStartHour: 10,
      windowEndHour: 17,
      weekdaysOnly: false,
      nextSendAt: null,
      createdAt: "2026-10-01T12:00:00.000Z",
      startedAt: null,
      completedAt: null,
      marketingTemplateId: "tpl-1",
      replyText: null,
      replyAlertEmail: "comercial@freelaservicos.com.br",
    } as Campaign;
    expect(stateFromCampaign(campaign, ADMIN, NOW)).toMatchObject({
      name: "Apresentação",
      audience: "CONTRACTORS_ALL",
      marketingTemplateId: "tpl-1",
      replyText: "",
      replyAlertEmail: "comercial@freelaservicos.com.br",
      messagesPerHour: 30,
      dailyCap: 150,
      windowStartHour: 10,
      windowEndHour: 17,
      weekdaysOnly: false,
    });
  });
});

describe("o que impede de seguir", () => {
  it("passo 1: nome; planilha exige lista conferida e a caixa de aceite", () => {
    expect(stepBlockers(avulsa(), 1, "avulsa", NOW)).toEqual([
      "Dê um nome à campanha.",
    ]);
    const sheet = changeAudience(
      { ...avulsa(), name: "Lista" },
      "EXTERNAL_LIST",
    );
    expect(stepBlockers(sheet, 1, "avulsa", NOW)).toEqual([
      "Suba a planilha e confira a lista.",
      "Confirme que essas pessoas aceitaram receber mensagens da Freela.",
    ]);
    expect(
      stepBlockers({ ...sheet, picker: PICKER }, 1, "avulsa", NOW),
    ).toEqual([
      "Confirme que essas pessoas aceitaram receber mensagens da Freela.",
    ]);
    expect(
      stepBlockers(
        { ...sheet, picker: PICKER, optInConfirmed: true },
        1,
        "avulsa",
        NOW,
      ),
    ).toEqual([]);
    expect(
      stepBlockers(
        { ...avulsa(), name: "Campanha", radiusCity: "Jundiaí", radiusKm: 0 },
        1,
        "avulsa",
        NOW,
      ),
    ).toEqual(["O raio vai de 1 a 2000 km."]);
  });

  it("passo 2: modelo escolhido, resposta até 500 e e-mail válido; push na automática", () => {
    const s: WizardState = { ...avulsa(), name: "Campanha" };
    expect(stepBlockers(s, 2, "avulsa", NOW)).toEqual([
      "Escolha um modelo aprovado ou escreva uma mensagem nova.",
    ]);
    const ok: WizardState = { ...s, marketingTemplateId: "tpl-1" };
    expect(stepBlockers(ok, 2, "avulsa", NOW)).toEqual([]);
    expect(
      stepBlockers(
        { ...ok, replyText: "a".repeat(501), replyAlertEmail: "rebeca@" },
        2,
        "avulsa",
        NOW,
      ),
    ).toEqual([
      "A resposta automática pode ter até 500 caracteres.",
      "O e-mail que recebe as respostas está inválido.",
    ]);

    const auto = automatica();
    expect(stepBlockers(auto, 2, "automatica", NOW)).toEqual([
      "Escolha pelo menos um canal.",
    ]);
    expect(
      stepBlockers({ ...auto, channels: ["PUSH"] }, 2, "automatica", NOW),
    ).toEqual(["Informe o título do push.", "Informe o corpo do push."]);
    expect(
      stepBlockers(
        {
          ...auto,
          channels: ["PUSH"],
          pushTitle: "Sextou!",
          pushBody: "Bora?",
        },
        2,
        "automatica",
        NOW,
      ),
    ).toEqual([]);
  });

  it("passo 3 avulsa: 23h30 de Brasília e 60 dias exatos passam; passado e 60 dias + 1 min não", () => {
    const s: WizardState = { ...avulsa(), when: "schedule" };
    const at = (scheduleAt: string) =>
      stepBlockers({ ...s, scheduleAt }, 3, "avulsa", NOW);
    expect(at("2026-10-01T23:30")).toEqual([]);
    expect(at("2026-11-30T09:00")).toEqual([]);
    expect(at("2026-11-30T09:01")).toEqual([
      "Dá para agendar até 60 dias à frente.",
    ]);
    expect(at("2026-10-01T08:59")).toEqual(["Escolha um horário no futuro."]);
    expect(at("")).toEqual(["Escolha a data e a hora do disparo."]);

    const now: WizardState = { ...s, when: "now" };
    expect(
      stepBlockers(
        { ...now, windowStartHour: 18, windowEndHour: 9 },
        3,
        "avulsa",
        NOW,
      ),
    ).toEqual(["A janela precisa começar antes de terminar."]);
    expect(
      stepBlockers(
        { ...now, messagesPerHour: 61, dailyCap: 0 },
        3,
        "avulsa",
        NOW,
      ),
    ).toEqual(["Mensagens por hora: de 1 a 60.", "Teto por dia: de 1 a 1000."]);
  });

  it("passo 3 automática: dias da semana ou data", () => {
    const auto = automatica();
    expect(stepBlockers(auto, 3, "automatica", NOW)).toEqual([
      "Escolha pelo menos um dia da semana.",
    ]);
    expect(
      stepBlockers({ ...auto, weekdays: [5] }, 3, "automatica", NOW),
    ).toEqual([]);
    expect(
      stepBlockers(
        { ...auto, scheduleKind: "DATED", repeatsAnnually: false },
        3,
        "automatica",
        NOW,
      ),
    ).toEqual([
      "Informe o mês.",
      "Informe o dia.",
      'Informe o ano (ou marque "repetir todo ano").',
    ]);
  });

  it("disparar, agendar e ligar só com modelo APROVADO", () => {
    expect(dispatchBlocker("avulsa", ["WHATSAPP"], "PENDING")).toBe(
      "O modelo ainda não foi aprovado pela Meta (situação: em análise). A campanha fica salva como rascunho; volte aqui para disparar depois da aprovação.",
    );
    expect(dispatchBlocker("avulsa", ["WHATSAPP"], "APPROVED")).toBeNull();
    expect(dispatchBlocker("automatica", ["WHATSAPP", "PUSH"], "PAUSED")).toBe(
      "O modelo ainda não foi aprovado pela Meta (situação: pausado pela Meta). Salve desligada e ligue depois da aprovação.",
    );
    expect(dispatchBlocker("automatica", ["PUSH"], null)).toBeNull();
    expect(dispatchBlocker("avulsa", ["WHATSAPP"], null)).toContain(
      "situação: não encontrado",
    );
  });
});

describe("horário de Brasília e resumo", () => {
  it("relógio de Brasília no campo e ISO com fuso para a API", () => {
    expect(brasiliaLocalInput(new Date("2026-10-02T02:30:00Z"))).toBe(
      "2026-10-01T23:30",
    );
    expect(scheduleIsoFromLocal("2026-10-01T23:30")).toBe(
      "2026-10-01T23:30:00-03:00",
    );
    expect(
      new Date(scheduleIsoFromLocal("2026-10-01T23:30")).toISOString(),
    ).toBe("2026-10-02T02:30:00.000Z");
    expect(scheduleLabel("2026-10-02T10:00")).toBe("sex 02/10 às 10h");
    expect(scheduleLabel("2026-10-01T23:30")).toBe("qui 01/10 às 23h30");
    expect(defaultScheduleAt(NOW)).toBe("2026-10-02T10:00");
  });

  it("prazo, custo e textos do resumo", () => {
    const pacing = {
      messagesPerHour: 60,
      dailyCap: 200,
      windowStartHour: 9,
      windowEndHour: 18,
      weekdaysOnly: true,
    };
    expect(estimateRunDays(418, pacing)).toBe(3);
    expect(estimateRunDays(0, pacing)).toBe(0);
    expect(
      estimateRunDays(100, {
        ...pacing,
        messagesPerHour: 10,
        windowStartHour: 9,
        windowEndHour: 12,
      }),
    ).toBe(4);
    expect(formatBrl(146.3)).toBe("R$ 146");
    expect(formatBrl(1234.5)).toBe("R$ 1.235");
    expect(formatPrice(0.35)).toBe("R$ 0,35");
    expect(daysLabel(3, true)).toBe("~3 dias úteis");
    expect(daysLabel(1, true)).toBe("~1 dia útil");
    expect(daysLabel(3, false)).toBe("~3 dias");
    expect(daysLabel(1, false)).toBe("~1 dia");
    expect(pacingLabel(pacing)).toBe(
      "ritmo 60/hora · até 200/dia · das 9h às 18h · dias úteis",
    );
    expect(pacingLabel({ ...pacing, weekdaysOnly: false })).toBe(
      "ritmo 60/hora · até 200/dia · das 9h às 18h · todos os dias",
    );
  });
});

describe("decisões da revisão", () => {
  it("F3: nome de 3 a 120 caracteres trava o passo 1", () => {
    const msg = ["O nome precisa ter de 3 a 120 caracteres."];
    expect(stepBlockers({ ...avulsa(), name: "ab" }, 1, "avulsa", NOW)).toEqual(
      msg,
    );
    expect(
      stepBlockers({ ...avulsa(), name: "abc" }, 1, "avulsa", NOW),
    ).toEqual([]);
    expect(
      stepBlockers({ ...avulsa(), name: "a".repeat(120) }, 1, "avulsa", NOW),
    ).toEqual([]);
    expect(
      stepBlockers({ ...avulsa(), name: "a".repeat(121) }, 1, "avulsa", NOW),
    ).toEqual(msg);
    expect(
      stepBlockers({ ...automatica(), name: "  ab " }, 1, "automatica", NOW),
    ).toEqual(msg);
  });

  it("F10: e-mail como na API (TLD de 2+ letras)", () => {
    expect(isValidEmail("a@b.c")).toBe(false);
    expect(isValidEmail("rebeca@")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
    expect(isValidEmail("rebeca@freelaservicos.com.br")).toBe(true);
    expect(isValidEmail("a@b.co")).toBe(true);
    const s: WizardState = {
      ...avulsa(),
      marketingTemplateId: "t",
      replyAlertEmail: "a@b.c",
    };
    expect(stepBlockers(s, 2, "avulsa", NOW)).toEqual([
      "O e-mail que recebe as respostas está inválido.",
    ]);
  });

  it("F5: resumo da automática desconta quem saiu por opt-out", () => {
    const s: WizardState = {
      ...automatica(),
      channels: ["WHATSAPP"],
      count: {
        total: 500,
        whatsapp: 418,
        email: 0,
        excludedByOptOut: 18,
        semCoordenada: 0,
      },
    };
    expect(automaticSummary(s)).toEqual({
      whatsappToSend: 400,
      excludedByOptOut: 18,
      costBrl: 140,
      days: 2,
    });
    expect(automaticSummary({ ...s, maxPerRun: 100 })?.whatsappToSend).toBe(
      100,
    );
    expect(automaticSummary({ ...s, channels: ["PUSH"] })?.costBrl).toBe(0);
    expect(automaticSummary({ ...s, count: null })).toBeNull();
    expect(
      automaticSummary({
        ...s,
        count: { ...s.count!, whatsapp: 5, excludedByOptOut: 9 },
      })?.whatsappToSend,
    ).toBe(0);
  });

  it("F8: modelo arquivado ou ausente ao reabrir limpa a escolha e avisa", () => {
    const base = {
      id: "camp-1",
      name: "Apresentação",
      status: "DRAFT",
      audience: "CONTRACTORS_ALL",
      audienceNote: null,
      messagesPerHour: 60,
      dailyCap: 200,
      windowStartHour: 9,
      windowEndHour: 18,
      weekdaysOnly: true,
      nextSendAt: null,
      createdAt: "2026-10-01T12:00:00.000Z",
      startedAt: null,
      completedAt: null,
      marketingTemplateId: "tpl-1",
    } as Campaign;
    const archived = stateFromCampaign(
      {
        ...base,
        marketingTemplate: {
          id: "tpl-1",
          name: "m",
          status: "ARCHIVED",
          metaName: "mkt_m_v1",
        },
      },
      ADMIN,
      NOW,
    );
    expect(archived.marketingTemplateId).toBeNull();
    expect(archived.modelNotice).toContain("arquivado");
    expect(stepBlockers(archived, 2, "avulsa", NOW)).toHaveLength(1);

    const missing = stateFromCampaign(
      { ...base, marketingTemplate: null },
      ADMIN,
      NOW,
    );
    expect(missing.marketingTemplateId).toBeNull();
    expect(missing.modelNotice).toContain("não foi encontrado");

    const fine = stateFromCampaign(
      {
        ...base,
        marketingTemplate: {
          id: "tpl-1",
          name: "m",
          status: "APPROVED",
          metaName: "mkt_m_v1",
        },
      },
      ADMIN,
      NOW,
    );
    expect(fine.marketingTemplateId).toBe("tpl-1");
    expect(fine.modelNotice).toBeNull();
    // Sem a relação na resposta não dá para saber: mantém.
    expect(stateFromCampaign(base, ADMIN, NOW).marketingTemplateId).toBe(
      "tpl-1",
    );

    const tpl = {
      id: "t1",
      name: "Sextou",
      scheduleKind: "WEEKLY",
      audience: "CONTRACTORS_ALL",
      channels: ["WHATSAPP"],
      marketingTemplateId: "mkt-1",
      marketingTemplate: {
        id: "mkt-1",
        name: "m",
        status: "ARCHIVED",
        metaName: "mkt_m_v1",
      },
      enabled: false,
      lastRunFor: null,
      lastRunAt: null,
      createdAt: "2026-09-01T00:00:00.000Z",
    } as CampaignTemplate;
    const auto = stateFromAutomatic(tpl, ADMIN, NOW);
    expect(auto.marketingTemplateId).toBeNull();
    expect(auto.modelNotice).toContain("arquivado");
  });

  it("agendamento: startAt sempre com -03:00, nos limites do dia e do mês", () => {
    expect(buildScheduleBody({ scheduleAt: "2026-10-01T23:30" })).toEqual({
      startAt: "2026-10-01T23:30:00-03:00",
    });
    expect(
      buildScheduleBody({ scheduleAt: "2026-12-31T00:00" }).startAt,
    ).toMatch(/-03:00$/);
    expect(validateSchedule("2026-02-31T10:00", NOW)).toBe(
      "Escolha a data e a hora do disparo.",
    );
    // virada de mês no padrão sugerido
    expect(defaultScheduleAt(new Date("2026-10-31T12:00:00.000Z"))).toBe(
      "2026-11-01T10:00",
    );
    // 23h30 de Brasília já é o dia seguinte em UTC: o padrão segue o dia de Brasília
    expect(defaultScheduleAt(new Date("2026-10-02T02:30:00.000Z"))).toBe(
      "2026-10-02T10:00",
    );
  });
});

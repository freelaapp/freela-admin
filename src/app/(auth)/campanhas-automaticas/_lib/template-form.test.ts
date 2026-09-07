import { describe, expect, it } from "vitest";
import type { CampaignTemplate } from "@/modules/admin/infrastructure/campaign-templates-api";
import { DEFAULT_TEMPLATE_FORM_VALUES, type TemplateFormValues } from "./template-schema";
import { buildAudienceFilters, buildTemplatePayload, templateToFormValues } from "./template-form";

describe("buildAudienceFilters", () => {
  it("devolve undefined sem cidade nem módulo (não filtra por 'nada')", () => {
    expect(buildAudienceFilters({ cities: [], modules: [] })).toBeUndefined();
  });

  it("monta { cities } quando só há cidades", () => {
    expect(buildAudienceFilters({ cities: ["Jundiaí"], modules: [] })).toEqual({
      cities: ["Jundiaí"],
    });
  });

  it("monta { modules } quando só há módulo", () => {
    expect(buildAudienceFilters({ cities: [], modules: ["home-services"] })).toEqual({
      modules: ["home-services"],
    });
  });

  it("combina cidades e módulo", () => {
    expect(
      buildAudienceFilters({ cities: ["Jundiaí", "Campinas"], modules: ["bars-restaurants"] }),
    ).toEqual({ cities: ["Jundiaí", "Campinas"], modules: ["bars-restaurants"] });
  });
});

const baseValues: TemplateFormValues = {
  ...DEFAULT_TEMPLATE_FORM_VALUES,
  name: "  Reengajamento semanal  ",
  audience: "CONTRACTORS_ALL",
};

describe("buildTemplatePayload — agenda", () => {
  it("WEEKLY manda weekdays+sendHour e não manda campos de DATED", () => {
    const payload = buildTemplatePayload({
      ...baseValues,
      scheduleKind: "WEEKLY",
      weekdays: [1, 3, 5],
      sendHour: 9,
    });
    expect(payload.scheduleKind).toBe("WEEKLY");
    expect(payload.weekdays).toEqual([1, 3, 5]);
    expect(payload.sendHour).toBe(9);
    expect(payload.targetMonth).toBeUndefined();
    expect(payload.targetDay).toBeUndefined();
    expect(payload.targetYear).toBeUndefined();
    expect(payload.leadDays).toBeUndefined();
  });

  it("DATED manda targetMonth+targetDay+leadDays e não manda weekdays/sendHour", () => {
    const payload = buildTemplatePayload({
      ...baseValues,
      scheduleKind: "DATED",
      targetMonth: 5,
      targetDay: 12,
      leadDays: 3,
      repeatsAnnually: true,
    });
    expect(payload.scheduleKind).toBe("DATED");
    expect(payload.targetMonth).toBe(5);
    expect(payload.targetDay).toBe(12);
    expect(payload.leadDays).toBe(3);
    expect(payload.weekdays).toBeUndefined();
    expect(payload.sendHour).toBeUndefined();
  });

  it("DATED com 'repetir todo ano' desmarcado manda targetYear", () => {
    const payload = buildTemplatePayload({
      ...baseValues,
      scheduleKind: "DATED",
      targetMonth: 5,
      targetDay: 12,
      leadDays: 3,
      repeatsAnnually: false,
      targetYear: 2027,
    });
    expect(payload.targetYear).toBe(2027);
  });

  it("DATED com 'repetir todo ano' marcado NÃO manda targetYear mesmo se preenchido antes", () => {
    const payload = buildTemplatePayload({
      ...baseValues,
      scheduleKind: "DATED",
      targetMonth: 5,
      targetDay: 12,
      leadDays: 3,
      repeatsAnnually: true,
      targetYear: 2027,
    });
    expect(payload.targetYear).toBeUndefined();
  });
});

describe("buildTemplatePayload — canais e mensagem", () => {
  it("sem WHATSAPP nos canais, não manda devzappFunnelUrl", () => {
    const payload = buildTemplatePayload({
      ...baseValues,
      channels: ["PUSH"],
      pushTitle: "Título",
      pushBody: "Corpo",
      devzappFunnelUrl: "https://api.devzapp.com.br/funil/abc",
    });
    expect(payload.devzappFunnelUrl).toBeUndefined();
    expect(payload.pushTitle).toBe("Título");
    expect(payload.pushBody).toBe("Corpo");
  });

  it("com WHATSAPP nos canais, manda o link do funil DevZapp aparado", () => {
    const payload = buildTemplatePayload({
      ...baseValues,
      channels: ["WHATSAPP"],
      devzappFunnelUrl: "  https://api.devzapp.com.br/funil/abc  ",
    });
    expect(payload.devzappFunnelUrl).toBe("https://api.devzapp.com.br/funil/abc");
    expect(payload.pushTitle).toBeUndefined();
    expect(payload.pushBody).toBeUndefined();
  });

  it("com os dois canais, manda o link do funil e a mensagem de push juntos", () => {
    const payload = buildTemplatePayload({
      ...baseValues,
      channels: ["PUSH", "WHATSAPP"],
      devzappFunnelUrl: "https://api.devzapp.com.br/funil/abc",
      pushTitle: " Título ",
      pushBody: " Corpo ",
    });
    expect(payload.devzappFunnelUrl).toBe("https://api.devzapp.com.br/funil/abc");
    expect(payload.pushTitle).toBe("Título");
    expect(payload.pushBody).toBe("Corpo");
  });

  // A API não é mais mandada com whatsappTemplate/ritmo — a DevZapp é dona
  // disso agora (mesma migração do item #1, `(auth)/campanhas`).
  it("nunca manda whatsappTemplate nem os campos de ritmo removidos", () => {
    const payload = buildTemplatePayload({ ...baseValues, channels: ["WHATSAPP", "PUSH"] });
    expect(payload).not.toHaveProperty("whatsappTemplate");
    expect(payload).not.toHaveProperty("messagesPerHour");
    expect(payload).not.toHaveProperty("dailyCap");
    expect(payload).not.toHaveProperty("windowStartHour");
    expect(payload).not.toHaveProperty("windowEndHour");
    expect(payload).not.toHaveProperty("weekdaysOnly");
  });
});

describe("buildTemplatePayload — imagem, deep-link, limite e público", () => {
  it("omite imageKey/deepLink/maxPerRun quando vazios", () => {
    const payload = buildTemplatePayload({ ...baseValues, imageKey: "", deepLink: "", maxPerRun: undefined });
    expect(payload.imageKey).toBeUndefined();
    expect(payload.deepLink).toBeUndefined();
    expect(payload.maxPerRun).toBeUndefined();
  });

  it("inclui imageKey/deepLink/maxPerRun quando preenchidos", () => {
    const payload = buildTemplatePayload({
      ...baseValues,
      imageKey: "campaign-templates/banner.png",
      deepLink: "contractor/vagas/nova",
      maxPerRun: 500,
    });
    expect(payload.imageKey).toBe("campaign-templates/banner.png");
    expect(payload.deepLink).toBe("contractor/vagas/nova");
    expect(payload.maxPerRun).toBe(500);
  });

  it("nunca filtra 'por nada' quando não há recorte", () => {
    const payload = buildTemplatePayload({ ...baseValues, cities: [], modules: [] });
    expect(payload.audienceFilters).toBeUndefined();
  });

  it("recorte de cidades vai para audienceFilters e o nome é aparado", () => {
    const payload = buildTemplatePayload({ ...baseValues, cities: ["Jundiaí", "Campinas"] });
    expect(payload.name).toBe("Reengajamento semanal");
    expect(payload.audienceFilters).toEqual({ cities: ["Jundiaí", "Campinas"] });
  });
});

describe("templateToFormValues", () => {
  const weeklyTemplate: CampaignTemplate = {
    id: "tpl-1",
    name: "Reengajamento semanal",
    scheduleKind: "WEEKLY",
    weekdays: [1, 3, 5],
    sendHour: 9,
    audience: "CONTRACTORS_ALL",
    audienceFilters: { cities: ["Jundiaí"], modules: ["home-services"] },
    channels: ["PUSH", "WHATSAPP"],
    devzappFunnelUrl: "https://api.devzapp.com.br/funil/abc",
    pushTitle: "Título salvo",
    pushBody: "Corpo salvo",
    imageKey: "campaign-templates/banner.png",
    deepLink: "contractor/vagas/nova",
    maxPerRun: 200,
    enabled: true,
    lastRunFor: null,
    lastRunAt: null,
    createdAt: "2026-08-31T00:00:00.000Z",
  };

  it("converte um template WEEKLY de volta para os valores do formulário", () => {
    const values = templateToFormValues(weeklyTemplate);
    expect(values.name).toBe("Reengajamento semanal");
    expect(values.scheduleKind).toBe("WEEKLY");
    expect(values.weekdays).toEqual([1, 3, 5]);
    expect(values.sendHour).toBe(9);
    expect(values.audience).toBe("CONTRACTORS_ALL");
    expect(values.cities).toEqual(["Jundiaí"]);
    expect(values.modules).toEqual(["home-services"]);
    expect(values.channels).toEqual(["PUSH", "WHATSAPP"]);
    expect(values.devzappFunnelUrl).toBe("https://api.devzapp.com.br/funil/abc");
    expect(values.pushTitle).toBe("Título salvo");
    expect(values.pushBody).toBe("Corpo salvo");
    expect(values.imageKey).toBe("campaign-templates/banner.png");
    expect(values.deepLink).toBe("contractor/vagas/nova");
    expect(values.maxPerRun).toBe(200);
    // Sem targetYear salvo ⇒ o form assume "repete todo ano" marcado.
    expect(values.repeatsAnnually).toBe(true);
  });

  it("template sem devzappFunnelUrl salvo (legado) volta com o campo vazio", () => {
    const legacy: CampaignTemplate = { ...weeklyTemplate, devzappFunnelUrl: undefined };
    const values = templateToFormValues(legacy);
    expect(values.devzappFunnelUrl).toBe("");
  });

  it("template DATED sem targetYear ⇒ repeatsAnnually true", () => {
    const dated: CampaignTemplate = {
      ...weeklyTemplate,
      scheduleKind: "DATED",
      weekdays: undefined,
      sendHour: undefined,
      targetMonth: 5,
      targetDay: 10,
      targetYear: undefined,
      leadDays: 3,
    };
    const values = templateToFormValues(dated);
    expect(values.scheduleKind).toBe("DATED");
    expect(values.targetMonth).toBe(5);
    expect(values.targetDay).toBe(10);
    expect(values.leadDays).toBe(3);
    expect(values.repeatsAnnually).toBe(true);
    expect(values.targetYear).toBeUndefined();
  });

  it("template DATED com targetYear salvo ⇒ repeatsAnnually false", () => {
    const dated: CampaignTemplate = {
      ...weeklyTemplate,
      scheduleKind: "DATED",
      targetMonth: 5,
      targetDay: 10,
      targetYear: 2027,
      leadDays: 3,
    };
    const values = templateToFormValues(dated);
    expect(values.repeatsAnnually).toBe(false);
    expect(values.targetYear).toBe(2027);
  });

  it("sem audienceFilters, cidades/módulo voltam vazios (não 'undefined' explodindo a tela)", () => {
    const withoutFilters: CampaignTemplate = { ...weeklyTemplate, audienceFilters: undefined };
    const values = templateToFormValues(withoutFilters);
    expect(values.cities).toEqual([]);
    expect(values.modules).toEqual([]);
  });
});

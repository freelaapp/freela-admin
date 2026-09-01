import { describe, expect, it } from "vitest";
import type { CampaignTemplate } from "@/modules/admin/infrastructure/campaign-templates-api";
import { DEFAULT_TEMPLATE_FORM_VALUES, type TemplateFormValues } from "./template-schema";
import {
  buildAudienceFilters,
  buildTemplatePayload,
  joinWhatsappVariants,
  splitWhatsappVariants,
  templateToFormValues,
  VARIANT_SEPARATOR,
} from "./template-form";

describe("buildAudienceFilters", () => {
  it("devolve undefined sem cidade, módulo ou raio (não filtra por 'nada')", () => {
    expect(
      buildAudienceFilters({ cities: [], modules: [], raioCidade: "", raioKm: 50 }),
    ).toBeUndefined();
  });

  it("monta { cities } quando só há cidades", () => {
    expect(
      buildAudienceFilters({ cities: ["Jundiaí"], modules: [], raioCidade: "", raioKm: 50 }),
    ).toEqual({ cities: ["Jundiaí"] });
  });

  it("monta { modules } quando só há módulo", () => {
    expect(
      buildAudienceFilters({ cities: [], modules: ["home-services"], raioCidade: "", raioKm: 50 }),
    ).toEqual({ modules: ["home-services"] });
  });

  it("raio ganha da lista de cidades (cidades somem do filtro)", () => {
    expect(
      buildAudienceFilters({
        cities: ["São Paulo"],
        modules: [],
        raioCidade: "Jundiaí",
        raioKm: 100,
      }),
    ).toEqual({ radius: { city: "Jundiaí", km: 100 } });
  });

  it("cidade de raio sem km > 0 não conta como raio — cai para a lista", () => {
    expect(
      buildAudienceFilters({ cities: ["Jundiaí"], modules: [], raioCidade: "Jundiaí", raioKm: 0 }),
    ).toEqual({ cities: ["Jundiaí"] });
  });

  it("combina módulo com raio", () => {
    expect(
      buildAudienceFilters({
        cities: [],
        modules: ["bars-restaurants"],
        raioCidade: "Jundiaí",
        raioKm: 30,
      }),
    ).toEqual({ modules: ["bars-restaurants"], radius: { city: "Jundiaí", km: 30 } });
  });
});

describe("joinWhatsappVariants / splitWhatsappVariants", () => {
  it("junta as 3 variantes com o separador e normaliza placeholders", () => {
    const joined = joinWhatsappVariants(["Oi {nome}", "Olá {primeiro_nome}", "E aí {cidade}"]);
    expect(joined).toBe(
      ["Oi {{nome}}", "Olá {{primeiro_nome}}", "E aí {{cidade}}"].join(VARIANT_SEPARATOR),
    );
  });

  it("faz o caminho de volta: texto salvo → as 3 variantes", () => {
    const saved = ["Variante 1", "Variante 2", "Variante 3"].join(VARIANT_SEPARATOR);
    expect(splitWhatsappVariants(saved)).toEqual(["Variante 1", "Variante 2", "Variante 3"]);
  });

  it("template null/vazio vira 3 variantes em branco", () => {
    expect(splitWhatsappVariants(null)).toEqual(["", "", ""]);
    expect(splitWhatsappVariants(undefined)).toEqual(["", "", ""]);
    expect(splitWhatsappVariants("")).toEqual(["", "", ""]);
  });

  it("preenche com '' quando o texto salvo tem menos de 3 variantes", () => {
    expect(splitWhatsappVariants("Só uma variante")).toEqual(["Só uma variante", "", ""]);
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
  it("sem WHATSAPP nos canais, não manda whatsappTemplate", () => {
    const payload = buildTemplatePayload({
      ...baseValues,
      channels: ["PUSH"],
      pushTitle: "Título",
      pushBody: "Corpo",
      whatsappVariants: ["a", "b", "c"],
    });
    expect(payload.whatsappTemplate).toBeUndefined();
    expect(payload.pushTitle).toBe("Título");
    expect(payload.pushBody).toBe("Corpo");
  });

  it("com WHATSAPP nos canais, junta e normaliza as 3 variantes", () => {
    const payload = buildTemplatePayload({
      ...baseValues,
      channels: ["WHATSAPP"],
      whatsappVariants: ["Oi {nome}", "Olá {primeiro_nome}", "E aí {cidade}"],
    });
    expect(payload.whatsappTemplate).toBe(
      ["Oi {{nome}}", "Olá {{primeiro_nome}}", "E aí {{cidade}}"].join(VARIANT_SEPARATOR),
    );
    expect(payload.pushTitle).toBeUndefined();
    expect(payload.pushBody).toBeUndefined();
  });

  it("com os dois canais, manda mensagem de WhatsApp e push juntas", () => {
    const payload = buildTemplatePayload({
      ...baseValues,
      channels: ["PUSH", "WHATSAPP"],
      whatsappVariants: ["a", "b", "c"],
      pushTitle: " Título ",
      pushBody: " Corpo ",
    });
    expect(payload.whatsappTemplate).toBe(["a", "b", "c"].join(VARIANT_SEPARATOR));
    expect(payload.pushTitle).toBe("Título");
    expect(payload.pushBody).toBe("Corpo");
  });
});

describe("buildTemplatePayload — imagem, deep-link, ritmo e público", () => {
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

  it("sempre manda o ritmo e nunca filtra 'por nada' quando não há recorte", () => {
    const payload = buildTemplatePayload({ ...baseValues, cities: [], modules: [], raioCidade: "" });
    expect(payload.audienceFilters).toBeUndefined();
    expect(payload).toMatchObject({
      messagesPerHour: baseValues.messagesPerHour,
      dailyCap: baseValues.dailyCap,
      windowStartHour: baseValues.windowStartHour,
      windowEndHour: baseValues.windowEndHour,
      weekdaysOnly: baseValues.weekdaysOnly,
    });
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
    whatsappTemplate: ["Var 1", "Var 2", "Var 3"].join(VARIANT_SEPARATOR),
    pushTitle: "Título salvo",
    pushBody: "Corpo salvo",
    imageKey: "campaign-templates/banner.png",
    deepLink: "contractor/vagas/nova",
    messagesPerHour: 12,
    dailyCap: 80,
    windowStartHour: 10,
    windowEndHour: 19,
    weekdaysOnly: false,
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
    expect(values.raioCidade).toBe("");
    expect(values.channels).toEqual(["PUSH", "WHATSAPP"]);
    expect(values.whatsappVariants).toEqual(["Var 1", "Var 2", "Var 3"]);
    expect(values.pushTitle).toBe("Título salvo");
    expect(values.pushBody).toBe("Corpo salvo");
    expect(values.imageKey).toBe("campaign-templates/banner.png");
    expect(values.deepLink).toBe("contractor/vagas/nova");
    expect(values.messagesPerHour).toBe(12);
    expect(values.dailyCap).toBe(80);
    expect(values.windowStartHour).toBe(10);
    expect(values.windowEndHour).toBe(19);
    expect(values.weekdaysOnly).toBe(false);
    expect(values.maxPerRun).toBe(200);
    // Sem targetYear salvo ⇒ o form assume "repete todo ano" marcado.
    expect(values.repeatsAnnually).toBe(true);
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

  it("recorte por raio (sem cidades) volta como raioCidade/raioKm", () => {
    const withRadius: CampaignTemplate = {
      ...weeklyTemplate,
      audienceFilters: { radius: { city: "Jundiaí", km: 40 } },
    };
    const values = templateToFormValues(withRadius);
    expect(values.raioCidade).toBe("Jundiaí");
    expect(values.raioKm).toBe(40);
    expect(values.cities).toEqual([]);
  });

  it("sem audienceFilters, cidades/módulo/raio voltam vazios (não 'undefined' explodindo a tela)", () => {
    const withoutFilters: CampaignTemplate = { ...weeklyTemplate, audienceFilters: undefined };
    const values = templateToFormValues(withoutFilters);
    expect(values.cities).toEqual([]);
    expect(values.modules).toEqual([]);
    expect(values.raioCidade).toBe("");
  });
});

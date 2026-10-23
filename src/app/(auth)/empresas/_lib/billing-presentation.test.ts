import { describe, expect, it } from "vitest";
import type { BillingModeSettings } from "@/modules/admin/infrastructure/billing-mode-api";
import {
  appUsageHint,
  billingChangeSummary,
  confirmCopy,
  cycleDescription,
  dayLabel,
  missingPhrase,
  requirementRows,
  whatChanges,
} from "./billing-presentation";

const VIEW: BillingModeSettings = {
  mode: "PREPAID",
  since: null,
  email: null,
  contactEmail: "contato@bardoze.com.br",
  editable: true,
  requirements: { missing: [] },
  appUsage: { lastAppDay: null },
  previews: {
    INVOICED_7: {
      period: { start: "2026-10-09", end: "2026-10-15" },
      closeDate: "2026-10-16",
      dueDate: "2026-10-19",
      blockFromDate: "2026-10-23",
    },
    INVOICED_15: {
      period: { start: "2026-10-01", end: "2026-10-15" },
      closeDate: "2026-10-16",
      dueDate: "2026-10-19",
      blockFromDate: "2026-10-23",
    },
    INVOICED_30: {
      period: { start: "2026-10-01", end: "2026-10-31" },
      closeDate: "2026-11-01",
      dueDate: "2026-11-04",
      blockFromDate: "2026-11-08",
    },
  },
  openPreview: null,
  extraordinaryInvoice: null,
};

describe("billing-presentation", () => {
  it("dia da semana pelo calendário (UTC), sem voltar um dia no fuso local", () => {
    expect(dayLabel("2026-10-16")).toBe("sex 16/10");
    expect(dayLabel("2026-11-01")).toBe("dom 01/11");
  });

  it("'Falta' e 'Faltam' com artigo", () => {
    expect(missingPhrase(["number"])).toBe("Falta o número do endereço.");
    expect(missingPhrase(["cnpj", "number", "email"])).toBe(
      "Faltam o CNPJ, o número do endereço e o e-mail.",
    );
  });

  it("pré-requisitos em três linhas: CNPJ, endereço completo e e-mail", () => {
    expect(
      requirementRows(["number", "neighborhood"], {
        cnpj: "12.345.678/0001-90",
        contactEmail: "contato@bardoze.com.br",
      }),
    ).toEqual([
      { key: "cnpj", ok: true, text: "CNPJ: 12.345.678/0001-90" },
      { key: "address", ok: false, text: "Endereço completo: falta o número e o bairro" },
      { key: "email", ok: true, text: "E-mail: contato@bardoze.com.br" },
    ]);
  });

  it("'O que muda' ao ligar o semanal: 1ª fatura com as datas do servidor", () => {
    expect(whatChanges(VIEW, "INVOICED_7", true)).toBe(
      "A partir do próximo aceite, as contratações desta empresa entram na fatura e a Freela adianta o pagamento dos freelancers. 1ª fatura: fecha sex 16/10 às 08:00 com os serviços realizados até qui 15/10; vence seg 19/10. Sem multa e sem juros. Se não pagar, publicar e aprovar ficam bloqueados a partir de sex 23/10.",
    );
    // Bloqueio desligado na API: a frase não ameaça um bloqueio que não existe.
    expect(whatChanges(VIEW, "INVOICED_7", false)).toContain(
      "O bloqueio por atraso ainda está desligado.",
    );
  });

  it("confirmações: ligar, voltar para pré-pago e trocar de ciclo", () => {
    const on = confirmCopy(VIEW, "INVOICED_7", "Bar do Zé", true);
    expect(on.title).toBe("Ligar o faturado semanal para Bar do Zé?");
    expect(on.action).toBe("Ligar faturado semanal");
    expect(on.items).toHaveLength(4);

    const invoiced: BillingModeSettings = {
      ...VIEW,
      mode: "INVOICED_7",
      openPreview: {
        lineCount: 5,
        debitsInCents: 70000,
        creditsInCents: 5970,
        totalInCents: 64030,
        calc: "700,00 − 59,70 = 640,30",
      },
      extraordinaryInvoice: {
        closeDate: "2026-10-11",
        dueDate: "2026-10-14",
        blockFromDate: "2026-10-18",
      },
    };
    const back = confirmCopy(invoiced, "PREPAID", "Bar do Zé", true);
    expect(back.title).toBe("Voltar Bar do Zé para pré-pago?");
    expect(back.items[0]).toBe(
      "Os lançamentos ainda não faturados (5 lançamentos, R$ 640,30) vão para uma fatura extra fechada agora, com vencimento em qua 14/10.",
    );
    expect(back.action).toBe("Voltar para pré-pago");

    const swap = confirmCopy(invoiced, "INVOICED_30", "Bar do Zé", true);
    expect(swap.title).toBe("Trocar de semanal para mensal?");
    expect(swap.items[0]).toBe(
      "Os serviços ainda não faturados entram no próximo fechamento do mensal: dom 01/11.",
    );
    expect(swap.action).toBe("Trocar para mensal");
  });

  it("aviso de uso do app: só quando usou nos últimos 30 dias", () => {
    expect(appUsageHint("2026-10-08", "2026-10-12")).toBe(
      "Esta empresa usou o app em 08/10. O app ainda não mostra o faturado; prefira começar por quem usa o site.",
    );
    expect(appUsageHint("2026-08-01", "2026-10-12")).toBeNull();
    expect(appUsageHint(null, "2026-10-12")).toBeNull();
  });

  it("resumo do 'Salvo.'", () => {
    expect(billingChangeSummary({ billingMode: "INVOICED_7", billingEmail: "contas@bar.com" })).toBe(
      "Modo de cobrança: Faturado semanal; E-mail do financeiro: contas@bar.com",
    );
    expect(billingChangeSummary({ billingEmail: null })).toBe(
      "E-mail do financeiro: vazio (usa o de contato)",
    );
  });
});

describe("billing-presentation — chave do bloqueio desconhecida", () => {
  it("sem `blockEnabled` (lista sem o campo): nenhuma frase sobre o bloqueio", () => {
    const text = whatChanges(VIEW, "INVOICED_7", undefined) as string;
    expect(text).toBe(
      "A partir do próximo aceite, as contratações desta empresa entram na fatura e a Freela adianta o pagamento dos freelancers. 1ª fatura: fecha sex 16/10 às 08:00 com os serviços realizados até qui 15/10; vence seg 19/10. Sem multa e sem juros.",
    );
    expect(text).not.toMatch(/bloque/i);

    const copy = confirmCopy(VIEW, "INVOICED_7", "Bar do Zé", undefined);
    expect(copy.items[2]).toBe("Sem multa e sem juros.");
    expect(copy.items.join(" ")).not.toMatch(/bloque/i);
  });

  it("bloqueio desligado (false): diz que está desligado", () => {
    expect(confirmCopy(VIEW, "INVOICED_7", "Bar do Zé", false).items[2]).toBe(
      "Sem multa e sem juros. O bloqueio por atraso (4º dia depois do vencimento) ainda está desligado.",
    );
  });
});

describe("cycleDescription — ciclo de cada modo", () => {
  it("semanal: segunda a domingo, fecha segunda (08:00 sem o horário da API)", () => {
    // billing-cycle.ts da API (PR #611): segunda a domingo, fecha na segunda e
    // vence 3 dias depois (quinta), ou no próximo dia útil.
    expect(cycleDescription("INVOICED_7")).toBe(
      "Serviços de segunda a domingo. Fecha segunda às 08:00 e vence quinta (ou no próximo dia útil).",
    );
  });

  it("mostra o horário que a API devolve", () => {
    expect(cycleDescription("INVOICED_7", "06:00")).toBe(
      "Serviços de segunda a domingo. Fecha segunda às 06:00 e vence quinta (ou no próximo dia útil).",
    );
    expect(cycleDescription("PREPAID", "06:00")).toBe(
      "A empresa paga o Pix de cada contratação na hora do aceite.",
    );
  });
});

describe("whatChanges — hora do fechamento vinda da API", () => {
  it("mostra o horário que a API devolve na 1ª fatura", () => {
    expect(whatChanges({ ...VIEW, closeHourLabel: "06:00" }, "INVOICED_7", undefined)).toContain(
      "1ª fatura: fecha sex 16/10 às 06:00 com os serviços realizados até qui 15/10",
    );
  });
});

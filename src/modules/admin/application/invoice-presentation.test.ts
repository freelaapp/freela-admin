import { describe, expect, it } from "vitest";
import {
  chargeStatusLabel,
  channelText,
  channelsLine,
  dayLabel,
  formatBrl,
  formatInstantBrt,
  instantWithWeekday,
  lastMessageLines,
  parseBrlToCents,
  periodLabel,
  SITUATION_CHIPS,
  situationStyle,
  tableCaption,
} from "./invoice-presentation";

describe("invoice-presentation", () => {
  it("situações do UX 7.7 com ícone e texto (nunca só a cor)", () => {
    expect(situationStyle("A_VENCER")).toEqual({ tone: "neutral", icon: "calendar" });
    expect(situationStyle("VENCE_HOJE")).toEqual({ tone: "warning", icon: "clock" });
    expect(situationStyle("VENCIDA")).toEqual({ tone: "danger", icon: "alert" });
    expect(situationStyle("BLOQUEADA")).toEqual({ tone: "danger", icon: "lock" });
    expect(situationStyle("LIBERADA")).toEqual({ tone: "warning", icon: "unlock" });
    expect(situationStyle("PAGA")).toEqual({ tone: "success", icon: "check" });
    expect(situationStyle("PAGA_MANUAL")).toEqual({ tone: "success", icon: "check" });
    expect(situationStyle("QUITADA")).toEqual({ tone: "success", icon: "check" });
    expect(situationStyle("CANCELADA")).toEqual({ tone: "muted", icon: "ban" });

    expect(SITUATION_CHIPS.map((chip) => chip.label)).toEqual([
      "Todas",
      "A vencer",
      "Vence hoje",
      "Vencidas",
      "Bloqueadas",
      "Pagas",
      "Quitadas com crédito",
      "Canceladas",
    ]);
    expect(SITUATION_CHIPS.map((chip) => chip.code)).toEqual([
      null,
      "A_VENCER",
      "VENCE_HOJE",
      "VENCIDA",
      "BLOQUEADA",
      "PAGA",
      "QUITADA",
      "CANCELADA",
    ]);
  });

  it("canais: sent → 'enviado', failed → 'falhou', skipped:not_enabled → 'não enviado (WhatsApp ainda não ligado)', ausente → '—'", () => {
    expect(channelText("sent")).toBe("enviado");
    expect(channelText("failed:timeout")).toBe("falhou");
    expect(channelText("failed")).toBe("falhou");
    expect(channelText("skipped:not_enabled")).toBe("não enviado (WhatsApp ainda não ligado)");
    expect(channelText("skipped:no_email")).toBe("não enviado (sem e-mail)");
    expect(channelText("skipped:no_recipients")).toBe("não enviado (ninguém com o app)");
    // Canal que o admin não marcou no reenvio: como ausente (UX 7.5).
    expect(channelText("skipped:not_selected")).toBe("—");
    expect(channelText("skipped:outro")).toBe("não enviado");
    expect(channelText(undefined)).toBe("—");
    expect(channelText(null)).toBe("—");
  });

  it("linha de canais: push, e-mail e WhatsApp em texto", () => {
    expect(
      channelsLine({ push: "sent", email: "failed:bounce", whatsapp: "skipped:not_enabled" }),
    ).toBe("push enviado · e-mail falhou · WhatsApp não enviado (WhatsApp ainda não ligado)");
    expect(channelsLine(null)).toBe("sem envio");
  });

  it("datas: dia da semana pelo calendário (UTC) e instantes em Brasília", () => {
    expect(dayLabel("2026-10-19")).toBe("seg 19/10");
    expect(periodLabel("2026-10-09", "2026-10-15")).toBe("09/10 a 15/10");
    expect(formatInstantBrt("2026-10-16T11:00:00.000Z")).toBe("16/10 08:00");
  });

  it("dinheiro em BRL", () => {
    expect(formatBrl(124860)).toBe("R$ 1.248,60");
    expect(formatBrl(-5202)).toBe("-R$ 52,02");
  });

  it("última mensagem: passo, quando, quem e canais", () => {
    expect(
      lastMessageLines({
        step: "D_PLUS_1",
        label: "D+1",
        at: "2026-10-20T12:00:00.000Z",
        by: "SYSTEM",
        channels: { push: "sent", email: "sent", whatsapp: "skipped:not_enabled" },
      }),
    ).toEqual({
      head: "D+1 · 20/10 09:00 · Sistema",
      channels: "push enviado · e-mail enviado · WhatsApp não enviado (WhatsApp ainda não ligado)",
    });
    expect(lastMessageLines(null)).toEqual({ head: "Nenhuma mensagem ainda", channels: null });
  });

  it("caption da tabela diz o filtro", () => {
    expect(tableCaption(null)).toBe("Faturas, todas as situações");
    expect(tableCaption("VENCIDA")).toBe("Faturas, filtradas por: Vencidas");
  });
});

describe("invoice-presentation — detalhe", () => {
  it("instante com o dia da semana, em Brasília", () => {
    expect(instantWithWeekday("2026-10-23T03:00:00.000Z")).toBe("sex 23/10 às 00:00");
    expect(instantWithWeekday(null)).toBe("—");
  });

  it("situação da cobrança Pix em português", () => {
    expect(chargeStatusLabel("PENDING")).toBe("Pendente");
    expect(chargeStatusLabel("COMPLETED")).toBe("Paga");
    expect(chargeStatusLabel("PAID")).toBe("Paga");
    expect(chargeStatusLabel("CANCELLED")).toBe("Cancelada");
    expect(chargeStatusLabel("EXPIRED")).toBe("Expirada");
    expect(chargeStatusLabel("OUTRO")).toBe("OUTRO");
  });
});

describe("invoice-presentation — valor digitado", () => {
  it("'1.248,60', '1248,60', 'R$ 52', '0,5' viram centavos; texto inválido vira null", () => {
    expect(parseBrlToCents("1.248,60")).toBe(124860);
    expect(parseBrlToCents("1248,60")).toBe(124860);
    expect(parseBrlToCents("R$ 52")).toBe(5200);
    expect(parseBrlToCents("0,5")).toBe(50);
    expect(parseBrlToCents("12.5")).toBe(1250);
    expect(parseBrlToCents("")).toBeNull();
    expect(parseBrlToCents("abc")).toBeNull();
    expect(parseBrlToCents("1,234,5")).toBeNull();
  });
});

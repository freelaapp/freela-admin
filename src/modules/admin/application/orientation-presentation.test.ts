import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import {
  approvedViaLabel,
  brasiliaDateKey,
  brasiliaDateTimeToIso,
  enrollmentStatusLabel,
  formatCount,
  formatSessionDay,
  formatSessionShort,
  formatSessionTimeRange,
  orientationErrorMessage,
  orientationEventLabel,
  orientationStatusLabel,
  sessionAlertText,
  whatsappUrlFromPhone,
} from "./orientation-presentation";

function axios409(code: string, message: string, status = 409) {
  const err = new AxiosError("fail");
  err.response = {
    status,
    data: { error: { code, message } },
    statusText: "",
    headers: {},
    config: {} as never,
  };
  return err;
}

describe("datas em Brasília", () => {
  it("formatSessionDay", () => {
    expect(formatSessionDay("2026-11-16T12:00:00.000Z")).toBe("segunda, 16/11");
  });
  it("turma de domingo 22h em Brasília fica no domingo", () => {
    expect(formatSessionDay("2026-11-16T01:00:00.000Z")).toBe("domingo, 15/11");
    expect(brasiliaDateKey("2026-11-16T01:00:00.000Z")).toBe("2026-11-15");
  });
  it("formatSessionTimeRange", () => {
    expect(formatSessionTimeRange("2026-11-16T12:00:00.000Z", "2026-11-16T13:00:00.000Z")).toBe("9h às 10h");
    expect(formatSessionTimeRange("2026-11-16T12:30:00.000Z", "2026-11-16T13:30:00.000Z")).toBe("9h30 às 10h30");
  });
  it("formatSessionShort", () => {
    expect(formatSessionShort("2026-11-16T12:00:00.000Z")).toBe("seg 16/11, 9h");
  });
  it("brasiliaDateTimeToIso", () => {
    expect(brasiliaDateTimeToIso("2026-11-16", "09:00")).toBe("2026-11-16T12:00:00.000Z");
  });
  it("data inválida não quebra", () => {
    expect(formatSessionDay("lixo")).toBe("—");
  });
});

describe("formatCount", () => {
  it("separa milhares", () => {
    expect(formatCount(210873)).toBe("210.873");
  });
});

describe("whatsappUrlFromPhone", () => {
  it("monta o link com 55", () => {
    expect(whatsappUrlFromPhone("11999990000")).toBe("https://wa.me/5511999990000");
    expect(whatsappUrlFromPhone("+5511999990000")).toBe("https://wa.me/5511999990000");
    expect(whatsappUrlFromPhone("(11) 99999-0000")).toBe("https://wa.me/5511999990000");
  });
  it("número curto ou vazio vira null", () => {
    expect(whatsappUrlFromPhone("123")).toBeNull();
    expect(whatsappUrlFromPhone(null)).toBeNull();
  });
});

describe("rótulos", () => {
  it("status da aula", () => {
    expect(orientationStatusLabel("APPROVED")).toBe("Aprovado");
    expect(orientationStatusLabel("REJECTED")).toBe("Reprovado");
    expect(orientationStatusLabel("PENDING")).toBe("Pendente");
    expect(orientationStatusLabel(null)).toBe("Pendente");
  });
  it("status da inscrição", () => {
    expect(enrollmentStatusLabel("BOOKED")).toBe("Inscrito");
    expect(enrollmentStatusLabel("NO_SHOW")).toBe("Faltou");
    expect(enrollmentStatusLabel("MOVED")).toBe("Trocou de turma");
    expect(enrollmentStatusLabel("CANCELLED")).toBe("Cancelou");
    expect(enrollmentStatusLabel("CANCELLED", "SESSION_CANCELLED")).toBe("Turma cancelada");
  });
  it("como foi aprovado", () => {
    expect(approvedViaLabel("CLASS")).toBe("Fez a aula");
    expect(approvedViaLabel("MANUAL")).toBe("Aprovado sem aula");
    expect(approvedViaLabel("HISTORY")).toBe("Já tinha histórico de serviços");
    expect(approvedViaLabel(null)).toBe("—");
  });
  it("evento do histórico", () => {
    const base = { id: "1", actorType: "ADMIN" as const, actorId: "a", detail: null, createdAt: "2026-11-16T12:00:00.000Z" };
    expect(orientationEventLabel({ ...base, action: "booked" })).toBe("Marcou a aula");
    expect(orientationEventLabel({ ...base, action: "algo_novo" })).toBe("algo_novo");
  });
  it("alerta da turma", () => {
    expect(sessionAlertText("LOW_BOOKINGS")).toMatch(/poucos inscritos/i);
    expect(sessionAlertText("NO_LINK_24H")).toMatch(/link/i);
    expect(sessionAlertText("ATTENDANCE_OPEN")).toMatch(/chamada/i);
  });
});

describe("orientationErrorMessage", () => {
  it("FORBIDDEN, SUPER_ADMIN_REQUIRED e GATE_NOT_WIRED têm texto próprio", () => {
    expect(orientationErrorMessage(axios409("FORBIDDEN", "x"), "f")).toBe("Você não tem permissão para isso.");
    expect(orientationErrorMessage(axios409("SUPER_ADMIN_REQUIRED", "x"), "f")).toBe(
      "Só super administradores podem fazer isso.",
    );
    expect(orientationErrorMessage(axios409("GATE_NOT_WIRED", "x"), "f")).toBe(
      "O bloqueio de vagas ainda não está ligado nesta versão; só dá para manter desligado.",
    );
  });
  it("traduz código da tabela", () => {
    expect(orientationErrorMessage(axios409("SESSION_FULL", "Lotou agora…"), "x")).toBe(
      "Esta turma lotou. Escolha outra.",
    );
  });
  it("código 'API' mostra a message da API", () => {
    expect(orientationErrorMessage(axios409("CAPACITY_BELOW_BOOKED", "Já há 12 inscritos"), "x")).toBe(
      "Já há 12 inscritos",
    );
  });
  it("BAD_REQUEST junta a message", () => {
    expect(orientationErrorMessage(axios409("BAD_REQUEST", "capacity inválido", 400), "x")).toBe(
      "Algum campo está fora do formato: capacity inválido",
    );
  });
  it("código fora da tabela usa a message da API", () => {
    expect(orientationErrorMessage(axios409("OUTRO", "Mensagem da API"), "x")).toBe("Mensagem da API");
  });
  it("não-axios usa o fallback", () => {
    expect(orientationErrorMessage(new Error("boom"), "Falhou")).toBe("Falhou");
  });
});

import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import {
  brt,
  supportCaseDetail,
  supportCaseItem,
} from "./support-queue.test-fixtures";
import {
  contactsLabel,
  isSupportQueueDisabled,
  newsClock,
  readyMessages,
  reasonLabel,
  statusLabel,
  whenLabel,
} from "./support-queue-presentation";

const caseItem = supportCaseItem;
const detail = supportCaseDetail;

function axios404(code: string) {
  return new AxiosError("404", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 404,
    statusText: "Not Found",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code, message: "x" } },
  });
}

describe("fila do suporte: textos da página", () => {
  it("reconhece a chave desligada (404 FEATURE_DISABLED) e só ela", () => {
    expect(isSupportQueueDisabled(axios404("FEATURE_DISABLED"))).toBe(true);
    expect(isSupportQueueDisabled(axios404("SUPPORT_CASE_NOT_FOUND"))).toBe(
      false,
    );
    expect(isSupportQueueDisabled(new Error("rede"))).toBe(false);
  });

  it("selo do motivo, com o risco no corte e a hora da configuração", () => {
    expect(reasonLabel(caseItem(), "16h30")).toBe("Ninguém aceitou o chamado");
    expect(
      reasonLabel(
        caseItem({ reason: "DAILY_CUTOFF", risk: "FIRST_ACCEPT_NO_RESERVE" }),
        "16h30",
      ),
    ).toBe("Corte das 16h30: 1º turno sem suplente");
    expect(reasonLabel(caseItem({ reason: "QUEUE_EMPTY" }), "16h30")).toBe(
      "Fila sem suplentes",
    );
  });

  it("estado: aberto, comigo, com outra pessoa e como terminou", () => {
    expect(statusLabel(caseItem(), "adm-1")).toBe("Aberto");
    const assumed = caseItem({
      status: "IN_PROGRESS",
      assignedTo: { adminId: "adm-1", name: "Bruna Lima" },
    });
    expect(statusLabel(assumed, "adm-1")).toBe("Comigo");
    expect(statusLabel(assumed, "adm-2")).toBe("Com Bruna");
    expect(
      statusLabel(
        caseItem({ status: "SAVED", closeReason: "SYSTEM_RESOLVED" }),
        "adm-1",
      ),
    ).toBe("O sistema resolveu");
    expect(
      statusLabel(
        caseItem({ status: "CANCELLED", closeReason: "VACANCY_STARTED" }),
        "adm-1",
      ),
    ).toBe("A vaga começou");
  });

  it("quando: hoje com o tempo até o início, ou o dia; e quando já começou", () => {
    expect(whenLabel(caseItem(), brt("2026-11-07T14:00:00"))).toBe(
      "hoje 18h · em 4h",
    );
    expect(whenLabel(caseItem(), brt("2026-11-06T18:00:00"))).toBe(
      "sáb 07/11, 18h · em 1 dia",
    );
    expect(whenLabel(caseItem(), brt("2026-11-07T18:10:00"))).toBe(
      "hoje 18h · começou há 10 min",
    );
  });

  it("relógio da notícia: faltam N min; vencido, atrasada há N min; sem aviso à empresa, nada", () => {
    expect(newsClock(caseItem().newsDueAt, brt("2026-11-07T14:18:00"))).toEqual(
      {
        text: "Dar notícia à empresa até 14h30 · faltam 12 min",
        late: false,
      },
    );
    expect(newsClock(caseItem().newsDueAt, brt("2026-11-07T14:33:00"))).toEqual(
      {
        text: "Notícia atrasada há 3 min",
        late: true,
      },
    );
    expect(newsClock(null, new Date())).toBeNull();
    expect(contactsLabel(0)).toBe("Contatos: nenhum");
    expect(contactsLabel(4)).toBe("Contatos: 4");
  });
});

describe("mensagens prontas A a E (Guia do suporte)", () => {
  const now = brt("2026-11-07T14:05:00");

  it("com o caso completo: os colchetes preenchidos, como no designer", () => {
    const messages = readyMessages({
      detail: detail({
        contacts: [
          {
            id: "k1",
            kind: "PROVIDER",
            candidacyId: "c-1",
            name: "João",
            channel: "CALL",
            result: "NO_ANSWER",
            note: null,
            contactedAt: "",
            recordedBy: { adminId: "a", name: "Bruna" },
          },
          {
            id: "k2",
            kind: "PROVIDER",
            candidacyId: "c-1",
            name: "João",
            channel: "WHATSAPP",
            result: "THINKING",
            note: null,
            contactedAt: "",
            recordedBy: { adminId: "a", name: "Bruna" },
          },
          {
            id: "k3",
            kind: "OTHER",
            candidacyId: null,
            name: "Maria",
            channel: "CALL",
            result: "WONT_GO",
            note: null,
            contactedAt: "",
            recordedBy: { adminId: "a", name: "Bruna" },
          },
          {
            id: "k4",
            kind: "CONTRACTOR",
            candidacyId: null,
            name: "Carla",
            channel: "CALL",
            result: "OTHER",
            note: null,
            contactedAt: "",
            recordedBy: { adminId: "a", name: "Bruna" },
          },
        ],
        people: [
          {
            candidacyId: "c-9",
            name: "João Pereira",
            phone: null,
            role: "PRINCIPAL",
            position: null,
            confirmed: true,
          },
        ],
      }),
      myName: "Bruna Lima",
      now,
      firstNewsMinutes: 30,
    });
    expect(Object.fromEntries(messages.map((m) => [m.key, m.text]))).toEqual({
      A: "Olá, Carla! Aqui é Bruna, do suporte do Freela. Já estou cuidando da sua vaga de Garçom para sáb 07/11 às 18h. Te dou notícia até 14h30.",
      B: "Carla, seguimos procurando. Já falei com 2 profissionais e estou aguardando retorno. Volto a te atualizar em 30 minutos.",
      C: "Resolvido! João vai cobrir sua vaga de sáb 07/11 às 18h. A presença já está confirmada. Os dados estão no app.",
      D: "Carla, infelizmente não conseguimos um profissional para sáb 07/11 às 18h. Estou te avisando agora para você ter tempo de se organizar. Peço desculpas. Sua vaga segue aberta no app e, se aparecer alguém, te aviso na hora.",
      E: "VAGA URGENTE – Garçom em Pinheiros, sáb 07/11 das 18h às 23h, R$ 137,28. Quem puder, responda aqui ou candidate-se pelo app: https://www.freelaservicos.com.br/freelancer/vagas/vac-1",
    });
  });

  it("sem o que o caso não sabe: colchetes para o suporte completar; sem aviso à empresa, agora + 30 min", () => {
    const messages = readyMessages({
      detail: detail({
        newsDueAt: null,
        contractor: { contactName: null, phone: null },
        payLabel: null,
        vacancy: { ...caseItem().vacancy, neighborhood: null, city: null },
      }),
      myName: null,
      now,
      firstNewsMinutes: 30,
    });
    const text = Object.fromEntries(messages.map((m) => [m.key, m.text]));
    expect(text.A).toBe(
      "Olá! Aqui é [seu nome], do suporte do Freela. Já estou cuidando da sua vaga de Garçom para sáb 07/11 às 18h. Te dou notícia até 14h35.",
    );
    // Lote 3 (QA de 04/11, achado 13): com 0 contatos, sem o "Já falei com 0 profissionais".
    expect(text.B).toBe("Estou procurando agora e te atualizo em 30 minutos.");
    const withName = readyMessages({
      detail: detail({ newsDueAt: null, contacts: [] }),
      myName: "Bruna Lima",
      now,
      firstNewsMinutes: 30,
    });
    expect(withName.find((m) => m.key === "B")?.text).toMatch(
      /^[A-ZÀ-Ú][a-zà-ú]+, estou procurando agora e te atualizo em 30 minutos\.$/,
    );
    expect(
      text.C.startsWith("Resolvido! [nome do freelancer] vai cobrir"),
    ).toBe(true);
    expect(text.E).toContain("Garçom em [bairro/cidade]");
    expect(text.E).toContain("R$ [valor]");
  });
});

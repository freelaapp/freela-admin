import { describe, expect, it } from "vitest";
import type { AdminGroupView, AdminGroupsList } from "../infrastructure/whatsapp-groups-api";
import { groupAlertBanners, notReceivingHint, renamedNote } from "./whatsapp-groups-presentation";

const group = (over: Partial<AdminGroupView> = {}): AdminGroupView => ({
  id: "id",
  groupJid: "r-group",
  name: "Vagas Freela Salvador BA",
  kind: "CITY",
  source: "IMPORTED",
  city: "Salvador",
  uf: "BA",
  sequence: null,
  dedicatedRuleId: null,
  createdAt: "2026-09-24T11:12:14.374Z",
  botInGroup: true,
  liveName: "Vagas Freela Salvador BA",
  receivesVacancies: true,
  ...over,
});

const list = (over: Partial<AdminGroupsList> = {}): AdminGroupsList => ({
  instance: { connected: true },
  directory: { ok: true, checkedAt: "2026-09-29T12:00:00.000Z" },
  groups: [],
  lostGroups: [],
  citiesWithoutGroup: [],
  ...over,
});

describe("renamedNote", () => {
  it("mostra o nome no WhatsApp só quando é diferente do cadastrado", () => {
    expect(renamedNote(group({ liveName: "Reserva BA" }))).toBe('No WhatsApp: "Reserva BA"');
    expect(renamedNote(group({ liveName: " Vagas Freela Salvador BA " }))).toBeNull();
    expect(renamedNote(group({ liveName: null }))).toBeNull();
    expect(renamedNote(group({ liveName: undefined }))).toBeNull();
  });
});

describe("notReceivingHint", () => {
  it("explica o nome que o grupo precisa ter para voltar a receber as vagas", () => {
    expect(notReceivingHint(group({ receivesVacancies: false }))).toBe(
      'Não recebe as vagas de Salvador/BA. Para voltar a receber, o nome no WhatsApp precisa ser "Vagas Freela Salvador BA".',
    );
    expect(notReceivingHint(group({ receivesVacancies: false, sequence: 2 }))).toBe(
      'Não recebe as vagas de Salvador/BA. Para voltar a receber, o nome no WhatsApp precisa ser "Vagas Freela Salvador BA #2".',
    );
  });

  it("null quando recebe, quando não dá para dizer ou sem cidade", () => {
    expect(notReceivingHint(group())).toBeNull();
    expect(notReceivingHint(group({ receivesVacancies: null }))).toBeNull();
    expect(notReceivingHint(group({ receivesVacancies: undefined }))).toBeNull();
    expect(notReceivingHint(group({ receivesVacancies: false, city: null }))).toBeNull();
  });
});

describe("groupAlertBanners", () => {
  const lost = {
    groupJid: "s-group",
    panelName: null,
    city: "Salvador",
    uf: "BA",
    lastSentAt: "2026-09-22T20:46:22.000Z",
    sample: "Nova oportunidade no Freela Empresa",
  };

  it("bot tirado do grupo: um aviso por grupo, com a melhor identificação disponível", () => {
    expect(
      groupAlertBanners(
        list({
          lostGroups: [
            lost,
            { ...lost, groupJid: "n-group", panelName: "Vagas Freela Natal RN", city: "Natal", uf: "RN" },
            { ...lost, groupJid: "a-group", city: null, uf: null, sample: "[Vaga nova] Boa tarde, Gestor!" },
          ],
        }),
      ),
    ).toEqual([
      {
        tone: "red",
        text: "O bot foi tirado do grupo de Salvador/BA (último envio em 22/09). As mensagens pararam de chegar lá — peça a um admin do grupo para adicionar o número do bot de volta.",
      },
      {
        tone: "red",
        text: 'O bot foi tirado do grupo "Vagas Freela Natal RN" (último envio em 22/09). As mensagens pararam de chegar lá — peça a um admin do grupo para adicionar o número do bot de volta.',
      },
      {
        tone: "red",
        text: 'O bot foi tirado do grupo que recebia "[Vaga nova] Boa tarde, Gestor!" (último envio em 22/09). As mensagens pararam de chegar lá — peça a um admin do grupo para adicionar o número do bot de volta.',
      },
    ]);
  });

  it("cidades sem grupo: um aviso só, listando as cidades", () => {
    expect(
      groupAlertBanners(
        list({
          citiesWithoutGroup: [
            { city: "Salvador", uf: "BA" },
            { city: "Natal", uf: "RN" },
          ],
        }),
      ),
    ).toEqual([
      {
        tone: "red",
        text: "Sem grupo recebendo vagas: Salvador/BA, Natal/RN. As vagas dessas cidades não vão para grupo nenhum.",
      },
    ]);
  });

  it("sem avisos quando está tudo certo ou a API ainda não manda os campos", () => {
    expect(groupAlertBanners(list())).toEqual([]);
    const oldApi: AdminGroupsList = {
      instance: { connected: true },
      directory: { ok: true, checkedAt: null },
      groups: [],
    };
    expect(groupAlertBanners(oldApi)).toEqual([]);
  });
});

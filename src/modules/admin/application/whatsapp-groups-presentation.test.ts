import { describe, expect, it, vi } from "vitest";
import { formatPhoneBr } from "@/lib/utils";
import type { AdminGroupView } from "../infrastructure/whatsapp-groups-api";
import type { VipStoreSummary } from "../infrastructure/vip-groups-api";
import {
  BOT_STATUS_LABELS,
  EMPTY_CITY_FILTERS,
  SOURCE_LABELS,
  alsoJoinText,
  applyPhonesToTargets,
  applySummaryText,
  botStatus,
  buildApplyTargets,
  canAddMembers,
  checkedAtLabel,
  cityOptions,
  deleteGroupEffect,
  directoryBanners,
  filterCityGroups,
  filterDedicatedGroups,
  filterVipStores,
  groupsCountLabel,
  hasVipGroup,
  parseGroupsTab,
  parsePhonesInput,
  progressLabel,
  ufOptions,
  withUf,
} from "./whatsapp-groups-presentation";

const group = (over: Partial<AdminGroupView> = {}): AdminGroupView => ({
  id: "id",
  groupJid: "j@g.us",
  name: "Vagas Freela Natal RN",
  kind: "CITY",
  source: "PANEL",
  city: "Natal",
  uf: "RN",
  sequence: null,
  dedicatedRuleId: null,
  createdAt: "2026-09-23T12:00:00.000Z",
  botInGroup: true,
  ...over,
});

const store = (over: Partial<VipStoreSummary> = {}): VipStoreSummary => ({
  contractorUserId: "loja-1",
  storeName: "Coco Bambu Jundiaí",
  status: "ACTIVE",
  groupJid: "vip-1@g.us",
  groupName: "VIP Coco Bambu Jundiaí",
  lastError: null,
  activeMembers: 3,
  pendingAdd: 0,
  pendingRemove: 0,
  botInGroup: true,
  ...over,
});

describe("abas e telefones", () => {
  it("aba da URL: valores conhecidos; o resto cai em Cidades", () => {
    expect(parseGroupsTab("vip")).toBe("vip");
    expect(parseGroupsTab("dedicados")).toBe("dedicados");
    expect(parseGroupsTab("xyz")).toBe("cidades");
    expect(parseGroupsTab(null)).toBe("cidades");
  });

  it("campo de telefones separa por vírgula, ponto e vírgula e linha", () => {
    expect(parsePhonesInput("11 91537-5766, (21) 99999-0000\n\n; 11988887777 ")).toEqual([
      "11 91537-5766",
      "(21) 99999-0000",
      "11988887777",
    ]);
    expect(parsePhonesInput("  ")).toEqual([]);
  });

  it("telefone padrão formatado como (11) 91537-5766 e o aviso 'Também entram'", () => {
    expect(formatPhoneBr("5511915375766")).toBe("(11) 91537-5766");
    expect(alsoJoinText(["5511915375766", "5521999990000"])).toBe(
      "Também entram: (11) 91537-5766, (21) 99999-0000",
    );
    expect(alsoJoinText([])).toBeNull();
  });
});

describe("bot, origem e contagem", () => {
  it("status do bot e rótulos", () => {
    expect(botStatus(true)).toBe("in");
    expect(botStatus(false)).toBe("out");
    expect(botStatus(null)).toBe("unknown");
    expect(botStatus(undefined)).toBe("unknown");
    expect(BOT_STATUS_LABELS).toEqual({ in: "Bot no grupo", out: "Bot fora do grupo", unknown: "Não conferido" });
  });

  it("adicionar membros só com jid e bot não sabidamente fora", () => {
    expect(canAddMembers(group())).toBe(true);
    expect(canAddMembers(group({ botInGroup: null }))).toBe(true);
    expect(canAddMembers(group({ botInGroup: false }))).toBe(false);
    expect(canAddMembers(group({ groupJid: null }))).toBe(false);
  });

  it("origem e contagem", () => {
    expect(SOURCE_LABELS).toEqual({ PANEL: "Painel", IMPORTED: "Importado" });
    expect(groupsCountLabel(1)).toBe("1 grupo");
    expect(groupsCountLabel(0)).toBe("0 grupos");
    expect(groupsCountLabel(12)).toBe("12 grupos");
  });
});

describe("filtros", () => {
  const groups = [
    group({ id: "1", name: "Vagas Freela Jundiaí SP", city: "Jundiaí", uf: "SP", botInGroup: true }),
    group({ id: "2", name: "Vagas Freela Jundiaí SP #2", city: "Jundiaí", uf: "SP", sequence: 2, botInGroup: false }),
    group({ id: "3", name: "Vagas Freela Campinas SP", city: "Campinas", uf: "SP", botInGroup: null }),
    group({ id: "4", name: "Vagas Freela Natal RN", city: "Natal", uf: "RN" }),
    group({ id: "5", name: "Vagas Freela jundiai SP", city: "jundiai", uf: "SP" }),
    group({ id: "6", name: "Notificações Coco Bambu", kind: "DEDICATED", city: null, uf: null, botInGroup: false }),
  ];

  it("UFs só dos grupos de cidade; cidades dependem da UF (sem repetir por acento/caixa)", () => {
    expect(ufOptions(groups)).toEqual(["RN", "SP"]);
    expect(cityOptions(groups, "SP")).toEqual(["Campinas", "Jundiaí"]);
    expect(cityOptions(groups, "")).toEqual([]);
  });

  it("trocar a UF zera a cidade", () => {
    const f = { ...EMPTY_CITY_FILTERS, uf: "SP", city: "Jundiaí", search: "x" };
    expect(withUf(f, "RN")).toEqual({ ...f, uf: "RN", city: "" });
  });

  it("cidades: busca sem acento, UF, cidade e status do bot", () => {
    const ids = (list: AdminGroupView[]) => list.map((g) => g.id);
    expect(ids(filterCityGroups(groups, { ...EMPTY_CITY_FILTERS, search: "jundiai" }))).toEqual(["1", "2", "5"]);
    expect(ids(filterCityGroups(groups, { ...EMPTY_CITY_FILTERS, uf: "RN" }))).toEqual(["4"]);
    expect(ids(filterCityGroups(groups, { ...EMPTY_CITY_FILTERS, uf: "SP", city: "Jundiaí" }))).toEqual(["1", "2", "5"]);
    expect(ids(filterCityGroups(groups, { ...EMPTY_CITY_FILTERS, bot: "out" }))).toEqual(["2"]);
    expect(ids(filterCityGroups(groups, { ...EMPTY_CITY_FILTERS, bot: "unknown" }))).toEqual(["3"]);
  });

  it("dedicados: só DEDICATED, busca e status", () => {
    expect(filterDedicatedGroups(groups, { search: "coco", bot: "all" }).map((g) => g.id)).toEqual(["6"]);
    expect(filterDedicatedGroups(groups, { search: "", bot: "in" })).toEqual([]);
  });

  it("hasVipGroup: só status diferente de NONE", () => {
    expect(hasVipGroup(store({ status: "ACTIVE" }))).toBe(true);
    expect(hasVipGroup(store({ status: "NONE" }))).toBe(false);
  });

  it("VIP: só lojas com grupo; busca por loja, estado e bot", () => {
    const stores = [
      store({ contractorUserId: "a" }),
      store({ contractorUserId: "b", storeName: "Outback", status: "FAILED", groupJid: null, groupName: "VIP Outback", botInGroup: null }),
      store({ contractorUserId: "c", status: "NONE", groupJid: null, groupName: null }),
    ];
    const ids = (list: VipStoreSummary[]) => list.map((s) => s.contractorUserId);
    expect(ids(filterVipStores(stores, { search: "", state: "all", bot: "all" }))).toEqual(["a", "b"]);
    expect(ids(filterVipStores(stores, { search: "outb", state: "all", bot: "all" }))).toEqual(["b"]);
    expect(ids(filterVipStores(stores, { search: "", state: "ACTIVE", bot: "all" }))).toEqual(["a"]);
    expect(ids(filterVipStores(stores, { search: "", state: "all", bot: "unknown" }))).toEqual(["b"]);
  });
});

describe("adicionar os números padrão em todos os grupos", () => {
  it("alvos: com jid e bot não fora; VIP só ATIVO; sem jid repetido", () => {
    const targets = buildApplyTargets(
      [
        group({ groupJid: "a@g.us", name: "A" }),
        group({ groupJid: "b@g.us", name: "B", botInGroup: false }),
        group({ groupJid: null, name: "C" }),
        group({ groupJid: "d@g.us", name: "D", botInGroup: null, kind: "DEDICATED" }),
        group({ groupJid: "a@g.us", name: "A de novo" }),
      ],
      [
        store({ groupJid: "v1@g.us", groupName: "VIP 1" }),
        store({ groupJid: "v2@g.us", groupName: "VIP 2", status: "PENDING" }),
        store({ groupJid: "v3@g.us", groupName: "VIP 3", botInGroup: false }),
        store({ groupJid: "v4@g.us", groupName: null, storeName: "Loja 4", botInGroup: undefined }),
      ],
    );
    expect(targets).toEqual([
      { groupJid: "a@g.us", name: "A" },
      { groupJid: "d@g.us", name: "D" },
      { groupJid: "v1@g.us", name: "VIP 1" },
      { groupJid: "v4@g.us", name: "Loja 4" },
    ]);
  });

  it("percorre em sequência, segue depois de uma falha e informa o progresso", async () => {
    let running = 0;
    let maxRunning = 0;
    const calls: string[] = [];
    const add = vi.fn(async ({ groupId }: { groupId: string; participants: string[] }) => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      calls.push(groupId);
      await Promise.resolve();
      running -= 1;
      if (groupId === "b@g.us") throw new Error("bot não é admin");
    });
    const progress: Array<[number, number]> = [];

    const failures = await applyPhonesToTargets(
      [
        { groupJid: "a@g.us", name: "A" },
        { groupJid: "b@g.us", name: "B" },
        { groupJid: "c@g.us", name: "C" },
      ],
      ["5511915375766"],
      add,
      (done, total) => progress.push([done, total]),
      (e) => (e as Error).message,
    );

    expect(calls).toEqual(["a@g.us", "b@g.us", "c@g.us"]);
    expect(maxRunning).toBe(1);
    expect(add).toHaveBeenCalledWith({ groupId: "a@g.us", participants: ["5511915375766"] });
    expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);
    expect(failures).toEqual([{ name: "B", message: "bot não é admin" }]);
  });

  it("textos de progresso e resumo", () => {
    expect(progressLabel(12, 40)).toBe("12 de 40");
    expect(applySummaryText(3, [])).toBe("3 de 3 grupos receberam os números.");
    expect(applySummaryText(3, [{ name: "B", message: "x" }])).toBe("2 de 3 grupos receberam os números.");
    expect(applySummaryText(1, [])).toBe("1 de 1 grupo recebeu os números.");
  });
});

describe("estado do diretório e excluir", () => {
  it("faixas: instância desconectada (vermelha) e diretório não conferido (âmbar)", () => {
    expect(directoryBanners({ instance: { connected: false }, directory: { ok: false, checkedAt: null } })).toEqual([
      { tone: "red", text: "Instância do WhatsApp desconectada — o status dos grupos pode estar desatualizado." },
      { tone: "amber", text: "Não deu para conferir os grupos agora." },
    ]);
    expect(directoryBanners({ instance: { connected: null }, directory: { ok: true, checkedAt: "x" } })).toEqual([]);
  });

  it("'Conferido às HH:MM' no horário de Brasília", () => {
    expect(checkedAtLabel("2026-09-23T17:32:00.000Z")).toBe("Conferido às 14:32");
    expect(checkedAtLabel(null)).toBeNull();
    expect(checkedAtLabel("lixo")).toBeNull();
  });

  it("texto do Excluir muda quando o bot já está fora", () => {
    expect(deleteGroupEffect(true)).toBe(
      "O bot sai do grupo e ele para de receber vagas. Os membros continuam no grupo. Não dá para desfazer por aqui.",
    );
    expect(deleteGroupEffect(null)).toBe(deleteGroupEffect(true));
    expect(deleteGroupEffect(false)).toBe("O bot já não está no grupo; ele só sai da lista.");
  });
});

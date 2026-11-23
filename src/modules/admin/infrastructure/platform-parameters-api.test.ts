import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, put }),
}));

import {
  getParameterChanges,
  getPlatformParameters,
  updatePlatformParameter,
} from "./platform-parameters-api";

const item = {
  key: "ranking.worked_here_cap_pct",
  label: "Teto de quem já trabalhou aqui",
  help: "Entre os 10 pré-selecionados.",
  unit: "%",
  value: 30,
  defaultValue: 50,
  min: 0,
  max: 100,
  isDefault: false,
  inEffect: true,
  version: 3,
  updatedAt: "2026-11-23T17:05:00.000Z",
  updatedBy: "Ana Lima",
};

describe("platform-parameters-api", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lista os parâmetros em /platform-parameters", async () => {
    get.mockResolvedValue({ data: { data: { items: [item] } } });
    const out = await getPlatformParameters();
    expect(get).toHaveBeenCalledWith("/platform-parameters");
    expect(out).toEqual([item]);
  });

  it("é tolerante: campos ausentes viram padrões e lixo extra é ignorado", async () => {
    get.mockResolvedValue({
      data: {
        data: {
          items: [
            {
              key: "x.y",
              value: 5,
              defaultValue: 5,
              min: 1,
              max: 9,
              version: 1,
              extra: "?",
            },
          ],
        },
      },
    });
    const [p] = await getPlatformParameters();
    expect(p).toMatchObject({
      key: "x.y",
      label: "x.y",
      help: "",
      unit: "",
      isDefault: false,
      inEffect: false,
      updatedAt: null,
      updatedBy: null,
    });
  });

  it("aceita o payload real da API: updatedBy é o NOME do admin (texto)", async () => {
    get.mockResolvedValue({ data: { data: { items: [{ ...item, updatedBy: "Diego" }] } } });
    const [p] = await getPlatformParameters();
    expect(p.updatedBy).toBe("Diego");
  });

  it("tolera updatedBy como objeto {name} e normaliza para texto", async () => {
    get.mockResolvedValue({ data: { data: { items: [{ ...item, updatedBy: { id: "a1", name: "Ana Lima" } }] } } });
    const [p] = await getPlatformParameters();
    expect(p.updatedBy).toBe("Ana Lima");
  });

  it("a resposta do PUT com updatedBy em texto não quebra", async () => {
    put.mockResolvedValue({ data: { data: { ...item, value: 40, version: 4, updatedBy: "Diego" } } });
    const out = await updatePlatformParameter("ranking.worked_here_cap_pct", {
      value: 40,
      reason: "Pedido do Diego",
      expectedVersion: 3,
    });
    expect(out.updatedBy).toBe("Diego");
  });

  it("valida item por item: o malformado é descartado com aviso e os bons ficam", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    get.mockResolvedValue({ data: { data: { items: [item, { key: "ruim", value: "x" }, null] } } });
    const out = await getPlatformParameters();
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe(item.key);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("lista vazia quando a resposta não traz items", async () => {
    get.mockResolvedValue({ data: { data: {} } });
    expect(await getPlatformParameters()).toEqual([]);
  });

  it("salva com value, reason e expectedVersion", async () => {
    put.mockResolvedValue({ data: { data: { ...item, value: 40, version: 4 } } });
    const out = await updatePlatformParameter("ranking.worked_here_cap_pct", {
      value: 40,
      reason: "Pedido do Diego",
      expectedVersion: 3,
    });
    expect(put).toHaveBeenCalledWith("/platform-parameters/ranking.worked_here_cap_pct", {
      value: 40,
      reason: "Pedido do Diego",
      expectedVersion: 3,
    });
    expect(out.version).toBe(4);
  });

  it("histórico com limit=50 e tolerante a campos nulos", async () => {
    get.mockResolvedValue({
      data: {
        data: {
          items: [
            {
              oldValue: null,
              newValue: 30,
              defaultValue: 50,
              reason: "Teste de motivo",
              admin: "Ana Lima",
              createdAt: "2026-11-23T17:05:00.000Z",
            },
          ],
        },
      },
    });
    const out = await getParameterChanges("ranking.worked_here_cap_pct");
    expect(get).toHaveBeenCalledWith("/platform-parameters/ranking.worked_here_cap_pct/changes", {
      params: { limit: 50 },
    });
    expect(out[0]).toMatchObject({ oldValue: null, newValue: 30, admin: "Ana Lima" });
  });
});

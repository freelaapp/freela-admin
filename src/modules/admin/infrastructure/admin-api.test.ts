import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesmo padrão de consultant-api.test.ts (vi.hoisted evita o hoisting trap do vi.mock).
const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() }),
}));

import { getAdminAllVacancies } from "./admin-api";

/** Erro como o axios entrega (o `isAxiosError` só olha a marca). */
function axiosError(status: number) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data: {} },
  });
}

const vaga = (id: string) => ({ id });

function respondWith(cancelled: () => Promise<unknown>) {
  get.mockImplementation((path: string) => {
    if (path === "/open-vacancies") return Promise.resolve({ data: { data: [vaga("aberta")] } });
    if (path === "/closed-vacancies") return Promise.resolve({ data: { data: [vaga("fechada")] } });
    if (path === "/cancelled-vacancies") return cancelled();
    return Promise.reject(new Error(`rota inesperada ${path}`));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAdminAllVacancies — canceladas", () => {
  it("junta abertas, fechadas e canceladas", async () => {
    respondWith(() => Promise.resolve({ data: { data: [vaga("cancelada")] } }));
    const all = await getAdminAllVacancies();
    expect(all.map((v) => v.id)).toEqual(["aberta", "fechada", "cancelada"]);
  });

  it("API antiga sem a rota (404): segue sem as canceladas", async () => {
    respondWith(() => Promise.reject(axiosError(404)));
    const all = await getAdminAllVacancies();
    expect(all.map((v) => v.id)).toEqual(["aberta", "fechada"]);
  });

  it("qualquer outra falha (500) sobe para a tela mostrar o erro, em vez de sumir com as canceladas", async () => {
    respondWith(() => Promise.reject(axiosError(500)));
    await expect(getAdminAllVacancies()).rejects.toMatchObject({ response: { status: 500 } });
  });

  it("timeout / sem resposta também sobe", async () => {
    respondWith(() => Promise.reject(Object.assign(new Error("timeout of 30000ms exceeded"), { isAxiosError: true })));
    await expect(getAdminAllVacancies()).rejects.toThrow("timeout");
  });
});

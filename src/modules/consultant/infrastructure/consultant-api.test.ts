import { beforeEach, describe, expect, it, vi } from "vitest";

// Mesmo padrão de referrals-api.test.ts (vi.hoisted evita o hoisting trap do vi.mock).
const { get, patch } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, patch, post: vi.fn() }),
}));

import {
  getConsultantProfileApi,
  listRegistrationsApi,
  toRegistrationPage,
  updateConsultantProfileApi,
} from "./consultant-api";
import type { RegistrationFilters } from "@/modules/consultant/domain/types";

const filters: RegistrationFilters = { type: "all", q: "", page: 1, pageSize: 50 };

const legacyItem = {
  id: "u1",
  userId: "u1",
  name: "Ana",
  email: null,
  phone: null,
  persona: "provider",
  module: null,
  status: "pending",
  createdAt: "2026-09-01T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listRegistrationsApi", () => {
  it("manda page/pageSize e omite type=all e busca vazia", async () => {
    get.mockResolvedValue({ data: { data: { total: 0, page: 1, pageSize: 50, items: [] } } });
    await listRegistrationsApi(filters);
    expect(get).toHaveBeenCalledWith("/me/registrations", { params: { page: 1, pageSize: 50 } });
  });

  it("manda type e busca aparada", async () => {
    get.mockResolvedValue({ data: { data: { total: 0, page: 2, pageSize: 20, items: [] } } });
    await listRegistrationsApi({ type: "contractor", q: "  bar  ", page: 2, pageSize: 20 });
    expect(get).toHaveBeenCalledWith("/me/registrations", {
      params: { page: 2, pageSize: 20, type: "contractor", q: "bar" },
    });
  });
});

describe("toRegistrationPage", () => {
  it("API antiga (lista): vira uma página só e completa os campos novos", () => {
    expect(toRegistrationPage([legacyItem], filters)).toEqual({
      total: 1,
      page: 1,
      pageSize: 1,
      items: [
        {
          ...legacyItem,
          companyName: null,
          city: null,
          uf: null,
          source: null,
          hasVacancy: false,
        },
      ],
    });
  });

  it("API nova (página): mantém total/page/pageSize", () => {
    const item = { ...legacyItem, companyName: "Bar", city: "Fortaleza", uf: "CE", source: "LINK", hasVacancy: true };
    expect(toRegistrationPage({ total: 120, page: 2, pageSize: 50, items: [item] }, filters)).toEqual({
      total: 120,
      page: 2,
      pageSize: 50,
      items: [item],
    });
  });

  it("resposta vazia vira página vazia", () => {
    expect(toRegistrationPage(null, filters)).toEqual({ total: 0, page: 1, pageSize: 50, items: [] });
  });
});

describe("perfil", () => {
  it("GET /me devolve o perfil", async () => {
    const profile = { id: "c1" };
    get.mockResolvedValue({ data: { data: profile } });
    await expect(getConsultantProfileApi()).resolves.toBe(profile);
    expect(get).toHaveBeenCalledWith("/me");
  });

  it("PATCH /me manda só nome e telefone", async () => {
    const profile = { id: "c1" };
    patch.mockResolvedValue({ data: { data: profile } });
    await expect(updateConsultantProfileApi({ name: "Ana", phone: "+5511988887777" })).resolves.toBe(profile);
    expect(patch).toHaveBeenCalledWith("/me", { name: "Ana", phone: "+5511988887777" });
  });
});

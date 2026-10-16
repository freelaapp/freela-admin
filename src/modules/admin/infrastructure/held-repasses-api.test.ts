import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, post }),
}));

import {
  advancedBreakdownOf,
  heldRepasseItemOf,
  heldSummaryCardOf,
  heldTotalsOf,
  listHeldRepasses,
  releaseHeldRepasse,
} from "./held-repasses-api";

/** O item como a API #603 manda (`docs/api-contracts.md`). */
const RAW_ITEM = {
  repasseId: "rep-1",
  vacancyId: "1768647f-7aa9-4304-a41e-7b12b7f26de0",
  vacancyTitle: "Garçom",
  serviceDate: "2026-10-22",
  freelancer: { providerGlobalId: "pg-1", name: "Ana Souza", hasPixKey: true },
  company: { contractorUserId: "u-1", name: "Bar do Zé" },
  amountInCents: 9500,
  heldAt: "2026-10-23T04:00:00.000Z",
  expectedDate: "2026-10-26",
  effectiveDeadlineAt: "2026-10-30T03:00:00.000Z",
  invoice: { id: "inv-1", number: "FAT-2026-000123", status: "ISSUED", dueDate: "2026-10-26" },
  situation: "invoice_open",
  releaseAuthorized: false,
  calc: "teto = mín(prazo da retenção sex 30/10, bloqueio da fatura sex 30/10) = sex 30/10 00:00",
  source: "Repasse retido (shared.repasses com status AWAITING_INVOICE).",
};

const RAW_TOTALS = {
  all: { count: 3, totalInCents: 28500 },
  awaitingClose: { count: 1, totalInCents: 12000 },
  invoiceOpen: { count: 1, totalInCents: 7000 },
  invoiceOverdue: { count: 1, totalInCents: 9500 },
  releasing: { count: 0, totalInCents: 0 },
  deadline48h: { count: 1, totalInCents: 9500 },
  calc: "fatura ainda aberta R$ 120,00 (1) + a vencer R$ 70,00 (1) + vencida R$ 95,00 (1) + liberando R$ 0,00 (0) = R$ 285,00 (3 retidos)",
  source: "Repasse retido.",
};

function axiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("falhou", String(status), config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data,
  });
}

describe("held-repasses-api", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it("lista: rota, filtro e página; 'all' não vai na URL", async () => {
    get.mockResolvedValue({
      data: { data: [RAW_ITEM], meta: { page: 2, pageSize: 200, total: 201, hasMore: false, totals: RAW_TOTALS } },
    });

    const result = await listHeldRepasses({ situation: "invoice_overdue", page: 2, pageSize: 200 });
    expect(get).toHaveBeenCalledWith("/billing/held-repasses", {
      params: { situation: "invoice_overdue", page: 2, pageSize: 200 },
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      repasseId: "rep-1",
      freelancer: { name: "Ana Souza", hasPixKey: true },
      invoice: { number: "FAT-2026-000123", dueDate: "2026-10-26" },
      situation: "invoice_open",
    });
    expect(result).toMatchObject({ page: 2, pageSize: 200, total: 201, hasMore: false });
    expect(result.totals?.deadline48h).toEqual({ count: 1, totalInCents: 9500 });

    await listHeldRepasses({ situation: "all" });
    expect(get).toHaveBeenLastCalledWith("/billing/held-repasses", { params: {} });
  });

  it("lista: item sem id, valor, teto ou com situação desconhecida é descartado; sem totais → null", async () => {
    get.mockResolvedValue({
      data: {
        data: [
          RAW_ITEM,
          { ...RAW_ITEM, repasseId: "" },
          { ...RAW_ITEM, amountInCents: 95.5 },
          { ...RAW_ITEM, effectiveDeadlineAt: "amanhã" },
          { ...RAW_ITEM, situation: "paid" },
        ],
        meta: {},
      },
    });

    const result = await listHeldRepasses();
    expect(result.items.map((i) => i.repasseId)).toEqual(["rep-1"]);
    expect(result.totals).toBeNull();
    expect(result.total).toBe(1);
  });

  it("item: campos opcionais nulos não quebram; `hasPixKey` ausente = não sabemos (null), não `false`", () => {
    const item = heldRepasseItemOf({
      ...RAW_ITEM,
      vacancyTitle: null,
      serviceDate: null,
      freelancer: { providerGlobalId: "pg-1", name: null },
      company: { contractorUserId: null, name: null },
      invoice: null,
      situation: "awaiting_close",
    });
    expect(item).toMatchObject({
      vacancyTitle: null,
      serviceDate: null,
      freelancer: { name: null, hasPixKey: null },
      company: { name: null },
      invoice: null,
      situation: "awaiting_close",
    });
  });

  it("item: `hasPixKey` false explícito continua false", () => {
    const item = heldRepasseItemOf({
      ...RAW_ITEM,
      freelancer: { providerGlobalId: "pg-1", name: "Ana Souza", hasPixKey: false },
    });
    expect(item?.freelancer.hasPixKey).toBe(false);
  });

  it("totais: falta uma parte → null (os cards somem, nunca R$ 0,00 inventado)", () => {
    expect(heldTotalsOf(RAW_TOTALS)?.all).toEqual({ count: 3, totalInCents: 28500 });
    expect(heldTotalsOf({ ...RAW_TOTALS, deadline48h: undefined })).toBeNull();
    expect(heldTotalsOf(undefined)).toBeNull();
  });

  it("resumo: `advanced.breakdown` e `held` lidos campo a campo; ausentes → null", () => {
    const breakdown = {
      onCompletion: { count: 2, valueInCents: 19000 },
      deadline: { count: 1, valueInCents: 9500 },
      admin: { count: 1, valueInCents: 9500 },
      invoiceCancelled: { count: 0, valueInCents: 0 },
    };
    expect(advancedBreakdownOf(breakdown)).toEqual(breakdown);
    expect(advancedBreakdownOf({ ...breakdown, admin: { count: 1 } })).toBeNull();
    expect(advancedBreakdownOf(undefined)).toBeNull();

    expect(
      heldSummaryCardOf({
        label: "Retido aguardando a fatura",
        valueInCents: 28500,
        count: 3,
        calc: "c",
        source: "s",
        meta: "m",
        help: "h",
        dueIn48hInCents: 9500,
        dueIn48hCount: 1,
        overdueInCents: 9500,
        overdueCount: 1,
        nextDeadlineAt: "2026-10-30T03:00:00.000Z",
      }),
    ).toMatchObject({ label: "Retido aguardando a fatura", valueInCents: 28500, dueIn48hCount: 1 });
    expect(heldSummaryCardOf({ label: "x", valueInCents: -1, count: 1 })).toBeNull();
    expect(heldSummaryCardOf(undefined)).toBeNull();
  });

  it("pagar agora: rota com o id, motivo sem espaços nas pontas; resposta lida", async () => {
    post.mockResolvedValue({
      data: { data: { repasseId: "rep-1", vacancyId: "vac-1", status: "COMPLETED", failureReason: null } },
    });

    const result = await releaseHeldRepasse("rep/1", { reason: "  Freelancer pediu  " });
    expect(post).toHaveBeenCalledWith("/repasses/rep%2F1/release", { reason: "Freelancer pediu" });
    expect(result).toEqual({ repasseId: "rep-1", vacancyId: "vac-1", status: "COMPLETED", failureReason: null });
  });

  it("pagar agora: 409 sobe como erro (quem chama traduz)", async () => {
    post.mockRejectedValue(axiosError(409, { error: { code: "REPASSE_ALREADY_RELEASED", message: "x" } }));
    await expect(releaseHeldRepasse("rep-1", { reason: "Freelancer pediu" })).rejects.toBeInstanceOf(AxiosError);
  });
});

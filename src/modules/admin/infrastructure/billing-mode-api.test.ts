import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, patch } = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));

vi.mock("@/modules/shared/infrastructure/authed-client", () => ({
  createAuthedClient: () => ({ get, patch }),
}));

import { apiErrorOf } from "./api-error";
import { getBillingModeSettings, updateBillingMode } from "./billing-mode-api";

/** Erro do axios com o corpo que o filtro global da API manda. */
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

describe("billing-mode-api", () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ data: { data: { mode: "PREPAID" } } });
    patch.mockReset().mockResolvedValue({ data: { data: { mode: "INVOICED_7" } } });
  });

  it("GET e PATCH em /billing/contractors/:userId[/mode]", async () => {
    await getBillingModeSettings("u 1");
    expect(get).toHaveBeenCalledWith("/billing/contractors/u%201");

    await updateBillingMode("u/1", { billingMode: "INVOICED_7", reason: "Contrato assinado" });
    expect(patch).toHaveBeenCalledWith("/billing/contractors/u%2F1/mode", {
      billingMode: "INVOICED_7",
      reason: "Contrato assinado",
    });
  });

  it("desembrulha `res.data.data`", async () => {
    await expect(getBillingModeSettings("u1")).resolves.toEqual({ mode: "PREPAID" });
    await expect(
      updateBillingMode("u1", { billingMode: "INVOICED_7", reason: "motivo" }),
    ).resolves.toEqual({ mode: "INVOICED_7" });
  });

  it("PATCH manda só os campos mudados + reason; e-mail vazio vira null", async () => {
    await updateBillingMode("u1", { billingEmail: "  ", reason: " Cliente pediu " });
    expect(patch).toHaveBeenLastCalledWith("/billing/contractors/u1/mode", {
      billingEmail: null,
      reason: "Cliente pediu",
    });

    await updateBillingMode("u1", { billingEmail: " contas@bar.com.br ", reason: "Cliente pediu" });
    expect(patch).toHaveBeenLastCalledWith("/billing/contractors/u1/mode", {
      billingEmail: "contas@bar.com.br",
      reason: "Cliente pediu",
    });
  });
});

describe("apiErrorOf", () => {
  it("lê status, code, message e os campos extras do corpo `{ error }` da API", () => {
    const err = axiosError(422, {
      error: {
        code: "BILLING_REQUIRES_COMPANY_DATA",
        message: "Para faturar, complete o cadastro: número do endereço.",
        missing: ["number"],
      },
    });
    expect(apiErrorOf(err)).toEqual({
      status: 422,
      code: "BILLING_REQUIRES_COMPANY_DATA",
      message: "Para faturar, complete o cadastro: número do endereço.",
      extra: { missing: ["number"] },
    });
  });

  it("aceita o corpo plano `{ code, message }` e erro sem resposta", () => {
    expect(apiErrorOf(axiosError(409, { code: "INVOICE_NOT_OPEN", message: "Paga." }))).toEqual({
      status: 409,
      code: "INVOICE_NOT_OPEN",
      message: "Paga.",
      extra: {},
    });
    expect(apiErrorOf(new Error("rede"))).toEqual({
      status: null,
      code: null,
      message: null,
      extra: {},
    });
  });
});

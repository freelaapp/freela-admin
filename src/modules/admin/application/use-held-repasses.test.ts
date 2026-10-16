import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { heldRefetchInterval } from "./use-held-repasses";

function axiosError(status: number): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError("falhou", String(status), config, null, {
    status,
    statusText: "",
    headers: {},
    config,
    data: {},
  });
}

describe("recarga periódica da lista dos retidos", () => {
  it("a cada minuto; para quando a rota dá 404 (API ainda sem o #603)", () => {
    expect(heldRefetchInterval(null)).toBe(60000);
    expect(heldRefetchInterval(axiosError(500))).toBe(60000);
    expect(heldRefetchInterval(axiosError(404))).toBe(false);
  });
});

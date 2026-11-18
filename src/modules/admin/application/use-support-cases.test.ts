import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";

vi.mock("../infrastructure/support-cases-api", () => ({
  listSupportCases: vi.fn(),
  getSupportCase: vi.fn(),
  assumeSupportCase: vi.fn(),
  recordSupportContact: vi.fn(),
  closeSupportCase: vi.fn(),
}));

import {
  SUPPORT_QUEUE_POLL_MS,
  supportCasesQueryOptions,
} from "./use-support-cases";

function featureDisabled() {
  return new AxiosError("404", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 404,
    statusText: "",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code: "FEATURE_DISABLED", message: "x" } },
  });
}

/** O pedaço da `Query` que as funções de ritmo leem. */
const queryWith = (error: unknown) => ({ state: { error } }) as never;

describe("ritmo de atualização da fila do suporte (noite 17→18/11, C3)", () => {
  const options = supportCasesQueryOptions("open", true);

  it("a cada 30 s, recarrega ao voltar para a aba e considera a lista velha depois de 15 s", () => {
    expect(SUPPORT_QUEUE_POLL_MS).toBe(30_000);
    const interval = options.refetchInterval as (q: never) => number | false;
    const onFocus = options.refetchOnWindowFocus as (q: never) => boolean;
    expect(interval(queryWith(null))).toBe(30_000);
    expect(onFocus(queryWith(null))).toBe(true);
    expect(options.staleTime).toBe(15_000);
    expect(options.queryKey).toEqual(["admin", "support-cases", "list", "open"]);
  });

  it("chave da API desligada (404 FEATURE_DISABLED): não insiste nem no relógio nem no foco", () => {
    const interval = options.refetchInterval as (q: never) => number | false;
    const onFocus = options.refetchOnWindowFocus as (q: never) => boolean;
    expect(interval(queryWith(featureDisabled()))).toBe(false);
    expect(onFocus(queryWith(featureDisabled()))).toBe(false);
    // Erro de rede comum continua no ritmo normal.
    expect(interval(queryWith(new Error("Network Error")))).toBe(30_000);
  });
});

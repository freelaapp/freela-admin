import { describe, expect, it } from "vitest";
import { queueFilterFromParams, queueFilterToParams } from "./queue-filters";

describe("filtro da Fila na URL", () => {
  it("URL vazia: pendentes que acessaram nos últimos 30 dias", () => {
    expect(queueFilterFromParams(new URLSearchParams(""))).toEqual({
      status: "PENDING",
      activeWithinDays: 30,
    });
  });

  it("lê todos os campos", () => {
    const sp = new URLSearchParams(
      "situacao=APPROVED&uf=SP&cidade=Campinas&funcao=Garçom&cadastroDe=2026-10-01&cadastroAte=2026-10-31&jaTrabalhou=sim&ativoEm=0&faltas=NONE&convocado=EVER&pediuAviso=sim",
    );
    expect(queueFilterFromParams(sp)).toEqual({
      status: "APPROVED",
      uf: "SP",
      city: "Campinas",
      role: "Garçom",
      signedUpFrom: "2026-10-01",
      signedUpTo: "2026-10-31",
      workedBefore: true,
      activeWithinDays: 0,
      noShows: "NONE",
      convoked: "EVER",
      notifyRequested: true,
    });
  });

  it("situacao=TODAS não existe: cai em pendente; jaTrabalhou=nao vira false", () => {
    const f = queueFilterFromParams(new URLSearchParams("situacao=TODAS&jaTrabalhou=nao"));
    expect(f.status).toBe("PENDING");
    expect(f.workedBefore).toBe(false);
  });

  it("ativoEm fica entre 1 e 365 (0 = sem filtro); UF só com 2 letras", () => {
    const days = (v: string) => queueFilterFromParams(new URLSearchParams(`ativoEm=${v}`)).activeWithinDays;
    expect(days("0")).toBe(0);
    expect(days("999")).toBe(365);
    expect(days("365")).toBe(365);
    expect(days("45")).toBe(45);
    expect(queueFilterFromParams(new URLSearchParams("uf=SPX")).uf).toBeUndefined();
    expect(queueFilterFromParams(new URLSearchParams("uf=s1")).uf).toBeUndefined();
  });

  it("valor inválido cai no padrão", () => {
    const f = queueFilterFromParams(
      new URLSearchParams("situacao=XX&ativoEm=abc&faltas=Z&convocado=Q&cadastroDe=ontem&uf=sp"),
    );
    expect(f).toEqual({ status: "PENDING", activeWithinDays: 30, uf: "SP" });
  });

  it("ida e volta; só grava na URL o que foge do padrão", () => {
    expect(queueFilterToParams({ status: "PENDING", activeWithinDays: 30 }).toString()).toBe("");
    const f = {
      status: "BOOKED" as const,
      uf: "SP",
      city: "Valinhos",
      activeWithinDays: 0,
      workedBefore: false,
      notifyRequested: true,
    };
    const back = queueFilterFromParams(queueFilterToParams(f));
    expect(back).toEqual(f);
  });
});

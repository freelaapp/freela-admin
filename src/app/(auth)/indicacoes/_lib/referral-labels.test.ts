import { describe, expect, it } from "vitest";

import type { ReferralItem, ReferredAccount } from "@/modules/admin/infrastructure/referrals-api";
import { describeSituation, empresaStepIndex, rejectionLabel } from "./referral-labels";

const account = (over: Partial<ReferredAccount> = {}): ReferredAccount => ({
  kind: "SEM_PERFIL",
  stage: "SO_LOGIN",
  pendingReason: "SO_LOGIN",
  deadline: "2026-11-03T12:00:00.000Z",
  profiles: { empresa: false, casa: false, freelancer: false },
  company: null,
  vacancies: 0,
  lastVacancyAt: null,
  hires: 0,
  completedJobs: 0,
  firstCompletedJob: null,
  ...over,
});

const item = (over: Partial<ReferralItem> = {}): ReferralItem => ({
  id: "ref-1",
  status: "REGISTERED",
  rejectionReason: null,
  createdAt: "2026-10-04T12:00:00.000Z",
  qualifiedAt: null,
  qualifyingModule: null,
  code: { code: "MEIRIEWJHM" },
  referrer: { id: "f-1", phone: null, email: null, profile: { name: "Meiriele" } },
  referred: { id: "u-1", phone: null, email: "b@x.com", profile: { name: "Beatriz" } },
  reward: null,
  referredAccount: account(),
  ...over,
});

describe("describeSituation", () => {
  it("explica que quem parou no 1º passo só aparece em Usuários", () => {
    const situation = describeSituation(item());
    expect(situation.label).toBe("Parou no 1º passo do cadastro");
    expect(situation.detail).toContain("só em Usuários");
  });

  it("vaga concluída abaixo do piso aparece como tal (caso do teste do dono)", () => {
    const situation = describeSituation(
      item({
        referredAccount: account({
          kind: "EMPRESA",
          stage: "CONCLUIU",
          pendingReason: "VAGA_ABAIXO_DO_MINIMO",
        }),
      }),
    );
    expect(situation.label).toBe("Vaga abaixo de R$ 80");
    expect(situation.tone).toBe("warn");
  });

  it("recusa do erro de persona diz que era empresa quando era", () => {
    const situation = describeSituation(
      item({
        status: "REJECTED",
        rejectionReason: "INDICADO_NAO_E_CONTRATANTE_EMPRESA",
        rejectedByPersonaBug: true,
        referredAccount: account({ kind: "EMPRESA", pendingReason: null }),
      }),
    );
    expect(situation.label).toBe("Rejeitada por erro (era empresa)");
    expect(situation.detail).toContain("28/09/2026");
  });

  it("recusa de verdade usa o motivo em português", () => {
    const situation = describeSituation(
      item({ status: "REJECTED", rejectionReason: "TELEFONE_IGUAL_AO_DO_INDICADOR" }),
    );
    expect(situation.label).toBe("Mesmo telefone de quem indicou");
  });

  it("sem dados novos da API (janela de deploy) cai em 'Cadastrou'", () => {
    expect(describeSituation(item({ referredAccount: undefined })).label).toBe("Cadastrou");
  });

  it("qualificada é verde", () => {
    expect(describeSituation(item({ status: "QUALIFIED" })).tone).toBe("ok");
  });
});

describe("empresaStepIndex", () => {
  it("posiciona o caminho da empresa e tira do caminho freelancer/Em Casa", () => {
    expect(empresaStepIndex("SO_LOGIN")).toBe(0);
    expect(empresaStepIndex("PUBLICOU_VAGA")).toBe(2);
    expect(empresaStepIndex("CONCLUIU")).toBe(4);
    expect(empresaStepIndex("PERFIL_FREELANCER")).toBeNull();
    expect(empresaStepIndex("PERFIL_CASA")).toBeNull();
  });
});

describe("rejectionLabel", () => {
  it("mantém o código quando não conhece o motivo", () => {
    expect(rejectionLabel("MOTIVO_NOVO")).toBe("MOTIVO_NOVO");
    expect(rejectionLabel(null)).toBe("Rejeitada");
  });
});

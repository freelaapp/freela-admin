import { describe, expect, it } from "vitest";

import type { SignupOrigin } from "@/modules/admin/infrastructure/admin-api";
import {
  NORMAL_SIGNUP_TEXT,
  formatSignupOrigin,
  signupOriginLabels,
} from "./signup-origin-presentation";

const EMPTY: SignupOrigin = {
  referral: null,
  consultant: null,
  partnership: null,
  campaign: null,
  social: null,
  channel: null,
  utm: null,
};

const texts = (origin: Partial<SignupOrigin>) =>
  signupOriginLabels({ signupOrigin: { ...EMPTY, ...origin } }).map((l) => l.text);

describe("signupOriginLabels", () => {
  it("todas as fontes, na ordem da spec", () => {
    expect(
      texts({
        referral: { referrerName: "Maria", code: "MARIA4F2K", status: "QUALIFIED" },
        consultant: { id: "c1", name: "João" },
        partnership: { id: "p1", name: "Colibri" },
        campaign: { id: "k1", name: "Reativação set" },
        utm: { source: "instagram", medium: "social", campaign: "promo-setembro" },
        social: "google",
        channel: "app",
      }),
    ).toEqual([
      "Indicação: Maria · qualificou",
      "Consultor: João",
      "Parceria: Colibri",
      "Campanha: Reativação set",
      "UTM: instagram / promo-setembro",
      "Google",
      "App",
    ]);
  });

  it("status da indicação em português; sem nome do indicador usa o código", () => {
    expect(texts({ referral: { referrerName: "Maria", code: "M1", status: "REGISTERED" } })).toEqual([
      "Indicação: Maria · cadastrou",
    ]);
    expect(texts({ referral: { referrerName: null, code: "ZE7K2P", status: "REJECTED" } })).toEqual([
      "Indicação: ZE7K2P · não contou",
    ]);
  });

  it("Apple, Site e Importação", () => {
    expect(texts({ social: "apple", channel: "web" })).toEqual(["Apple", "Site"]);
    expect(texts({ channel: "import" })).toEqual(["Importação"]);
  });

  it("UTM: source / campaign; só medium → medium; tudo nulo → sem etiqueta", () => {
    expect(texts({ utm: { source: "instagram", medium: null, campaign: null } })).toEqual(["UTM: instagram"]);
    expect(texts({ utm: { source: null, medium: "cpc", campaign: null } })).toEqual(["UTM: cpc"]);
    expect(texts({ utm: { source: null, medium: null, campaign: null } })).toEqual([NORMAL_SIGNUP_TEXT]);
  });

  it("sem nenhuma origem → 'Cadastro normal'", () => {
    expect(texts({})).toEqual(["Cadastro normal"]);
  });
});

describe("formatSignupOrigin — API antiga (sem signupOrigin) mantém o texto de hoje", () => {
  it("parceria + consultor com código", () => {
    expect(
      formatSignupOrigin({
        referredByPartnership: { name: "Colibri", code: "COLIBRI" },
        referredByConsultant: { name: "André", code: "ANDRE2K" },
      }),
    ).toBe("Parceria: Colibri (COLIBRI) · Consultor: André (ANDRE2K)");
  });

  it("nada → '—' (não 'Cadastro normal')", () => {
    expect(formatSignupOrigin({})).toBe("—");
    expect(formatSignupOrigin({ signupOrigin: null })).toBe("—");
  });

  it("API nova: junta as etiquetas com ' · '", () => {
    expect(formatSignupOrigin({ signupOrigin: { ...EMPTY, social: "google", channel: "web" } })).toBe(
      "Google · Site",
    );
  });
});

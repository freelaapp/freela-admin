import { describe, expect, it } from "vitest";
import { buildReferralLink, deriveWebAppBaseUrl } from "./referral-link";

describe("deriveWebAppBaseUrl", () => {
  it("prefers the explicit web app URL and trims trailing slashes", () => {
    expect(deriveWebAppBaseUrl({ webAppUrl: "https://app.freela.dev/", apiUrl: "x" })).toBe(
      "https://app.freela.dev",
    );
  });

  it("derives the base from the API URL by dropping the api. subdomain", () => {
    expect(deriveWebAppBaseUrl({ apiUrl: "https://api.freelaservicosapp.com.br" })).toBe(
      "https://freelaservicosapp.com.br",
    );
  });

  it("returns empty string when nothing is configured", () => {
    expect(deriveWebAppBaseUrl({})).toBe("");
  });
});

describe("buildReferralLink", () => {
  it("builds an absolute link from the derived base", () => {
    expect(buildReferralLink("ANDRE2K", { apiUrl: "https://api.freela.dev" })).toBe(
      "https://freela.dev/cadastro?ref=ANDRE2K",
    );
  });

  it("falls back to a relative path when no base is available", () => {
    expect(buildReferralLink("ANDRE2K", {})).toBe("/cadastro?ref=ANDRE2K");
  });

  it("url-encodes the code", () => {
    expect(buildReferralLink("A B&C", { webAppUrl: "https://x.dev" })).toBe(
      "https://x.dev/cadastro?ref=A%20B%26C",
    );
  });
});

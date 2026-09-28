import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SignupOrigin } from "@/modules/admin/infrastructure/admin-api";
import { SignupOriginBadges } from "./signup-origin-badges";

const EMPTY: SignupOrigin = {
  referral: null,
  consultant: null,
  partnership: null,
  campaign: null,
  social: null,
  channel: null,
  utm: null,
};

describe("SignupOriginBadges", () => {
  it("uma etiqueta por origem, na ordem", () => {
    const { container } = render(
      <SignupOriginBadges
        source={{
          signupOrigin: {
            ...EMPTY,
            referral: { referrerName: "Maria", code: "MARIA4F2K", status: "QUALIFIED" },
            social: "google",
            channel: "app",
          },
        }}
      />,
    );
    const labels = Array.from(container.querySelectorAll("[data-signup-origin]")).map((el) => el.textContent);
    expect(labels).toEqual(["Indicação: Maria · qualificou", "Google", "App"]);
  });

  it("'Cadastro normal' em cinza", () => {
    render(<SignupOriginBadges source={{ signupOrigin: EMPTY }} />);
    expect(screen.getByText("Cadastro normal")).toHaveClass("bg-[#e5e5e5]");
  });

  it("API antiga: mostra o texto de hoje", () => {
    render(<SignupOriginBadges source={{ referredByPartnership: { name: "Colibri", code: "COLIBRI" } }} />);
    expect(screen.getByText("Parceria: Colibri (COLIBRI)")).toBeInTheDocument();
  });

  it("etiqueta longa quebra linha em vez de empurrar a tela para o lado (celular 360px)", () => {
    const longCampaign = "promo_setembro_2026_whatsapp_grupos_vip_redes_grandes_sem_espaco";
    const { container } = render(
      <SignupOriginBadges
        source={{
          signupOrigin: {
            ...EMPTY,
            referral: {
              referrerName: "Maria Aparecida dos Santos Oliveira de Albuquerque",
              code: "MARIA4F2K",
              status: "QUALIFIED",
            },
            utm: { source: "instagram", medium: null, campaign: longCampaign },
          },
        }}
      />,
    );
    const list = container.firstElementChild as HTMLElement;
    expect(list).toHaveClass("flex", "flex-wrap", "min-w-0");
    const badges = Array.from(container.querySelectorAll<HTMLElement>("[data-signup-origin]"));
    expect(badges.map((el) => el.textContent)).toEqual([
      "Indicação: Maria Aparecida dos Santos Oliveira de Albuquerque · qualificou",
      expect.stringContaining(longCampaign),
    ]);
    for (const badge of badges) {
      expect(badge).not.toHaveClass("whitespace-nowrap");
      // overflow-wrap:anywhere também quebra UTM sem espaço (break-words não
      // encolhe o min-content dentro do inline-flex do Badge).
      expect(badge).toHaveClass("max-w-full", "wrap-anywhere");
    }
  });

  it("API antiga sem origem: traço discreto", () => {
    render(<SignupOriginBadges source={{}} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

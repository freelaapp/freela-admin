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

  it("API antiga sem origem: traço discreto", () => {
    render(<SignupOriginBadges source={{}} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

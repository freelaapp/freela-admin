import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChoicePills } from "./choice-pills";

const OPTIONS = [
  { value: "FREE", label: "Grátis" },
  { value: "BASIC", label: "Básico" },
] as const;

describe("ChoicePills", () => {
  it("marca a opção atual e troca ao clicar em outra", () => {
    const onChange = vi.fn();
    render(<ChoicePills options={[...OPTIONS]} value="FREE" onChange={onChange} aria-label="Plano" />);

    expect(screen.getByRole("radio", { name: "Grátis" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Básico" }));
    expect(onChange).toHaveBeenCalledWith("BASIC");
  });

  it("clicar na opção já marcada não dispara onChange (evita mutação à toa)", () => {
    const onChange = vi.fn();
    render(<ChoicePills options={[...OPTIONS]} value="FREE" onChange={onChange} aria-label="Plano" />);
    fireEvent.click(screen.getByRole("radio", { name: "Grátis" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("desabilitado não troca", () => {
    const onChange = vi.fn();
    render(<ChoicePills options={[...OPTIONS]} value="FREE" onChange={onChange} disabled aria-label="Plano" />);
    fireEvent.click(screen.getByRole("radio", { name: "Básico" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

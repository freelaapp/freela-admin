import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("'lost' vira 'Vencida' em cinza", () => {
    render(<StatusBadge status="lost" />);
    expect(screen.getByText("Vencida")).toHaveClass("bg-[#e5e5e5]");
  });

  it("status existentes não mudam", () => {
    render(<StatusBadge status="open" />);
    expect(screen.getByText("Aberto")).toBeInTheDocument();
  });
});

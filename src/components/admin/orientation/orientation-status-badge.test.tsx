import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrientationStatusBadge } from "./orientation-status-badge";

describe("OrientationStatusBadge", () => {
  it("aprovado", () => {
    render(<OrientationStatusBadge status="APPROVED" />);
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
  });
  it("reprovado e pendente", () => {
    const { rerender } = render(<OrientationStatusBadge status="REJECTED" />);
    expect(screen.getByText("Reprovado")).toBeInTheDocument();
    rerender(<OrientationStatusBadge status="PENDING" />);
    expect(screen.getByText("Pendente")).toBeInTheDocument();
  });
  it("null = pendente com explicação", () => {
    render(<OrientationStatusBadge status={null} />);
    expect(screen.getByText("Pendente")).toHaveAttribute("title", "Sem identidade global (cadastro antigo)");
  });
  it("undefined = traço", () => {
    render(<OrientationStatusBadge status={undefined} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

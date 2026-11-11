import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReasonPrompt } from "./reason-prompt";

function setup(over: Partial<Parameters<typeof ReasonPrompt>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ReasonPrompt
      title="Corrigir resultado"
      consequence="A pessoa volta a ficar pendente."
      confirmLabel="Corrigir"
      pending={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...over}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ReasonPrompt", () => {
  it("mostra título e consequência; textarea limita em 500", () => {
    setup();
    expect(screen.getByText("Corrigir resultado")).toBeInTheDocument();
    expect(screen.getByText("A pessoa volta a ficar pendente.")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("maxlength", "500");
  });

  it("confirmar fica desativado com só espaços", () => {
    const { onConfirm } = setup();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    const btn = screen.getByRole("button", { name: "Corrigir" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("com texto chama onConfirm com o motivo aparado", () => {
    const { onConfirm } = setup();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: " pediu " } });
    fireEvent.click(screen.getByRole("button", { name: "Corrigir" }));
    expect(onConfirm).toHaveBeenCalledWith("pediu");
  });

  it("voltar chama onCancel; pending desativa os botões", () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("pending desativa confirmar e voltar", () => {
    setup({ pending: true });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    expect(screen.getByRole("button", { name: "Corrigir" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
  });
});

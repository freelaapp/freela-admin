import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent, DialogFooter } from "./dialog";

describe("Dialog — fechar pelo overlay", () => {
  it("fecha quando o clique começa e termina no overlay", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>conteúdo</DialogContent>
      </Dialog>,
    );
    const overlay = screen.getByTestId("dialog-overlay");
    fireEvent.pointerDown(overlay);
    fireEvent.click(overlay);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ignora o clique solto no overlay (escolha num <select> nativo dentro do diálogo)", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <select aria-label="plano" defaultValue="a">
            <option value="a">A</option>
            <option value="b">B</option>
          </select>
        </DialogContent>
      </Dialog>,
    );
    const select = screen.getByLabelText("plano");
    fireEvent.pointerDown(select);
    fireEvent.change(select, { target: { value: "b" } });
    // O popup nativo fecha e o browser entrega o click ao que está sob o ponteiro.
    fireEvent.click(screen.getByTestId("dialog-overlay"));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("não renderiza nada fechado", () => {
    render(
      <Dialog open={false} onOpenChange={() => {}}>
        <DialogContent>conteúdo</DialogContent>
      </Dialog>,
    );
    expect(screen.queryByTestId("dialog-overlay")).not.toBeInTheDocument();
  });
});

describe("DialogFooter", () => {
  // O diálogo tem largura fixa (max-w-lg). Com 4 botões ("Finalizar e pagar",
  // "Cancelar Vaga", "Reiniciar (no-show)", "Fechar" no detalhe da vaga) a
  // linha não cabia; sem quebra, o `justify-end` empurrava o excesso para a
  // ESQUERDA e o primeiro botão sumia cortado (28/09/2026). jsdom não mede
  // layout, então o teste trava a regra: o rodapé quebra linha por padrão.
  it("quebra os botões em linhas quando não cabem", () => {
    render(
      <DialogFooter>
        <button>Um</button>
        <button>Dois</button>
      </DialogFooter>,
    );
    expect(screen.getByText("Um").parentElement).toHaveClass("flex-wrap");
  });

  it("mantém o className de quem chama", () => {
    render(
      <DialogFooter className="sm:justify-between">
        <button>Um</button>
      </DialogFooter>,
    );
    const footer = screen.getByText("Um").parentElement;
    expect(footer).toHaveClass("flex-wrap");
    expect(footer).toHaveClass("sm:justify-between");
  });
});

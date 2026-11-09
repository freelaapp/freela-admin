import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ArrivalSignalLine } from "./arrival-signal-line";

describe("ArrivalSignalLine", () => {
  it("mostra o texto pronto da API em uma linha", () => {
    render(<ArrivalSignalLine signal={{ text: "Chegou às 17h32, a 80 m (app)" }} />);
    expect(screen.getByTestId("arrival-signal")).toHaveTextContent("Chegou às 17h32, a 80 m (app)");
  });

  it("mostra também o registro aproximado e o sem leitura", () => {
    const { rerender } = render(
      <ArrivalSignalLine
        signal={{ text: "Registro aproximado às 17h32, a cerca de 320 m do ponto da vaga (raio ampliado de 500 m) (site)" }}
      />,
    );
    expect(screen.getByTestId("arrival-signal")).toHaveTextContent(/Registro aproximado às 17h32/);
    rerender(<ArrivalSignalLine signal={{ text: "Sem leitura às 17h32: permissão de localização negada (app)" }} />);
    expect(screen.getByTestId("arrival-signal")).toHaveTextContent(/Sem leitura às 17h32/);
  });

  it.each([[undefined], [null], [{ text: "" }], [{ text: "   " }]])("sem dado (%j): nada aparece", (signal) => {
    const { container } = render(<ArrivalSignalLine signal={signal as never} />);
    expect(container).toBeEmptyDOMElement();
  });
});

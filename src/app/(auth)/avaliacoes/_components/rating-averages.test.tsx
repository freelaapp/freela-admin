import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RatingAverages } from "./rating-averages";

/** O cartão inteiro a partir do título (o título fica 2 níveis abaixo do Card). */
function cardOf(title: string): HTMLElement {
  const card = screen.getByText(title).parentElement?.parentElement;
  if (!card) throw new Error(`cartão "${title}" não encontrado`);
  return card;
}

describe("RatingAverages", () => {
  it("mostra a média de cada lado com quantidade, módulo, conta e fonte", () => {
    render(
      <RatingAverages
        moduleLabel="Bares e Restaurantes"
        feedbacks={[
          { role: "CONTRACTOR", rating: 5 },
          { role: "CONTRACTOR", rating: 4 },
          { role: "CONTRACTOR", rating: 3 },
          { role: "PROVIDER", rating: 2 },
          { role: "PROVIDER", rating: 5 },
        ]}
      />,
    );

    const freelancers = within(cardOf("Nota média dos freelancers"));
    expect(freelancers.getByText("4,00")).toBeInTheDocument();
    expect(
      freelancers.getByText("Nota dada por contratantes · 3 avaliações · Bares e Restaurantes"),
    ).toBeInTheDocument();
    expect(
      freelancers.getByText("Conta: soma das 3 notas (12) ÷ 3 avaliações = 4,00"),
    ).toBeInTheDocument();
    expect(freelancers.getByText(/^Fonte: todas as avaliações de Bares e Restaurantes escritas por contratantes/)).toBeInTheDocument();

    const contratantes = within(cardOf("Nota média dos contratantes"));
    expect(contratantes.getByText("3,50")).toBeInTheDocument();
    expect(
      contratantes.getByText("Nota dada por freelancers · 2 avaliações · Bares e Restaurantes"),
    ).toBeInTheDocument();
    expect(
      contratantes.getByText("Conta: soma das 2 notas (7) ÷ 2 avaliações = 3,50"),
    ).toBeInTheDocument();
  });

  it("módulo sem avaliações: travessão no lugar da nota, nunca zero", () => {
    render(<RatingAverages moduleLabel="Freela em Casa" feedbacks={[]} />);

    const freelancers = within(cardOf("Nota média dos freelancers"));
    expect(freelancers.getByText("—")).toBeInTheDocument();
    expect(
      freelancers.getByText("Nota dada por contratantes · 0 avaliações · Freela em Casa"),
    ).toBeInTheDocument();
    expect(
      freelancers.getByText("Conta: nenhuma avaliação nesta direção ainda, então não há média"),
    ).toBeInTheDocument();
  });
});

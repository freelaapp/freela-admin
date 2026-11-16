import { describe, expect, it } from "vitest";

import {
  describeAverageCalc,
  formatAverage,
  formatReviewCount,
  summarizeReceivedRatings,
} from "./rating-summary";

describe("summarizeReceivedRatings", () => {
  it("separa pela direção: quem ESCREVEU é o papel, quem recebeu é a outra ponta", () => {
    const resumo = summarizeReceivedRatings([
      // Contratante escreveu → nota recebida pelo freelancer.
      { role: "CONTRACTOR", rating: 5 },
      { role: "CONTRACTOR", rating: 4 },
      { role: "CONTRACTOR", rating: 3 },
      // Freelancer escreveu → nota recebida pelo contratante.
      { role: "PROVIDER", rating: 2 },
      { role: "PROVIDER", rating: 5 },
    ]);

    expect(resumo.freelancers).toEqual({ count: 3, sum: 12, average: 4 });
    expect(resumo.contractors).toEqual({ count: 2, sum: 7, average: 3.5 });
  });

  it("sem avaliação numa direção: zero na quantidade e média nula (não zero)", () => {
    const resumo = summarizeReceivedRatings([{ role: "PROVIDER", rating: 4 }]);

    expect(resumo.freelancers).toEqual({ count: 0, sum: 0, average: null });
    expect(resumo.contractors).toEqual({ count: 1, sum: 4, average: 4 });
  });

  it("lista vazia não divide por zero", () => {
    const resumo = summarizeReceivedRatings([]);

    expect(resumo.freelancers.average).toBeNull();
    expect(resumo.contractors.average).toBeNull();
  });

  it("ignora papel desconhecido e nota que não é número", () => {
    const resumo = summarizeReceivedRatings([
      { role: "ADMIN", rating: 1 },
      { role: "CONTRACTOR", rating: Number.NaN },
      { role: "CONTRACTOR", rating: null as unknown as number },
      { role: "CONTRACTOR", rating: 5 },
    ]);

    expect(resumo.freelancers).toEqual({ count: 1, sum: 5, average: 5 });
    expect(resumo.contractors.count).toBe(0);
  });
});

describe("formatAverage", () => {
  it("duas casas com vírgula, como no Dashboard", () => {
    expect(formatAverage(4.6189)).toBe("4,62");
    expect(formatAverage(5)).toBe("5,00");
  });

  it("sem média vira travessão", () => {
    expect(formatAverage(null)).toBe("—");
  });
});

describe("formatReviewCount", () => {
  it("singular e plural", () => {
    expect(formatReviewCount(0)).toBe("0 avaliações");
    expect(formatReviewCount(1)).toBe("1 avaliação");
    expect(formatReviewCount(152)).toBe("152 avaliações");
  });
});

describe("describeAverageCalc", () => {
  it("mostra as parcelas: soma ÷ quantidade = média", () => {
    expect(describeAverageCalc({ count: 3, sum: 12, average: 4 })).toBe(
      "soma das 3 notas (12) ÷ 3 avaliações = 4,00",
    );
  });

  it("uma avaliação só: singular", () => {
    expect(describeAverageCalc({ count: 1, sum: 5, average: 5 })).toBe(
      "soma da 1 nota (5) ÷ 1 avaliação = 5,00",
    );
  });

  it("soma quebrada sai com vírgula", () => {
    expect(describeAverageCalc({ count: 2, sum: 8.5, average: 4.25 })).toBe(
      "soma das 2 notas (8,5) ÷ 2 avaliações = 4,25",
    );
  });

  it("sem avaliações explica que não há conta", () => {
    expect(describeAverageCalc({ count: 0, sum: 0, average: null })).toBe(
      "nenhuma avaliação nesta direção ainda, então não há média",
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  ageLabel,
  initialsOf,
  locationLabel,
  parseCurriculum,
  ratingLabel,
  scoreTone,
  servicesLabel,
} from "./candidate-presentation";

describe("textos do candidato", () => {
  it("nota: com avaliações mostra média e quantidade; sem nenhuma, não inventa zero", () => {
    expect(ratingLabel({ averageRating: 4.75, totalRatings: 8 })).toBe("4,8 · 8 avaliações");
    expect(ratingLabel({ averageRating: 5, totalRatings: 1 })).toBe("5,0 · 1 avaliação");
    expect(ratingLabel({ averageRating: null, totalRatings: 0 })).toBe("Sem avaliações");
    expect(ratingLabel({ averageRating: 0, totalRatings: 0 })).toBe("Sem avaliações");
  });

  it("serviços e idade, no singular e no plural", () => {
    expect(servicesLabel(0)).toBe("Nenhum serviço ainda");
    expect(servicesLabel(1)).toBe("1 serviço");
    expect(servicesLabel(6)).toBe("6 serviços");
    expect(ageLabel(24)).toBe("24 anos");
    expect(ageLabel(null)).toBeNull();
  });

  it("local: km só quando a API mandou; senão o bairro, que é o que se sabe", () => {
    expect(
      locationLabel({ distanceInKm: 6.3, neighborhood: "Bela Vista", city: "São Paulo", uf: "SP" }),
    ).toBe("Bela Vista, São Paulo – SP · 6,3 km da vaga");
    expect(
      locationLabel({ distanceInKm: null, neighborhood: "Parque Bologne", city: "São Paulo", uf: "SP" }),
    ).toBe("Parque Bologne, São Paulo – SP");
    expect(locationLabel({ distanceInKm: 2, neighborhood: null, city: null, uf: null })).toBe(
      "2,0 km da vaga",
    );
    expect(locationLabel({ distanceInKm: null, neighborhood: " ", city: null, uf: null })).toBeNull();
  });

  it("faixas do score e iniciais do avatar", () => {
    expect(scoreTone(87)).toBe("good");
    expect(scoreTone(60)).toBe("warn");
    expect(scoreTone(31)).toBe("bad");
    expect(initialsOf("Ester Amaral")).toBe("EA");
    expect(initialsOf("Ketille Juliane Gomes da Silva")).toBe("KS");
    expect(initialsOf("  ")).toBe("?");
  });
});

describe("parseCurriculum", () => {
  it("lê o formato do app e descarta linhas em branco", () => {
    const parsed = parseCurriculum({
      experiences: [
        { workplace: "Spoleto", role: "Atendente", durationLabel: "1 ano" },
        { workplace: " ", role: "", durationLabel: "" },
      ],
      courses: [{ title: "Boas práticas", durationLabel: "8 h", completionYear: 2024 }],
      skills: " Atendimento ao público ",
      competitiveEdge: "",
    });

    expect(parsed.experiences).toEqual([
      { workplace: "Spoleto", role: "Atendente", durationLabel: "1 ano" },
    ]);
    expect(parsed.courses).toEqual([
      { title: "Boas práticas", durationLabel: "8 h", completionYear: "2024" },
    ]);
    expect(parsed.skills).toBe("Atendimento ao público");
    expect(parsed.isEmpty).toBe(false);
  });

  it("nulo, texto solto ou formato inesperado viram currículo vazio, sem quebrar", () => {
    expect(parseCurriculum(null).isEmpty).toBe(true);
    expect(parseCurriculum("qualquer coisa").isEmpty).toBe(true);
    expect(parseCurriculum({ experiences: "não é lista", courses: [null, 3] }).isEmpty).toBe(true);
  });
});

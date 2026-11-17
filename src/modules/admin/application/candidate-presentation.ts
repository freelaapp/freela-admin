import type { VacancyCandidacyProvider } from "../infrastructure/admin-api";

/**
 * Como os dados do candidato viram texto no painel. Puras: o cartão da lista e
 * o diálogo do perfil têm de dizer a mesma coisa, com as mesmas palavras.
 */

const decimal = (value: number, digits = 1) => value.toFixed(digits).replace(".", ",");

/** "★ 4,8 · 8 avaliações" ou, sem nenhuma, "Sem avaliações" (0 não é nota). */
export function ratingLabel(p: Pick<VacancyCandidacyProvider, "averageRating" | "totalRatings">): string {
  if (p.averageRating === null || p.totalRatings <= 0) return "Sem avaliações";
  return `${decimal(p.averageRating)} · ${p.totalRatings} ${p.totalRatings === 1 ? "avaliação" : "avaliações"}`;
}

/** "6 serviços" — os concluídos na janela recente, o mesmo número que a empresa vê. */
export function servicesLabel(completed: number): string {
  if (completed <= 0) return "Nenhum serviço ainda";
  return `${completed} ${completed === 1 ? "serviço" : "serviços"}`;
}

export function ageLabel(age: number | null): string | null {
  return age === null ? null : `${age} ${age === 1 ? "ano" : "anos"}`;
}

/**
 * Onde o candidato mora em relação à vaga. O km só aparece quando a API mandou
 * (os dois endereços são de rua); senão fica o bairro, que é o que se sabe.
 * Com a distância nova (`distance`, quando a API liga os níveis), vale o mesmo
 * texto que a empresa vê; `distance: null` = sem distância, só o bairro.
 */
export function locationLabel(
  p: Pick<VacancyCandidacyProvider, "distanceInKm" | "neighborhood" | "city" | "uf"> &
    Partial<Pick<VacancyCandidacyProvider, "distance">>,
): string | null {
  const place = [p.neighborhood?.trim(), [p.city?.trim(), p.uf?.trim()].filter(Boolean).join(" – ")]
    .filter(Boolean)
    .join(", ");
  if (p.distance !== undefined) {
    if (p.distance === null) return place || null;
    const text = `${p.distance.label} até a vaga`;
    return place ? `${place} · ${text}` : text;
  }
  if (p.distanceInKm !== null) {
    const km = `${decimal(p.distanceInKm)} km da vaga`;
    return place ? `${place} · ${km}` : km;
  }
  return place || null;
}

/** Faixa do score, igual à da página Freelancers: ≥80 bom, ≥60 atenção, abaixo ruim. */
export function scoreTone(score: number): "good" | "warn" | "bad" {
  return score >= 80 ? "good" : score >= 60 ? "warn" : "bad";
}

export interface CurriculumExperience {
  workplace: string;
  role: string;
  durationLabel: string;
}
export interface CurriculumCourse {
  title: string;
  durationLabel: string;
  completionYear: string;
}
export interface ParsedCurriculum {
  experiences: CurriculumExperience[];
  courses: CurriculumCourse[];
  skills: string;
  competitiveEdge: string;
  /** Nada preenchido: a tela diz isso em vez de mostrar seções vazias. */
  isEmpty: boolean;
}

const text = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];

/**
 * O currículo é JSON livre gravado pelo app (`experiences`, `courses`, `skills`,
 * `competitiveEdge`). Aqui ele vira uma forma segura: qualquer coisa fora do
 * esperado some em vez de quebrar a tela, e linha em branco não conta.
 */
export function parseCurriculum(raw: unknown): ParsedCurriculum {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const experiences = list(source.experiences)
    .map((e) => ({
      workplace: text(e.workplace),
      role: text(e.role),
      durationLabel: text(e.durationLabel),
    }))
    .filter((e) => e.workplace || e.role || e.durationLabel);
  const courses = list(source.courses)
    .map((c) => ({
      title: text(c.title),
      durationLabel: text(c.durationLabel),
      completionYear: text(c.completionYear),
    }))
    .filter((c) => c.title || c.durationLabel || c.completionYear);
  const skills = text(source.skills);
  const competitiveEdge = text(source.competitiveEdge);
  return {
    experiences,
    courses,
    skills,
    competitiveEdge,
    isEmpty: experiences.length === 0 && courses.length === 0 && !skills && !competitiveEdge,
  };
}

/** Iniciais para o avatar sem foto: "Ester Amaral" → "EA". */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

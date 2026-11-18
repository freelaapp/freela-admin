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

/** Só o lugar ("Bela Vista, São Paulo – SP"), sem a distância — ela tem a linha própria. */
export function placeLabel(
  p: Pick<VacancyCandidacyProvider, "neighborhood" | "city" | "uf">,
): string | null {
  const place = [p.neighborhood?.trim(), [p.city?.trim(), p.uf?.trim()].filter(Boolean).join(" – ")]
    .filter(Boolean)
    .join(", ");
  return place || null;
}

export const DISTANCE_UNAVAILABLE_TEXT = "Distância indisponível";
export const DISTANCE_UNAVAILABLE_HINT =
  "Falta o endereço completo do freelancer ou da vaga para calcular.";

export interface CandidateDistanceInfo {
  /** Km para ordenar; `null` = sem distância (vai para o fim da ordem por distância). */
  km: number | null;
  /** "15,4 km em linha reta até o trabalho" ou "Distância indisponível". */
  text: string;
  available: boolean;
}

const UNAVAILABLE: CandidateDistanceInfo = { km: null, text: DISTANCE_UNAVAILABLE_TEXT, available: false };

/**
 * A distância do candidato até o lugar do trabalho, com a MESMA regra da lista da empresa:
 * - com a distância nova (`distance`), vale o texto da API ("15,4 km em linha reta", "cerca de
 *   19 km em linha reta", "menos de 100 m em linha reta"); `distance: null` = indisponível;
 * - sem ela (API com os níveis desligados), o km legado só existe quando os dois endereços são
 *   de rua; ausente = indisponível (um dos lados é só o centro da cidade).
 * Nunca "0 km": ponto que não se conhece não vira distância.
 */
export function candidateDistance(
  p: Pick<VacancyCandidacyProvider, "distanceInKm"> & Partial<Pick<VacancyCandidacyProvider, "distance">>,
): CandidateDistanceInfo {
  if (p.distance !== undefined) {
    if (p.distance === null || !Number.isFinite(p.distance.km)) return UNAVAILABLE;
    return { km: p.distance.km, text: `${p.distance.label} até o trabalho`, available: true };
  }
  if (p.distanceInKm === null || !Number.isFinite(p.distanceInKm) || p.distanceInKm < 0) {
    return UNAVAILABLE;
  }
  const label =
    p.distanceInKm < 0.1 ? "menos de 100 m em linha reta" : `${decimal(p.distanceInKm)} km em linha reta`;
  return { km: p.distanceInKm, text: `${label} até o trabalho`, available: true };
}

/**
 * "Mais perto primeiro": por km, crescente; quem não tem distância (ou não tem os dados do
 * candidato) vai para o fim, na ordem em que já estava. Não muda a lista original.
 */
export function sortByDistance<T extends { provider?: VacancyCandidacyProvider | null }>(
  items: readonly T[],
): T[] {
  return items
    .map((item, index) => ({ item, index, km: item.provider ? candidateDistance(item.provider).km : null }))
    .sort((a, b) => {
      if (a.km === null && b.km === null) return a.index - b.index;
      if (a.km === null) return 1;
      if (b.km === null) return -1;
      return a.km - b.km || a.index - b.index;
    })
    .map(({ item }) => item);
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

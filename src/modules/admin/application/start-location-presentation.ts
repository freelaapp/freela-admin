import type { VacancyStartLocation } from "../infrastructure/admin-api";

/**
 * Textos do local no "Iniciar serviço" (fluxo v2, fatia F2), no "Roadmap da vaga". Puro (sem
 * React). A API manda só a distância até o local da vaga (nunca o ponto no mapa); sem dado, nada
 * aparece.
 */

const SP_TZ = "America/Sao_Paulo";

/** "18h04" (ou "18h" na hora cheia), em Brasília. `null` sem horário válido. */
export function startHourLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SP_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return minute === "00" ? `${hour}h` : `${hour}h${minute}`;
}

/** "120 m", "1,2 km", "12 km". */
export function distanceLabel(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return km < 10
    ? `${km.toFixed(1).replace(".", ",")} km`
    : `${Math.round(km)} km`;
}

export type StartLocationTone = "ok" | "warn" | "neutral";

export interface StartLocationView {
  /** A frase principal: "Iniciou às 18h04 a 120 m do local". */
  text: string;
  /** De onde vem o número (regra do dono: todo número com a conta e a fonte). */
  detail: string | null;
  tone: StartLocationTone;
}

/** De onde vem a distância, com o raio e a precisão do GPS daquele início. */
function measureDetail(location: VacancyStartLocation): string {
  const base =
    'Distância do celular até o endereço da vaga, no toque em "Iniciar serviço"';
  const extras: string[] = [];
  if (location.radiusMeters != null)
    extras.push(`raio de ${distanceLabel(location.radiusMeters)}`);
  if (location.accuracyMeters != null) {
    extras.push(
      `GPS com precisão de ${distanceLabel(location.accuracyMeters)}`,
    );
  }
  return extras.length ? `${base} (${extras.join("; ")}).` : `${base}.`;
}

/**
 * A frase do local do início, ou `null` (nada a mostrar: sem dado, ou uma situação que esta versão
 * do painel não conhece).
 */
export function describeStartLocation(
  location: VacancyStartLocation | null | undefined,
  startedAt: string | null | undefined,
): StartLocationView | null {
  if (!location) return null;
  const hour = startHourLabel(startedAt);
  const started = hour ? `Iniciou às ${hour}` : "Iniciou";
  const distance = location.distanceMeters;
  switch (location.status) {
    case "INSIDE":
      return {
        text:
          distance != null
            ? `${started} a ${distanceLabel(distance)} do local`
            : `${started} dentro do raio do local`,
        detail: measureDetail(location),
        tone: "ok",
      };
    case "OUTSIDE":
      return {
        text:
          distance != null
            ? `${started} fora do raio (${distanceLabel(distance)})`
            : `${started} fora do raio`,
        detail: measureDetail(location),
        tone: "warn",
      };
    case "LOW_ACCURACY":
      return {
        text:
          location.accuracyMeters != null
            ? `${started} com GPS impreciso (precisão de ${distanceLabel(location.accuracyMeters)})`
            : `${started} com GPS sem precisão informada`,
        detail:
          distance != null && location.radiusMeters != null
            ? `A ${distanceLabel(distance)} do endereço da vaga, mas com essa precisão não dá para dizer se estava no raio de ${distanceLabel(location.radiusMeters)}.`
            : null,
        tone: "neutral",
      };
    case "NO_VACANCY_COORDS":
      return {
        text: `${started} · distância não calculada`,
        detail:
          "O endereço da vaga não tem o ponto exato no mapa (só a cidade).",
        tone: "neutral",
      };
    case "NO_PERMISSION":
      return {
        text: `${started} sem localização (permissão negada)`,
        detail: null,
        tone: "neutral",
      };
    case "UNAVAILABLE":
      return {
        text: `${started} sem localização (o celular não deu a posição)`,
        detail: null,
        tone: "neutral",
      };
    case "NOT_SENT":
      return {
        text: `${started} · app sem localização`,
        detail: "Versão do app sem o envio do local, ou início pelo site.",
        tone: "neutral",
      };
    default:
      return null;
  }
}

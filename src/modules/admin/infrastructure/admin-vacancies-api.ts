import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

/**
 * Abertura de vaga por hora (Bares & Restaurantes) pelo painel admin, em nome
 * de um contratante.
 *
 * O backend expõe `POST /v1/bars-restaurants/admin/vacancies`, que reusa o
 * MESMO handler do app/web (`CreateVacancyHandler`) — a única diferença é que o
 * dono da vaga vem no corpo (`contractorUserId`) em vez do token. Ou seja: a
 * vaga nasce OPEN/PUBLICADA, com os mesmos disparos de push e grupo de
 * WhatsApp. Aprovar candidatura e pagar continua sendo do contratante.
 */
const adminVacanciesApi = createAuthedClient("/v1/bars-restaurants/admin");

/**
 * Corpo do `AdminCreateVacancyDto` (api-freela:
 * `src/modules/bares-restaurantes/adapters/http/dto/vacancy.dto.ts`).
 *
 * Campos herdados de `CreateVacancyDto` + `contractorUserId`. Não há campos
 * extras: qualquer chave desconhecida é rejeitada pelo ValidationPipe global
 * (`forbidNonWhitelisted`).
 */
export interface AdminCreateVacancyInput {
  /** userId (shared.users.id) do contratante dono da vaga. */
  contractorUserId: string;
  /** Título da vaga. O web usa o nome do cargo do catálogo. */
  title: string;
  description?: string | null;
  /** Slug da função/cargo (catálogo). */
  serviceType: string;
  /** Slug da categoria do catálogo (define preço e bonusModel no backend). */
  categorySlug?: string | null;
  /** Só para cargos com pricingModel TIERED; nas demais vai `null`. */
  pricingTierLabel?: string | null;
  /** Dia da vaga em `YYYY-MM-DD`. */
  date: string;
  /** Instante ISO (UTC) do início. */
  startTime: string;
  /** Instante ISO (UTC) do fim (dia seguinte quando a jornada vira a noite). */
  endTime: string;
  /** Pausa não remunerada — instantes ISO (UTC), só em cargos por hora. */
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  providesMeal?: boolean;
  /** Endereço textual. Vazio/omitido → backend usa o endereço do contratante. */
  address?: string | null;
  /** Atenção: `cityId` guarda o NOME da cidade. Omitido → cidade do contratante. */
  cityId?: string | null;
}

export interface AdminCreatedVacancy {
  id: string;
  status: string;
}

export async function adminCreateVacancy(
  input: AdminCreateVacancyInput,
): Promise<AdminCreatedVacancy> {
  const res = await adminVacanciesApi.post("/vacancies", input);
  return res.data.data;
}

// ─── Data/hora ──────────────────────────────────────────────────────────────

/**
 * Converte hora de parede de Brasília (`YYYY-MM-DD` + `HH:MM`) para instante
 * ISO em UTC — mesma semântica de `vacancyWallTimeBrasiliaToUtcIso` do
 * freela-web-v2. Brasília é UTC-3 fixo (sem horário de verão desde 2019).
 */
export function brasiliaWallTimeToUtcIso(dateYmd: string, hhmm: string): string {
  const date = new Date(`${dateYmd}T${hhmm}:00-03:00`);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Data ou horário inválido");
  }
  return date.toISOString();
}

/** Dia seguinte de um `YYYY-MM-DD` (usado na jornada que vira a noite). */
export function nextDayYmd(dateYmd: string): string {
  const [year, month, day] = dateYmd.split("-").map(Number);
  const d = new Date(year, month - 1, day + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** `HH:MM` → minutos desde a meia-noite. `null` se o formato não bater. */
export function hhmmToMinutes(hhmm: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

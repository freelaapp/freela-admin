/**
 * Utilitários de data/hora do admin.
 *
 * Espelha a lógica canônica de `freela-web-v2/src/lib/date.utils.ts` para
 * manter a exibição consistente entre os apps. Há duas categorias distintas:
 *
 *  - **Datas puras de vaga** (`BRVacancy.date`, histórico): chegam como
 *    `YYYY-MM-DD` (gravadas como meia-noite UTC). Renderizar via
 *    `Date(...).toLocaleDateString` desloca para o dia anterior em UTC-3.
 *    Use `formatVacancyDate` — constrói a partir das partes locais.
 *
 *  - **Instantes reais** (`startTime`/`endTime`, `createdAt`,
 *    `deletion*At`): são timestamps UTC verdadeiros. Devem ser renderizados
 *    fixando o fuso de Brasília. Use `formatVacancyTime` (hora) ou
 *    `formatInstantDate` (data-calendário).
 */

const SP_TZ = "America/Sao_Paulo";

/**
 * Formata a data de uma vaga para PT-BR (dd/mm/aaaa).
 *
 * Aceita `"YYYY-MM-DD"` ou `"YYYY-MM-DDTHH:MM:SS..."` (descarta o horário).
 * Construída com partes locais para evitar o desvio UTC-midnight → dia
 * anterior em UTC-3 / Brasília.
 */
export function formatVacancyDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    const datePart = dateStr.split("T")[0];
    const [year, month, day] = datePart.split("-").map(Number);
    if (!year || !month || !day) return "—";
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Formata o horário (HH:MM) de uma vaga a partir do instante UTC retornado
 * pela API, fixando o fuso **America/Sao_Paulo**.
 */
export function formatVacancyTime(timeStr: string): string {
  if (!timeStr) return "—";
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: SP_TZ,
    });
  } catch {
    return "—";
  }
}

/**
 * Formata a data-calendário (dd/mm/aaaa) de um **instante real** (timestamp
 * UTC: `createdAt`, `deletion*At`, `new Date()`) no fuso de Brasília.
 *
 * Difere de `formatVacancyDate`: aqui o horário importa para decidir o dia
 * (ex.: `02:00Z` é ainda 23:00 do dia anterior em São Paulo).
 */
export function formatInstantDate(value: string | Date): string {
  if (!value) return "—";
  try {
    const date = typeof value === "string" ? new Date(value) : value;
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: SP_TZ,
    });
  } catch {
    return "—";
  }
}

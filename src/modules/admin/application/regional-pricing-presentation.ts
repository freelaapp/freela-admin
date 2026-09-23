/** Helpers puros da tela "Preços por região" (índice em basis points; 10000 = 1,0). */
export const ONE_BPS = 10000;

export const FAIXA_PRESETS: { label: "A" | "B" | "C" | "D"; bps: number; hint: string }[] = [
  { label: "A", bps: 10000, hint: "tabela atual" },
  { label: "B", bps: 11500, hint: "+15%" },
  { label: "C", bps: 12500, hint: "+25%" },
  { label: "D", bps: 15500, hint: "+55%" },
];

export function bpsToIndexText(bps: number): string {
  return (bps / ONE_BPS).toFixed(4).replace(".", ",");
}

/** "1,5494" | "1.25" | "1" → bps; inválido ou < 1,0 → null. */
export function indexTextToBps(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 1) return null;
  return Math.round(value * ONE_BPS);
}

export function brl(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/**
 * Prévia local do valor-hora: base × índice, arredondado a R$ 0,50 e nunca
 * abaixo da base — a MESMA conta de `regionalizeHourlyInCents` no backend
 * (`src/common/regional-pricing/regional-multiplier.ts`). Só para o dono ver o
 * efeito enquanto digita; o valor salvo é sempre o do servidor.
 */
export function regionalizeHourly(baseCents: number, bps: number): number {
  const clamped = Math.max(ONE_BPS, Math.trunc(bps));
  if (clamped === ONE_BPS) return baseCents;
  const scaled = Math.round((baseCents * clamped) / ONE_BPS);
  return Math.max(Math.round(scaled / 50) * 50, baseCents);
}

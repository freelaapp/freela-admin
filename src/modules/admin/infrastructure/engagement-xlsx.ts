import { sanitizeCsvValue } from "@/lib/csv";
import type { Cell, Sheet } from "@/modules/admin/application/engagement-export";

/**
 * Escreve o .xlsx no navegador. O `xlsx` entra por import dinâmico (como em
 * campanhas/external-list-picker.tsx) para não pesar o carregamento da página.
 */
const MAX_SHEET_NAME = 31;

/** Nome de aba válido no Excel: sem \ / ? * : [ ], até 31 caracteres e sem repetir. */
export function safeSheetName(name: string, used: Set<string>): string {
  const clean =
    name
      .replace(/[\\/?*:[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_SHEET_NAME) || "Aba";
  let candidate = clean;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` ${n++}`;
    candidate = `${clean.slice(0, MAX_SHEET_NAME - suffix.length)}${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Texto que começa com = + - @ vira texto puro (anti-fórmula); número e vazio passam intactos. */
export function sanitizeCells(rows: Cell[][]): Cell[][] {
  return rows.map((r) => r.map((c) => (typeof c === "string" ? sanitizeCsvValue(c) : c)));
}

export async function downloadSheets(filename: string, sheets: Sheet[]): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sanitizeCells(s.rows)), safeSheetName(s.name, used));
  }
  XLSX.writeFile(wb, filename.toLowerCase().endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

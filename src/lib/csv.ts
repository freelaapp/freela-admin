/**
 * Exportação CSV compatível com Excel pt-BR: separador `;` (padrão do Excel
 * em locale brasileiro) e BOM UTF-8 para os acentos abrirem corretos no
 * duplo-clique. Valores numéricos devem vir já com vírgula decimal.
 */

/** Caracteres que fazem o Excel/Sheets interpretar a célula como fórmula. */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];
/** Números "de verdade" (inclusive negativos/monetários) não são fórmula. */
const PLAIN_NUMBER = /^[-+]?[\d.,\s]+$/;

/**
 * Neutraliza CSV injection: um campo vindo do banco que comece com `=`, `+`,
 * `-` ou `@` seria executado como fórmula ao abrir a planilha. Prefixar com
 * `'` faz o Excel tratar como texto. Valores puramente numéricos (ex.:
 * `-1.234,56`) passam intactos para não estragar somatórios.
 */
export function sanitizeCsvValue(value: string): string {
  if (!value) return value;
  if (!FORMULA_TRIGGERS.includes(value[0])) return value;
  if (PLAIN_NUMBER.test(value)) return value;
  return `'${value}`;
}

export function downloadCsv(
  filename: string,
  header: string[],
  rows: (string | number | null | undefined)[][],
) {
  const escape = (v: string | number | null | undefined) => {
    // Números nativos nunca viram fórmula — só strings passam pelo sanitizador.
    const s = v == null ? "" : typeof v === "number" ? String(v) : sanitizeCsvValue(String(v));
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows].map((r) => r.map(escape).join(";"));
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

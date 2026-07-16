/**
 * Exportação CSV compatível com Excel pt-BR: separador `;` (padrão do Excel
 * em locale brasileiro) e BOM UTF-8 para os acentos abrirem corretos no
 * duplo-clique. Valores numéricos devem vir já com vírgula decimal.
 */
export function downloadCsv(
  filename: string,
  header: string[],
  rows: (string | number | null | undefined)[][],
) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
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

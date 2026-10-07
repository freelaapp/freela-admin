import { beforeEach, describe, expect, it, vi } from "vitest";

// Captura o que iria para a planilha: o teste confere as células, não o arquivo.
const { aoa, names, writeFile } = vi.hoisted(() => ({
  aoa: [] as unknown[][][],
  names: [] as string[],
  writeFile: vi.fn(),
}));

vi.mock("xlsx", () => ({
  utils: {
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    aoa_to_sheet: (rows: unknown[][]) => {
      aoa.push(rows);
      return { rows };
    },
    book_append_sheet: (_wb: unknown, _ws: unknown, name: string) => {
      names.push(name);
    },
  },
  writeFile,
}));

import { downloadSheets, safeSheetName, sanitizeCells } from "./engagement-xlsx";

beforeEach(() => {
  aoa.length = 0;
  names.length = 0;
  writeFile.mockReset();
});

describe("sanitizeCells", () => {
  it("texto que vira fórmula ganha apóstrofo; número, vazio e telefone passam", () => {
    expect(
      sanitizeCells([['=HYPERLINK("http://x")', "@soma", "+5532998765432", "-12,5", "Ana", 42, null]]),
    ).toEqual([["'=HYPERLINK(\"http://x\")", "'@soma", "+5532998765432", "-12,5", "Ana", 42, null]]);
  });
});

describe("safeSheetName", () => {
  it("tira caracteres proibidos, corta em 31 e não repete", () => {
    const used = new Set<string>();
    expect(safeSheetName("Resumo: atual/anterior [set]", used)).toBe("Resumo atual anterior set");
    expect(safeSheetName("Lista", used)).toBe("Lista");
    expect(safeSheetName("lista", used)).toBe("lista 2");
    expect(safeSheetName("x".repeat(40), used)).toHaveLength(31);
  });
});

describe("downloadSheets", () => {
  it("monta o arquivo com as abas na ordem e sanitizado", async () => {
    await downloadSheets("engajamento-setembro", [
      { name: "Filtros", rows: [["Filtro", "Valor"]] },
      { name: "Lista", rows: [["Nome"], ["=cmd|' /C calc'!A0"]] },
    ]);
    expect(names).toEqual(["Filtros", "Lista"]);
    expect(aoa[1][1][0]).toBe("'=cmd|' /C calc'!A0");
    expect(writeFile).toHaveBeenCalledWith(expect.anything(), "engajamento-setembro.xlsx");
  });
});

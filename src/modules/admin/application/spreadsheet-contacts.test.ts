import { describe, expect, it } from "vitest";
import {
  cellToString,
  detectColumnMapping,
  normalizeEmail,
  normalizeHeader,
  normalizePhone,
  normalizeTemplatePlaceholders,
  renderPreview,
  rowsToContacts,
  toApiContacts,
} from "./spreadsheet-contacts";

describe("normalizeHeader", () => {
  it("tira acento, espaço e pontuação", () => {
    expect(normalizeHeader(" E-mail ")).toBe("email");
    expect(normalizeHeader("Telefone / WhatsApp")).toBe("telefonewhatsapp");
    expect(normalizeHeader("Nº")).toBe("n");
    expect(normalizeHeader(null)).toBe("");
  });
});

describe("detectColumnMapping", () => {
  it("acha nome, telefone e e-mail em português", () => {
    expect(detectColumnMapping(["Nome", "Celular", "E-mail"])).toEqual({
      name: 0,
      phone: 1,
      email: 2,
    });
  });

  it("acha em inglês e em qualquer ordem", () => {
    expect(detectColumnMapping(["email", "phone", "name"])).toEqual({
      name: 2,
      phone: 1,
      email: 0,
    });
  });

  it("casa por 'contém' quando o cabeçalho é composto", () => {
    expect(detectColumnMapping(["Nome do responsável", "Telefone comercial", "Email principal"])).toEqual({
      name: 0,
      phone: 1,
      email: 2,
    });
  });

  it("prefere igualdade a 'contém' e não repete coluna", () => {
    // "Nome da empresa" contém "nome" e "empresa"; "Nome" é igual — ganha.
    expect(detectColumnMapping(["Nome da empresa", "Nome", "WhatsApp"])).toEqual({
      name: 1,
      phone: 2,
      email: null,
    });
  });

  it("devolve null para o que não achou", () => {
    expect(detectColumnMapping(["Cidade", "Cargo"])).toEqual({ name: null, phone: null, email: null });
    expect(detectColumnMapping([])).toEqual({ name: null, phone: null, email: null });
  });
});

describe("cellToString", () => {
  it("número inteiro vira dígitos, sem notação científica", () => {
    expect(cellToString(11999990001)).toBe("11999990001");
    expect(cellToString(5511999990001)).toBe("5511999990001");
  });
  it("float vindo de célula numérica é arredondado", () => {
    expect(cellToString(11999990001.0)).toBe("11999990001");
  });
  it("texto é aparado; vazio e null viram ''", () => {
    expect(cellToString("  abc ")).toBe("abc");
    expect(cellToString(undefined)).toBe("");
  });
});

describe("normalizePhone", () => {
  it.each([
    ["(11) 99999-0001", "+5511999990001"],
    ["11 99999 0001", "+5511999990001"],
    ["11999990001", "+5511999990001"],
    ["5511999990001", "+5511999990001"],
    ["+55 11 99999-0001", "+5511999990001"],
    ["011 99999-0001", "+5511999990001"],
    ["0055 11 99999-0001", "+5511999990001"],
    ["1133334444", "+551133334444"],
    [11999990001, "+5511999990001"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("devolve o texto original quando não reconhece", () => {
    expect(normalizePhone("999")).toBe("999");
    expect(normalizePhone("abc")).toBe("abc");
    // DDD inexistente (01) não vira +55.
    expect(normalizePhone("0199999000")).toBe("0199999000");
  });

  it("vazio fica vazio", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone(null)).toBe("");
  });
});

describe("normalizeEmail", () => {
  it("minúsculo e sem espaço", () => {
    expect(normalizeEmail("  Joao@Exemplo.COM ")).toBe("joao@exemplo.com");
    expect(normalizeEmail("a b@c.com")).toBe("ab@c.com");
    expect(normalizeEmail(null)).toBe("");
  });
});

describe("rowsToContacts", () => {
  const mapping = { name: 0, phone: 1, email: 2 };

  it("numera a linha como no Excel (cabeçalho = 1) e normaliza", () => {
    const rows = [
      ["Bruno", "(11) 99000-1001", "Bruno@X.com"],
      ["", "", ""],
      ["Só e-mail", "", "so@email.com"],
    ];
    expect(rowsToContacts(rows, mapping)).toEqual({
      emptyRows: 1,
      contacts: [
        { line: 2, name: "Bruno", phone: "+5511990001001", email: "bruno@x.com" },
        { line: 4, name: "Só e-mail", email: "so@email.com" },
      ],
    });
  });

  it("coluna não mapeada é ignorada", () => {
    const rows = [["Ana", "11999990001"]];
    expect(rowsToContacts(rows, { name: 0, phone: null, email: null }).contacts).toEqual([
      { line: 2, name: "Ana" },
    ]);
  });

  it("linha curta (célula faltando) não quebra", () => {
    const rows = [["Ana"]];
    expect(rowsToContacts(rows, mapping).contacts).toEqual([{ line: 2, name: "Ana" }]);
  });

  it("toApiContacts tira a linha", () => {
    const { contacts } = rowsToContacts([["Ana", "11999990001", ""]], mapping);
    expect(toApiContacts(contacts)).toEqual([{ name: "Ana", phone: "+5511999990001" }]);
  });
});

describe("normalizeTemplatePlaceholders", () => {
  it("chave simples vira dupla; dupla fica", () => {
    expect(normalizeTemplatePlaceholders("Oi {nome}, {{primeiro_nome}} de { cidade }")).toBe(
      "Oi {{nome}}, {{primeiro_nome}} de {{cidade}}",
    );
  });
  it("não mexe em chaves desconhecidas", () => {
    expect(normalizeTemplatePlaceholders("{outra} {{x}}")).toBe("{outra} {{x}}");
  });
});

describe("renderPreview", () => {
  it("preenche nome e primeiro nome", () => {
    expect(renderPreview("Oi {primeiro_nome}, {{nome}}!", "José da Silva")).toBe(
      "Oi José, José da Silva!",
    );
  });
  it("limpa a pontuação órfã quando não há nome", () => {
    expect(renderPreview("Oi {nome}, tudo bem?", "")).toBe("Oi, tudo bem?");
  });
});

/**
 * Planilha → contatos de campanha (função pura, sem DOM e sem `xlsx`).
 *
 * A leitura do arquivo fica no componente (SheetJS entrega `unknown[][]`);
 * aqui só mora o que dá para testar sem navegador: achar as colunas pelo
 * cabeçalho, limpar telefone/e-mail e montar a lista que vai para a API.
 *
 * A validação de verdade é da API (`external-list/preview`): o cliente só
 * normaliza o suficiente para que o mesmo telefone digitado de três jeitos
 * diferentes chegue lá igual — e para que a prévia na tela já mostre o que
 * vai ser enviado.
 */

export type ContactField = "name" | "phone" | "email";

/** Índice da coluna (0-based) de cada campo, ou `null` quando não achou. */
export type ColumnMapping = Record<ContactField, number | null>;

export interface SpreadsheetContact {
  /** Linha na planilha como o usuário vê no Excel (1 = cabeçalho). */
  line: number;
  name?: string;
  phone?: string;
  email?: string;
}

/**
 * Cabeçalhos aceitos, já normalizados (minúsculo, sem acento, sem
 * pontuação). Ordem importa: o primeiro que casar por igualdade ganha; só
 * depois tenta "contém" (ex.: "telefone celular" contém "telefone").
 */
const HEADER_ALIASES: Record<ContactField, string[]> = {
  name: ["nome", "name", "nomecompleto", "fullname", "cliente", "responsavel", "razaosocial", "empresa", "estabelecimento"],
  phone: ["telefone", "celular", "whatsapp", "phone", "fone", "tel", "mobile", "numero", "zap", "whats", "cel"],
  email: ["email", "mail", "correio", "correioeletronico"],
};

/** "E-mail " → "email", "Telefone / WhatsApp" → "telefonewhatsapp". */
export function normalizeHeader(value: unknown): string {
  return cellToString(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Detecta as colunas pelo cabeçalho. Cada coluna só pode servir a um campo:
 * "Contato" não vira nome E telefone ao mesmo tempo.
 */
export function detectColumnMapping(headers: unknown[]): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: ColumnMapping = { name: null, phone: null, email: null };

  for (const field of ["phone", "email", "name"] as ContactField[]) {
    const aliases = HEADER_ALIASES[field];
    let found = normalized.findIndex((h, i) => !used.has(i) && aliases.includes(h));
    if (found === -1) {
      found = normalized.findIndex(
        (h, i) => !used.has(i) && h.length > 0 && aliases.some((a) => h.includes(a)),
      );
    }
    if (found !== -1) {
      mapping[field] = found;
      used.add(found);
    }
  }
  return mapping;
}

/**
 * Célula → texto. Número inteiro vira dígitos (telefone gravado como número
 * no Excel), sem notação científica; data e outros tipos viram `String()`.
 */
export function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    // 1.1999990001e10 quando a célula veio como float: tenta recuperar.
    return Number.isFinite(value) ? value.toFixed(0) : "";
  }
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/**
 * Telefone brasileiro → E.164 (`+55DDDNÚMERO`). Aceita "(11) 99999-0001",
 * "11 99999 0001", "5511999990001", "+55 11 ...", "011 9 9999-0001".
 *
 * Quando não dá para reconhecer, devolve o texto original limpo: a API é
 * quem recusa com motivo, e a linha aparece na lista de inválidos com o que
 * o operador digitou — não com um número "corrigido" errado.
 */
export function normalizePhone(raw: unknown): string {
  const text = cellToString(raw);
  if (!text) return "";
  let digits = text.replace(/\D/g, "");
  if (!digits) return text;

  // Prefixo internacional discado (0055...) ou código do país.
  if (digits.startsWith("0055")) digits = digits.slice(4);
  else if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  // Prefixo de operadora/longa distância: "011 9...." ou "0 11 ...".
  if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1);
  }

  if (digits.length === 10 || digits.length === 11) {
    const ddd = Number(digits.slice(0, 2));
    if (ddd >= 11 && ddd <= 99) return `+55${digits}`;
  }
  return text;
}

export function normalizeEmail(raw: unknown): string {
  return cellToString(raw).toLowerCase().replace(/\s+/g, "");
}

export interface RowsToContactsResult {
  contacts: SpreadsheetContact[];
  /** Linhas sem nada nas colunas mapeadas — nem entram na prévia. */
  emptyRows: number;
}

/**
 * Linhas de dados (SEM o cabeçalho) → contatos. `line` conta a partir de 2
 * porque a linha 1 é o cabeçalho — é o número que o operador vai procurar
 * na planilha quando a API apontar "linha 7 inválida".
 */
export function rowsToContacts(rows: unknown[][], mapping: ColumnMapping): RowsToContactsResult {
  const contacts: SpreadsheetContact[] = [];
  let emptyRows = 0;

  rows.forEach((row, index) => {
    const pick = (col: number | null) => (col == null ? undefined : row[col]);
    const name = cellToString(pick(mapping.name));
    const phone = normalizePhone(pick(mapping.phone));
    const email = normalizeEmail(pick(mapping.email));

    if (!name && !phone && !email) {
      emptyRows += 1;
      return;
    }
    contacts.push({
      line: index + 2,
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
    });
  });

  return { contacts, emptyRows };
}

/** Sem `line` — é o que a API recebe. */
export function toApiContacts(contacts: SpreadsheetContact[]) {
  return contacts.map((c) => ({
    ...(c.name ? { name: c.name } : {}),
    ...(c.phone ? { phone: c.phone } : {}),
    ...(c.email ? { email: c.email } : {}),
  }));
}

/**
 * A API renderiza `{{nome}}`, `{{primeiro_nome}}` e `{{cidade}}`; o operador
 * escreve `{nome}` como o dono pediu. Chave simples vira dupla, dupla fica
 * como está.
 */
export function normalizeTemplatePlaceholders(text: string): string {
  return text.replace(/(?<!\{)\{\s*(nome|primeiro_nome|cidade)\s*\}(?!\})/gi, (_m, key: string) => {
    return `{{${key.toLowerCase()}}}`;
  });
}

/** Como a mensagem vai chegar, para a prévia na tela. */
export function renderPreview(template: string, name: string): string {
  const full = name.trim();
  const first = full.split(/\s+/)[0] ?? "";
  return normalizeTemplatePlaceholders(template)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, first)
    .replace(/\{\{\s*nome\s*\}\}/gi, full)
    .replace(/\{\{\s*cidade\s*\}\}/gi, "")
    .replace(/ {2,}/g, " ")
    .replace(/ +([,.!?])/g, "$1")
    .replace(/([,!?]) *([,.!?])/g, "$2")
    .trim();
}

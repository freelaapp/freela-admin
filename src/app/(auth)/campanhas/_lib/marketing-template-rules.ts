/**
 * Espelho, no admin, das regras do editor de modelos de marketing da API
 * (`api-freela/src/shared/activation-campaigns/domain/marketing-template-rules.ts`,
 * spec 2026-10-01 campanhas parte 1 §4.2). Serve para mostrar o erro enquanto o
 * time digita; quem decide é a API (400 `MARKETING_TEMPLATE_INVALID`). As
 * mensagens são as da API, palavra por palavra — mudar uma é mudar as duas.
 */
import { normalizePhone } from "@/modules/admin/application/spreadsheet-contacts";
import type {
  MarketingButton,
  MarketingRuleError,
  MarketingTemplateStatus,
} from "@/modules/admin/infrastructure/marketing-templates-api";

export const MARKETING_VARIABLES = ["nome", "primeiro_nome", "cidade"] as const;
export type MarketingVariable = (typeof MARKETING_VARIABLES)[number];
/** Ordem dos chips no editor (spec §8.1). */
export const VARIABLE_CHIPS: readonly MarketingVariable[] = [
  "primeiro_nome",
  "nome",
  "cidade",
];

export const MARKETING_BODY_MAX = 1024;
export const MARKETING_BUTTON_TEXT_MAX = 25;
export const MARKETING_URL_MAX = 2000;
export const MARKETING_MAX_BUTTONS = 2;
/** Botão de saída: a API acrescenta sempre como o último. */
export const OPT_OUT_BUTTON_TEXT = "Não quero receber";
/** A Meta não aceita webp no topo do modelo. */
export const MARKETING_IMAGE_TYPES = ["image/png", "image/jpeg"] as const;

/** Dados de exemplo da prévia (os mesmos que a API manda à Meta). */
export const MARKETING_SAMPLE: Record<MarketingVariable, string> = {
  nome: "Maria Souza",
  primeiro_nome: "Maria",
  cidade: "Campinas",
};

export const MARKETING_STATUS_LABEL: Record<MarketingTemplateStatus, string> = {
  DRAFT: "Rascunho",
  PENDING: "Em análise",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
  PAUSED: "Pausado pela Meta",
  DISABLED: "Desativado pela Meta",
  ARCHIVED: "Arquivado",
};

/** "Pausado pela Meta" → "pausado pela Meta" (para usar no meio da frase). */
export function statusInSentence(status: MarketingTemplateStatus): string {
  const label = MARKETING_STATUS_LABEL[status];
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** Botão como a tela edita: `value` é o link (URL) ou o telefone (PHONE). */
export interface DraftButton {
  type: "URL" | "PHONE";
  text: string;
  value: string;
}

export type PreviewButton = {
  type: "URL" | "PHONE" | "QUICK_REPLY";
  text: string;
};

const TOKEN = /\{([^{}]*)\}/g;
const POSITIONAL = /\{\{\d+\}\}/;

const tokenName = (inner: string): string => inner.trim().toLowerCase();

const isVariable = (name: string): name is MarketingVariable =>
  (MARKETING_VARIABLES as readonly string[]).includes(name);

/** Tamanho como a Meta conta (por caractere, não por unidade UTF-16). */
export function codePointLength(text: string): number {
  return [...text].length;
}

export function toPositional(body: string): {
  text: string;
  paramOrder: MarketingVariable[];
} {
  const paramOrder: MarketingVariable[] = [];
  const text = (body ?? "")
    .trim()
    .replace(TOKEN, (whole: string, inner: string) => {
      const name = tokenName(inner);
      if (!isVariable(name)) return whole;
      paramOrder.push(name);
      return `{{${paramOrder.length}}}`;
    });
  return { text, paramOrder };
}

export function validateMarketingBody(body: string): MarketingRuleError[] {
  const trimmed = (body ?? "").trim();
  if (!trimmed)
    return [{ code: "BODY_EMPTY", message: "Escreva o texto da mensagem." }];

  const errors: MarketingRuleError[] = [];
  const unknown = new Set<string>();
  for (const match of trimmed.matchAll(TOKEN)) {
    if (!isVariable(tokenName(match[1]))) unknown.add(match[0]);
  }
  if (unknown.size > 0) {
    errors.push({
      code: "UNKNOWN_VARIABLE",
      message: `Variável desconhecida: ${[...unknown].join(", ")}. Use {nome}, {primeiro_nome} ou {cidade}.`,
    });
  }

  // Chave dupla (`{{nome}}`) ou solta (`{nome, tudo`) sobra depois de tirar os `{xxx}`.
  if (/[{}]/.test(trimmed.replace(TOKEN, ""))) {
    errors.push({
      code: "INVALID_BRACES",
      message:
        "Chaves soltas ou duplas no texto. Use só {nome}, {primeiro_nome} ou {cidade}, com uma chave de cada lado.",
    });
  }

  const { text, paramOrder } = toPositional(trimmed);
  if (paramOrder.length > 0) {
    if (new RegExp(`^${POSITIONAL.source}`).test(text)) {
      errors.push({
        code: "STARTS_WITH_VARIABLE",
        message:
          'O texto não pode começar com uma variável. Escreva algo antes, como "Oi, {primeiro_nome}!".',
      });
    }
    if (new RegExp(`${POSITIONAL.source}$`).test(text)) {
      errors.push({
        code: "ENDS_WITH_VARIABLE",
        message:
          "O texto não pode terminar com uma variável. Escreva algo depois dela.",
      });
    }
    if (new RegExp(`${POSITIONAL.source}\\s*${POSITIONAL.source}`).test(text)) {
      errors.push({
        code: "ADJACENT_VARIABLES",
        message: "Duas variáveis seguidas precisam de texto entre elas.",
      });
    }
  }

  const length = codePointLength(text);
  if (length > MARKETING_BODY_MAX) {
    errors.push({
      code: "BODY_TOO_LONG",
      message: `O texto tem ${length} caracteres; o máximo é ${MARKETING_BODY_MAX}.`,
    });
  }
  return errors;
}

function isHttpsUrl(url: string): boolean {
  if (!url.startsWith("https://")) return false;
  try {
    return new URL(url).hostname.length > 0;
  } catch {
    return false;
  }
}

/** Telefone BR reconhecível (fixo ou celular). A API normaliza para E.164. */
function isBrPhone(raw: string): boolean {
  return normalizePhone(raw).startsWith("+55");
}

export function validateMarketingButtons(
  buttons: DraftButton[],
): MarketingRuleError[] {
  const errors: MarketingRuleError[] = [];
  if (buttons.length > MARKETING_MAX_BUTTONS) {
    errors.push({
      code: "TOO_MANY_BUTTONS",
      message: `No máximo ${MARKETING_MAX_BUTTONS} botões (um link e um telefone). O "${OPT_OUT_BUTTON_TEXT}" entra sozinho.`,
    });
  }
  const seen = new Set<string>();
  buttons.forEach((button, index) => {
    const label = `Botão ${index + 1}`;
    const text = button.text.trim();
    if (button.type !== "URL" && button.type !== "PHONE") {
      errors.push({
        code: "BUTTON_TYPE",
        message: `${label}: tipo inválido (use link ou ligar).`,
      });
      return;
    }
    if (seen.has(button.type)) {
      errors.push({
        code: "DUPLICATE_BUTTON_TYPE",
        message: `${label}: só cabe um botão de ${button.type === "URL" ? "link" : "ligar"}.`,
      });
    }
    seen.add(button.type);
    if (!text || codePointLength(text) > MARKETING_BUTTON_TEXT_MAX) {
      errors.push({
        code: "BUTTON_TEXT",
        message: `${label}: o texto do botão precisa ter de 1 a ${MARKETING_BUTTON_TEXT_MAX} caracteres.`,
      });
    } else if (text.toLowerCase() === OPT_OUT_BUTTON_TEXT.toLowerCase()) {
      errors.push({
        code: "BUTTON_TEXT_RESERVED",
        message: `${label}: "${OPT_OUT_BUTTON_TEXT}" já entra sozinho como último botão.`,
      });
    }
    const value = button.value.trim();
    if (button.type === "URL") {
      if (
        !isHttpsUrl(value) ||
        value.length > MARKETING_URL_MAX ||
        /[{}]/.test(value)
      ) {
        errors.push({
          code: "BUTTON_URL",
          message: `${label}: o link precisa começar com https://, ter até ${MARKETING_URL_MAX} caracteres e não pode ter variável.`,
        });
      }
      return;
    }
    if (!isBrPhone(value)) {
      errors.push({
        code: "BUTTON_PHONE",
        message: `${label}: telefone inválido. Use DDD + número, ex.: (11) 95090-3219.`,
      });
    }
  });
  return errors;
}

/** Tela → corpo da API (a API normaliza o telefone para E.164). */
export function toApiButtons(
  buttons: DraftButton[],
): Array<
  | { type: "URL"; text: string; url: string }
  | { type: "PHONE"; text: string; phone: string }
> {
  return buttons.map((b) =>
    b.type === "URL"
      ? { type: "URL" as const, text: b.text.trim(), url: b.value.trim() }
      : { type: "PHONE" as const, text: b.text.trim(), phone: b.value.trim() },
  );
}

export function fromApiButtons(buttons: MarketingButton[]): DraftButton[] {
  return buttons.map((b) =>
    b.type === "URL"
      ? { type: "URL" as const, text: b.text, value: b.url }
      : { type: "PHONE" as const, text: b.text, value: b.phone },
  );
}

/** Ordem do WhatsApp: link, ligar e, por último, o "Não quero receber". */
export function previewButtons(
  buttons: Array<{ type: "URL" | "PHONE"; text: string }>,
): PreviewButton[] {
  return [
    ...buttons
      .filter((b) => b.type === "URL")
      .map((b) => ({ type: "URL" as const, text: b.text })),
    ...buttons
      .filter((b) => b.type === "PHONE")
      .map((b) => ({ type: "PHONE" as const, text: b.text })),
    { type: "QUICK_REPLY", text: OPT_OUT_BUTTON_TEXT },
  ];
}

/** Texto com as variáveis preenchidas (prévia). Vazio vira "-", como no envio. */
export function renderMarketingText(
  body: string,
  values: Partial<Record<MarketingVariable, string>> = MARKETING_SAMPLE,
): string {
  return (body ?? "").trim().replace(TOKEN, (whole: string, inner: string) => {
    const name = tokenName(inner);
    if (!isVariable(name)) return whole;
    return values[name]?.trim() || "-";
  });
}

/** Insere `token` no lugar da seleção [start, end) e devolve onde o cursor fica. */
export function insertAt(
  body: string,
  start: number,
  end: number,
  token: string,
): { body: string; cursor: number } {
  const from = Math.max(0, Math.min(start, body.length));
  const to = Math.max(from, Math.min(end, body.length));
  return {
    body: body.slice(0, from) + token + body.slice(to),
    cursor: from + token.length,
  };
}

/** Pasta onde o upload de campanhas grava (`POST /v1/admins/campaign-templates/upload`). */
export const MARKETING_IMAGE_PREFIX = "freela/images/campaigns/";

/**
 * Espelho de `marketingImageErrors` da API: só a pasta de campanhas e só png/jpg/jpeg
 * (a Meta não aceita webp no topo). Mesma mensagem da API.
 */
export function marketingImageErrors(
  imageKey: string | null | undefined,
): MarketingRuleError[] {
  const key = (imageKey ?? "").trim();
  if (!key) return [];
  const ok =
    key.startsWith(MARKETING_IMAGE_PREFIX) &&
    key.length > MARKETING_IMAGE_PREFIX.length &&
    !key.includes("..") &&
    !/[\s?#\\]/.test(key) &&
    /\.(png|jpe?g)$/i.test(key);
  return ok
    ? []
    : [
        {
          code: "IMAGE_NOT_ALLOWED",
          message:
            "A imagem precisa ser PNG ou JPEG enviada pelo admin (WebP a Meta não aceita).",
        },
      ];
}

/** Nome do arquivo pelo tipo real (image/jpeg → .jpg, image/png → .png); o nome original some. */
export function imageFileNameForMime(
  mime: string,
  now: number = Date.now(),
): string | null {
  if (mime === "image/jpeg") return `modelo-${now}.jpg`;
  if (mime === "image/png") return `modelo-${now}.png`;
  return null;
}

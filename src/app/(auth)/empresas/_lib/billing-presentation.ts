import type {
  BillingMode,
  BillingModeSettings,
  CompanyDataField,
  DateKey,
  InvoicedMode,
} from "@/modules/admin/infrastructure/billing-mode-api";

/**
 * Textos da aba "Cobrança" do modal "Documentos e cobrança" (UX 5.3–5.5, Fase
 * 3). Funções puras: a tela só junta as peças. As datas vêm do servidor
 * (`previews`, `extraordinaryInvoice`); aqui só viram texto.
 */

export const BILLING_MODES: readonly BillingMode[] = [
  "PREPAID",
  "INVOICED_7",
  "INVOICED_15",
  "INVOICED_30",
];

export const isInvoicedMode = (mode: BillingMode): mode is InvoicedMode => mode !== "PREPAID";

/** Nome curto (selo, histórico, aviso de "Salvo"). */
export const BILLING_MODE_SHORT: Record<BillingMode, string> = {
  PREPAID: "Pré-pago",
  INVOICED_7: "Faturado semanal",
  INVOICED_15: "Faturado quinzenal",
  INVOICED_30: "Faturado mensal",
};

/**
 * Rótulo do rádio. O "(boleto 7)" é só do admin, para casar com o vocabulário
 * do dono; para o contratante, nunca "boleto" (o pagamento é Pix com QR).
 */
export const BILLING_MODE_OPTION: Record<BillingMode, string> = {
  PREPAID: "Pré-pago: Pix a cada contratação (padrão)",
  INVOICED_7: 'Faturado semanal ("boleto 7")',
  INVOICED_15: 'Faturado quinzenal ("boleto 15")',
  INVOICED_30: 'Faturado mensal ("boleto 30")',
};

/** O ciclo de cada modo. O horário do fechamento (08:00) é fixo na API. */
export const CYCLE_DESCRIPTION: Record<BillingMode, string> = {
  PREPAID: "A empresa paga o Pix de cada contratação na hora do aceite.",
  INVOICED_7:
    "Serviços de sexta a quinta. Fecha sexta às 08:00 e vence segunda (ou no próximo dia útil).",
  INVOICED_15:
    "Serviços de 1 a 15 e de 16 ao fim do mês. Fecha nos dias 16 e 1 e vence 3 dias depois (ou no próximo dia útil).",
  INVOICED_30:
    "Serviços do mês. Fecha no dia 1 e vence no dia 4 (ou no próximo dia útil).",
};

const CYCLE_ADJECTIVE: Record<InvoicedMode, string> = {
  INVOICED_7: "semanal",
  INVOICED_15: "quinzenal",
  INVOICED_30: "mensal",
};

/** "Modo atual: Pré-pago (Pix a cada contratação)". */
export function currentModeLabel(mode: BillingMode): string {
  return mode === "PREPAID" ? "Pré-pago (Pix a cada contratação)" : BILLING_MODE_SHORT[mode];
}

// ─── Datas (dia civil de Brasília, `AAAA-MM-DD`) ──────────────────────────────

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function keyParts(key: DateKey): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * "sex 16/10". O dia da semana sai do calendário em UTC: um `getDay()` no fuso
 * do navegador voltaria um dia para quem está a oeste de Greenwich.
 */
export function dayLabel(key: DateKey): string {
  const parts = keyParts(key);
  if (!parts) return key;
  const [y, m, d] = parts;
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** "08/10". */
export function ddmm(key: DateKey): string {
  const parts = keyParts(key);
  if (!parts) return key;
  return `${String(parts[2]).padStart(2, "0")}/${String(parts[1]).padStart(2, "0")}`;
}

/** Dias corridos de `from` até `to` (ambos `AAAA-MM-DD`). */
function daysBetween(from: DateKey, to: DateKey): number | null {
  const a = keyParts(from);
  const b = keyParts(to);
  if (!a || !b) return null;
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86_400_000);
}

/** Hoje em Brasília, `AAAA-MM-DD`. */
export function todayKeyBrasilia(now: Date = new Date()): DateKey {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

// ─── Pré-requisitos (F1: CNPJ, endereço completo e e-mail) ────────────────────

const FIELD_WITH_ARTICLE: Record<CompanyDataField, string> = {
  cnpj: "o CNPJ",
  cep: "o CEP",
  street: "a rua",
  number: "o número do endereço",
  neighborhood: "o bairro",
  city: "a cidade",
  uf: "o estado",
  email: "o e-mail",
};

const ADDRESS_FIELDS: CompanyDataField[] = ["cep", "street", "number", "neighborhood", "city", "uf"];
const ADDRESS_SHORT: Partial<Record<CompanyDataField, string>> = {
  cep: "o CEP",
  street: "a rua",
  number: "o número",
  neighborhood: "o bairro",
  city: "a cidade",
  uf: "o estado",
};

function joinPt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** "Falta o número do endereço." / "Faltam o CNPJ e o e-mail." */
export function missingPhrase(missing: CompanyDataField[]): string {
  const names = missing.map((field) => FIELD_WITH_ARTICLE[field] ?? field);
  return `${names.length > 1 ? "Faltam" : "Falta"} ${joinPt(names)}.`;
}

/** "Para faturar, complete o cadastro: o número do endereço." (422 com `missing`). */
export function missingFromServer(missing: CompanyDataField[]): string {
  return `Para faturar, complete o cadastro: ${joinPt(
    missing.map((field) => FIELD_WITH_ARTICLE[field] ?? field),
  )}.`;
}

export interface RequirementRow {
  key: "cnpj" | "address" | "email";
  ok: boolean;
  text: string;
}

/** As três linhas de "Para faturar, o cadastro precisa de:" (ícone + texto na tela). */
export function requirementRows(
  missing: CompanyDataField[],
  known: { cnpj?: string | null; contactEmail?: string | null },
): RequirementRow[] {
  const has = (field: CompanyDataField) => missing.includes(field);
  const addressMissing = ADDRESS_FIELDS.filter(has).map((field) => ADDRESS_SHORT[field] as string);
  return [
    {
      key: "cnpj",
      ok: !has("cnpj"),
      text: has("cnpj") ? "CNPJ: falta (14 dígitos)" : `CNPJ: ${known.cnpj || "ok"}`,
    },
    {
      key: "address",
      ok: addressMissing.length === 0,
      text:
        addressMissing.length === 0
          ? "Endereço completo: ok"
          : `Endereço completo: falta ${joinPt(addressMissing)}`,
    },
    {
      key: "email",
      ok: !has("email"),
      text: has("email") ? "E-mail: falta o e-mail de contato" : `E-mail: ${known.contactEmail || "ok"}`,
    },
  ];
}

// ─── "O que muda" e confirmações ──────────────────────────────────────────────

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function blockSentence(blockFromDate: DateKey, blockEnabled: boolean): string {
  return blockEnabled
    ? `Se não pagar, publicar e aprovar ficam bloqueados a partir de ${dayLabel(blockFromDate)}.`
    : `O bloqueio por atraso ainda está desligado. Quando ligar, publicar e aprovar ficam bloqueados a partir de ${dayLabel(blockFromDate)} se a fatura não for paga.`;
}

function openLinesSentence(view: BillingModeSettings): string {
  const open = view.openPreview;
  const due = view.extraordinaryInvoice?.dueDate;
  if (!open || open.lineCount === 0) {
    return "Não há lançamentos a faturar: nenhuma fatura extra é criada.";
  }
  const lines = plural(open.lineCount, "lançamento", "lançamentos");
  const dueText = due ? `, com vencimento em ${dayLabel(due)}` : "";
  return `Os lançamentos ainda não faturados (${lines}, R$ ${brl(open.totalInCents)}) vão para uma fatura extra fechada agora${dueText}.`;
}

/** O bloco "O que muda" da aba, para o modo escolhido (`null` = nada mudou). */
export function whatChanges(
  view: BillingModeSettings,
  next: BillingMode,
  blockEnabled: boolean,
): string | null {
  const current = view.mode;
  if (next === current) return null;
  if (!isInvoicedMode(next)) {
    return `Os próximos aceites pedem Pix na hora. ${openLinesSentence(view)}`;
  }
  const preview = view.previews[next];
  if (isInvoicedMode(current)) {
    return `Os serviços ainda não faturados entram no próximo fechamento do ${CYCLE_ADJECTIVE[next]}: ${dayLabel(preview.closeDate)}. Faturas já emitidas não mudam.`;
  }
  return [
    "A partir do próximo aceite, as contratações desta empresa entram na fatura e a Freela adianta o pagamento dos freelancers.",
    `1ª fatura: fecha ${dayLabel(preview.closeDate)} às 08:00 com os serviços realizados até ${dayLabel(preview.period.end)}; vence ${dayLabel(preview.dueDate)}.`,
    "Sem multa e sem juros.",
    blockSentence(preview.blockFromDate, blockEnabled),
  ].join(" ");
}

export interface ConfirmCopy {
  title: string;
  items: string[];
  /** O botão diz o verbo e o modo. */
  action: string;
}

/** As três confirmações do UX 5.3: ligar, voltar para pré-pago e trocar de ciclo. */
export function confirmCopy(
  view: BillingModeSettings,
  next: BillingMode,
  companyName: string,
  blockEnabled: boolean,
): ConfirmCopy {
  const current = view.mode;
  if (!isInvoicedMode(next)) {
    return {
      title: `Voltar ${companyName} para pré-pago?`,
      items: [openLinesSentence(view), "Os próximos aceites pedem Pix na hora."],
      action: "Voltar para pré-pago",
    };
  }
  const cycle = CYCLE_ADJECTIVE[next];
  const preview = view.previews[next];
  if (isInvoicedMode(current)) {
    return {
      title: `Trocar de ${CYCLE_ADJECTIVE[current]} para ${cycle}?`,
      items: [
        `Os serviços ainda não faturados entram no próximo fechamento do ${cycle}: ${dayLabel(preview.closeDate)}.`,
        "Faturas já emitidas não mudam.",
      ],
      action: `Trocar para ${cycle}`,
    };
  }
  return {
    title: `Ligar o faturado ${cycle} para ${companyName}?`,
    items: [
      "A partir do próximo aceite, a empresa não paga Pix na hora; a Freela adianta o pagamento dos freelancers.",
      `1ª fatura: fecha ${dayLabel(preview.closeDate)}, vence ${dayLabel(preview.dueDate)}.`,
      blockEnabled
        ? "Sem multa e sem juros. Bloqueio de publicar e aprovar no 4º dia depois do vencimento."
        : "Sem multa e sem juros. O bloqueio por atraso (4º dia depois do vencimento) ainda está desligado.",
      "Contratações já pagas por Pix não entram na fatura.",
    ],
    action: `Ligar faturado ${cycle}`,
  };
}

// ─── Uso do app (§0.3: o piloto é com quem opera pelo site) ───────────────────

/** Uso do app "recente" = nos últimos 30 dias. */
export const RECENT_APP_USE_DAYS = 30;

/**
 * Aviso para escolher o piloto. A versão do app que mostra o faturado ainda
 * não tem número (A3 sai com o OK do dono): por isso o texto não cita versão.
 */
export function appUsageHint(lastAppDay: DateKey | null, today: DateKey): string | null {
  if (!lastAppDay) return null;
  const days = daysBetween(lastAppDay, today);
  if (days === null || days < 0 || days > RECENT_APP_USE_DAYS) return null;
  return `Esta empresa usou o app em ${ddmm(lastAppDay)}. O app ainda não mostra o faturado; prefira começar por quem usa o site.`;
}

// ─── Aviso de "Salvo." ────────────────────────────────────────────────────────

export function billingChangeSummary(patch: {
  billingMode?: BillingMode;
  billingEmail?: string | null;
}): string {
  const parts: string[] = [];
  if (patch.billingMode) parts.push(`Modo de cobrança: ${BILLING_MODE_SHORT[patch.billingMode]}`);
  if (patch.billingEmail !== undefined) {
    parts.push(`E-mail do financeiro: ${patch.billingEmail || "vazio (usa o de contato)"}`);
  }
  return parts.join("; ");
}

import { jsPDF } from "jspdf";
import type {
  ContractorReportResult,
  ContractorReportRow,
  ContractorReportRepasse,
} from "./admin-api";

const brl = (c: number | null | undefined) =>
  c == null
    ? "—"
    : "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

const fmtCpf = (raw: string | null | undefined) => {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : String(raw);
};

/** O backend devolve json (repasse/contractor_payment); o driver normalmente já parseia,
 *  mas tratamos string por segurança. */
function asObj<T>(v: T | string | null | undefined): T | null {
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v as T;
}

const isPaid = (rp: ContractorReportRepasse | null) =>
  !!rp && (rp.status === "COMPLETED" || rp.status === "MOVEMENT_CONFIRMED");

interface Col {
  label: string;
  x: number;
  w: number;
  align: "left" | "right";
}

/** Layout legado (sem decomposição): 3 colunas de dinheiro (repasse/taxa/pago). */
const COLS: Col[] = [
  { label: "Nome completo", x: 12, w: 64, align: "left" },
  { label: "CPF", x: 76, w: 32, align: "left" },
  { label: "Vaga", x: 108, w: 44, align: "left" },
  { label: "Data", x: 152, w: 22, align: "left" },
  { label: "Valor do repasse", x: 174, w: 34, align: "right" },
  { label: "Taxa", x: 208, w: 30, align: "right" },
  { label: "Valor pago", x: 238, w: 47, align: "right" },
];

/**
 * Layout com decomposição (spec 2026-09-02): usado quando ALGUMA vaga do
 * relatório já foi precificada no modelo novo. Troca CPF por colunas
 * explícitas de taxa/pix/seguro/INSS/repasse líquido — todas reconciliam
 * (taxa + pix + seguro + repasse líquido = você paga) para as vagas com
 * decomposição; vagas antigas mostram "—" nas colunas novas e mantêm
 * repasse/pago no fim. Espelho de `COLS_DECOMP` em freela-web-v2
 * (contractor-report-pdf.ts).
 */
const COLS_DECOMP: Col[] = [
  { label: "Nome completo", x: 12, w: 52, align: "left" },
  { label: "Vaga", x: 66, w: 40, align: "left" },
  { label: "Data", x: 108, w: 18, align: "left" },
  { label: "Taxa serviço", x: 128, w: 26, align: "right" },
  { label: "Pix", x: 156, w: 16, align: "right" },
  { label: "Seguro", x: 174, w: 20, align: "right" },
  { label: "INSS", x: 196, w: 20, align: "right" },
  { label: "Repasse líquido", x: 218, w: 32, align: "right" },
  { label: "Você paga", x: 252, w: 33, align: "right" },
];

/**
 * Taxa fixa do Pix por transferência (mesmo valor de
 * `FIXED_PIX_FEE_IN_CENTS` em freela-web-v2). LIMITAÇÃO CONHECIDA (espelha o
 * web): usa a constante VIGENTE, não um valor histórico por linha — a linha
 * do relatório vinda do backend não carrega uma coluna de pix.
 */
const FIXED_PIX_FEE_IN_CENTS = 185;

/**
 * Gera e baixa o PDF do relatório de freelancers CONTRATADOS de um contratante,
 * no mesmo formato validado manualmente (tabela paisagem A4).
 */
export function generateContractorReportPdf(
  result: ContractorReportResult,
  range?: { from?: string; to?: string },
): void {
  const { contractor, rows } = result;

  const hired = rows
    .filter((r) => r.candidacy_status === "ACCEPTED")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const records = hired.map((f: ContractorReportRow) => {
    const rp = asObj<ContractorReportRepasse>(f.repasse);
    const pay = asObj<{ status: string; value: number }>(f.contractor_payment);
    const hasDecomposition =
      f.taxa_servico_in_cents != null &&
      f.seguro_in_cents != null &&
      f.total_freelance_in_cents != null &&
      f.inss_in_cents != null &&
      f.repasse_liquido_in_cents != null;
    return {
      nome: f.freelancer_name || "—",
      cpf:
        fmtCpf(f.freelancer_cpf_casa) ||
        (rp && /cpf/i.test(rp.pixKeyType || "") ? fmtCpf(rp.pixKey) : null) ||
        "—",
      vaga: f.title || f.candidacy_role || f.vacancy_service || "—",
      data: fmtDate(f.date),
      vacancyId: f.vacancy_id,
      // Repasse líquido (modelo novo) já é o que o freela de fato recebe —
      // difere do `freelancer_amount_in_cents`/`rp.amount` legado porque o
      // seguro e a taxa Pix saem do lado dele antes do INSS.
      repasseCents: hasDecomposition
        ? f.repasse_liquido_in_cents
        : rp
          ? rp.amount
          : f.freelancer_amount_in_cents,
      repassePending: !isPaid(rp),
      // "Valor pago" só quando o pagamento LIQUIDOU: o backend devolve a
      // cobrança mais recente de QUALQUER status (preferindo COMPLETED), e
      // cobrança pendente/expirada entrava no total de um PDF que vai pro cliente.
      pagoCents: pay && pay.status === "COMPLETED" ? pay.value : null,
      hasDecomposition,
      taxaServicoCents: hasDecomposition ? f.taxa_servico_in_cents : null,
      pixCents: hasDecomposition ? FIXED_PIX_FEE_IN_CENTS : null,
      seguroCents: hasDecomposition ? f.seguro_in_cents : null,
      inssCents: hasDecomposition ? f.inss_in_cents : null,
      repasseLiquidoCents: hasDecomposition ? f.repasse_liquido_in_cents : null,
    };
  });

  // Repasse de cada freelancer somado por VAGA: o pagamento é da vaga, o repasse
  // é de cada posição preenchida.
  const repassePorVaga = new Map<string, number>();
  for (const r of records) {
    repassePorVaga.set(
      r.vacancyId,
      (repassePorVaga.get(r.vacancyId) ?? 0) + (r.repasseCents || 0),
    );
  }

  /**
   * A taxa legada é o que SOBRA do que o contratante pagou depois do repasse
   * — não o `platform_fee_in_cents` da vaga (taxa BRUTA do anúncio, antes do
   * desconto da assinatura e da taxa fixa; exibi-lo fazia as colunas não
   * fecharem — reclamação do Coco Bambu Jundiaí, 18/08).
   *
   * Vagas no modelo novo de decomposição (spec 2026-09-02) não usam mais essa
   * heurística: a taxa vem explícita (taxaServico + pix + seguro), que
   * reconcilia exatamente com o repasse líquido e o valor pago.
   *
   * Pagamento e taxa saem UMA vez por vaga, na primeira linha dela. Numa vaga com
   * várias posições, repetir por linha somaria o mesmo pagamento várias vezes.
   */
  const vagaJaExibida = new Set<string>();
  const linhas = records.map((r) => {
    const primeiraDaVaga = !vagaJaExibida.has(r.vacancyId);
    if (primeiraDaVaga) vagaJaExibida.add(r.vacancyId);
    const pagoCents = primeiraDaVaga ? r.pagoCents : null;

    let taxaCents: number | null = null;
    if (primeiraDaVaga && r.pagoCents != null) {
      taxaCents = r.hasDecomposition
        ? (r.taxaServicoCents ?? 0) + (r.pixCents ?? 0) + (r.seguroCents ?? 0)
        : r.pagoCents - (repassePorVaga.get(r.vacancyId) ?? 0);
    }

    return { ...r, pagoCents, taxaCents };
  });

  const anyDecomposition = linhas.some((r) => r.hasDecomposition);
  const cols = anyDecomposition ? COLS_DECOMP : COLS;

  let totRepasse = 0;
  let totTaxa = 0;
  let totPago = 0;
  let totTaxaServico = 0;
  let totPix = 0;
  let totSeguro = 0;
  let totInss = 0;
  for (const r of linhas) {
    totRepasse += r.repasseCents || 0;
    totTaxa += r.taxaCents || 0;
    totPago += r.pagoCents || 0;
    totTaxaServico += r.taxaServicoCents || 0;
    totPix += r.pixCents || 0;
    totSeguro += r.seguroCents || 0;
    totInss += r.inssCents || 0;
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const PW = 297;
  const PH = 210;
  const L = 12;
  const RIGHT = PW - 12;
  let y = 16;

  const fit = (s: string, wmm: number, size: number) => {
    doc.setFontSize(size);
    s = String(s);
    if (doc.getTextWidth(s) <= wmm) return s;
    while (s.length > 1 && doc.getTextWidth(s + "…") > wmm) s = s.slice(0, -1);
    return s + "…";
  };
  const cell = (txt: string, col: Col, size: number) => {
    doc.setFontSize(size);
    if (col.align === "right") {
      doc.text(fit(txt, col.w - 1, size), col.x + col.w - 1, y, { align: "right" });
    } else {
      doc.text(fit(txt, col.w - 1, size), col.x, y);
    }
  };
  const drawHeader = () => {
    doc.setFillColor(238, 168, 38);
    doc.rect(L, y - 4, RIGHT - L, 6.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 30, 5);
    for (const col of cols) cell(col.label, col, 8);
    y += 5.5;
  };

  // Cabeçalho do documento
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text("Relatório de Freelancers Contratados", L, y);
  y += 7;
  doc.setFontSize(12);
  doc.setTextColor(196, 123, 14);
  doc.text(contractor.companyName || "—", L, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `${contractor.contactName || "—"}  ·  ${contractor.contactPhone || "—"}  ·  ${contractor.city || ""}/${contractor.uf || ""}`,
    L,
    y,
  );
  y += 5;
  const periodo =
    range?.from || range?.to
      ? `Período: ${range?.from ? fmtDate(range.from) : "início"} até ${range?.to ? fmtDate(range.to) : "hoje"}`
      : `Desde ${fmtDate(contractor.createdAt)}`;
  doc.text(`${periodo}  ·  Total de contratações: ${linhas.length}  ·  Somente contratados`, L, y);
  y += 7;

  drawHeader();

  doc.setFont("helvetica", "normal");
  let i = 0;
  for (const r of linhas) {
    if (y > PH - 22) {
      doc.addPage();
      y = 16;
      drawHeader();
      doc.setFont("helvetica", "normal");
    }
    i++;
    if (i % 2 === 0) {
      doc.setFillColor(248, 248, 245);
      doc.rect(L, y - 4, RIGHT - L, 6, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(35, 35, 35);

    if (anyDecomposition) {
      // Nome / Vaga / Data / Taxa serviço / Pix / Seguro / INSS / Repasse líquido / Você paga.
      // Vagas legadas (sem decomposição, `hasDecomposition===false`) mostram
      // "—" nas colunas explícitas — só a linha "Repasse líquido"/"Você paga"
      // reaproveita o repasse/pago legado dessa vaga (ver legenda no rodapé).
      const dash = (v: number | null) => (v == null ? "—" : brl(v));
      cell(r.nome, cols[0], 8);
      cell(r.vaga, cols[1], 8);
      cell(r.data, cols[2], 8);
      doc.setTextColor(110, 110, 110);
      cell(dash(r.taxaServicoCents), cols[3], 8);
      cell(dash(r.pixCents), cols[4], 8);
      cell(dash(r.seguroCents), cols[5], 8);
      cell(dash(r.inssCents), cols[6], 8);
      if (r.repassePending) doc.setTextColor(150, 120, 10);
      else doc.setTextColor(22, 110, 60);
      cell(brl(r.repasseCents) + (r.repassePending ? " *" : ""), cols[7], 8);
      doc.setTextColor(35, 35, 35);
      cell(brl(r.pagoCents), cols[8], 8);
    } else {
      cell(r.nome, cols[0], 8);
      cell(r.cpf, cols[1], 8);
      cell(r.vaga, cols[2], 8);
      cell(r.data, cols[3], 8);
      if (r.repassePending) doc.setTextColor(150, 120, 10);
      else doc.setTextColor(22, 110, 60);
      cell(brl(r.repasseCents) + (r.repassePending ? " *" : ""), cols[4], 8);
      doc.setTextColor(110, 110, 110);
      cell(brl(r.taxaCents), cols[5], 8);
      doc.setTextColor(35, 35, 35);
      cell(brl(r.pagoCents), cols[6], 8);
    }
    y += 6;
  }

  if (y > PH - 22) {
    doc.addPage();
    y = 16;
    drawHeader();
  }
  y += 1;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(L, y - 4, RIGHT, y - 4);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  cell("TOTAIS", cols[0], 8.5);
  if (anyDecomposition) {
    cell(brl(totTaxaServico), cols[3], 8.5);
    cell(brl(totPix), cols[4], 8.5);
    cell(brl(totSeguro), cols[5], 8.5);
    cell(brl(totInss), cols[6], 8.5);
    cell(brl(totRepasse), cols[7], 8.5);
    cell(brl(totPago), cols[8], 8.5);
  } else {
    cell(brl(totRepasse), cols[4], 8.5);
    cell(brl(totTaxa), cols[5], 8.5);
    cell(brl(totPago), cols[6], 8.5);
  }
  y += 8;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);
  doc.text(
    anyDecomposition
      ? '* repasse ainda não confirmado (pendente/falhou). Taxa serviço + Pix + Seguro + Repasse líquido = Você paga · INSS: descontado do total da vaga e retido para a guia do INSS/prestação de contas — é a diferença entre o Total da vaga e o Você paga · "—" = vaga anterior à decomposição (modelo antigo).'
      : "* repasse ainda não confirmado (pendente/falhou). Repasse = pago ao freelancer · Taxa = valor pago − repasse · Valor pago = pago pelo contratante (uma vez por vaga).",
    L,
    Math.min(y, PH - 12),
  );

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(`Freela · ${contractor.companyName || ""} · pág. ${p}/${pages}`, L, PH - 8);
  }

  const slug = (contractor.companyName || "contratante")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  doc.save(`relatorio-${slug}.pdf`);
}

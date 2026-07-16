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
    return {
      nome: f.freelancer_name || "—",
      cpf:
        fmtCpf(f.freelancer_cpf_casa) ||
        (rp && /cpf/i.test(rp.pixKeyType || "") ? fmtCpf(rp.pixKey) : null) ||
        "—",
      vaga: f.title || f.candidacy_role || f.vacancy_service || "—",
      data: fmtDate(f.date),
      vacancyId: f.vacancy_id,
      repasseCents: rp ? rp.amount : f.freelancer_amount_in_cents,
      repassePending: !isPaid(rp),
      taxaCents: f.platform_fee_in_cents, // taxa real da plataforma (não calcular por proxy)
      // "Valor pago" só quando o pagamento LIQUIDOU: o backend devolve a
      // cobrança mais recente de QUALQUER status (preferindo COMPLETED), e
      // cobrança pendente/expirada entrava no total de um PDF que vai pro cliente.
      pagoCents: pay && pay.status === "COMPLETED" ? pay.value : null,
    };
  });

  // totais (repasse por contratação; taxa/pago por vaga única p/ não duplicar)
  let totRepasse = 0;
  let totTaxa = 0;
  let totPago = 0;
  const seen = new Set<string>();
  for (const r of records) {
    totRepasse += r.repasseCents || 0;
    if (!seen.has(r.vacancyId)) {
      seen.add(r.vacancyId);
      totTaxa += r.taxaCents || 0;
      totPago += r.pagoCents || 0;
    }
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
    for (const col of COLS) cell(col.label, col, 8);
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
  doc.text(`${periodo}  ·  Total de contratações: ${records.length}  ·  Somente contratados`, L, y);
  y += 7;

  drawHeader();

  doc.setFont("helvetica", "normal");
  let i = 0;
  for (const r of records) {
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
    cell(r.nome, COLS[0], 8);
    cell(r.cpf, COLS[1], 8);
    cell(r.vaga, COLS[2], 8);
    cell(r.data, COLS[3], 8);
    if (r.repassePending) doc.setTextColor(150, 120, 10);
    else doc.setTextColor(22, 110, 60);
    cell(brl(r.repasseCents) + (r.repassePending ? " *" : ""), COLS[4], 8);
    doc.setTextColor(110, 110, 110);
    cell(brl(r.taxaCents), COLS[5], 8);
    doc.setTextColor(35, 35, 35);
    cell(brl(r.pagoCents), COLS[6], 8);
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
  cell("TOTAIS", COLS[0], 8.5);
  cell(brl(totRepasse), COLS[4], 8.5);
  cell(brl(totTaxa), COLS[5], 8.5);
  cell(brl(totPago), COLS[6], 8.5);
  y += 8;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(140, 140, 140);
  doc.text(
    "* repasse ainda não confirmado (pendente/falhou). Repasse = pago ao freelancer · Taxa = taxa da plataforma · Valor pago = pago pelo contratante.",
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

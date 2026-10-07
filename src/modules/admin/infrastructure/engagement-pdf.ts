import { jsPDF } from "jspdf";
import {
  cityTable,
  contractorReportTables,
  measurementText,
  overviewFunnelLines,
  overviewSummaryTables,
  type PdfTable,
} from "@/modules/admin/application/engagement-export";
import { dateBR, dateTimeBR, lastDayBR } from "@/modules/admin/application/engagement-format";
import { SERIES_LINES } from "@/modules/admin/application/engagement-metrics";
import type { ContractorDetail, EngagementOverview } from "./engagement-api";

/**
 * PDFs do engajamento (spec §5.2), montados com jsPDF, não com captura de tela.
 * Fonte helvetica = WinAnsi: nada de "−" (U+2212), "≤" ou "≥"; acentos, "—",
 * "·" e "…" funcionam. Mesmo visual do relatório de contratante (faixa
 * laranja, zebra). A4 retrato, em mm.
 */
const PW = 210;
const PH = 297;
const L = 14;
const W = PW - 2 * L;
const ROW_H = 6.5;
const BOTTOM = PH - 22;
const TOP = 18;
/** Tamanho do gráfico de exportação (series-chart.tsx), para manter a proporção. */
const CHART_W_PX = 720;
const CHART_H_PX = 300;

type Rgb = [number, number, number];
const INK: Rgb = [29, 29, 27];
const MUTED: Rgb = [115, 115, 115];
const WARN: Rgb = [161, 98, 7];

function hexRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

class PdfWriter {
  readonly doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  y = TOP;

  /** Corta com "…" o que não cabe na largura. */
  fit(text: string, wmm: number, size: number): string {
    this.doc.setFontSize(size);
    let s = String(text);
    if (this.doc.getTextWidth(s) <= wmm) return s;
    while (s.length > 1 && this.doc.getTextWidth(`${s}…`) > wmm) s = s.slice(0, -1);
    return `${s}…`;
  }

  wrap(text: string, wmm: number, size: number): string[] {
    this.doc.setFontSize(size);
    const lines: string[] = [];
    let cur = "";
    for (const word of text.split(" ")) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && this.doc.getTextWidth(next) > wmm) {
        lines.push(cur);
        cur = word;
      } else {
        cur = next;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  ensure(h: number): void {
    if (this.y + h > BOTTOM) {
      this.doc.addPage();
      this.y = TOP;
    }
  }

  color([r, g, b]: Rgb): void {
    this.doc.setTextColor(r, g, b);
  }

  header(title: string, subtitle: string): void {
    const d = this.doc;
    d.setFillColor(238, 168, 38);
    d.rect(0, 0, PW, 26, "F");
    this.color(INK);
    d.setFont("helvetica", "bold");
    d.text(this.fit(title, W, 16), L, 12);
    d.setFont("helvetica", "normal");
    d.text(this.fit(subtitle, W, 10), L, 20);
    this.y = 34;
  }

  paragraph(text: string, size = 9, rgb: Rgb = MUTED): void {
    this.doc.setFont("helvetica", "normal");
    for (const line of this.wrap(text, W, size)) {
      this.ensure(5);
      this.doc.setFontSize(size);
      this.color(rgb);
      this.doc.text(line, L, this.y);
      this.y += size * 0.45 + 1;
    }
    this.y += 2;
  }

  sectionTitle(text: string): void {
    this.ensure(12);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(11.5);
    this.color(INK);
    this.doc.text(text, L, this.y);
    this.y += 6;
  }

  lines(texts: string[]): void {
    this.doc.setFont("helvetica", "normal");
    for (const t of texts) {
      this.ensure(5);
      this.doc.setFontSize(9);
      this.color(INK);
      this.doc.text(this.fit(t, W, 9), L, this.y);
      this.y += 5;
    }
    this.y += 3;
  }

  table(t: PdfTable, widths: number[], right: boolean[]): void {
    const d = this.doc;
    const xs: number[] = [];
    widths.reduce((x, w) => {
      xs.push(x);
      return x + w;
    }, L);
    const row = (cells: string[], bold: boolean) => {
      d.setFont("helvetica", bold ? "bold" : "normal");
      this.color(INK);
      cells.forEach((c, i) => {
        const s = this.fit(c, widths[i] - 2, 8.5);
        if (right[i]) d.text(s, xs[i] + widths[i] - 1, this.y, { align: "right" });
        else d.text(s, xs[i] + 1, this.y);
      });
      this.y += ROW_H;
    };
    const head = () => {
      d.setFillColor(238, 168, 38);
      d.rect(L, this.y - 4.5, W, ROW_H, "F");
      row(t.head, true);
    };
    this.ensure(12 + ROW_H * 2);
    this.sectionTitle(t.title);
    head();
    if (t.rows.length === 0) {
      d.setFont("helvetica", "normal");
      d.setFontSize(8.5);
      this.color(MUTED);
      d.text("Nada no período.", L + 1, this.y);
      this.y += ROW_H;
    }
    t.rows.forEach((cells, i) => {
      if (this.y + ROW_H > BOTTOM) {
        d.addPage();
        this.y = TOP;
        head();
      }
      if (i % 2 === 1) {
        d.setFillColor(248, 248, 245);
        d.rect(L, this.y - 4.5, W, ROW_H, "F");
      }
      row(cells, false);
    });
    this.y += 4;
  }

  image(png: string, wpx: number, hpx: number): void {
    const h = (W * hpx) / wpx;
    this.ensure(h + 4);
    this.doc.addImage(png, "PNG", L, this.y, W, h);
    this.y += h + 4;
  }

  legend(items: { label: string; color: string }[]): void {
    const d = this.doc;
    this.ensure(8);
    let x = L;
    d.setFont("helvetica", "normal");
    d.setFontSize(8);
    for (const it of items) {
      const [r, g, b] = hexRgb(it.color);
      d.setFillColor(r, g, b);
      d.rect(x, this.y - 2.6, 3, 3, "F");
      this.color(INK);
      d.text(it.label, x + 4.5, this.y);
      x += 4.5 + d.getTextWidth(it.label) + 6;
    }
    this.y += 7;
  }

  footer(left: string): void {
    const d = this.doc;
    const pages = d.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      d.setPage(p);
      d.setFont("helvetica", "normal");
      d.setTextColor(150, 150, 150);
      d.text(this.fit(`${left} · página ${p} de ${pages}`, W, 7.5), L, PH - 8);
    }
  }
}

/** PDF do painel: só agregados (pode ir para diretoria e investidor). */
export function buildOverviewPdf(
  o: EngagementOverview,
  filtersText: string,
  chartPng: string | null,
  generatedAt: Date,
): jsPDF {
  const w = new PdfWriter();
  w.header("Engajamento na Freela", `${o.period.label} · comparado com ${o.period.previousLabel}`);
  w.paragraph(filtersText);
  if (!o.openedAvailable.current || !o.openedAvailable.previous) {
    w.paragraph(
      `${measurementText(o)}. Sem medição, os números de "abriram" aparecem como — (não é zero).`,
      8.5,
      WARN,
    );
  }
  for (const t of overviewSummaryTables(o)) w.table(t, [92, 30, 30, 30], [false, true, true, true]);
  for (const f of overviewFunnelLines(o)) {
    w.sectionTitle(f.title);
    w.lines(f.lines);
  }
  if (chartPng) {
    w.ensure(12 + (W * CHART_H_PX) / CHART_W_PX + 12);
    w.sectionTitle("Evolução no período");
    w.image(chartPng, CHART_W_PX, CHART_H_PX);
    w.legend(SERIES_LINES);
  }
  w.table(cityTable(o), [70, 25, 30, 27, 30], [false, true, true, true, true]);
  w.footer(`Freela · Engajamento · ${o.period.label} · gerado em ${dateTimeBR(generatedAt)}`);
  return w.doc;
}

/**
 * Relatório para enviar à empresa: números e vagas dela no período, com o 1º
 * nome de quem trabalhou. Sem telefone, e-mail ou documento de ninguém.
 */
export function buildContractorReportPdf(d: ContractorDetail, generatedAt: Date): jsPDF {
  const w = new PdfWriter();
  const range = `${dateBR(d.period.start)} a ${lastDayBR(d.period.end)}`;
  w.header(d.summary.name, `Relatório de vagas · ${range}`);
  w.paragraph(`Período: ${d.period.label}. Comparado com: ${d.period.previousLabel}.`);
  const { numbers, vacancies } = contractorReportTables(d);
  w.table(numbers, [102, 40, 40], [false, true, true]);
  w.table(vacancies, [22, 50, 34, 22, 30, 24], [false, false, false, true, false, false]);
  w.footer(`Freela · ${d.summary.name} · ${range} · gerado em ${dateTimeBR(generatedAt)}`);
  return w.doc;
}

import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/admin/infrastructure/vacancy-documents-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/admin/infrastructure/vacancy-documents-api")>()),
  reissueVacancyNfse: vi.fn(),
  getVacancyNfse: vi.fn(),
  getVacancyDocumentHtml: vi.fn(),
}));

import type {
  VacancyDocuments,
  VacancyDocumentsDetail,
} from "@/modules/admin/infrastructure/admin-api";
import type { VacancyNfseInvoice } from "@/modules/admin/infrastructure/vacancy-documents-api";
import { VacancyDocumentsCell } from "./vacancy-documents-cell";

const ALL_OK: VacancyDocuments = { contract: "OK", receipt: "OK", rpa: "OK", nfse: "OK" };

function renderCell(props: {
  documents: VacancyDocuments;
  detail?: VacancyDocumentsDetail;
  paymentMethod?: string | null;
  nfseInvoice?: VacancyNfseInvoice | null;
}) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <VacancyDocumentsCell variant="full" vacancyId="vac-1" {...props} />
    </QueryClientProvider>,
  );
}

const nfseItem = () =>
  screen.getAllByRole("listitem").find((li) => li.textContent?.startsWith("NF-e")) as HTMLElement;

describe("VacancyDocumentsCell — NFS-e da vaga faturada (AD2c.3)", () => {
  it("vaga faturada: 'NFS-e na fatura FAT-2026-000123' com link para a fatura; sem 'Reemitir'", () => {
    renderCell({
      documents: { ...ALL_OK, nfse: "FAILED" },
      detail: { nfse: "NFS-e na fatura FAT-2026-000123: Inscrição municipal inválida" },
      paymentMethod: "INVOICE",
      nfseInvoice: { invoiceId: "inv-123", number: "FAT-2026-000123" },
    });

    const link = screen.getByRole("link", { name: "NFS-e na fatura FAT-2026-000123" });
    expect(link).toHaveAttribute("href", "/financeiro/faturas/inv-123");
    expect(screen.queryByRole("button", { name: /Reemitir/ })).not.toBeInTheDocument();
    expect(within(nfseItem()).queryByRole("button")).not.toBeInTheDocument();
    // O motivo que a API mandou continua escrito embaixo.
    expect(
      screen.getByText("NFS-e na fatura FAT-2026-000123: Inscrição municipal inválida"),
    ).toBeInTheDocument();
  });

  it("paymentMethod INVOICE com nfseInvoice: link direto para /financeiro/faturas/<id>, nunca o fallback", () => {
    renderCell({
      documents: { ...ALL_OK, nfse: "PENDING" },
      // Texto com outro número: o link segue o nfseInvoice, não o texto.
      detail: { nfse: "NFS-e na fatura FAT-2026-000999: aguardando emissão" },
      paymentMethod: "INVOICE",
      nfseInvoice: { invoiceId: "inv-777", number: "FAT-2026-000777" },
    });

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("NFS-e na fatura FAT-2026-000777");
    expect(links[0]).toHaveAttribute("href", "/financeiro/faturas/inv-777");
    expect(screen.queryByRole("link", { name: /FAT-2026-000999/ })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/financeiro?aba=faturas"]')).toBeNull();
  });

  it("fallback: o texto do link é 'NFS-e na fatura FAT-AAAA-N' tirado do texto da API", () => {
    renderCell({
      documents: { ...ALL_OK, nfse: "PENDING" },
      detail: { nfse: "NFS-e na fatura FAT-2026-000131: sai quando a fatura for paga" },
      paymentMethod: "INVOICE",
    });

    const link = screen.getByRole("link");
    expect(link.textContent).toMatch(/^NFS-e na fatura FAT-\d{4}-\d+$/);
    expect(link).toHaveTextContent("NFS-e na fatura FAT-2026-000131");
    expect(link).toHaveAttribute("href", "/financeiro?aba=faturas");
  });

  it("vaga faturada com a nota emitida: o link da fatura no lugar de 'Abrir' (não há nota da vaga)", () => {
    renderCell({
      documents: ALL_OK,
      detail: { nfse: "NFS-e na fatura FAT-2026-000123" },
      paymentMethod: "INVOICE",
      nfseInvoice: { invoiceId: "inv 123", number: "FAT-2026-000123" },
    });

    expect(screen.getByRole("link", { name: "NFS-e na fatura FAT-2026-000123" })).toHaveAttribute(
      "href",
      "/financeiro/faturas/inv%20123",
    );
    // Contrato, recibo e RPA abrem como hoje; a NF-e não.
    expect(screen.getAllByRole("button", { name: "Abrir" })).toHaveLength(3);
    expect(within(nfseItem()).queryByRole("button", { name: "Abrir" })).not.toBeInTheDocument();
  });

  it("vaga faturada sem o id da fatura na resposta: link para a aba Faturas com o número da API", () => {
    renderCell({
      documents: { ...ALL_OK, nfse: "FAILED" },
      detail: { nfse: "NFS-e na fatura FAT-2026-000131: emissão falhou" },
      paymentMethod: "INVOICE",
    });

    expect(screen.getByRole("link", { name: "NFS-e na fatura FAT-2026-000131" })).toHaveAttribute(
      "href",
      "/financeiro?aba=faturas",
    );
    expect(screen.queryByRole("button", { name: /Reemitir/ })).not.toBeInTheDocument();
  });

  it("vaga zerada por cupom: o texto da API, sem link e sem 'Reemitir'", () => {
    renderCell({
      documents: { ...ALL_OK, nfse: "NA" },
      detail: { nfse: "Sem NFS-e: o cupom CORTESIA cobriu a vaga" },
      paymentMethod: "INVOICE",
      nfseInvoice: null,
    });

    expect(screen.getByText("Sem NFS-e: o cupom CORTESIA cobriu a vaga")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reemitir/ })).not.toBeInTheDocument();
  });

  it("vaga faturada antes do fechamento (nfseInvoice null): sem link e sem 'Reemitir'", () => {
    renderCell({
      documents: { ...ALL_OK, nfse: "NA" },
      detail: { nfse: "NFS-e na fatura: sai depois que a fatura for paga" },
      nfseInvoice: null,
    });

    expect(screen.getByText("NFS-e na fatura: sai depois que a fatura for paga")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("pré-pago: 'Reemitir' na NF-e recusada e 'Abrir' na emitida, como hoje", () => {
    const { unmount } = renderCell({
      documents: { ...ALL_OK, nfse: "FAILED" },
      detail: { nfse: "Inscrição municipal inválida" },
      paymentMethod: "PIX",
    });
    expect(screen.getByRole("button", { name: /Reemitir/ })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    unmount();

    renderCell({ documents: ALL_OK, paymentMethod: "PIX" });
    expect(screen.getAllByRole("button", { name: "Abrir" })).toHaveLength(4);
  });
});

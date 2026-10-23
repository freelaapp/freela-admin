import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/modules/admin/infrastructure/vacancy-documents-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/admin/infrastructure/vacancy-documents-api")>()),
  reissueVacancyNfse: vi.fn(),
  getVacancyNfse: vi.fn(),
  getVacancyDocumentHtml: vi.fn(),
  getCompanyDocumentHtml: vi.fn(),
}));

import type {
  VacancyDocuments,
  VacancyDocumentsDetail,
} from "@/modules/admin/infrastructure/admin-api";
import {
  getCompanyDocumentHtml,
  type VacancyNfseInvoice,
} from "@/modules/admin/infrastructure/vacancy-documents-api";
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
      paymentMethod: "INVOICE",
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

  it("pré-pago com nfseInvoice null (como as listas mandam desde 13/10): 'Abrir' e 'Reemitir' na NF-e", () => {
    const { unmount } = renderCell({ documents: ALL_OK, paymentMethod: "PIX", nfseInvoice: null });
    expect(within(nfseItem()).getByRole("button", { name: "Abrir" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Abrir" })).toHaveLength(4);
    unmount();

    renderCell({
      documents: { ...ALL_OK, nfse: "FAILED" },
      detail: { nfse: "Inscrição municipal inválida" },
      paymentMethod: "PIX",
      nfseInvoice: null,
    });
    expect(within(nfseItem()).getByRole("button", { name: /Reemitir/ })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

// Plano 2026-10-22 §2.16 (AD-D): Nota de Débito (ND) e comprovante de pagamento
// (PG) da empresa, só quando a API manda a chave em `documents`.
describe("VacancyDocumentsCell — documentos da empresa (AD-D)", () => {
  function renderCompact(documents: VacancyDocuments) {
    const qc = new QueryClient();
    return render(
      <QueryClientProvider client={qc}>
        <VacancyDocumentsCell documents={documents} />
      </QueryClientProvider>,
    );
  }

  it("pastilha ND na coluna da listagem, com o nome inteiro no title", () => {
    const { container } = renderCompact({ ...ALL_OK, debitNote: "OK", paymentProof: "NA" });

    const pills = Array.from(container.querySelectorAll("span[title]"));
    // A sigla é o primeiro nó de texto da pastilha (depois vêm o símbolo e o rótulo do leitor de tela).
    expect(pills.map((pill) => pill.childNodes[0]?.textContent)).toEqual(["C", "R", "RPA", "NF", "ND", "PG"]);
    expect(pills[4]).toHaveAttribute("title", "Nota de Débito: Emitido");
    expect(pills[5]).toHaveAttribute("title", "Comprovante de pagamento: Não se aplica");
    expect(pills[1]).toHaveAttribute("title", "Recibo do freelancer: Emitido");
  });

  it("sem os campos novos (chaves desligadas ou API antiga): as quatro pastilhas de hoje", () => {
    const { container } = renderCompact(ALL_OK);

    const pills = Array.from(container.querySelectorAll("span[title]"));
    expect(pills.map((pill) => pill.childNodes[0]?.textContent)).toEqual(["C", "R", "RPA", "NF"]);
    expect(pills[1]).toHaveAttribute("title", "Recibo: Emitido");
  });

  it("detalhe: 'Abrir' da Nota de Débito emitida busca o HTML da rota da empresa", async () => {
    vi.mocked(getCompanyDocumentHtml).mockResolvedValue("<html><head></head><body>ND</body></html>");
    const tab = { document: { write: vi.fn() }, location: { href: "" }, close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    Object.assign(URL, { createObjectURL: vi.fn(() => "blob:nd"), revokeObjectURL: vi.fn() });
    renderCell({ documents: { ...ALL_OK, debitNote: "OK" } });

    const item = screen.getAllByRole("listitem").find((li) => li.textContent?.startsWith("Nota de Débito")) as HTMLElement;
    fireEvent.click(within(item).getByRole("button", { name: /Abrir/ }));

    await waitFor(() => expect(getCompanyDocumentHtml).toHaveBeenCalledWith("vac-1", "debitNote"));
    await waitFor(() => expect(tab.location.href).toBe("blob:nd"));
    open.mockRestore();
  });

  it("detalhe: Nota de Débito ainda não emitida não tem 'Abrir'", () => {
    renderCell({ documents: { ...ALL_OK, debitNote: "NA" }, detail: { debitNote: "Sai depois do serviço" } });

    const item = screen.getAllByRole("listitem").find((li) => li.textContent?.startsWith("Nota de Débito")) as HTMLElement;
    expect(within(item).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Sai depois do serviço")).toBeInTheDocument();
  });

  it("vaga faturada: a Nota de Débito é a da fatura (link), sem 'Abrir'", () => {
    renderCell({
      documents: { ...ALL_OK, debitNote: "NA" },
      detail: { debitNote: "Vaga faturada: os documentos estão na fatura" },
      paymentMethod: "INVOICE",
      nfseInvoice: { invoiceId: "inv-140", number: "FAT-2026-000140" },
    });

    const link = screen.getByRole("link", { name: "Nota de Débito na fatura FAT-2026-000140" });
    expect(link).toHaveAttribute("href", "/financeiro/faturas/inv-140");
  });
});

import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BillingModeSettings } from "@/modules/admin/infrastructure/billing-mode-api";
import { BillingModeConfirmDialog } from "./billing-mode-confirm-dialog";

const PREPAID: BillingModeSettings = {
  mode: "PREPAID",
  since: null,
  email: null,
  contactEmail: "contato@bardoze.com.br",
  editable: true,
  requirements: { missing: [] },
  appUsage: { lastAppDay: null },
  previews: {
    INVOICED_7: {
      period: { start: "2026-10-09", end: "2026-10-15" },
      closeDate: "2026-10-16",
      dueDate: "2026-10-19",
      blockFromDate: "2026-10-23",
    },
    INVOICED_15: {
      period: { start: "2026-10-01", end: "2026-10-15" },
      closeDate: "2026-10-16",
      dueDate: "2026-10-19",
      blockFromDate: "2026-10-23",
    },
    INVOICED_30: {
      period: { start: "2026-10-01", end: "2026-10-31" },
      closeDate: "2026-11-01",
      dueDate: "2026-11-04",
      blockFromDate: "2026-11-08",
    },
  },
  openPreview: null,
  extraordinaryInvoice: null,
};

const WEEKLY: BillingModeSettings = {
  ...PREPAID,
  mode: "INVOICED_7",
  openPreview: {
    lineCount: 5,
    debitsInCents: 70000,
    creditsInCents: 5970,
    totalInCents: 64030,
    calc: "700,00 − 59,70 = 640,30",
  },
  extraordinaryInvoice: { closeDate: "2026-10-11", dueDate: "2026-10-14", blockFromDate: "2026-10-18" },
};

function renderDialog(props: Partial<React.ComponentProps<typeof BillingModeConfirmDialog>>) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <BillingModeConfirmDialog
      open
      view={PREPAID}
      next="INVOICED_7"
      companyName="Bar do Zé"
      blockEnabled
      pending={false}
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onConfirm, onCancel, dialog: screen.getByRole("alertdialog") };
}

describe("BillingModeConfirmDialog", () => {
  it("ligar faturado semanal: os 4 itens do UX 5.3 com as datas do servidor", () => {
    const { dialog } = renderDialog({});

    expect(within(dialog).getByText("Ligar o faturado semanal para Bar do Zé?")).toBeInTheDocument();
    const items = within(dialog).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual([
      "A partir do próximo aceite, a empresa não paga Pix na hora; a Freela adianta o pagamento dos freelancers.",
      "1ª fatura: fecha sex 16/10, vence seg 19/10.",
      "Sem multa e sem juros. Bloqueio de publicar e aprovar no 4º dia depois do vencimento.",
      "Contratações já pagas por Pix não entram na fatura.",
    ]);
  });

  it("voltar para pré-pago: '5 lançamentos, R$ 640,30 vão para uma fatura extra fechada agora, com vencimento em qua 14/10' (openPreview + extraordinaryInvoice), com a conta", () => {
    const { dialog } = renderDialog({ view: WEEKLY, next: "PREPAID" });

    expect(within(dialog).getByText("Voltar Bar do Zé para pré-pago?")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Os lançamentos ainda não faturados (5 lançamentos, R$ 640,30) vão para uma fatura extra fechada agora, com vencimento em qua 14/10.",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Conta (débitos − créditos): 700,00 − 59,70 = 640,30. Fonte: lançamentos do faturado ainda sem fatura.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Os próximos aceites pedem Pix na hora.")).toBeInTheDocument();
  });

  it("trocar de ciclo: 'entram no próximo fechamento do mensal: dom 01/11'", () => {
    const { dialog } = renderDialog({ view: WEEKLY, next: "INVOICED_30" });

    expect(within(dialog).getByText("Trocar de semanal para mensal?")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Os serviços ainda não faturados entram no próximo fechamento do mensal: dom 01/11.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Faturas já emitidas não mudam.")).toBeInTheDocument();
  });

  it("botão diz o verbo e o modo; Cancelar não salva; salvando, os dois ficam travados", () => {
    const { onConfirm, onCancel } = renderDialog({});

    fireEvent.click(screen.getByRole("button", { name: "Ligar faturado semanal" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("enquanto salva, os botões ficam desabilitados", () => {
    renderDialog({ pending: true });

    expect(screen.getByRole("button", { name: /Salvando/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});

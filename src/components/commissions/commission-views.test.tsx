import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CommissionDashboard, StatementItem } from "@/lib/commissions/types";
import { CommissionDashboardView } from "./dashboard-view";
import { CommissionStatementView } from "./statement-view";
import { PeriodFilter } from "./period-filter";

const dash: CommissionDashboard = {
  period: { from: "2026-10-01", to: "2026-10-31" },
  rule: { description: "10% da taxa da Freela em cada serviço concluído · Empresa · sem prazo", mode: "PERCENT_OF_FEE" },
  registrations: { total: 3, empresa: 1, casa: 0, freelancer: 1, semPerfil: 1 },
  vacancies: { published: 4, hires: 2, completed: 1 },
  commission: { generatedInCents: 315, paidInCents: 0, openInCents: 315 },
  clients: [{ userId: "u1", name: "José", companyName: "Bar do Zé", vacancies: 4, completed: 1, commissionInCents: 315 }],
};

const items: StatementItem[] = [
  {
    type: "PAYOUT",
    id: "p1",
    paidAt: "2026-10-07T15:00:00.000Z",
    amountInCents: 315,
    paymentProof: "E123",
    periodEnd: "2026-10-05",
    reversedAt: null,
    reversalReason: null,
    entriesCount: 1,
  },
  {
    type: "ENTRY",
    id: "e1",
    kind: "COMMISSION",
    occurredAt: "2026-10-05T20:00:00.000Z",
    amountInCents: 315,
    clientName: "José",
    companyName: "Bar do Zé",
    module: "bars-restaurants",
    vacancyTitle: "Garçom",
    vacancyDate: "2026-10-05T00:00:00.000Z",
    baseFeeInCents: 3150,
    ruleDescription: "10% da taxa da Freela em cada serviço concluído · Empresa · sem prazo",
    reason: null,
    status: "PAID",
    payoutId: "p1",
    paidAt: "2026-10-07T15:00:00.000Z",
  },
];

describe("CommissionDashboardView", () => {
  it("mostra cartões, regra em texto e clientes", () => {
    render(<CommissionDashboardView data={dash} isLoading={false} />);
    expect(screen.getByText(/10% da taxa da Freela/)).toBeInTheDocument();
    expect(screen.getAllByText("R$ 3,15").length).toBeGreaterThan(0);
    expect(screen.getByText("Bar do Zé")).toBeInTheDocument();
  });
});

describe("CommissionStatementView", () => {
  it("lista pagamento e comissão, com cliente, vaga, regra e situação", () => {
    render(<CommissionStatementView items={items} />);
    expect(screen.getByText(/Comprovante E123/)).toBeInTheDocument();
    expect(screen.getByText("Garçom")).toBeInTheDocument();
    expect(screen.getByText(/pago em/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /estornar/i })).not.toBeInTheDocument();
  });

  it("botão de estornar só com o callback (admin)", () => {
    const onReverse = vi.fn();
    render(<CommissionStatementView items={items} onReversePayout={onReverse} />);
    fireEvent.click(screen.getByRole("button", { name: /estornar/i }));
    expect(onReverse).toHaveBeenCalledWith(items[0]);
  });

  it("vazio diz que não há lançamentos", () => {
    render(<CommissionStatementView items={[]} />);
    expect(screen.getByText(/nenhum lançamento/i)).toBeInTheDocument();
  });
});

describe("PeriodFilter", () => {
  it("personalizado mostra as datas", () => {
    const onChange = vi.fn();
    render(<PeriodFilter value={{ preset: "custom", customFrom: "", customTo: "" }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-10-01" } });
    expect(onChange).toHaveBeenCalledWith({ preset: "custom", customFrom: "2026-10-01", customTo: "" });
  });
});

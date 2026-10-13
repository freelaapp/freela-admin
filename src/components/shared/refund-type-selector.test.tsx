import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { cancelResultMessage, RefundTypeSelector } from "./refund-type-selector";

describe("RefundTypeSelector", () => {
  it("sem a prop: textos de hoje (estorno do pagamento)", () => {
    render(<RefundTypeSelector value="FULL" onChange={vi.fn()} />);

    expect(screen.getByText("Estorno ao contratante")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Integral/ })).toHaveTextContent("Devolve tudo");
    expect(screen.getByRole("button", { name: /50%/ })).toHaveTextContent("Metade");
    expect(screen.getByRole("button", { name: /Nenhum/ })).toHaveTextContent("Sem estorno");
    expect(
      screen.getByText("Integral: devolve tudo (menos a taxa Pix). 50%: metade. Nenhum: sem estorno."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/fatura/)).not.toBeInTheDocument();
  });

  it("invoiced: 'Integral: não entra na fatura'; '50%: cobra 50% na fatura'; 'Nenhum: cobra 100% na fatura' (D12)", () => {
    render(<RefundTypeSelector value="FULL" onChange={vi.fn()} invoiced />);

    expect(screen.getByText("Efeito na fatura da empresa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Integral/ })).toHaveTextContent(
      "Não entra na fatura",
    );
    expect(screen.getByRole("button", { name: /50%/ })).toHaveTextContent("Cobra 50% na fatura");
    expect(screen.getByRole("button", { name: /Nenhum/ })).toHaveTextContent(
      "Cobra 100% na fatura",
    );
    const note = screen.getByTestId("refund-note");
    expect(note).toHaveTextContent("Vaga faturada: nada foi pago por Pix.");
    expect(note).toHaveTextContent("Integral: não entra na fatura.");
    expect(note).toHaveTextContent("50%: cobra 50% na fatura.");
    expect(note).toHaveTextContent("Nenhum: cobra 100% na fatura.");
    expect(note).toHaveTextContent(
      "Se o freelancer já recebeu o repasse, nada é estornado e a fatura cobra o valor cheio.",
    );
  });

  it("escolher uma opção avisa o valor; o selecionado fica marcado", () => {
    const onChange = vi.fn();
    render(<RefundTypeSelector value="PARTIAL_50" onChange={onChange} invoiced />);

    expect(screen.getByRole("button", { name: /50%/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Nenhum/ }));
    expect(onChange).toHaveBeenCalledWith("NONE");
  });
});

describe("cancelResultMessage", () => {
  it("pré-pago: o estorno com o valor; sem estorno, só 'cancelada'", () => {
    expect(cancelResultMessage({ refundAmount: 12481, refundType: "FULL" }, false)).toBe(
      "Vaga cancelada. Estorno integral de R$ 124,81 processado.",
    );
    expect(cancelResultMessage({ refundAmount: 0, refundType: "NONE" }, false)).toBe(
      "Vaga cancelada com sucesso.",
    );
  });

  it("faturado: diz o efeito na fatura, nunca 'estorno processado'", () => {
    expect(cancelResultMessage({ refundAmount: 12481, refundType: "FULL" }, true)).toBe(
      "Vaga cancelada. O serviço não entra na fatura.",
    );
    expect(cancelResultMessage({ refundAmount: 6240, refundType: "PARTIAL_50" }, true)).toBe(
      "Vaga cancelada. A fatura cobra 50% do serviço.",
    );
  });

  it("faturado sem estorno: só afirma o valor cheio quando a linha tem freelancer confirmado", () => {
    // Freelancer aceito = pagamento faturado liquidado: a API retém (ou a linha do serviço cobra).
    expect(
      cancelResultMessage({ refundAmount: 0, refundType: "NONE" }, true, {
        requested: "NONE",
        confirmedFreelancer: true,
      }),
    ).toBe("Vaga cancelada. A fatura cobra o valor cheio do serviço.");
    // Pediu estorno, mas a API não estornou: o repasse já tinha saído.
    expect(
      cancelResultMessage({ refundAmount: 0, refundType: "NONE" }, true, {
        requested: "FULL",
        confirmedFreelancer: true,
      }),
    ).toBe(
      "Vaga cancelada sem estorno: o freelancer já recebeu o repasse. A fatura cobra o valor cheio do serviço.",
    );
    // Sem saber se havia freelancer confirmado: texto neutro com o efeito da escolha.
    expect(
      cancelResultMessage({ refundAmount: 0, refundType: "NONE" }, true, { requested: "NONE" }),
    ).toBe(
      "Vaga cancelada. A fatura reflete a escolha: cobra 100%, se a vaga já tinha freelancer confirmado.",
    );
    expect(
      cancelResultMessage({ refundAmount: 0, refundType: "NONE" }, true, { requested: "FULL" }),
    ).toBe(
      "Vaga cancelada. A fatura reflete a escolha: não entra, se a vaga já tinha freelancer confirmado.",
    );
    expect(cancelResultMessage({ refundAmount: 0, refundType: "NONE" }, true)).toBe(
      "Vaga cancelada. A fatura reflete a escolha: cobra 100%, se a vaga já tinha freelancer confirmado.",
    );
  });
});

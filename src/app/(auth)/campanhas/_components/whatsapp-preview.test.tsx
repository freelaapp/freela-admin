import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { previewButtons } from "../_lib/marketing-template-rules";
import { MarketingStatusBadge } from "./marketing-status-badge";
import { WhatsAppPreview } from "./whatsapp-preview";

describe("WhatsAppPreview", () => {
  it("balão com imagem, texto com *negrito* e botões na ordem do WhatsApp", () => {
    render(
      <WhatsAppPreview
        imageUrl="https://s3/apresentacao-freela.jpeg"
        text={"Oi, Maria! *Cadastre* seu negócio"}
        buttons={previewButtons([
          { type: "PHONE", text: "Falar com a Rebeca" },
          { type: "URL", text: "Cadastrar meu negócio" },
        ])}
      />,
    );

    expect(screen.getByRole("img", { name: "Imagem do topo" })).toHaveAttribute(
      "src",
      "https://s3/apresentacao-freela.jpeg",
    );
    expect(screen.getByText("Cadastre").tagName).toBe("STRONG");
    expect(screen.getByTestId("whatsapp-preview")).toHaveTextContent(
      "Oi, Maria! Cadastre seu negócio",
    );
    expect(
      screen.getAllByTestId("preview-button").map((b) => b.textContent),
    ).toEqual([
      "Cadastrar meu negócio",
      "Falar com a Rebeca",
      "Não quero receber",
    ]);
  });

  it("imagem enviada sem URL de prévia mostra o espaço; sem imagem, nada", () => {
    const { rerender } = render(
      <WhatsAppPreview hasImage text="Oi" buttons={[]} />,
    );
    expect(screen.getByText("Imagem do topo")).toBeInTheDocument();
    rerender(<WhatsAppPreview text="Oi" buttons={[]} />);
    expect(screen.queryByText("Imagem do topo")).not.toBeInTheDocument();
  });

  it("celular: o balão ocupa a largura até 300 px", () => {
    render(<WhatsAppPreview text="Oi" buttons={[]} />);
    expect(screen.getByTestId("whatsapp-bubble")).toHaveClass(
      "w-full",
      "max-w-[300px]",
    );
  });
});

describe("MarketingStatusBadge", () => {
  it("cores do mockup por situação", () => {
    const { rerender } = render(<MarketingStatusBadge status="APPROVED" />);
    expect(screen.getByText("Aprovado")).toHaveClass(
      "bg-green-200",
      "text-green-900",
    );
    rerender(<MarketingStatusBadge status="PENDING" />);
    expect(screen.getByText("Em análise")).toHaveClass(
      "bg-amber-200",
      "text-amber-900",
    );
    rerender(<MarketingStatusBadge status="REJECTED" />);
    expect(screen.getByText("Recusado")).toHaveClass(
      "bg-red-200",
      "text-red-900",
    );
    rerender(<MarketingStatusBadge status="DRAFT" />);
    expect(screen.getByText("Rascunho")).toHaveClass(
      "bg-gray-200",
      "text-gray-900",
    );
  });
});

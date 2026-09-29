import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { VacancyCandidacyItem } from "@/modules/admin/infrastructure/admin-api";
import { VacancyCandidacyList } from "./vacancy-candidacy-list";

function item(overrides: Partial<VacancyCandidacyItem> = {}): VacancyCandidacyItem {
  return {
    id: "cand-1",
    providerId: "prov-1",
    providerName: "Thayna Silva",
    providerPhone: "+5511991594494",
    providerEmail: "thayna@example.com",
    status: "PENDING",
    createdAt: "2026-09-24T15:00:00.000Z",
    ...overrides,
  };
}

function renderList(
  candidacies: VacancyCandidacyItem[],
  extra: Partial<Parameters<typeof VacancyCandidacyList>[0]> = {},
) {
  return render(
    <VacancyCandidacyList
      candidacies={candidacies}
      loading={false}
      onConfirm={vi.fn()}
      confirming={false}
      {...extra}
    />,
  );
}

describe("VacancyCandidacyList — Colocar na vaga", () => {
  it("mostra o botão no candidato PENDENTE e repassa id + nome", () => {
    const onAccept = vi.fn();
    renderList([item()], { onAccept });

    fireEvent.click(screen.getByRole("button", { name: /colocar na vaga/i }));

    expect(onAccept).toHaveBeenCalledWith("cand-1", "Thayna Silva");
  });

  it("não mostra o botão em quem não está pendente", () => {
    renderList(
      [
        item({ id: "c-acc", status: "ACCEPTED" }),
        item({ id: "c-wd", status: "WITHDRAWN" }),
        item({ id: "c-ns", status: "NOT_SELECTED" }),
      ],
      { onAccept: vi.fn() },
    );

    expect(screen.queryByRole("button", { name: /colocar na vaga/i })).not.toBeInTheDocument();
  });

  it("sem onAccept (área sem permissão) o botão não aparece", () => {
    renderList([item()]);

    expect(screen.queryByRole("button", { name: /colocar na vaga/i })).not.toBeInTheDocument();
  });

  it("desabilita enquanto uma colocação está em andamento", () => {
    renderList([item()], { onAccept: vi.fn(), accepting: true });

    expect(screen.getByRole("button", { name: /colocar na vaga/i })).toBeDisabled();
  });
});

describe("VacancyCandidacyList — Aprovado por", () => {
  it("aceite feito pelo painel aparece como Painel, não como Dono", () => {
    renderList([
      item({
        status: "ACCEPTED",
        acceptedAt: "2026-09-24T18:40:00.000Z",
        approvedBy: {
          userId: "admin-7",
          name: "Suporte Freela",
          email: "suporte@freela.com",
          role: "ADMIN",
          employeeLabel: null,
        },
      }),
    ]);

    expect(screen.getByText(/Aprovado por Suporte Freela/)).toBeInTheDocument();
    expect(screen.getByText("Painel")).toBeInTheDocument();
    expect(screen.queryByText("Dono")).not.toBeInTheDocument();
  });
});

describe("VacancyCandidacyList — Voltar para candidatos", () => {
  it("mostra o botão em recusado e não selecionado, com a vaga aberta, e repassa id + nome", () => {
    const onRestore = vi.fn();
    renderList(
      [item({ id: "c-rej", status: "REJECTED" }), item({ id: "c-ns", status: "NOT_SELECTED", providerName: "Giselle" })],
      { onRestore, vacancyOpen: true },
    );

    const buttons = screen.getAllByRole("button", { name: /voltar para candidatos/i });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    expect(onRestore).toHaveBeenCalledWith("c-ns", "Giselle");
  });

  it("não aparece com a vaga fechada nem em outros status", () => {
    const { unmount } = renderList([item({ status: "REJECTED" })], { onRestore: vi.fn(), vacancyOpen: false });
    expect(screen.queryByRole("button", { name: /voltar para candidatos/i })).not.toBeInTheDocument();
    unmount();

    renderList(
      [item({ id: "a", status: "PENDING" }), item({ id: "b", status: "ACCEPTED" }), item({ id: "c", status: "WITHDRAWN" })],
      { onRestore: vi.fn(), vacancyOpen: true },
    );
    expect(screen.queryByRole("button", { name: /voltar para candidatos/i })).not.toBeInTheDocument();
  });

  it("quem pode ser RECOLOCADO (já foi aprovado) não ganha um segundo botão", () => {
    renderList([item({ status: "NOT_SELECTED", acceptedAt: "2026-09-29T11:41:19.000Z" })], {
      onRestore: vi.fn(),
      onReinstate: vi.fn(),
      vacancyOpen: true,
    });
    expect(screen.getByRole("button", { name: /recolocar na vaga/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /voltar para candidatos/i })).not.toBeInTheDocument();
  });

  it("sem onRestore (área sem permissão) o botão não aparece", () => {
    renderList([item({ status: "REJECTED" })], { vacancyOpen: true });
    expect(screen.queryByRole("button", { name: /voltar para candidatos/i })).not.toBeInTheDocument();
  });
});

import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DataTable, type Column } from "./data-table";

type Row = { id: string; nome: string; cidade: string; valor: number };

const ROWS: Row[] = [
  { id: "1", nome: "Bruno", cidade: "Natal", valor: 200 },
  { id: "2", nome: "Ana", cidade: "Brejetuba", valor: 300 },
  { id: "3", nome: "Carla", cidade: "Jundiaí", valor: 100 },
];

function columns(onVer: (id: string) => void = vi.fn()): Column<Row>[] {
  return [
    { header: "Nome", accessor: "nome", sortable: true, sortAccessor: (r) => r.nome },
    { header: "Cidade", accessor: "cidade", className: "hidden md:table-cell" },
    {
      header: "Valor",
      accessor: (r) => `R$ ${r.valor}`,
      className: "hidden lg:table-cell",
      sortable: true,
      sortAccessor: (r) => r.valor,
    },
    {
      header: "Ações",
      accessor: (r) => (
        <button type="button" onClick={() => onVer(r.id)}>
          Ver {r.nome}
        </button>
      ),
    },
  ];
}

const cards = () => within(screen.getByTestId("data-table-cards"));
const cardTitles = () => cards().getAllByRole("listitem").map((li) => li.firstElementChild?.textContent);

describe("DataTable — cartões no celular", () => {
  it("1ª coluna vira o título e as demais 'Rótulo: valor' — inclusive as 'hidden' da tabela", () => {
    render(<DataTable columns={columns()} data={ROWS} />);
    const [primeiro] = cards().getAllByRole("listitem");

    expect(primeiro.firstElementChild).toHaveTextContent("Bruno");
    expect(within(primeiro).getByText("Cidade")).toBeInTheDocument();
    expect(within(primeiro).getByText("Natal")).toBeInTheDocument();
    expect(within(primeiro).getByText("Valor")).toBeInTheDocument();
    expect(within(primeiro).getByText("R$ 200")).toBeInTheDocument();
  });

  it("coluna 'Ações' vai para o rodapé do cartão, sem rótulo, e continua clicável", () => {
    const onVer = vi.fn();
    render(<DataTable columns={columns(onVer)} data={ROWS} />);
    const [primeiro] = cards().getAllByRole("listitem");
    const rodape = within(primeiro).getByTestId("data-table-card-actions");

    fireEvent.click(within(rodape).getByRole("button", { name: "Ver Bruno" }));

    expect(onVer).toHaveBeenCalledWith("1");
    expect(within(primeiro).queryByText("Ações")).not.toBeInTheDocument();
  });

  it("header vazio e mobile:'actions' também vão para o rodapé", () => {
    const cols: Column<Row>[] = [
      { header: "Nome", accessor: "nome" },
      { header: "", accessor: (r) => <button type="button">Detalhes {r.nome}</button> },
      { header: "Contato", accessor: (r) => <a href={`#${r.id}`}>WhatsApp</a>, mobile: "actions" },
    ];
    render(<DataTable columns={cols} data={[ROWS[0]]} />);
    const rodape = cards().getByTestId("data-table-card-actions");

    expect(within(rodape).getByRole("button", { name: "Detalhes Bruno" })).toBeInTheDocument();
    expect(within(rodape).getByRole("link", { name: "WhatsApp" })).toBeInTheDocument();
    expect(cards().queryByText("Contato")).not.toBeInTheDocument();
  });

  it("mobile:'hide' some só do cartão; mobile:'title' escolhe o título", () => {
    const cols: Column<Row>[] = [
      { header: "", accessor: (r) => <span>{r.nome.slice(0, 2)}</span>, mobile: "hide" },
      { header: "Cidade", accessor: "cidade" },
      { header: "Nome", accessor: "nome", mobile: "title" },
    ];
    render(<DataTable columns={cols} data={[ROWS[0]]} />);
    const [cartao] = cards().getAllByRole("listitem");

    expect(cartao.firstElementChild).toHaveTextContent("Bruno");
    expect(within(cartao).queryByText("Br")).not.toBeInTheDocument();
    expect(within(screen.getByTestId("data-table-desktop")).getByText("Br")).toBeInTheDocument();
    expect(within(cartao).getByText("Cidade")).toBeInTheDocument();
  });

  it("'Ordenar por' ordena os cartões com a mesma lógica da tabela", () => {
    render(<DataTable columns={columns()} data={ROWS} />);
    const select = cards().getByLabelText("Ordenar por");

    fireEvent.change(select, { target: { value: "0:asc" } });
    expect(cardTitles()).toEqual(["Ana", "Bruno", "Carla"]);

    fireEvent.change(select, { target: { value: "2:asc" } });
    expect(cardTitles()).toEqual(["Carla", "Bruno", "Ana"]);

    fireEvent.change(select, { target: { value: "" } });
    expect(cardTitles()).toEqual(["Bruno", "Ana", "Carla"]);
  });

  it("clicar no cabeçalho da tabela reflete no seletor (estado único)", () => {
    render(<DataTable columns={columns()} data={ROWS} />);
    fireEvent.click(within(screen.getByTestId("data-table-desktop")).getByText("Nome"));
    expect(cards().getByLabelText("Ordenar por")).toHaveValue("0:asc");
  });

  it("sem coluna ordenável não há seletor; lista vazia avisa", () => {
    render(<DataTable columns={[{ header: "Nome", accessor: "nome" }]} data={[] as Row[]} />);
    expect(cards().queryByLabelText("Ordenar por")).not.toBeInTheDocument();
    expect(cards().getByText("Nenhum resultado encontrado.")).toBeInTheDocument();
  });

  it("isFetching com lista vazia (1º carregamento): sem 'Nenhum resultado encontrado.', com indicador de carregamento nos cartões", () => {
    render(<DataTable columns={columns()} data={[]} isFetching />);

    expect(cards().queryByText("Nenhum resultado encontrado.")).not.toBeInTheDocument();
    expect(cards().getByText("Carregando…")).toBeInTheDocument();
  });
});

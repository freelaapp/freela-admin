import "@testing-library/jest-dom";
import * as React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { VacancyBoard, type BoardVacancy } from "./vacancy-board";
import { resetSupportChecklistCache } from "@/modules/admin/application/use-support-checklist";
import { CHECKLIST_STORAGE_KEY } from "@/modules/admin/infrastructure/support-checklist-storage";

/**
 * A área de trabalho do suporte ponta a ponta: a vaga entra no painel, o banner
 * vermelho a acusa, a gaveta abre e o tique apaga a linha do banner.
 *
 * É o teste que a lógica pura não alcança — `support-actions.test.ts` prova a
 * régua, este prova que ela chega à tela e volta.
 */

/** Amanhã às 20h, sempre no futuro: o painel só mostra vaga de hoje em diante. */
function amanhaAs(hora: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hora, 0, 0, 0);
  return d.toISOString();
}

function vaga(over: Partial<BoardVacancy> = {}): BoardVacancy {
  const startTime = amanhaAs(20);
  return {
    id: "vaga-0001-aaaa",
    bucket: "open",
    empresa: "Coco Bambu",
    cargo: "Garçom",
    cidade: "São Paulo",
    candidatos: 0,
    valor: "R$ 180,00",
    valorCents: 18_000,
    residuoCents: 3_600,
    data: "04/08",
    turno: "20:00 - 02:00",
    freelancer: null,
    contratanteContato: "Marcos",
    contratanteTelefone: "(11) 98765-4321",
    freelancerTelefone: null,
    raw: {
      date: startTime.slice(0, 10),
      startTime,
      endTime: amanhaAs(23),
      createdAt: new Date().toISOString(),
    } as BoardVacancy["raw"],
    ...over,
  };
}

function renderBoard(vagas: BoardVacancy[] = [vaga()]) {
  return render(
    <VacancyBoard
      vacancies={vagas}
      isFetching={false}
      onSelect={() => {}}
      areaDeTrabalho
      quemTicou="Ana"
    />,
  );
}

function limpar() {
  window.localStorage.clear();
  // O store é cache de módulo: sem o reset, um teste que tica herda o tique no
  // seguinte mesmo com o storage limpo. Dentro de `act` porque o reset avisa os
  // componentes ainda montados.
  act(() => resetSupportChecklistCache());
}

beforeEach(limpar);
afterEach(limpar);

describe("painel com a área de trabalho do suporte", () => {
  it("acusa no banner vermelho a ação crítica que ainda não foi feita", () => {
    renderBoard();
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("ação(ões) crítica(s) pendente(s) em 1 vaga(s)");
    // A ação em si, não só a contagem: é ela que diz o que fazer.
    expect(banner).toHaveTextContent("Enviar saudação ao contratante");
    expect(banner).toHaveTextContent("Divulgar de novo no grupo de WhatsApp");
  });

  it("abre a gaveta pelo banner e tica a ação, apagando a linha", () => {
    renderBoard();
    fireEvent.click(within(screen.getByRole("alert")).getByText(/Garçom · Coco Bambu/));

    const gaveta = screen.getByRole("dialog");
    expect(gaveta).toHaveTextContent("Área de trabalho do suporte");
    expect(gaveta).toHaveTextContent("Aberta · sem candidato");

    fireEvent.click(
      within(gaveta).getByRole("checkbox", { name: "Enviar saudação ao contratante" }),
    );

    // Quem ticou e quando ficam registrados — checklist anônimo não sustenta
    // conversa de turno.
    expect(gaveta).toHaveTextContent("Ana");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Enviar saudação ao contratante");
  });

  it("guarda o tique entre remontagens do painel", () => {
    const { unmount } = renderBoard();
    fireEvent.click(within(screen.getByRole("alert")).getByText(/Garçom · Coco Bambu/));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("checkbox", {
        name: "Enviar saudação ao contratante",
      }),
    );
    expect(window.localStorage.getItem(CHECKLIST_STORAGE_KEY)).toContain("saudacao");

    unmount();
    renderBoard();
    expect(screen.getByRole("alert")).not.toHaveTextContent("Enviar saudação ao contratante");
  });

  it("o card mostra o progresso e o número de críticas pendentes", () => {
    renderBoard();
    // 0 de 7 ações (1 de sempre + 6 da etapa "aberta sem candidato").
    expect(screen.getByTitle(/ação\(ões\) crítica\(s\) pendente\(s\)/)).toHaveTextContent(
      "0/7",
    );
  });

  // Vaga concluída e avaliada não pede nada: cobrar ação dela seria pedir
  // trabalho que não muda nada.
  it("não acende banner para vaga de ciclo fechado com a saudação já feita", () => {
    const concluida = vaga({ id: "vaga-fechada", bucket: "completedReviewed" });
    renderBoard([concluida]);
    fireEvent.click(within(screen.getByRole("alert")).getByText(/Garçom · Coco Bambu/));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("checkbox", {
        name: "Enviar saudação ao contratante",
      }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sem a área de trabalho, o painel continua o quadro de antes", () => {
    render(<VacancyBoard vacancies={[vaga()]} isFetching={false} onSelect={() => {}} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/As ações ticadas ficam salvas/)).toBeNull();
  });
});

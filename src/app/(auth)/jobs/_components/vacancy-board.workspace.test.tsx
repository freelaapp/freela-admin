import "@testing-library/jest-dom";
import * as React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VacancyBoard, type BoardVacancy } from "./vacancy-board";
import type { ChecklistTickDto } from "@/modules/admin/infrastructure/support-checklist-api";

/**
 * A área de trabalho do suporte ponta a ponta: a vaga entra no painel, o banner
 * vermelho a acusa, a gaveta abre e o tique apaga a linha do banner — e o tique
 * agora vive na API (compartilhado), não mais no localStorage.
 *
 * A API é dublada por um store em memória com estado: ticar grava, e uma
 * remontagem relê o mesmo store — o que prova que o tique persiste do lado do
 * servidor, não só na tela.
 */

const backend = vi.hoisted(() => ({ store: [] as ChecklistTickDto[] }));

vi.mock("@/modules/admin/infrastructure/support-checklist-api", () => ({
  getSupportChecklist: vi.fn(async () => backend.store),
  tickSupportAction: vi.fn(async (vacancyId: string, actionId: string, _m: string, by?: string) => {
    if (!backend.store.some((t) => t.vacancyId === vacancyId && t.actionId === actionId)) {
      backend.store.push({
        vacancyId,
        actionId,
        checkedAt: new Date().toISOString(),
        by: by ?? null,
        sentTo: null,
        sentWhatsappAt: null,
      });
    }
  }),
  untickSupportAction: vi.fn(async (vacancyId: string, actionId: string) => {
    backend.store = backend.store.filter(
      (t) => !(t.vacancyId === vacancyId && t.actionId === actionId),
    );
  }),
  tickSupportActions: vi.fn(
    async (vacancyId: string, actionIds: string[], _m: string, by?: string) => {
      for (const actionId of actionIds) {
        if (!backend.store.some((t) => t.vacancyId === vacancyId && t.actionId === actionId)) {
          backend.store.push({
            vacancyId,
            actionId,
            checkedAt: new Date().toISOString(),
            by: by ?? null,
            sentTo: null,
            sentWhatsappAt: null,
          });
        }
      }
    },
  ),
  sendSupportAction: vi.fn(async () => ({ phone: "5511987654321", sentAt: new Date().toISOString() })),
}));

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

function renderBoard(vagas: BoardVacancy[] = [vaga()], areaDeTrabalho = true) {
  // Cliente por render: sem cache herdado entre testes e sem retry a atrapalhar.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <VacancyBoard
        vacancies={vagas}
        isFetching={false}
        onSelect={() => {}}
        areaDeTrabalho={areaDeTrabalho}
        quemTicou="Ana"
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  backend.store = [];
});
afterEach(() => {
  backend.store = [];
});

describe("painel com a área de trabalho do suporte", () => {
  it("acusa no banner vermelho a ação crítica que ainda não foi feita", () => {
    renderBoard();
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("ação(ões) crítica(s) pendente(s) em 1 vaga(s)");
    // A ação em si, não só a contagem: é ela que diz o que fazer.
    expect(banner).toHaveTextContent("Enviar saudação ao contratante");
    expect(banner).toHaveTextContent("Divulgar de novo no grupo de WhatsApp");
  });

  it("abre a gaveta pelo banner e tica a ação, apagando a linha", async () => {
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
    await waitFor(() => expect(gaveta).toHaveTextContent("Ana"));
    await waitFor(() =>
      expect(screen.getByRole("alert")).not.toHaveTextContent("Enviar saudação ao contratante"),
    );
  });

  it("guarda o tique entre remontagens do painel (persistido na API)", async () => {
    const { unmount } = renderBoard();
    fireEvent.click(within(screen.getByRole("alert")).getByText(/Garçom · Coco Bambu/));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("checkbox", {
        name: "Enviar saudação ao contratante",
      }),
    );
    await waitFor(() => expect(backend.store.some((t) => t.actionId === "saudacao")).toBe(true));

    unmount();
    renderBoard();
    await waitFor(() =>
      expect(screen.getByRole("alert")).not.toHaveTextContent("Enviar saudação ao contratante"),
    );
  });

  it("o card mostra o progresso e o número de críticas pendentes", () => {
    renderBoard();
    // 0 de 7 ações (1 de sempre + 6 da etapa "aberta sem candidato").
    expect(screen.getByTitle(/ação\(ões\) crítica\(s\) pendente\(s\)/)).toHaveTextContent("0/7");
  });

  // Vaga concluída e avaliada não pede nada: cobrar ação dela seria pedir
  // trabalho que não muda nada.
  it("não acende banner para vaga de ciclo fechado com a saudação já feita", async () => {
    const concluida = vaga({ id: "vaga-fechada", bucket: "completedReviewed" });
    renderBoard([concluida]);
    fireEvent.click(within(screen.getByRole("alert")).getByText(/Garçom · Coco Bambu/));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("checkbox", {
        name: "Enviar saudação ao contratante",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("sem a área de trabalho, o painel continua o quadro de antes", () => {
    renderBoard([vaga()], false);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/As ações ticadas são compartilhadas/)).toBeNull();
  });
});

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdminGroupView, AdminGroupsList } from "@/modules/admin/infrastructure/whatsapp-groups-api";
import { AdminGroupsList as GroupsList } from "./admin-groups-list";
import { DirectoryStatusBanner } from "./directory-status-banner";

const renamed: AdminGroupView = {
  id: "row-1",
  groupJid: "r-group",
  name: "Vagas Freela Salvador BA",
  kind: "CITY",
  source: "IMPORTED",
  city: "Salvador",
  uf: "BA",
  sequence: null,
  dedicatedRuleId: null,
  createdAt: "2026-09-24T11:12:14.374Z",
  botInGroup: true,
  liveName: "Reserva BA",
  receivesVacancies: false,
};

describe("AdminGroupsList — grupo renomeado no WhatsApp", () => {
  it("mostra o nome atual, o selo 'Não recebe vagas' e o nome que o grupo precisa ter", () => {
    render(<GroupsList groups={[renamed]} showLocation emptyText="" onAddMembers={vi.fn()} onDelete={vi.fn()} />);

    // tabela (md+) e cartões (celular) renderizam os dois — o CSS escolhe qual aparece
    expect(screen.getAllByText('No WhatsApp: "Reserva BA"')).toHaveLength(2);
    expect(screen.getAllByText("Não recebe vagas")).toHaveLength(2);
    expect(
      screen.getAllByText(
        'Não recebe as vagas de Salvador/BA. Para voltar a receber, o nome no WhatsApp precisa ser "Vagas Freela Salvador BA".',
      ),
    ).toHaveLength(2);
  });

  it("grupo em dia não ganha nada a mais", () => {
    render(
      <GroupsList
        groups={[{ ...renamed, liveName: "Vagas Freela Salvador BA", receivesVacancies: true }]}
        showLocation
        emptyText=""
        onAddMembers={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText(/No WhatsApp:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Não recebe vagas")).not.toBeInTheDocument();
  });
});

describe("DirectoryStatusBanner — avisos de grupo", () => {
  it("mostra o bot tirado do grupo e as cidades sem grupo", () => {
    const list: AdminGroupsList = {
      instance: { connected: true },
      directory: { ok: true, checkedAt: "2026-09-29T12:00:00.000Z" },
      groups: [],
      lostGroups: [
        {
          groupJid: "s-group",
          panelName: null,
          city: "Salvador",
          uf: "BA",
          lastSentAt: "2026-09-22T20:46:22.000Z",
          sample: "Nova oportunidade",
        },
      ],
      citiesWithoutGroup: [{ city: "Salvador", uf: "BA" }],
    };
    render(<DirectoryStatusBanner list={list} onRefresh={vi.fn()} refreshing={false} />);

    expect(screen.getByText(/O bot foi tirado do grupo de Salvador\/BA \(último envio em 22\/09\)/)).toBeInTheDocument();
    expect(screen.getByText(/Sem grupo recebendo vagas: Salvador\/BA\./)).toBeInTheDocument();
  });
});

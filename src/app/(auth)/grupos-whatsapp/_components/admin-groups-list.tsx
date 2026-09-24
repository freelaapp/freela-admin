"use client";

import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SOURCE_LABELS, canAddMembers } from "@/modules/admin/application/whatsapp-groups-presentation";
import type { AdminGroupView } from "@/modules/admin/infrastructure/whatsapp-groups-api";
import { BotStatusBadge } from "./bot-status-badge";

interface RowHandlers {
  onAddMembers: (group: AdminGroupView) => void;
  onDelete: (group: AdminGroupView) => void;
}

function RowActions({ group, onAddMembers, onDelete }: RowHandlers & { group: AdminGroupView }) {
  const addable = canAddMembers(group);
  return (
    <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
      <Button
        variant="outline"
        size="sm"
        disabled={!addable}
        onClick={() => onAddMembers(group)}
        title={addable ? "Adicionar membros a este grupo" : "O bot precisa estar no grupo para adicionar membros"}
      >
        <UserPlus className="h-4 w-4" aria-hidden /> Adicionar membros
      </Button>
      <Button variant="outline" size="sm" onClick={() => onDelete(group)} className="text-red-600 hover:bg-red-50">
        <Trash2 className="h-4 w-4" aria-hidden /> Excluir
      </Button>
    </div>
  );
}

/** Grupos do painel: tabela a partir de `md`, cartões no celular. */
export function AdminGroupsList({
  groups,
  showLocation,
  emptyText,
  onAddMembers,
  onDelete,
}: RowHandlers & { groups: AdminGroupView[]; showLocation: boolean; emptyText: string }) {
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-[#e5e5e5] bg-white px-4 py-8 text-center text-[13px] text-[#a3a3a3]">
        {emptyText}
      </p>
    );
  }
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-[#e5e5e5] bg-white md:block">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f7f7] text-left text-[#737373]">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Grupo</th>
              {showLocation && <th scope="col" className="px-4 py-2.5 font-medium">Cidade</th>}
              {showLocation && <th scope="col" className="px-4 py-2.5 font-medium">UF</th>}
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="hidden px-4 py-2.5 font-medium lg:table-cell">Origem</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {groups.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-2.5 font-medium text-[#171717]">{g.name}</td>
                {showLocation && <td className="px-4 py-2.5 text-[#525252]">{g.city ?? "—"}</td>}
                {showLocation && <td className="px-4 py-2.5 text-[#525252]">{g.uf ?? "—"}</td>}
                <td className="px-4 py-2.5">
                  <BotStatusBadge botInGroup={g.botInGroup} />
                </td>
                <td className="hidden px-4 py-2.5 text-[#525252] lg:table-cell">{SOURCE_LABELS[g.source]}</td>
                <td className="px-4 py-2.5">
                  <RowActions group={g} onAddMembers={onAddMembers} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 md:hidden">
        {groups.map((g) => (
          <div key={g.id} className="rounded-lg border border-[#e5e5e5] bg-white p-3 text-[13px]">
            <p className="font-medium text-[#171717]">{g.name}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[#737373]">
              <BotStatusBadge botInGroup={g.botInGroup} />
              {showLocation && g.city && (
                <span>
                  {g.city}
                  {g.uf ? ` · ${g.uf}` : ""}
                </span>
              )}
              <span>{SOURCE_LABELS[g.source]}</span>
            </div>
            <div className="mt-3">
              <RowActions group={g} onAddMembers={onAddMembers} onDelete={onDelete} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

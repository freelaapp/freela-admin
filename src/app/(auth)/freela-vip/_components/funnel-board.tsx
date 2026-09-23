"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, GripVertical, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMoveVipStage, useVipKanban, useVipRole } from "@/modules/admin/application/use-freela-vip";
import { filterKanbanCards, scoreBand, scoreBandClass, sortCardsByScore } from "@/modules/admin/application/freela-vip-presentation";
import type { VipKanbanCard, VipStatus } from "@/modules/admin/infrastructure/freela-vip-api";
import { QueryError } from "./query-error";

export function FunnelBoard({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const role = useVipRole();
  const { data: board, isLoading, isError, refetch } = useVipKanban(cycleId);
  const move = useMoveVipStage(cycleId);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [city, setCity] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const canMove = role.canAdmin;

  const cities = useMemo(() => [...new Set((board?.columns ?? []).flatMap((c) => c.cards).map((k) => k.city).filter(Boolean) as string[])].sort(), [board]);
  const roles = useMemo(() => [...new Set((board?.columns ?? []).flatMap((c) => c.cards).map((k) => k.role).filter(Boolean) as string[])].sort(), [board]);

  function onDrop(stage: VipStatus) {
    if (!canMove || !draggingId) return;
    const id = draggingId;
    setDraggingId(null);
    const from = board?.columns.find((c) => c.cards.some((k) => k.id === id));
    if (!from || from.stage === stage) return;
    move.mutate({ applicationId: id, stage });
  }

  if (isLoading) {
    return <div className="flex justify-center py-10 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>;
  }

  if (isError || !board) {
    return <QueryError message="Não foi possível carregar o funil." onRetry={() => refetch()} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <select className="rounded-md border border-[#E2E8F0] px-2 py-1.5 text-[13px]" value={city} onChange={(e) => setCity(e.target.value)} aria-label="Cidade">
          <option value="">Todas as cidades</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="rounded-md border border-[#E2E8F0] px-2 py-1.5 text-[13px]" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Função">
          <option value="">Todas as funções</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {!role.readOnly && <Input className="w-56" placeholder="Buscar por nome…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar por nome" />}
        <p className="ml-auto self-center text-[12.5px] text-[#64748B]">Ativos {board.totalActive} · reprovados {board.rejectedCount} · desistiram {board.withdrewCount}{!canMove && " · somente leitura"}</p>
      </div>

      <div className="flex flex-col gap-3 pb-3 md:flex-row md:overflow-x-auto">
        {board.columns.map((col) => {
          const cards = sortCardsByScore(filterKanbanCards(col.cards, { city, role: roleFilter, search }));
          return (
            <div
              key={col.stage}
              className="w-full md:w-72 md:min-w-[270px] md:flex-shrink-0"
              onDragOver={(e) => { if (canMove) e.preventDefault(); }}
              onDrop={() => onDrop(col.stage)}
            >
              <div className="rounded-xl border border-[#E2E8F0] border-t-4 border-t-[#334155] bg-white">
                <div className="flex items-center justify-between border-b border-[#F1F5F9] px-3 py-2">
                  <h3 className="text-[12px] font-semibold text-[#0F172A]">{col.title}</h3>
                  <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] text-[#64748B]">{col.count}</span>
                </div>
                <div className="min-h-[80px] space-y-2 p-2">
                  {cards.map((k) => <Card key={k.id} card={k} canMove={canMove} dragging={draggingId === k.id} onDragStart={() => setDraggingId(k.id)} onDragEnd={() => setDraggingId(null)} onOpen={() => router.push(`/freela-vip/candidatos/${k.id}`)} />)}
                  {cards.length === 0 && (
                    <p className="py-3 text-center text-[11px] text-[#94A3B8]">Nenhum candidato nesta etapa</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({ card, canMove, dragging, onDragStart, onDragEnd, onOpen }: {
  card: VipKanbanCard; canMove: boolean; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onOpen: () => void;
}) {
  const band = scoreBand(card.totalScore);
  return (
    <div
      draggable={canMove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={`cursor-pointer rounded-lg bg-[#F8FAFC] p-2.5 transition-colors hover:bg-[#F1F5F9] ${dragging ? "opacity-50" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-[#0F172A]">{card.displayName ?? "Candidato"}</p>
        {canMove && <GripVertical className="h-4 w-4 shrink-0 text-[#CBD5E1]" aria-hidden />}
      </div>
      <p className="text-[12px] text-[#64748B]">{card.city ?? "—"} · {card.role ?? "—"} · {card.source === "LINK" ? "link" : "base"}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${scoreBandClass(band)}`}>{card.totalScore === null ? "sem nota" : `nota ${Math.round(card.totalScore)}`}</span>
        {card.alertsCount > 0 && <span className="flex items-center gap-1 text-[11px] font-medium text-[#DC2626]"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />{card.alertsCount}</span>}
      </div>
    </div>
  );
}

"use client";

import { CheckCircle2 } from "lucide-react";
import type { VipKanbanBoard } from "@/modules/admin/infrastructure/freela-vip-api";
import { vipTodoCounts } from "@/modules/admin/application/freela-vip-flow";

export type CycleTab = "convidar" | "convites" | "funil" | "ind";

/** "O que fazer agora": contadores clicáveis do que depende de alguém agir. */
export function TodoStrip({ board, cycleHasBackground, onGo }: {
  board: VipKanbanBoard;
  cycleHasBackground: boolean;
  onGo: (tab: CycleTab) => void;
}) {
  const c = vipTodoCounts(board, { cycleHasBackground });
  const items: { n: number; label: string; tab: CycleTab; mine: boolean }[] = [
    { n: c.interview, label: "para entrevistar", tab: "funil", mine: true },
    { n: c.requestBackground, label: "para pedir antecedentes", tab: "funil", mine: true },
    { n: c.toApprove, label: "prontos para aprovar como VIP", tab: "funil", mine: true },
    { n: c.waitlist, label: "na lista de espera", tab: "funil", mine: true },
    { n: c.backgroundPending, label: "esperando certidões", tab: "funil", mine: false },
    { n: c.invitesWaiting, label: "convites sem resposta", tab: "convites", mine: false },
  ].filter((i) => i.n > 0);

  return (
    <section aria-label="O que fazer agora" className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <h2 className="text-[13.5px] font-semibold text-[#0F172A]">O que fazer agora</h2>
      {items.length === 0 ? (
        <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-[#475569]">
          <CheckCircle2 className="h-4 w-4 text-[#16A34A]" aria-hidden /> Nada esperando por você neste ciclo.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((i) => (
            <button
              key={i.label}
              type="button"
              onClick={() => onGo(i.tab)}
              className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                i.mine ? "border-[#F59E0B] bg-[#FFFBEB] text-[#92400E] hover:bg-[#FEF3C7]" : "border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:bg-[#F1F5F9]"
              }`}
            >
              <strong className="tabular-nums">{i.n}</strong> {i.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

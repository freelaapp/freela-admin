"use client";

import { useState } from "react";
import { Check, Trash2, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCrmMutations, useCrmTasks } from "@/modules/admin/application/use-admin-crm";
import { PRIORITY_META } from "./crm-constants";

export function TasksPanel({ onOpenCompany }: { onOpenCompany: (id: string) => void }) {
  const [showDone, setShowDone] = useState(false);
  const { data: tasks = [], isLoading } = useCrmTasks(showDone ? undefined : { done: false });
  const m = useCrmMutations();

  return (
    <div>
      <div className="flex gap-1 mb-4 bg-[#f7f7f7] p-1 rounded-lg w-fit">
        <button
          onClick={() => setShowDone(false)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${!showDone ? "bg-white text-[#1d1d1b] shadow-sm" : "text-[#737373]"}`}
        >
          Pendentes
        </button>
        <button
          onClick={() => setShowDone(true)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${showDone ? "bg-white text-[#1d1d1b] shadow-sm" : "text-[#737373]"}`}
        >
          Todas
        </button>
      </div>

      {isLoading && <p className="text-sm text-[#737373]">Carregando…</p>}
      {!isLoading && tasks.length === 0 && (
        <p className="text-sm text-[#737373]">Nenhuma tarefa {showDone ? "" : "pendente"}.</p>
      )}

      <div className="space-y-2 max-w-2xl">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-3 bg-white border border-[#e5e5e5] rounded-lg px-3 py-2.5">
            <button
              onClick={() => m.updateTask.mutate({ id: t.id, dto: { done: !t.done } })}
              className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${t.done ? "bg-green-600 border-green-600 text-white" : "border-[#c4c4c4]"}`}
            >
              {t.done && <Check className="w-3.5 h-3.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${t.done ? "line-through text-[#a3a3a3]" : "text-[#1d1d1b]"}`}>{t.title}</p>
              {t.company && (
                <button
                  onClick={() => t.company && onOpenCompany(t.company.id)}
                  className="text-xs text-[#eca826] hover:underline"
                >
                  {t.company.name}
                </button>
              )}
            </div>
            {t.dueAt && (
              <span className="flex items-center gap-1 text-xs text-[#737373]">
                <CalendarClock className="w-3.5 h-3.5" />
                {new Date(t.dueAt).toLocaleDateString("pt-BR")}
              </span>
            )}
            <Badge variant={PRIORITY_META[t.priority].variant} className="text-[10px] px-1.5 py-0">
              {PRIORITY_META[t.priority].label}
            </Badge>
            <Button size="sm" variant="ghost" className="text-[#737373] hover:text-red-600" onClick={() => m.deleteTask.mutate(t.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

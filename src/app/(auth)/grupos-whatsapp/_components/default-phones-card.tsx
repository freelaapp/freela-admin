"use client";

import { useState } from "react";
import { Loader2, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPhoneBr } from "@/lib/utils";
import type { ApplyTarget } from "@/modules/admin/application/whatsapp-groups-presentation";
import { ApplyDefaultsDialog } from "./apply-defaults-dialog";
import { EditDefaultPhonesDialog } from "./edit-default-phones-dialog";

export function DefaultPhonesCard({
  defaultPhones,
  loading,
  targets,
}: {
  defaultPhones: string[];
  loading: boolean;
  targets: ApplyTarget[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  return (
    <section className="rounded-xl border border-[#e5e5e5] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#171717]">Números padrão</h2>
          <p className="mt-1 text-[13px] text-[#737373]">
            Entram em todo grupo criado pelo painel (cidades, dedicados e VIP).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" aria-hidden /> Editar
          </Button>
          <Button
            size="sm"
            onClick={() => setApplyOpen(true)}
            disabled={defaultPhones.length === 0}
            className="bg-[#eca826] text-white hover:bg-[#d8961f]"
          >
            <Users className="h-4 w-4" aria-hidden /> Adicionar em todos os grupos
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#a3a3a3]" aria-hidden />
        ) : defaultPhones.length === 0 ? (
          <p className="text-[13px] text-[#a3a3a3]">Nenhum número padrão cadastrado.</p>
        ) : (
          defaultPhones.map((p) => (
            <span key={p} className="rounded-full bg-[#f7f7f7] px-3 py-1 text-[13px] font-medium tabular-nums text-[#1d1d1b]">
              {formatPhoneBr(p)}
            </span>
          ))
        )}
      </div>
      {editOpen && <EditDefaultPhonesDialog current={defaultPhones} onClose={() => setEditOpen(false)} />}
      {applyOpen && <ApplyDefaultsDialog phones={defaultPhones} targets={targets} onClose={() => setApplyOpen(false)} />}
    </section>
  );
}

"use client";

import { useState } from "react";
import { Loader2, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPhoneBr } from "@/lib/utils";
import { QueryError } from "@/app/(auth)/freela-vip/_components/query-error";
import type { ApplyTarget } from "@/modules/admin/application/whatsapp-groups-presentation";
import { ApplyDefaultsDialog } from "./apply-defaults-dialog";
import { EditDefaultPhonesDialog } from "./edit-default-phones-dialog";

export function DefaultPhonesCard({
  defaultPhones,
  isLoading,
  isError,
  unready,
  targetsReady,
  onRetry,
  targets,
}: {
  defaultPhones: string[];
  isLoading: boolean;
  isError: boolean;
  /** Carregando, com erro ou ainda sem dado — `defaultPhones` não é confiável aqui. */
  unready: boolean;
  /** Grupos + VIP terminaram de carregar com sucesso — só então `targets` reflete as três abas. */
  targetsReady: boolean;
  onRetry: () => void;
  targets: ApplyTarget[];
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const applyDisabled = unready || !targetsReady || defaultPhones.length === 0;

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
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} disabled={unready}>
            <Pencil className="h-4 w-4" aria-hidden /> Editar
          </Button>
          <Button
            size="sm"
            onClick={() => setApplyOpen(true)}
            disabled={applyDisabled}
            title={!unready && !targetsReady ? "Aguarde os grupos e o VIP carregarem para aplicar a todos." : undefined}
            className="bg-[#eca826] text-white hover:bg-[#d8961f]"
          >
            <Users className="h-4 w-4" aria-hidden /> Adicionar em todos os grupos
          </Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {isLoading ? (
          <p className="inline-flex items-center gap-2 text-[13px] text-[#a3a3a3]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando números padrão...
          </p>
        ) : isError ? (
          <QueryError compact message="Não foi possível carregar os números padrão." onRetry={onRetry} />
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
      {/* Defesa extra: mesmo que o botão desabilitado já impeça o clique, os diálogos só
          montam com `unready=false` (e o de aplicar também exige `targetsReady=true`) —
          nunca abrem seedados a partir de dado incompleto ou de listas ainda não assentadas. */}
      {editOpen && !unready && <EditDefaultPhonesDialog current={defaultPhones} onClose={() => setEditOpen(false)} />}
      {applyOpen && !unready && targetsReady && (
        <ApplyDefaultsDialog phones={defaultPhones} targets={targets} onClose={() => setApplyOpen(false)} />
      )}
    </section>
  );
}

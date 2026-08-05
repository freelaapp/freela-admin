"use client";

import { useMemo, useState } from "react";
import { Search, MapPin, Store, Loader2, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCrmPipeline, usePipelineWhatsApp } from "@/modules/admin/application/use-admin-crm";
import type { PipelineCard } from "@/modules/admin/infrastructure/crm-api";
import { FUNNEL_STAGE_ICONS, MODULE_LABEL, filterPipelineCards, waLink } from "./funnel-helpers";

/**
 * Kanban do funil de contratantes: Cadastro novo → 1ª/2ª/3ª contratação →
 * Cliente fidelizado. As colunas vêm prontas da API (calculadas pelo nº de
 * vagas pagas) — o card muda de coluna sozinho, sem drag-and-drop.
 */
export function FunnelBoard() {
  const { data: board, isLoading } = useCrmPipeline();
  const sendWhatsApp = usePipelineWhatsApp();
  const [q, setQ] = useState("");

  const columns = useMemo(() => {
    if (!board) return [];
    return board.columns.map((col) => ({
      ...col,
      cards: filterPipelineCards(col.cards, q),
    }));
  }, [board, q]);

  function onSendWhatsApp(card: PipelineCard) {
    if (!confirm(`Enviar a mensagem automática de WhatsApp para ${card.name}?`)) return;
    sendWhatsApp.mutate(card.userId);
  }

  if (isLoading) {
    return <p className="text-sm text-[#737373]">Carregando funil de contratantes…</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-[#737373]" />
          <Input
            className="pl-8 w-72"
            placeholder="Buscar nome, cidade, estado, ramo, telefone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {board && (
          <span className="text-xs text-[#737373]">
            {board.totalContractors} contratante{board.totalContractors === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const Icon = FUNNEL_STAGE_ICONS[col.stage];
          return (
            <div key={col.stage} className="min-w-[290px] flex-shrink-0">
              <div className="border-t-4 border-[#eca826] bg-white rounded-xl border border-[#e5e5e5]">
                <div className="px-4 py-3 border-b border-[#e5e5e5] flex items-center justify-between">
                  <h3 className="font-semibold text-xs text-[#1d1d1b] flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-[#eca826]" />
                    {col.title}
                  </h3>
                  <span className="text-xs font-medium text-[#737373] bg-[#f7f7f7] px-2 py-0.5 rounded-full">
                    {col.cards.length}
                  </span>
                </div>
                <div className="p-3 space-y-2 min-h-[80px] max-h-[65vh] overflow-y-auto">
                  {col.cards.map((card) => {
                    const sending =
                      sendWhatsApp.isPending && sendWhatsApp.variables === card.userId;
                    return (
                      <div key={card.userId} className="bg-[#f7f7f7]/50 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-[#1d1d1b]">{card.name}</p>
                          <div className="flex gap-1 shrink-0">
                            {card.modules.map((m) => (
                              <Badge key={m} variant="outline" className="text-[10px] px-1.5 py-0">
                                {MODULE_LABEL[m] ?? m}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="mt-2 space-y-1">
                          {(card.city || card.state) && (
                            <p className="text-xs text-[#737373] flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {[card.city, card.state].filter(Boolean).join(" – ")}
                            </p>
                          )}
                          {card.segment && (
                            <p className="text-xs text-[#737373] flex items-center gap-1">
                              <Store className="w-3 h-3 shrink-0" />
                              {card.segment}
                            </p>
                          )}
                          {card.whatsappPhone ? (
                            <a
                              href={waLink(card.whatsappPhone)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-[#25D366] hover:underline flex items-center gap-1"
                            >
                              <MessageCircle className="w-3 h-3 shrink-0" />
                              {card.whatsappPhone}
                            </a>
                          ) : (
                            <p className="text-xs text-[#c4c4c4] flex items-center gap-1">
                              <MessageCircle className="w-3 h-3 shrink-0" />
                              Sem WhatsApp cadastrado
                            </p>
                          )}
                        </div>

                        <Button
                          size="sm"
                          className="w-full mt-2 h-7 text-xs bg-[#25D366] text-white hover:bg-[#1fb457] font-medium disabled:opacity-60"
                          disabled={!card.whatsappPhone || sending}
                          onClick={() => onSendWhatsApp(card)}
                        >
                          {sending ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Enviar msg automática
                        </Button>
                      </div>
                    );
                  })}
                  {col.cards.length === 0 && (
                    <p className="text-[11px] text-[#c4c4c4] text-center py-3">
                      Nenhum contratante nesta etapa
                    </p>
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

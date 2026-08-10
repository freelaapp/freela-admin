"use client";

import { useMemo, useState } from "react";
import { Search, MapPin, Store, Loader2, MessageCircle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCrmPipeline, usePipelineWhatsApp } from "@/modules/admin/application/use-admin-crm";
import type { PipelineCard } from "@/modules/admin/infrastructure/crm-api";
import {
  FUNNEL_PRESETS,
  FUNNEL_STAGE_ICONS,
  MODULE_LABEL,
  activeFunnelPreset,
  filterPipelineCards,
  formatSentAt,
  waLink,
  type FunnelRange,
} from "./funnel-helpers";

/**
 * Kanban do funil de contratantes: Cadastro novo → 1ª/2ª/3ª contratação →
 * Cliente fidelizado. As colunas vêm prontas da API (calculadas pelo nº de
 * vagas pagas) — o card muda de coluna sozinho, sem drag-and-drop.
 */
export function FunnelBoard() {
  // Padrão "30 dias" — o filtro roda no banco, para não puxar a base inteira.
  const [range, setRange] = useState<FunnelRange>(() => FUNNEL_PRESETS[3].compute());
  const { data: board, isLoading, isFetching, isError, refetch } = useCrmPipeline(range);
  const sendWhatsApp = usePipelineWhatsApp();
  const [q, setQ] = useState("");
  const activePreset = activeFunnelPreset(range);

  const columns = useMemo(() => {
    if (!board) return [];
    return board.columns.map((col) => {
      const cards = filterPipelineCards(col.cards, q);
      return {
        ...col,
        cards,
        // Conta sobre os cards VISÍVEIS: com busca ativa, "3 enviadas" tem que
        // bater com o que está na tela, senão o número parece errado.
        contactedCount: cards.filter((c) => c.lastMessageSentAt).length,
      };
    });
  }, [board, q]);

  function onSendWhatsApp(card: PipelineCard) {
    // Reenvio pede confirmação DIFERENTE: mandar de novo para quem já recebeu é
    // o erro que o amarelo existe para evitar, e insistir queima o número.
    const pergunta = card.lastMessageSentAt
      ? `${card.name} já recebeu a mensagem ${formatSentAt(card.lastMessageSentAt)}` +
        `${card.messagesSentCount > 1 ? ` (${card.messagesSentCount} envios)` : ""}. Enviar de novo?`
      : `Enviar a mensagem automática de WhatsApp para ${card.name}?`;
    if (!confirm(pergunta)) return;
    sendWhatsApp.mutate(card.userId);
  }

  if (isLoading) {
    return <p className="text-sm text-[#737373]">Carregando funil de contratantes…</p>;
  }

  if (isError) {
    return (
      <div className="text-sm text-[#737373]">
        <p>Não foi possível carregar o funil de contratantes.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Período do CADASTRO: atalhos + calendário (editar as datas = personalizado). */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {FUNNEL_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setRange(p.compute())}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activePreset === p.label
                  ? "bg-[#1d1d1b] text-white"
                  : "bg-[#f7f7f7] text-[#737373] hover:text-[#1d1d1b]"
              }`}
            >
              {p.label}
            </button>
          ))}
          <span
            className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${
              !activePreset ? "bg-[#1d1d1b] text-white" : "bg-[#f7f7f7] text-[#c4c4c4]"
            }`}
          >
            Personalizado
          </span>
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#737373]">De</span>
            <input
              type="date"
              value={range.from}
              max={range.to || undefined}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
              className="h-9 px-3 rounded-lg bg-[#f7f7f7] border-none text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#737373]">Até</span>
            <input
              type="date"
              value={range.to}
              min={range.from || undefined}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
              className="h-9 px-3 rounded-lg bg-[#f7f7f7] border-none text-sm text-[#1d1d1b] focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
            />
          </label>
        </div>
      </div>

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
            {board.totalContractors} contratante{board.totalContractors === 1 ? "" : "s"} no
            período{isFetching ? " — atualizando…" : ""}
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
                  <div className="flex items-center gap-1">
                    {/* Quantos desta etapa já foram abordados: o número que diz
                        se ainda há trabalho na coluna, sem contar card a card. */}
                    {col.contactedCount > 0 && (
                      <span
                        className="text-[10px] font-medium text-[#8a6d1f] bg-[#fdf6e3] px-1.5 py-0.5 rounded-full"
                        title={`${col.contactedCount} já receberam a mensagem`}
                      >
                        {col.contactedCount} enviadas
                      </span>
                    )}
                    <span className="text-xs font-medium text-[#737373] bg-[#f7f7f7] px-2 py-0.5 rounded-full">
                      {col.cards.length}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2 min-h-[80px] max-h-[65vh] overflow-y-auto">
                  {col.cards.map((card) => {
                    const sending =
                      sendWhatsApp.isPending && sendWhatsApp.variables === card.userId;
                    // Amarelo = já falamos com essa pessoa. O card cinza é
                    // trabalho a fazer; o amarelo é trabalho feito — dá para
                    // varrer a coluna com o olho sem abrir card nenhum.
                    const contacted = Boolean(card.lastMessageSentAt);
                    return (
                      <div
                        key={card.userId}
                        className={`rounded-lg p-3 ${
                          contacted
                            ? "bg-[#fdf6e3] border border-[#eca826]/40"
                            : "bg-[#f7f7f7]/50"
                        }`}
                      >
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

                        {contacted && (
                          <p className="mt-2 text-[11px] text-[#8a6d1f] flex items-center gap-1">
                            <Check className="w-3 h-3 shrink-0" />
                            Enviada {formatSentAt(card.lastMessageSentAt!)}
                            {card.messagesSentCount > 1 && ` · ${card.messagesSentCount}x`}
                          </p>
                        )}

                        <Button
                          size="sm"
                          className={`w-full mt-2 h-7 text-xs font-medium disabled:opacity-60 ${
                            contacted
                              ? "bg-white text-[#737373] border border-[#e5e5e5] hover:bg-[#f7f7f7]"
                              : "bg-[#25D366] text-white hover:bg-[#1fb457]"
                          }`}
                          disabled={!card.whatsappPhone || sending}
                          onClick={() => onSendWhatsApp(card)}
                        >
                          {sending ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          {contacted ? "Enviar de novo" : "Enviar msg automática"}
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

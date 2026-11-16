"use client";

import { useMemo, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { DataTable, type Column } from "@/components/shared/data-table";
import { formatInstantDate } from "@/lib/date.utils";
import {
  useCrmOldSignups,
  useCrmPipelineSettings,
  usePipelineWhatsApp,
} from "@/modules/admin/application/use-admin-crm";
import type { PipelineCard } from "@/modules/admin/infrastructure/crm-api";
import {
  CONTACT_FILTERS,
  MODULE_LABEL,
  countByContactFilter,
  filterOldSignups,
  isContacted,
  locationOptions,
  messageStatusOf,
  sendConfirmQuestion,
  waLink,
  type OldSignupFilters,
} from "./funnel-helpers";
import { MessageStatusInfo } from "./message-status";
import { PipelineMessageBar } from "./pipeline-message-bar";

/** Quantas linhas entram na tela por vez: a base tem centenas de cadastros. */
const PAGE_SIZE = 100;

type Row = PipelineCard & { id: string };

const NO_FILTERS: OldSignupFilters = { q: "", state: "", city: "", contact: "ALL" };

/** "2026-10-17" → "17/10/2026" (data de calendário: sem fuso para deslocar o dia). */
function formatYmd(ymd: string): string {
  const [year, month, day] = ymd.split("-");
  return year && month && day ? `${day}/${month}/${year}` : ymd;
}

/**
 * Cadastros antigos: contratantes que se cadastraram antes da janela do funil
 * (mais de 30 dias) — a base que nunca foi abordada. Um a um: a lista mostra
 * quem já recebeu o quê, e o envio é o mesmo botão do funil.
 */
export function OldSignupsBoard() {
  const { data, isLoading, isError, isFetching, refetch } = useCrmOldSignups();
  const { data: settings } = useCrmPipelineSettings();
  const sendWhatsApp = usePipelineWhatsApp();
  const [filters, setFilters] = useState<OldSignupFilters>(NO_FILTERS);
  const [limit, setLimit] = useState(PAGE_SIZE);

  /** Trocar qualquer filtro volta para o começo da lista. */
  const patch = (next: Partial<OldSignupFilters>) => {
    setFilters((current) => ({ ...current, ...next }));
    setLimit(PAGE_SIZE);
  };

  const cards = useMemo(() => data?.cards ?? [], [data]);
  const options = useMemo(() => locationOptions(cards, filters.state), [cards, filters.state]);
  const counts = useMemo(() => countByContactFilter(cards, filters), [cards, filters]);
  const visible = useMemo(() => filterOldSignups(cards, filters), [cards, filters]);
  const rows: Row[] = useMemo(
    () => visible.slice(0, limit).map((card) => ({ ...card, id: card.userId })),
    [visible, limit],
  );

  function onSend(card: PipelineCard) {
    const pergunta = sendConfirmQuestion(card, { templateName: settings?.template?.name });
    if (!confirm(pergunta)) return;
    sendWhatsApp.mutate(card.userId);
  }

  if (isLoading) {
    return <p className="text-sm text-[#737373]">Carregando cadastros antigos…</p>;
  }

  if (isError || !data) {
    return (
      <div className="text-sm text-[#737373]">
        <p>Não foi possível carregar os cadastros antigos.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
          Tentar de novo
        </Button>
      </div>
    );
  }

  const columns: Column<Row>[] = [
    {
      header: "Contratante",
      mobile: "title",
      sortable: true,
      sortAccessor: (row) => row.name,
      accessor: (row) => (
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-[#1d1d1b]">{row.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {row.modules.map((m) => (
              <Badge key={m} variant="outline" className="px-1.5 py-0 text-[10px]">
                {MODULE_LABEL[m] ?? m}
              </Badge>
            ))}
            {row.segment && <span className="text-xs text-[#737373]">{row.segment}</span>}
          </div>
        </div>
      ),
    },
    {
      header: "Cidade",
      sortable: true,
      sortAccessor: (row) => `${row.state ?? "zz"} ${row.city ?? "zz"}`,
      accessor: (row) =>
        row.city || row.state ? (
          <span className="text-sm text-[#1d1d1b]">
            {[row.city, row.state].filter(Boolean).join(" – ")}
          </span>
        ) : (
          <span className="text-sm text-[#a3a3a3]">Sem cidade</span>
        ),
    },
    {
      header: "WhatsApp",
      accessor: (row) =>
        row.whatsappPhone ? (
          <a
            href={waLink(row.whatsappPhone)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[#1a9e4b] hover:underline"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0" />
            {row.whatsappPhone}
          </a>
        ) : (
          <span className="text-sm text-[#a3a3a3]">Sem WhatsApp</span>
        ),
    },
    {
      header: "Cadastro",
      sortable: true,
      sortAccessor: (row) => new Date(row.registeredAt),
      accessor: (row) => (
        <span className="whitespace-nowrap text-sm text-[#1d1d1b]">
          {formatInstantDate(row.registeredAt)}
        </span>
      ),
    },
    {
      header: "Contratações",
      headerTitle:
        "Vagas pagas e não canceladas deste contratante, nos dois módulos (Bares e Casa), desde o cadastro.",
      sortable: true,
      sortAccessor: (row) => row.hiringsCount,
      accessor: (row) => <span className="text-sm text-[#1d1d1b]">{row.hiringsCount}</span>,
    },
    {
      header: "Mensagem",
      headerTitle:
        "O que este contratante já recebeu: a mensagem do Pipeline (e o que a Meta confirmou) e campanhas por WhatsApp.",
      sortable: true,
      sortAccessor: (row) => (row.lastMessageSentAt ? new Date(row.lastMessageSentAt) : null),
      accessor: (row) => {
        const info = <MessageStatusInfo card={row} />;
        const nothing =
          messageStatusOf(row) === "NONE" &&
          !row.lastCampaign &&
          !row.samePhoneSentAt &&
          !row.messageOptedOutAt;
        return nothing ? (
          <span className="text-xs text-[#a3a3a3]">Nunca recebeu nada</span>
        ) : (
          <div className="max-w-[260px] md:max-w-[240px]">{info}</div>
        );
      },
    },
    {
      header: "Ações",
      mobile: "actions",
      accessor: (row) => {
        const sending = sendWhatsApp.isPending && sendWhatsApp.variables === row.userId;
        const status = messageStatusOf(row);
        const again = isContacted(row) || status === "UNCERTAIN";
        return (
          <Button
            size="sm"
            className={`h-8 w-full whitespace-nowrap text-xs font-medium disabled:opacity-60 md:w-auto ${
              again
                ? "border border-[#e5e5e5] bg-white text-[#737373] hover:bg-[#f7f7f7]"
                : "bg-[#25D366] text-white hover:bg-[#1fb457]"
            }`}
            disabled={!row.whatsappPhone || sending}
            title={row.whatsappPhone ? undefined : "Sem WhatsApp cadastrado"}
            onClick={() => onSend(row)}
          >
            {sending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
            )}
            {again ? "Enviar de novo" : status === "FAILED" ? "Tentar de novo" : "Enviar mensagem"}
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <PipelineMessageBar />

      {/* Todo número diz o que é, a conta e de onde veio. */}
      <div className="mb-4 rounded-xl border border-[#e5e5e5] bg-white px-4 py-3">
        <p className="text-sm text-[#1d1d1b]">
          <strong>{data.total}</strong> contratante{data.total === 1 ? "" : "s"} cadastrado
          {data.total === 1 ? "" : "s"} há mais de {data.days} dias
          {isFetching ? " — atualizando…" : ""}
        </p>
        <p className="mt-0.5 text-xs text-[#737373]">
          Conta: contas de contratante ativas com cadastro até {formatYmd(data.registeredUntil)} (hoje
          menos {data.days} dias, no horário de Brasília). Quem tem cadastro em Bares e em Casa conta
          uma vez. Os mais novos aparecem no funil, na aba Pipeline.
        </p>
      </div>

      {/* Situação: os números seguem a busca, o estado e a cidade escolhidos. */}
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Situação da mensagem">
        {CONTACT_FILTERS.map((option) => {
          const active = filters.contact === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => patch({ contact: option.value })}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-[#eca826] bg-[#eca826]/10 text-[#1d1d1b]"
                  : "border-[#e5e5e5] bg-white text-[#737373] hover:bg-[#f5f5f5]"
              }`}
            >
              {option.label} ({counts[option.value]})
            </button>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isFetching={isFetching && rows.length === 0}
        searchPlaceholder="Buscar nome, cidade, ramo, telefone…"
        controlledSearch={{ value: filters.q, onChange: (q) => patch({ q }) }}
        defaultSort={{ index: 3, direction: "desc" }}
        caption="Cadastros antigos de contratantes, com o que cada um já recebeu"
        emptyMessage={
          cards.length === 0
            ? "Nenhum contratante cadastrado há mais de 30 dias."
            : "Nenhum cadastro com esses filtros."
        }
        filters={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <NativeSelect
              aria-label="Estado"
              className="sm:w-36"
              value={filters.state}
              onChange={(event) => patch({ state: event.target.value, city: "" })}
            >
              <option value="">Todos os estados</option>
              {options.states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label="Cidade"
              className="sm:w-52"
              value={filters.city}
              onChange={(event) => patch({ city: event.target.value })}
            >
              <option value="">Todas as cidades</option>
              {options.cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </NativeSelect>
          </div>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#737373]">
            <span>
              Mostrando {rows.length} de {visible.length}
              {visible.length !== cards.length ? ` (filtrado de ${cards.length})` : ""}
            </span>
            {visible.length > rows.length && (
              <Button variant="outline" size="sm" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                Mostrar mais {Math.min(PAGE_SIZE, visible.length - rows.length)}
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
}

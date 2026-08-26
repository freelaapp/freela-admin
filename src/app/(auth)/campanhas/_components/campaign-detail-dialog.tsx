"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  Send,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatInstantDateTime } from "@/lib/date.utils";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useCampaign,
  useCampaignRecipients,
  useSetRecipientContact,
} from "@/modules/admin/application/use-admin-referrals";
import {
  exportCampaignRecipientsCsv,
  getCampaignCounts,
  type CampaignRecipient,
  type RecipientStatus,
} from "@/modules/admin/infrastructure/referrals-api";
import { CampaignStatusBadge } from "./campaign-status-badge";

const PAGE_SIZE = 50;

const RECIPIENT_STATUS_LABEL: Record<RecipientStatus, string> = {
  PENDING: "Pendente",
  SENT: "Enviado",
  FAILED: "Falhou",
  SKIPPED: "Pulado",
};

const ROLE_LABEL: Record<string, string> = {
  FREELANCER: "freelancer",
  PROVIDER: "freelancer",
  CONTRACTOR: "contratante",
  CONTRATANTE: "contratante",
  BOTH: "os dois",
};

type TriState = "" | "yes" | "no";

function triToBool(value: TriState): boolean | undefined {
  return value === "" ? undefined : value === "yes";
}

/** Nome/telefone/e-mail valem para as campanhas antigas também (`destination`). */
function rowName(row: CampaignRecipient) {
  return row.name ?? row.displayName ?? null;
}
function rowPhone(row: CampaignRecipient) {
  return row.phone ?? (row.channel === "WHATSAPP" ? row.destination : null);
}
function rowEmail(row: CampaignRecipient) {
  return row.email ?? (row.channel === "EMAIL" ? row.destination : null);
}

function whoWhen(who: { name: string | null } | null | undefined, when: string | null | undefined) {
  if (!when) return null;
  return `${who?.name ?? "—"} em ${formatInstantDateTime(when)}`;
}

/** Baixa um Blob como arquivo — sem depender do `download` de `<a>` externo. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function StatusCell({ row }: { row: CampaignRecipient }) {
  if (row.status === "SENT") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> Enviado
      </span>
    );
  }
  if (row.status === "FAILED") {
    return (
      <span
        className="inline-flex cursor-help items-center gap-1 text-red-700"
        title={row.failureReason ?? "Sem motivo registrado"}
      >
        <XCircle className="h-3.5 w-3.5" /> Falhou
        {row.failureReason && (
          <span className="max-w-40 truncate text-[11px] text-red-500">
            · {row.failureReason}
          </span>
        )}
      </span>
    );
  }
  if (row.status === "SKIPPED") {
    return <span className="text-neutral-500">Pulado</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-neutral-600">
      <Clock className="h-3.5 w-3.5" /> Pendente
    </span>
  );
}

/**
 * Checkbox + nota. A nota salva ao sair do campo (ou Enter) só se mudou; o
 * checkbox salva na hora. Quem marcou e quando vêm da API — não do cliente.
 */
function ContactCell({
  campaignId,
  row,
  disabled,
}: {
  campaignId: string;
  row: CampaignRecipient;
  disabled: boolean;
}) {
  const setContact = useSetRecipientContact();
  const [note, setNote] = useState(row.contactNote ?? "");
  // Otimista: o checkbox vira na hora do clique; a API confirma no refetch.
  // Sem isso o operador clica, nada muda por um segundo, e clica de novo.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const contacted = optimistic ?? Boolean(row.contactedAt);

  useEffect(() => {
    setNote(row.contactNote ?? "");
  }, [row.contactNote]);
  useEffect(() => {
    setOptimistic(null);
  }, [row.contactedAt]);

  const save = async (next: { contacted: boolean; note?: string }) => {
    setOptimistic(next.contacted);
    try {
      await setContact.mutateAsync({ campaignId, recipientId: row.id, ...next });
    } catch (error) {
      setOptimistic(null);
      toast.error(getAxiosErrorMessage(error));
    }
  };

  return (
    <div className="flex min-w-48 flex-col gap-1">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          data-testid={`contacted-${row.id}`}
          checked={contacted}
          disabled={disabled || setContact.isPending}
          onChange={(event) =>
            void save({ contacted: event.target.checked, ...(note ? { note } : {}) })
          }
        />
        <span>Conseguiu contato</span>
        {setContact.isPending && <Loader2 className="h-3 w-3 animate-spin text-neutral-400" />}
      </label>
      <input
        type="text"
        data-testid={`note-${row.id}`}
        className="h-7 w-full rounded border border-neutral-200 px-2 text-xs"
        placeholder="Nota (opcional)"
        value={note}
        disabled={disabled}
        onChange={(event) => setNote(event.target.value)}
        onBlur={() => {
          if (note !== (row.contactNote ?? "")) void save({ contacted, note });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
        }}
      />
      {contacted && (
        <span className="text-[11px] text-neutral-500">
          {whoWhen(row.contactedBy, row.contactedAt)}
        </span>
      )}
    </div>
  );
}

function RegisteredCell({ row }: { row: CampaignRecipient }) {
  if (!row.registered) return <span className="text-neutral-400">—</span>;
  const role = ROLE_LABEL[row.registered.role?.toUpperCase?.() ?? ""] ?? row.registered.role;
  return (
    <span className="inline-flex flex-col text-xs text-emerald-700">
      <span className="inline-flex items-center gap-1">
        <CheckCircle2 className="h-3.5 w-3.5" /> Cadastrou
      </span>
      <span className="text-[11px] text-neutral-500">
        {formatInstantDateTime(row.registered.registeredAt)} · {role}
        {row.registered.afterCampaign === false && " · já tinha conta"}
      </span>
    </span>
  );
}

interface Props {
  campaignId: string | null;
  onClose: () => void;
}

export function CampaignDetailDialog({ campaignId, onClose }: Props) {
  const detail = useCampaign(campaignId);
  const [status, setStatus] = useState<"" | RecipientStatus>("");
  const [contacted, setContacted] = useState<TriState>("");
  const [registered, setRegistered] = useState<TriState>("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  // Busca com atraso: cada tecla seria uma chamada à API.
  useEffect(() => {
    const handle = setTimeout(() => setQ(search), 400);
    return () => clearTimeout(handle);
  }, [search]);

  // Filtro novo → volta para a primeira página.
  useEffect(() => {
    setPage(1);
  }, [status, contacted, registered, q]);

  // Trocar de campanha limpa os filtros da anterior.
  useEffect(() => {
    setStatus("");
    setContacted("");
    setRegistered("");
    setSearch("");
    setQ("");
    setPage(1);
  }, [campaignId]);

  const running = detail.data?.campaign.status === "RUNNING";
  const params = useMemo(
    () => ({
      status: status || undefined,
      contacted: triToBool(contacted),
      registered: triToBool(registered),
      q,
      page,
      pageSize: PAGE_SIZE,
    }),
    [status, contacted, registered, q, page],
  );
  const recipients = useCampaignRecipients(campaignId, params, { autoRefresh: running });

  const total = recipients.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromIndex = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toIndex = Math.min(page * PAGE_SIZE, total);
  const counts = detail.data ? getCampaignCounts(detail.data) : null;
  const campaign = detail.data?.campaign;
  // O detalhe traz os admins na raiz; a lista, dentro da campanha.
  const createdBy = detail.data?.createdBy ?? campaign?.createdBy;
  const startedBy = detail.data?.startedBy ?? campaign?.startedBy;
  const isExternal = campaign?.audience === "EXTERNAL_LIST";
  const finished = campaign?.status === "CANCELLED";

  const handleExport = async () => {
    if (!campaignId) return;
    setExporting(true);
    try {
      // Exporta o que está na tela (mesmos filtros), todas as páginas.
      const blob = await exportCampaignRecipientsCsv(campaignId, {
        status: params.status,
        contacted: params.contacted,
        registered: params.registered,
        q: params.q,
      });
      const safeName = (campaign?.name ?? "campanha").replace(/[^\w\-]+/g, "_").slice(0, 60);
      downloadBlob(blob, `campanha-${safeName}.csv`);
    } catch (error) {
      toast.error(getAxiosErrorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    { header: "Nome", accessor: (row: CampaignRecipient) => rowName(row) ?? "—" },
    {
      header: "Telefone",
      accessor: (row: CampaignRecipient) => (
        <span className="font-mono text-xs">{rowPhone(row) ?? "—"}</span>
      ),
    },
    { header: "E-mail", accessor: (row: CampaignRecipient) => rowEmail(row) ?? "—" },
    {
      header: "Canal",
      accessor: (row: CampaignRecipient) => (row.channel === "WHATSAPP" ? "WhatsApp" : "E-mail"),
    },
    { header: "Status", accessor: (row: CampaignRecipient) => <StatusCell row={row} /> },
    {
      header: "Enviado em",
      accessor: (row: CampaignRecipient) => (
        <span className="text-xs tabular-nums">
          {row.sentAt ? formatInstantDateTime(row.sentAt) : "—"}
        </span>
      ),
    },
    {
      header: "Contato",
      accessor: (row: CampaignRecipient) =>
        campaignId ? (
          <ContactCell campaignId={campaignId} row={row} disabled={Boolean(finished)} />
        ) : null,
    },
    { header: "Cadastro", accessor: (row: CampaignRecipient) => <RegisteredCell row={row} /> },
  ];

  return (
    <Dialog
      open={Boolean(campaignId)}
      onOpenChange={(open) => !open && onClose()}
      className="max-w-6xl"
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign?.name ?? "Campanha"}</DialogTitle>
          {/* Não usa DialogDescription: ela renderiza <p>, e aqui há vários. */}
          <div className="mt-1 space-y-0.5 text-sm text-[#737373]" data-testid="detail-meta">
              {campaign && (
                <>
                  <p className="flex flex-wrap items-center gap-2">
                    <CampaignStatusBadge status={campaign.status} />
                    <span>
                      {campaign.audience === "EXTERNAL_LIST" ? "Lista externa (planilha)" : "Recorte da base"}
                    </span>
                  </p>
                  <p>
                    Criada por <strong>{createdBy?.name ?? "—"}</strong> em{" "}
                    {formatInstantDateTime(campaign.createdAt)}
                    {campaign.listFileName && (
                      <>
                        {" "}
                        · planilha <span className="font-mono text-xs">{campaign.listFileName}</span>
                      </>
                    )}
                  </p>
                  <p>
                    {campaign.startedAt ? (
                      <>
                        Disparada por <strong>{startedBy?.name ?? "—"}</strong> em{" "}
                        {formatInstantDateTime(campaign.startedAt)}
                      </>
                    ) : (
                      "Ainda não disparada."
                    )}
                    {detail.data && detail.data.stats.PENDING > 0 && campaign.status !== "DRAFT" && (
                      <>
                        {" "}
                        Restam ~{detail.data.estimate.days} dia(s) úteis a{" "}
                        {detail.data.estimate.perDay}/dia.
                      </>
                    )}
                  </p>
                </>
              )}
          </div>
        </DialogHeader>

        {counts && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" data-testid="detail-counts">
            <CountCard icon={Users} label="Total" value={counts.total} />
            <CountCard icon={Send} label="Enviados" value={counts.sent} tone="text-emerald-700" />
            <CountCard icon={XCircle} label="Falharam" value={counts.failed} tone={counts.failed ? "text-red-700" : undefined} />
            <CountCard icon={Clock} label="Pendentes" value={counts.pending} />
            <CountCard icon={UserCheck} label="Contato" value={counts.contacted} tone="text-[#eca826]" />
            <CountCard icon={UserPlus} label="Cadastro" value={counts.registered} tone="text-blue-700" />
          </div>
        )}

        <DataTable
          columns={columns}
          data={recipients.data?.items ?? []}
          isFetching={recipients.isFetching && !recipients.data}
          searchPlaceholder="Buscar por nome, telefone ou e-mail…"
          controlledSearch={{ value: search, onChange: setSearch }}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect
                data-testid="filter-status"
                className="w-auto"
                value={status}
                onChange={(event) => setStatus(event.target.value as "" | RecipientStatus)}
              >
                <option value="">Todos os status</option>
                {(Object.keys(RECIPIENT_STATUS_LABEL) as RecipientStatus[]).map((key) => (
                  <option key={key} value={key}>
                    {RECIPIENT_STATUS_LABEL[key]}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                data-testid="filter-contacted"
                className="w-auto"
                value={contacted}
                onChange={(event) => setContacted(event.target.value as TriState)}
              >
                <option value="">Contato: todos</option>
                <option value="yes">Conseguiu contato</option>
                <option value="no">Sem contato</option>
              </NativeSelect>
              <NativeSelect
                data-testid="filter-registered"
                className="w-auto"
                value={registered}
                onChange={(event) => setRegistered(event.target.value as TriState)}
              >
                <option value="">Cadastro: todos</option>
                <option value="yes">Cadastrou</option>
                <option value="no">Não cadastrou</option>
              </NativeSelect>
              <Button
                type="button"
                size="sm"
                variant="outline"
                data-testid="export-csv"
                disabled={exporting || !campaignId}
                onClick={handleExport}
              >
                {exporting ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1 h-3.5 w-3.5" />
                )}
                Exportar CSV
              </Button>
              {running && (
                <span className="text-xs text-neutral-500">Atualiza a cada 60 s</span>
              )}
            </div>
          }
          footer={
            <div className="flex items-center justify-between text-sm text-[#737373]">
              <span>{`Mostrando ${fromIndex}–${toIndex} de ${total.toLocaleString("pt-BR")}`}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || recipients.isFetching}
                  className="rounded-md border border-[#e5e5e5] p-1 disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-[#1d1d1b]">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || recipients.isFetching}
                  className="rounded-md border border-[#e5e5e5] p-1 disabled:opacity-40"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          }
        />
        {!isExternal && (
          <p className="text-xs text-neutral-500">
            Campanha da base: contato e cadastro só aparecem se a API já os registrar para
            esta audiência.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CountCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <Card className="flex flex-col gap-0.5 p-3">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#737373]">
        <Icon className={`h-3.5 w-3.5 ${tone ?? "text-[#a3a3a3]"}`} />
        {label}
      </span>
      <span className={`text-xl font-bold tabular-nums ${tone ?? "text-[#1d1d1b]"}`}>{value}</span>
    </Card>
  );
}

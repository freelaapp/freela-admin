"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { NOTIFICATION_EVENTS_KEY, useNotificationEvents, useSetNotificationEvent } from "@/modules/admin/application/use-notification-events";
import { LegacyCutSection } from "./legacy-cut-section";
import {
  sendNotificationTest,
  submitNotificationTemplate,
  type NotificationEventView,
  type TemplateStatus,
} from "@/modules/admin/infrastructure/notification-events-api";

const STATUS_LABEL: Record<TemplateStatus, string> = {
  APPROVED: "Aprovado",
  PENDING: "Em análise na Meta",
  REJECTED: "Recusado",
  PAUSED: "Pausado pela Meta",
  DISABLED: "Desativado pela Meta",
  MISSING: "Ainda não enviado",
};

const STATUS_CLASS: Record<TemplateStatus, string> = {
  APPROVED: "bg-green-50 text-green-700",
  PENDING: "bg-amber-50 text-amber-700",
  REJECTED: "bg-red-50 text-red-700",
  PAUSED: "bg-red-50 text-red-700",
  DISABLED: "bg-red-50 text-red-700",
  MISSING: "bg-[#f7f7f7] text-[#737373]",
};

function EventRow({ row, testPhone }: { row: NotificationEventView; testPhone: string }) {
  const setEvent = useSetNotificationEvent();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const approved = row.template.status === "APPROVED";
  const canSubmit = row.template.status === "MISSING" || row.template.status === "REJECTED";

  async function run(action: () => Promise<void>, ok: string, fail: string, refresh = false) {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      // A situação do modelo mudou na Meta: recarrega a lista para mostrar "Em análise".
      if (refresh) await qc.invalidateQueries({ queryKey: NOTIFICATION_EVENTS_KEY });
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, fail));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 border-b border-[#e5e5e5] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#1d1d1b]">{row.label}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#737373]">
          <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_CLASS[row.template.status]}`}>{STATUS_LABEL[row.template.status]}</span>
          {row.templateCategory === "AUTHENTICATION" && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">Autenticação</span>
          )}
          {row.template.rejectedReason && <span>Motivo: {row.template.rejectedReason}</span>}
          {row.categoryWarning && <span className="text-red-700">A Meta mudou a categoria para {row.template.category} (custo maior)</span>}
          <span>
            7 dias: {row.last7Days.sent} enviados · {row.last7Days.delivered} entregues · {row.last7Days.read} lidos · {row.last7Days.failed} falhas
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canSubmit && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => run(() => submitNotificationTemplate(row.eventKey), "Modelo enviado para aprovação.", "Não foi possível enviar o modelo.", true)}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar para aprovação
          </Button>
        )}
        {approved && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || testPhone.replace(/\D/g, "").length < 10}
            onClick={() => run(() => sendNotificationTest(row.eventKey, testPhone), "Teste enviado.", "O teste não saiu.")}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar teste
          </Button>
        )}
        <Switch
          aria-label={row.label}
          checked={row.metaEnabled}
          disabled={!approved && !row.metaEnabled}
          onCheckedChange={(enabled) =>
            setEvent.mutate(
              { eventKey: row.eventKey, enabled },
              { onError: (err) => toast.error(getAxiosErrorMessage(err, "Não foi possível alterar o aviso.")) },
            )
          }
        />
      </div>
    </li>
  );
}

export function MetaEventsCard() {
  const { data, isLoading, isError } = useNotificationEvents();
  const [testPhone, setTestPhone] = useState("");

  return (
    <div className="mb-6 rounded-xl border border-[#e5e5e5] bg-white p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eca826]/10">
          <MessageSquare className="h-5 w-5 text-[#eca826]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#1d1d1b]">WhatsApp oficial (Meta)</h3>
          <p className="mt-1 text-xs text-[#737373]">
            Cada aviso ligado sai pelo número oficial com botões, e deixa de sair pela Z-API. Desligar volta ao envio antigo na hora.
          </p>
          <label htmlFor="meta-test-phone" className="mb-1 mt-4 block text-xs font-medium text-[#737373]">
            Seu WhatsApp para os testes
          </label>
          <Input
            id="meta-test-phone"
            className="mb-3 max-w-xs"
            placeholder="(11) 98888-7777"
            inputMode="tel"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
          {isError && <p className="text-xs text-red-600">Não foi possível carregar os avisos.</p>}
          {data && (
            <ul>
              {data.map((row) => (
                <EventRow key={row.eventKey} row={row} testPhone={testPhone} />
              ))}
            </ul>
          )}
          <LegacyCutSection />
        </div>
      </div>
    </div>
  );
}

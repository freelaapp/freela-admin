"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  getAutoSettings,
  setAutoSetting,
  type AutoSettings,
} from "@/modules/admin/infrastructure/support-checklist-api";

const QUERY_KEY = ["admin", "support-auto-settings"] as const;

/**
 * Liga/desliga o disparo AUTOMÁTICO das mensagens do suporte, por ação.
 *
 * As mensagens saem SOZINHAS para o cliente quando a hora chega — por isso o
 * aviso vermelho e o rollout uma ação por vez. O flag mestre (env) fica acima de
 * tudo: com ele OFF, nada dispara mesmo com ações ligadas aqui.
 */
export function SupportAutoSettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getAutoSettings,
    enabled: open,
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: ({ actionId, enabled }: { actionId: string; enabled: boolean }) =>
      setAutoSetting(actionId, enabled),
    onMutate: async ({ actionId, enabled }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const anterior = qc.getQueryData<AutoSettings>(QUERY_KEY);
      if (anterior) {
        qc.setQueryData<AutoSettings>(QUERY_KEY, {
          ...anterior,
          actions: anterior.actions.map((a) => (a.actionId === actionId ? { ...a, enabled } : a)),
        });
      }
      return { anterior };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.anterior) qc.setQueryData(QUERY_KEY, ctx.anterior);
      toast.error("Não foi possível salvar. Tente de novo.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const globalOff = data ? !data.globalEnabled : false;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[#334155]" aria-hidden />
              Automação de mensagens
            </span>
          </DialogTitle>
        </DialogHeader>

        <p className="flex items-start gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#92400E]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            As ações ligadas aqui saem <strong>sozinhas para o cliente</strong> no WhatsApp quando
            a hora chega — só entre 8h e 21h, sem repetir e no máximo uma por pessoa a cada 6h.
            Ligue uma por vez e acompanhe.
          </span>
        </p>

        {isLoading || !data ? (
          <div className="flex items-center justify-center py-8 text-[#94A3B8]">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </div>
        ) : (
          <>
            {globalOff ? (
              <p className="rounded-lg bg-[#F1F5F9] px-3 py-2 text-[12px] font-medium text-[#475569]">
                Interruptor mestre <strong>desligado</strong> no servidor: nada dispara sozinho
                ainda, mesmo com as ações abaixo ligadas. (Depende do dono ligar em produção.)
              </p>
            ) : (
              <p className="rounded-lg bg-[#F0FDF4] px-3 py-2 text-[12px] font-medium text-[#166534]">
                Interruptor mestre <strong>ligado</strong>: as ações ligadas abaixo estão disparando.
              </p>
            )}

            <ul className="mt-1 flex flex-col divide-y divide-[#F1F5F9]">
              {data.actions.map((a) => (
                <li key={a.actionId} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-[13px] font-medium text-[#0F172A]">{a.label}</span>
                  <Switch
                    checked={a.enabled}
                    onCheckedChange={(enabled) => mutation.mutate({ actionId: a.actionId, enabled })}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

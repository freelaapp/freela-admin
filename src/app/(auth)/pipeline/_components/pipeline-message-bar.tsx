"use client";

import { useState } from "react";
import { AlertTriangle, MessageCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCrmPipelineSettings } from "@/modules/admin/application/use-admin-crm";
import { MessageSettingsDialog } from "./message-settings-dialog";

/**
 * Faixa no topo do funil e dos cadastros antigos: diz QUAL mensagem o botão
 * manda e para qual WhatsApp o contratante é levado — antes de alguém apertar
 * enviar em série sem saber o que está saindo.
 */
export function PipelineMessageBar() {
  const { data: settings, isLoading, isError } = useCrmPipelineSettings();
  const [open, setOpen] = useState(false);

  // API anterior a esta tela (rota inexistente) ou fora do ar: o botão de
  // enviar segue funcionando como sempre, só não há o que configurar aqui.
  if (isLoading || isError || !settings) return null;

  const template = settings.template;
  const notApproved = template && template.status !== "APPROVED";

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#e5e5e5] bg-white px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#25D366]" />
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-[#1d1d1b]">
            {template
              ? `Mensagem: WhatsApp oficial, modelo “${template.name}”`
              : "Mensagem: texto fixo pelo chip de campanha"}
          </p>
          <p className="break-words text-xs text-[#737373]">
            WhatsApp do marketing: {settings.marketingWhatsapp.display}
            {settings.marketingWhatsapp.isFallback && " (o de suporte; nenhum número do marketing configurado)"}
          </p>
          {notApproved && (
            <p className="mt-1 flex items-start gap-1 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              O modelo está {template.statusLabel}: os envios são recusados até escolher outro.
            </p>
          )}
        </div>
      </div>
      <Button variant="outline" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
        <Settings className="mr-1.5 h-3.5 w-3.5" /> Configurar mensagem
      </Button>

      <MessageSettingsDialog open={open} onOpenChange={setOpen} settings={settings} />
    </div>
  );
}

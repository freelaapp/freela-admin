// src/app/(auth)/configuracoes/_components/legacy-cut-section.tsx
"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Scissors } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useLegacyCut, useSetLegacyCut } from "@/modules/admin/application/use-notification-events";

/** C1–C18 da spec fase 2 §6, em linguagem do dia a dia. */
export const LEGACY_CUT_ITEMS: string[] = [
  "Aviso ao freelancer quando o contratante desfaz a seleção",
  "Lembrete de 30 minutos para o freelancer confirmar",
  "“Seu serviço começa em breve” (1 hora antes)",
  "Códigos de check-in e check-out por WhatsApp",
  "“O freelancer confirmou” no WhatsApp particular do contratante (o grupo dedicado continua)",
  "“O freelancer compareceu?” fora do modelo oficial",
  "Lembrete de 24 horas para confirmar a presença",
  "Guia “Sua vaga foi publicada”",
  "Guia depois do pagamento",
  "Boas-vindas ao contratante (passa a ser por e-mail)",
  "Freelancer cancelou antes do pagamento",
  "Contrato: aviso de 30 minutos e cancelamento para o contratante",
  "Aviso de infração (ficam e-mail e push)",
  "Plano vencido (passa a ser e-mail e push)",
  "eSocial S-2300 por serviço (vira resumo semanal por e-mail)",
  "Relatório do contador, S-1200 e DCTFWeb (passam a ser e-mail)",
  "Entrevista de vaga fixa (ficam e-mail com convite de agenda e push)",
  "Avisos ao consultor (fica o e-mail)",
];

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LegacyCutSection() {
  const { data, isLoading, isError } = useLegacyCut();
  const setCut = useSetLegacyCut();
  const [pending, setPending] = useState<boolean | null>(null);
  const enabled = data?.enabled ?? false;

  function confirm() {
    if (pending === null) return;
    const next = pending;
    setCut.mutate(next, {
      onSuccess: () => {
        toast.success(next ? "Corte ligado: esses avisos pararam de sair pela Z-API." : "Corte desligado: a Z-API voltou para esses avisos.");
        setPending(null);
      },
      onError: (err) => {
        toast.error(getAxiosErrorMessage(err, "Não foi possível mudar o corte."));
        setPending(null);
      },
    });
  }

  return (
    <section className="mt-6 border-t border-[#e5e5e5] pt-5" aria-labelledby="legacy-cut-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 id="legacy-cut-title" className="flex items-center gap-2 text-sm font-semibold text-[#1d1d1b]">
            <Scissors className="h-4 w-4 text-[#eca826]" />
            Cortar WhatsApp antigo
          </h4>
          <p className="mt-1 text-xs text-[#737373]">
            Ligado, os avisos abaixo param de sair pela Z-API. O push e o e-mail de cada um continuam. Desligar volta ao envio antigo em até 1 minuto.
          </p>
        </div>
        <Switch
          aria-label="Cortar WhatsApp antigo"
          checked={enabled}
          className="before:absolute before:-inset-3 before:content-['']"
          disabled={isLoading || isError || setCut.isPending}
          onCheckedChange={(next) => setPending(next)}
        />
      </div>

      <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        Ligue só depois de ativar SPF/DKIM no domínio de e-mail.
      </p>

      {data?.updatedAt && (
        <p className="mt-2 text-xs text-[#737373]">
          {data.enabled ? "Ligado" : "Desligado"} por {data.updatedBy ?? "alguém da equipe"} em {formatWhen(data.updatedAt)}
        </p>
      )}
      {isError && <p className="mt-2 text-xs text-red-600">Não foi possível carregar o corte.</p>}

      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[#525252]">
        {LEGACY_CUT_ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending ? "Ligar o corte do WhatsApp antigo?" : "Desligar o corte?"}</DialogTitle>
            <DialogDescription>
              {pending
                ? "Os 18 avisos da lista param de sair pela Z-API em até 1 minuto. Push e e-mail continuam."
                : "Os 18 avisos voltam a sair pela Z-API em até 1 minuto."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button className="min-h-11" onClick={confirm} disabled={setCut.isPending}>
              {setCut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "Ligar o corte" : "Desligar o corte"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

"use client";

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface Props {
  title: string;
  /** O que acontece com a pessoa ao confirmar, em português claro. */
  consequence: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** Painel inline que pede o motivo (obrigatório) antes de uma ação que mexe na situação da pessoa. */
export function ReasonPrompt({ title, consequence, confirmLabel, pending, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState("");
  const id = useId();
  const trimmed = reason.trim();

  return (
    <div className="space-y-3 text-sm text-[#1d1d1b]">
      <p className="text-base font-semibold">{title}</p>
      <p className="text-[#525252]">{consequence}</p>
      <div className="space-y-1">
        <Label htmlFor={id}>Motivo (obrigatório)</Label>
        <textarea
          id={id}
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#eca826]/30"
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" className="min-h-11" onClick={onCancel} disabled={pending}>
          Voltar
        </Button>
        <Button className="min-h-11" onClick={() => onConfirm(trimmed)} disabled={pending || trimmed === ""}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

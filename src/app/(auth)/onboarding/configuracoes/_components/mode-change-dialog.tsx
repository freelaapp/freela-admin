"use client";

import { useState } from "react";
import { CheckCircle2, HelpCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ModeChangeDialog as ModeChangeInfo } from "@/modules/admin/application/orientation-mode";
import { readinessChecks, type ReadinessCheck } from "@/modules/admin/application/orientation-virada-presentation";
import { useOrientationReadiness } from "@/modules/admin/application/use-orientation";

interface Props {
  info: ModeChangeInfo | { blocked: string };
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const STATE_VIEW = {
  ok: { Icon: CheckCircle2, text: "Ok", color: "text-[#166534]" },
  fail: { Icon: XCircle, text: "Falhou", color: "text-[#991b1b]" },
  unknown: { Icon: HelpCircle, text: "Sem conferência", color: "text-[#8a5d00]" },
} as const;

function CheckRow({ check }: { check: ReadinessCheck }) {
  const [all, setAll] = useState(false);
  const v = STATE_VIEW[check.state];
  const extra = check.allCities && check.allCities.length > 5 ? check.allCities : null;
  return (
    <li className="rounded-lg border border-[#e5e5e5] p-3">
      <p className="flex items-start gap-2 font-medium">
        <v.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${v.color}`} aria-hidden />
        <span className={`shrink-0 ${v.color}`}>{v.text}</span>
        <span>{check.label}</span>
      </p>
      <p className="mt-1 pl-6 text-[#525252]">{all && extra ? extra.join("; ") : check.detail}</p>
      {extra && (
        <button type="button" className="mt-1 pl-6 text-xs underline" onClick={() => setAll((a) => !a)}>
          {all ? "Ver menos" : `Ver todas (${extra.length})`}
        </button>
      )}
      {check.how && (
        <details className="mt-1 pl-6 text-xs text-[#737373]">
          <summary className="cursor-pointer">Ver a conta</summary>
          <p className="mt-1">{check.how}</p>
        </details>
      )}
    </li>
  );
}

/** Conferências do modo "Todos": informam, não travam (quem decide é o super-admin; o botão continua no TODOS). */
function ReadinessChecks() {
  const q = useOrientationReadiness(true);
  if (q.isLoading) {
    return (
      <p role="status" className="flex items-center gap-2 text-[#737373]">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Conferindo…
      </p>
    );
  }
  const checks = readinessChecks(q.data ?? null, q.isError);
  const problem = checks.some((c) => c.state !== "ok");
  return (
    <div className="space-y-2">
      <ul aria-label="Conferências antes de ligar o Todos" className="space-y-2">
        {checks.map((c) => (
          <CheckRow key={c.label} check={c} />
        ))}
      </ul>
      {problem && (
        <p role="alert" className="rounded-lg border border-[#dc2626] bg-[#fef2f2] p-3 font-medium text-[#991b1b]">
          Há conferência com problema. Ligar mesmo assim esconde vagas onde falta gente.
        </p>
      )}
    </div>
  );
}

export function ModeChangeDialog({ info, pending, onConfirm, onClose }: Props) {
  const [typed, setTyped] = useState("");
  const blocked = "blocked" in info;
  const needs = !blocked ? info.requiresTyping : null;
  const canConfirm = !blocked && !pending && (!needs || typed.trim() === needs);

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent role="dialog" aria-modal="true" className="max-h-[55vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{blocked ? "Não dá para mudar agora" : info.title}</DialogTitle>
          {blocked && <DialogDescription>{info.blocked}</DialogDescription>}
        </DialogHeader>
        {!blocked && (
          <div className="space-y-2 text-sm text-[#1d1d1b]">
            {info.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {needs && <ReadinessChecks />}
            {needs && (
              <div className="pt-2">
                <Label htmlFor="mode-typed">Digite {needs} para confirmar</Label>
                <Input
                  id="mode-typed"
                  value={typed}
                  autoComplete="off"
                  onChange={(e) => setTyped(e.target.value)}
                />
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {blocked ? "Fechar" : "Cancelar"}
          </Button>
          {!blocked && (
            <Button onClick={onConfirm} disabled={!canConfirm}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {info.confirmLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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

interface Props {
  info: ModeChangeInfo | { blocked: string };
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
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

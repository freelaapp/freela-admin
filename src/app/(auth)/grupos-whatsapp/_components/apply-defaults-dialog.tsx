"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  applyPhonesToTargets,
  applySummaryText,
  groupsCountLabel,
  progressLabel,
  type ApplyFailure,
  type ApplyTarget,
} from "@/modules/admin/application/whatsapp-groups-presentation";
import { addGroupParticipants } from "@/modules/admin/infrastructure/whatsapp-groups-api";

type Phase =
  | { step: "confirm" }
  | { step: "running"; done: number; total: number }
  | { step: "done"; total: number; failures: ApplyFailure[] };

/** Confirmação → um grupo por vez com "12 de 40" → resumo com quem falhou. */
export function ApplyDefaultsDialog({
  phones,
  targets,
  onClose,
}: {
  phones: string[];
  targets: ApplyTarget[];
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ step: "confirm" });
  const running = phase.step === "running";

  const run = async () => {
    setPhase({ step: "running", done: 0, total: targets.length });
    const failures = await applyPhonesToTargets(
      targets,
      phones,
      addGroupParticipants,
      (done, total) => setPhase({ step: "running", done, total }),
      (error) => getAxiosErrorMessage(error, "Falha ao adicionar."),
    );
    setPhase({ step: "done", total: targets.length, failures });
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !running) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar em todos os grupos</DialogTitle>
          <DialogDescription>
            {phase.step === "confirm" &&
              (targets.length === 0
                ? "Nenhum grupo com o bot dentro para receber os números agora."
                : `Os ${phones.length} números padrão vão ser adicionados a ${groupsCountLabel(targets.length)} (cidades, dedicados e VIP ativos). Grupos com o bot fora ficam de fora.`)}
            {phase.step === "running" && "Adicionando um grupo por vez. Não feche esta janela."}
            {phase.step === "done" && applySummaryText(phase.total, phase.failures)}
          </DialogDescription>
        </DialogHeader>

        {phase.step === "running" && (
          <div className="space-y-2">
            <div
              className="h-2 w-full rounded-full bg-[#f0f0f0]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={phase.total}
              aria-valuenow={phase.done}
            >
              <div
                className="h-2 rounded-full bg-[#eca826] transition-all"
                style={{ width: `${phase.total ? (phase.done / phase.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-[13px] tabular-nums text-[#525252]">{progressLabel(phase.done, phase.total)}</p>
          </div>
        )}

        {phase.step === "done" && phase.failures.length > 0 && (
          <ul className="max-h-[40vh] space-y-1.5 overflow-y-auto rounded-lg bg-red-50 p-3 text-[13px] text-red-700">
            {phase.failures.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <span className="font-medium">{f.name}</span>: {f.message}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          {phase.step === "confirm" && (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={run} disabled={targets.length === 0} className="bg-[#eca826] text-white hover:bg-[#d8961f]">
                Adicionar em {groupsCountLabel(targets.length)}
              </Button>
            </>
          )}
          {phase.step === "running" && (
            <Button disabled>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Adicionando...
            </Button>
          )}
          {phase.step === "done" && <Button onClick={onClose}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

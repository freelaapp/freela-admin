"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/modules/auth/application/use-auth";
import {
  modeCards,
  modeChangeDialog,
  summarySource,
  modeCardsWithoutNumbers,
  type CardView,
} from "@/modules/admin/application/orientation-mode";
import { formatCount, orientationErrorMessage } from "@/modules/admin/application/orientation-presentation";
import {
  useOrientationSummary,
  useUpdateOrientationSettings,
} from "@/modules/admin/application/use-orientation";
import type {
  OrientationGateMode,
  OrientationSettingsView,
} from "@/modules/admin/infrastructure/orientation-api";
import { SUPER_ADMIN_ONLY_HINT } from "../../../configuracoes/_components/super-admin-hint";
import { ModeChangeDialog } from "./mode-change-dialog";

function Card({
  card,
  source,
  canChange,
  busy,
  onChoose,
}: {
  card: CardView;
  source: string;
  canChange: boolean;
  busy: boolean;
  onChoose: (mode: OrientationGateMode) => void;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border bg-white p-5 ${
        card.isCurrent ? "border-[#eca826] ring-1 ring-[#eca826]" : "border-[#e5e5e5]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#1d1d1b]">{card.title}</h3>
        {card.isCurrent && (
          <span className="rounded-full bg-[#eca826]/15 px-2 py-0.5 text-xs font-medium text-[#8a5d00]">
            Modo atual
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-[#737373]">{card.effect}</p>
      <p className="mt-4 text-3xl font-bold text-[#1d1d1b]">
        {card.seeing === null ? "—" : formatCount(card.seeing)}
      </p>
      <p className="text-xs text-[#737373]">freelancers veem vagas</p>
      <p className="mt-1 text-xs text-[#737373]">
        {card.blocked === null ? "—" : formatCount(card.blocked)} ficam sem ver vagas
      </p>
      {card.calc && (
        <details className="mt-3 text-xs text-[#737373]">
          <summary className="cursor-pointer font-medium text-[#1d1d1b]">Ver a conta</summary>
          <p className="mt-1">{card.calc}</p>
          <p className="mt-1">{source}</p>
        </details>
      )}
      {canChange && !card.isCurrent && (
        <Button className="mt-4 min-h-11" variant="outline" disabled={busy} onClick={() => onChoose(card.mode)}>
          Usar este modo
        </Button>
      )}
    </div>
  );
}

export function GateModeSection({ settings }: { settings: OrientationSettingsView }) {
  const { isSuperAdmin } = useAuth();
  const summary = useOrientationSummary();
  const update = useUpdateOrientationSettings();
  const [target, setTarget] = useState<OrientationGateMode | null>(null);

  const info = target ? modeChangeDialog(settings.gateMode, target, summary.data ?? null, new Date()) : null;

  const confirm = () => {
    if (!target) return;
    update.mutate(
      { gateMode: target },
      {
        onSuccess: () => {
          toast.success("Modo alterado. Vale em até 1 minuto.");
          setTarget(null);
        },
        onError: (err) => toast.error(orientationErrorMessage(err, "Não foi possível mudar o modo.")),
      },
    );
  };

  const toggleFixed = (enabled: boolean) =>
    update.mutate(
      { gateFixedJobs: enabled },
      {
        onSuccess: () => toast.success("Salvo. Vale em até 1 minuto."),
        onError: (err) => toast.error(orientationErrorMessage(err, "Não foi possível salvar.")),
      },
    );

  return (
    <section className="mb-6" aria-labelledby="gate-title">
      <h2 id="gate-title" className="text-base font-semibold text-[#1d1d1b]">
        Quem precisa fazer a aula para ver vagas
      </h2>
      {summary.isLoading && <Loader2 className="mt-4 h-5 w-5 animate-spin text-neutral-400" />}
      <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
        {(summary.data
          ? modeCards(summary.data, settings.gateMode)
          : modeCardsWithoutNumbers(settings.gateMode, settings.newSignupsSince)
        ).map((card) => (
          <Card
            key={card.mode}
            card={card}
            source={summary.data ? summarySource(summary.data) : ""}
            canChange={isSuperAdmin}
            busy={update.isPending}
            onChoose={setTarget}
          />
        ))}
      </div>
      {!summary.isLoading && !summary.data && (
        <p className="mt-2 text-xs text-[#737373]">
          Não consegui contar os freelancers agora. Desligar o bloqueio continua possível.{" "}
          <button type="button" className="underline" onClick={() => void summary.refetch()}>
            Tentar de novo
          </button>
        </p>
      )}
      {!isSuperAdmin && <p className="mt-2 text-xs text-[#737373]">{SUPER_ADMIN_ONLY_HINT}</p>}

      {isSuperAdmin && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[#e5e5e5] bg-white p-4">
          <div>
            <p className="text-sm font-medium text-[#1d1d1b]">Bloqueio vale também para vagas fixas (CLT)</p>
            <p className="text-xs text-[#737373]">Muda quem vê as vagas fixas no mesmo modo escolhido acima.</p>
          </div>
          <Switch
            aria-label="Bloqueio vale também para vagas fixas (CLT)"
            checked={settings.gateFixedJobs}
            disabled={update.isPending}
            onCheckedChange={toggleFixed}
          />
        </div>
      )}

      {info && (
        <ModeChangeDialog
          info={info}
          pending={update.isPending}
          onConfirm={confirm}
          onClose={() => setTarget(null)}
        />
      )}
    </section>
  );
}

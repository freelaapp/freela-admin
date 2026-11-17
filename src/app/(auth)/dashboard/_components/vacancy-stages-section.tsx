"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVacancyStages } from "@/modules/admin/application/use-admin-dashboard";
import {
  DashboardUnavailableError,
  VACANCY_STAGE_KEYS,
  type StageSummary,
  type VacancyStageKey,
  type VacancyStagesScope,
} from "@/modules/admin/infrastructure/dashboard-api";
import {
  DASH,
  STAGE_DEFINITIONS,
  STAGE_SCOPE_LABELS,
  formatInteger,
  shortDateTimeBrasilia,
} from "@/modules/admin/application/dashboard-presentation";

const SCOPES: VacancyStagesScope[] = ["today", "upcoming"];

/**
 * Bloco 3 — Status das vagas. Foto do momento com seletor próprio (Hoje · A acontecer), que não
 * segue a barra de período. Cada card abre a lista das vagas da etapa, com a definição (o que é,
 * quando entra e quando sai). S2 e S3 ficam em alerta quando há vaga começando em menos de 24 h.
 */
export function VacancyStagesSection() {
  const [scope, setScope] = useState<VacancyStagesScope>("today");
  const [open, setOpen] = useState<VacancyStageKey | null>(null);
  const { data, isLoading, isError, error, isFetching } = useVacancyStages(scope);
  const unavailable = error instanceof DashboardUnavailableError;

  return (
    <section aria-labelledby="status-vagas" className="mb-8">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="status-vagas" className="mr-2 text-base font-semibold text-[#1d1d1b]">
          Status das vagas
        </h2>
        <div className="inline-flex rounded-lg border border-[#e5e5e5] bg-white p-0.5">
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              aria-pressed={scope === s}
              className={
                scope === s
                  ? "h-8 rounded-md bg-[#1d1d1b] px-3 text-sm font-semibold text-white cursor-pointer"
                  : "h-8 rounded-md px-3 text-sm text-[#737373] hover:bg-[#f7f7f7] cursor-pointer"
              }
            >
              {STAGE_SCOPE_LABELS[s].label}
            </button>
          ))}
        </div>
        {isFetching && !isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-[#a3a3a3]" aria-label="Atualizando" />
        )}
      </div>
      <p className="mb-3 text-xs text-[#737373]">
        Foto de agora, {STAGE_SCOPE_LABELS[scope].description}. Não muda com o período. Toque num
        card para ver as vagas.
      </p>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
        </div>
      ) : unavailable ? (
        <p className="rounded-lg bg-[#f7f7f7] p-3 text-sm text-[#737373]">
          Os status das vagas ainda não estão disponíveis nesta versão da API.
        </p>
      ) : isError || !data ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Não foi possível carregar os status das vagas. A tela tenta de novo sozinha.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {VACANCY_STAGE_KEYS.map((key) => (
            <StageButton key={key} stage={key} summary={data.stages[key]} onOpen={() => setOpen(key)} />
          ))}
        </div>
      )}

      {open && data && (
        <StageDialog
          stage={open}
          summary={data.stages[open]}
          scope={scope}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}

function StageButton({
  stage,
  summary,
  onOpen,
}: {
  stage: VacancyStageKey;
  summary: StageSummary | undefined;
  onOpen: () => void;
}) {
  const def = STAGE_DEFINITIONS[stage];
  const alerts = summary?.alerts ?? 0;
  const alerting = (stage === "S2" || stage === "S3") && alerts > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!summary}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border bg-white p-3 text-left shadow-sm transition-colors xl:flex-col xl:items-start",
        alerting ? "border-red-300 bg-red-50" : "border-[#e5e5e5] hover:bg-[#f7f7f7]",
        summary ? "cursor-pointer" : "cursor-default opacity-70",
      )}
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold text-[#a3a3a3]">{stage}</span>
        <span className="block text-xs font-medium text-[#525252]">{def.title}</span>
        {alerting && (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-red-700">
            <AlertTriangle className="h-3 w-3" />
            {formatInteger(alerts)} começa{alerts === 1 ? "" : "m"} em menos de 24 h
          </span>
        )}
      </span>
      <span
        className="shrink-0 text-2xl font-bold text-[#1d1d1b]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {summary ? formatInteger(summary.count) : DASH}
      </span>
    </button>
  );
}

function StageDialog({
  stage,
  summary,
  scope,
  onClose,
}: {
  stage: VacancyStageKey;
  summary: StageSummary | undefined;
  scope: VacancyStagesScope;
  onClose: () => void;
}) {
  const def = STAGE_DEFINITIONS[stage];
  const vacancies = summary?.vacancies ?? [];
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} className="max-w-2xl">
      <DialogContent>
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>
            {stage} · {def.title} ({summary ? formatInteger(summary.count) : DASH})
          </DialogTitle>
          <DialogDescription>
            {STAGE_SCOPE_LABELS[scope].label}: {STAGE_SCOPE_LABELS[scope].description}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          <div className="rounded-lg bg-[#f7f7f7] p-3 text-xs text-[#525252]">
            <p>
              <strong>Entra quando:</strong> {def.enters}
            </p>
            <p className="mt-1">
              <strong>Sai quando:</strong> {def.leaves}
            </p>
            <p className="mt-1">
              <strong>Fonte:</strong> vagas de Empresa e Casa, situação da vaga, das candidaturas e
              do serviço agora; vagas de QA (cargo Teste) e contas internas ficam fora.
            </p>
          </div>
          {vacancies.length === 0 ? (
            <p className="text-sm text-[#737373]">Nenhuma vaga nesta etapa agora.</p>
          ) : (
            <ul className="divide-y divide-[#f0f0f0]">
              {vacancies.map((v) => (
                <li key={v.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1d1d1b] break-words">
                      {v.title || v.serviceType}
                      {v.alert && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                          menos de 24 h
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[#737373] break-words">
                      {v.contractorName ?? "Contratante sem nome"}
                      {v.city ? ` · ${v.city}` : ""} · {v.module === "HOME_SERVICES" ? "Casa" : "Empresa"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-[#525252]">
                      {shortDateTimeBrasilia(v.startTime)} – {shortDateTimeBrasilia(v.endTime)}
                    </span>
                    {v.module !== "HOME_SERVICES" && (
                      <Link
                        href={`/jobs?vaga=${encodeURIComponent(v.id)}`}
                        className="text-xs font-medium text-[#1d1d1b] underline hover:text-[#eca826]"
                      >
                        Abrir
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {summary?.truncated && (
            <p className="text-xs text-[#737373]">
              Mostrando as {formatInteger(vacancies.length)} primeiras pelo horário de início, de{" "}
              {formatInteger(summary.count)}.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

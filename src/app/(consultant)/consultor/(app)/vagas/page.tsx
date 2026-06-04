"use client";

import { useMemo, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  Loader2,
  Phone,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { formatVacancyDate, formatVacancyTime } from "@/lib/date.utils";
import {
  useConsultantVacancies,
  useConsultantVacancyCandidacies,
} from "@/modules/consultant/application/use-consultant-vacancies";
import type { ConsultantVacancy } from "@/modules/consultant/domain/types";

const MODULE_LABEL: Record<ConsultantVacancy["module"], string> = {
  "bars-restaurants": "Bares & Restaurantes",
  "home-services": "Freela em Casa",
};

/** Status do job (vaga fechada, BR) → rótulo + variante do badge. */
const JOB_STATUS: Record<string, { label: string; variant: "default" | "success" | "warning" | "secondary" | "destructive" }> = {
  SCHEDULED: { label: "Agendado", variant: "warning" },
  IN_PROGRESS: { label: "Em andamento", variant: "default" },
  COMPLETED: { label: "Concluído", variant: "success" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
  CANCELED: { label: "Cancelado", variant: "destructive" },
};

/** Status de candidatura → rótulo + variante. */
const CANDIDACY_STATUS: Record<string, { label: string; variant: "default" | "success" | "warning" | "secondary" | "destructive" }> = {
  PENDING: { label: "Aguardando", variant: "warning" },
  ACCEPTED: { label: "Aceita", variant: "success" },
  REJECTED: { label: "Recusada", variant: "secondary" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
  CANCELED: { label: "Cancelada", variant: "destructive" },
};

function formatBRL(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default function ConsultorVagasPage() {
  const { data: vacancies, isLoading, isError } = useConsultantVacancies();
  const [tab, setTab] = useState("open");
  const [candidaciesVacancy, setCandidaciesVacancy] = useState<ConsultantVacancy | null>(null);

  const { open, closed, totalCandidacies } = useMemo(() => {
    const all = vacancies ?? [];
    const isOpen = (v: ConsultantVacancy) => v.status.toUpperCase() === "OPEN";
    const open = all.filter(isOpen);
    const closed = all.filter((v) => !isOpen(v));
    const totalCandidacies = open.reduce((sum, v) => sum + (v.candidacyCount ?? 0), 0);
    return { open, closed, totalCandidacies };
  }, [vacancies]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <p className="text-red-500">Erro ao carregar as vagas dos seus clientes.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Vagas dos meus clientes"
        description="Acompanhe as vagas abertas, candidaturas e contratações dos contratantes que você cadastrou"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard title="Vagas em aberto" value={String(open.length)} icon={Briefcase} />
        <KpiCard
          title="Candidaturas"
          value={String(totalCandidacies)}
          icon={Users}
          iconColor="text-blue-500"
        />
        <KpiCard
          title="Contratadas"
          value={String(closed.length)}
          icon={CheckCircle2}
          iconColor="text-green-600"
        />
        <KpiCard
          title="Total de vagas"
          value={String((vacancies ?? []).length)}
          icon={Briefcase}
          iconColor="text-[#737373]"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="open">Em aberto ({open.length})</TabsTrigger>
          <TabsTrigger value="closed">Contratadas ({closed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          {open.length === 0 ? (
            <EmptyState message="Nenhuma vaga em aberto no momento." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {open.map((v) => (
                <VacancyCard
                  key={`${v.module}-${v.id}`}
                  vacancy={v}
                  onViewCandidacies={
                    v.module === "bars-restaurants"
                      ? () => setCandidaciesVacancy(v)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="closed">
          {closed.length === 0 ? (
            <EmptyState message="Nenhuma vaga contratada ainda." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {closed.map((v) => (
                <VacancyCard key={`${v.module}-${v.id}`} vacancy={v} closed />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CandidaciesDialog
        vacancy={candidaciesVacancy}
        onClose={() => setCandidaciesVacancy(null)}
      />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white border border-[#e5e5e5] rounded-xl p-10 flex flex-col items-center justify-center text-center mt-2">
      <div className="w-12 h-12 rounded-full bg-[#eca826]/10 flex items-center justify-center mb-3">
        <Briefcase className="w-6 h-6 text-[#eca826]" />
      </div>
      <p className="text-sm text-[#737373]">{message}</p>
    </div>
  );
}

function VacancyCard({
  vacancy: v,
  closed,
  onViewCandidacies,
}: {
  vacancy: ConsultantVacancy;
  closed?: boolean;
  onViewCandidacies?: () => void;
}) {
  const contractor = v.contractorCompanyName || v.contractorName || "Contratante";
  const job = v.job;

  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-[#1d1d1b] truncate">{v.title || v.serviceType}</p>
          <p className="text-xs text-[#737373] truncate">{contractor}</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px]">
          {MODULE_LABEL[v.module]}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#737373]">
        <span>{formatVacancyDate(v.date)}</span>
        {v.startTime && <span>{formatVacancyTime(v.startTime)}</span>}
        <span className="font-medium text-[#1d1d1b]">{formatBRL(v.payment)}</span>
      </div>

      {!closed ? (
        <div className="flex items-center justify-between mt-1">
          <span className="inline-flex items-center gap-1 text-xs text-[#737373]">
            <Users className="w-3.5 h-3.5" />
            {v.candidacyCount ?? 0} candidatura{(v.candidacyCount ?? 0) === 1 ? "" : "s"}
          </span>
          {onViewCandidacies && (v.candidacyCount ?? 0) > 0 && (
            <Button
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={onViewCandidacies}
            >
              Ver candidatos
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between mt-1 border-t border-[#f0f0f0] pt-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-[#a3a3a3]">Contratado</p>
            <p className="text-xs font-medium text-[#1d1d1b] truncate">
              {v.providerName ?? "—"}
            </p>
          </div>
          {job ? (
            <Badge variant={JOB_STATUS[job.status.toUpperCase()]?.variant ?? "secondary"}>
              {JOB_STATUS[job.status.toUpperCase()]?.label ?? job.status}
            </Badge>
          ) : (
            <Badge variant="secondary">Preenchida</Badge>
          )}
        </div>
      )}
    </Card>
  );
}

function CandidaciesDialog({
  vacancy,
  onClose,
}: {
  vacancy: ConsultantVacancy | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useConsultantVacancyCandidacies(vacancy?.id ?? null);

  return (
    <Dialog open={!!vacancy} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>Candidatos — {vacancy?.title || vacancy?.serviceType}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
          </div>
        ) : isError ? (
          <p className="text-sm text-red-500 py-4">Erro ao carregar candidaturas.</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-[#737373] py-4">Nenhuma candidatura nesta vaga.</p>
        ) : (
          <ul className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
            {data.map((c) => {
              const st = CANDIDACY_STATUS[c.status.toUpperCase()];
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#e5e5e5] p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1d1d1b] truncate">
                      {c.providerName ?? "Freelancer"}
                    </p>
                    {c.providerPhone && (
                      <p className="inline-flex items-center gap-1 text-xs text-[#737373]">
                        <Phone className="w-3 h-3" />
                        {c.providerPhone}
                      </p>
                    )}
                  </div>
                  <Badge variant={st?.variant ?? "secondary"}>{st?.label ?? c.status}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

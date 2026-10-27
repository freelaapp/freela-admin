"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Phone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrestartCheckStatus } from "@/components/admin/vacancy/prestart-check-status";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import { useConfirmPrestartByPhone } from "@/modules/admin/application/use-vacancy-candidacies";
import { getAdminPrestartChecks } from "@/modules/admin/infrastructure/admin-api";
import { formatVacancyTime } from "@/lib/date.utils";

/** Hoje em Brasília, no formato do `<input type="date">`. */
function todayInBrasilia(): string {
  return new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Confirmação do dia (AD-1): 3 h antes de cada vaga o freelancer recebe "Você vai
 * mesmo?". Aqui o suporte vê quem ainda não respondeu, liga e marca "Confirmar
 * por telefone". A empresa decide manter ou liberar a vaga pela tela dela.
 */
export default function ConfirmacaoDoDiaPage() {
  const { isChecking, allowed } = useAreaGuard("JOBS");
  const [day, setDay] = useState(todayInBrasilia);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const checks = useQuery({
    queryKey: ["admin", "prestart-checks", day, filter],
    queryFn: () => getAdminPrestartChecks({ day, filter }),
    enabled: allowed,
    refetchInterval: 60_000,
  });
  const confirm = useConfirmPrestartByPhone(null);

  async function handleConfirm(candidacyId: string, nome: string) {
    if (!window.confirm(`Você ligou para ${nome} e ele(a) disse que vai?`)) return;
    try {
      const res = await confirm.mutateAsync(candidacyId);
      if (res.status === "already_confirmed") {
        toast.info(`${nome} já tinha confirmado.`);
        return;
      }
      toast.success(
        res.late
          ? `${nome} confirmado(a). A empresa foi avisada de que vai.`
          : `${nome} confirmado(a) pelo painel.`,
      );
    } catch (err) {
      toast.error(getAxiosErrorMessage(err, "Não foi possível confirmar."));
    }
  }

  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }

  const items = checks.data ?? [];

  return (
    <div>
      <PageHeader
        title="Confirmação do dia"
        description="3 h antes da vaga o freelancer recebe “Você vai mesmo?”. Ligue para quem não respondeu e marque “Confirmar por telefone”."
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => checks.refetch()}
            disabled={checks.isFetching}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${checks.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={day}
          onChange={(e) => e.target.value && setDay(e.target.value)}
          className="w-auto"
          aria-label="Dia das vagas"
        />
        <div className="inline-flex rounded-md border border-[#e5e5e5] bg-white p-0.5">
          {(
            [
              ["pending", "Sem resposta"],
              ["all", "Todas"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                filter === value ? "bg-[#1d1d1b] text-white" : "text-[#737373] hover:text-[#1d1d1b]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {!checks.isLoading && (
          <span className="text-xs text-[#737373]">
            {items.length} {items.length === 1 ? "freelancer" : "freelancers"}
          </span>
        )}
      </div>

      {checks.isLoading && (
        <div className="flex items-center gap-2 text-sm text-[#737373]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando…
        </div>
      )}
      {checks.isError && (
        <p className="text-sm text-red-600">
          {getAxiosErrorMessage(checks.error, "Não foi possível carregar a confirmação do dia.")}
        </p>
      )}
      {!checks.isLoading && !checks.isError && items.length === 0 && (
        <p className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">
          {filter === "pending"
            ? "Ninguém sem resposta neste dia."
            : "Nenhuma pergunta feita neste dia."}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-lg border border-[#e5e5e5] bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1d1d1b]">
                  {item.providerName ?? "Sem nome"}
                </p>
                <p className="truncate text-xs text-[#737373]">
                  {item.vacancyTitle}
                  {item.companyName ? ` · ${item.companyName}` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded bg-[#f7f7f7] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#1d1d1b]">
                {formatVacancyTime(item.startTime)}
              </span>
            </div>
            {item.providerPhone && (
              <a
                href={`tel:${item.providerPhone}`}
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-[#1d1d1b] hover:text-[#eca826]"
              >
                <Phone className="h-3 w-3 text-[#737373]" />
                {item.providerPhone}
              </a>
            )}
            <PrestartCheckStatus
              check={item}
              confirming={confirm.isPending}
              onConfirm={() => handleConfirm(item.candidacyId, item.providerName ?? "O freelancer")}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

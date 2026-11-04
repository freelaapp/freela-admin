"use client";

import { useEffect, useState } from "react";
import { Loader2, MoonStar, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { useAuth } from "@/modules/auth/application/use-auth";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import {
  useAssumeSupportCase,
  useSupportCases,
} from "@/modules/admin/application/use-support-cases";
import { isSupportQueueDisabled } from "@/modules/admin/application/support-queue-presentation";
import type {
  SupportCaseFilter,
  SupportCaseItem,
} from "@/modules/admin/infrastructure/support-cases-api";
import {
  SupportCaseCard,
  type SupportCaseDialog,
} from "./_components/support-case-card";
import { CaseMessagesDialog } from "./_components/case-messages-dialog";
import { RecordContactDialog } from "./_components/record-contact-dialog";
import { CloseCaseDialog } from "./_components/close-case-dialog";
import { CaseToolsDialog } from "./_components/case-tools-dialog";

const EMPTY: Record<SupportCaseFilter, string> = {
  open: "Nenhum caso aberto. O sistema está dando conta sozinho.",
  mine: "Nenhum caso com você.",
  closed_today: "Nenhum caso fechado hoje.",
};

/** O relógio da notícia anda sozinho entre as atualizações da lista. */
function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Fila do suporte (fluxo de vagas v2, fatia C2; designer, lote 2 §5.3): as vagas que o sistema
 * não resolveu sozinho, a de início mais próximo em cima. Atualiza a cada 60 s, como a
 * Confirmação do dia. Com a chave da API desligada (404 `FEATURE_DISABLED`), avisa que a fila
 * ainda não está ligada, sem tela de erro.
 */
export default function FilaDoSuportePage() {
  const { isChecking, allowed } = useAreaGuard("JOBS");
  const { user } = useAuth();
  const [filter, setFilter] = useState<SupportCaseFilter>("open");
  const [dialog, setDialog] = useState<{
    kind: SupportCaseDialog;
    item: SupportCaseItem;
  } | null>(null);
  const cases = useSupportCases(filter, allowed);
  const assume = useAssumeSupportCase();
  const now = useNow(30_000);

  async function handleAssume(item: SupportCaseItem) {
    try {
      await assume.mutateAsync(item.id);
      toast.success("Caso assumido. Mande a mensagem A para a empresa.");
    } catch (err) {
      toast.error(
        apiErrorOf(err).message ?? "Não foi possível assumir o caso.",
      );
    }
  }

  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }

  const firstNewsMinutes = cases.data?.firstNewsMinutes ?? 30;
  const header = (
    <PageHeader
      title="Fila do suporte"
      description={`Vagas que o sistema não resolveu sozinho. A de início mais próximo fica em cima. A empresa nunca fica mais de ${firstNewsMinutes} min sem notícia.`}
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => cases.refetch()}
          disabled={cases.isFetching}
        >
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${cases.isFetching ? "animate-spin" : ""}`}
          />
          Atualizar
        </Button>
      }
    />
  );

  if (cases.isError && isSupportQueueDisabled(cases.error)) {
    return (
      <div>
        {header}
        <p className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">
          A fila do suporte ainda não está ligada.
        </p>
      </div>
    );
  }

  const data = cases.data;
  const counts = data?.counts;
  const tabs: Array<[SupportCaseFilter, string]> = [
    ["open", `Abertos${counts ? ` ${counts.open}` : ""}`],
    ["mine", `Comigo${counts ? ` ${counts.mine}` : ""}`],
    ["closed_today", `Fechados hoje${counts ? ` ${counts.closedToday}` : ""}`],
  ];
  const items = data?.items ?? [];

  return (
    <div>
      {header}

      <div
        className="mb-4 inline-flex rounded-md border border-[#e5e5e5] bg-white p-0.5"
        role="tablist"
      >
        {tabs.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
              filter === value
                ? "bg-[#1d1d1b] text-white"
                : "text-[#737373] hover:text-[#1d1d1b]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {data && !data.supportHours.open && (
        <p
          role="status"
          className="mb-4 flex items-start gap-2 rounded-lg border border-[#e5e5e5] bg-[#f7f7f7] p-3 text-sm text-[#1d1d1b]"
        >
          <MoonStar
            className="mt-0.5 h-4 w-4 shrink-0 text-[#737373]"
            aria-hidden="true"
          />
          <span>
            Fora do horário do suporte ({data.supportHours.label}). Os casos
            novos esperam a abertura
            {data.supportHours.nextOpeningLabel
              ? `: ${data.supportHours.nextOpeningLabel}`
              : ""}
            .
          </span>
        </p>
      )}

      {cases.isLoading && (
        <div
          className="grid gap-3"
          aria-label="Carregando a fila"
          aria-busy="true"
        >
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              className="h-28 w-full"
              data-testid="support-case-skeleton"
            />
          ))}
        </div>
      )}

      {cases.isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <p>
            Não foi possível carregar a fila. Confira a conexão e toque em
            Tentar de novo.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => cases.refetch()}
          >
            Tentar de novo
          </Button>
        </div>
      )}

      {data && items.length === 0 && (
        <p className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">
          {EMPTY[filter]}
        </p>
      )}

      {data && items.length > 0 && (
        <div className="grid gap-3">
          {items.map((item) => (
            <SupportCaseCard
              key={item.id}
              item={item}
              now={now}
              cutoffLabel={data.cutoffLabel}
              myAdminId={user?.id ?? null}
              assuming={assume.isPending && assume.variables === item.id}
              onAssume={() => handleAssume(item)}
              onOpenDialog={(kind) => setDialog({ kind, item })}
            />
          ))}
        </div>
      )}

      {dialog?.kind === "messages" && (
        <CaseMessagesDialog
          caseId={dialog.item.id}
          myName={user?.name ?? null}
          firstNewsMinutes={data?.firstNewsMinutes ?? 30}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "contact" && (
        <RecordContactDialog
          caseId={dialog.item.id}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "close" && (
        <CloseCaseDialog
          caseId={dialog.item.id}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "tools" && (
        <CaseToolsDialog
          // Depois de cada atualização da lista (60 s), o diálogo mostra o caso atual; o
          // retrato do clique só vale se o caso saiu da aba (ex.: fechado por outra pessoa).
          item={items.find((i) => i.id === dialog.item.id) ?? dialog.item}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

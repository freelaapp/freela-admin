"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import { useAreaGuard } from "@/modules/auth/application/use-area-guard";
import { useOccurrence } from "@/modules/admin/application/use-occurrences";
import {
  DETAIL_ERROR_TEXT,
  DISABLED_TEXT,
  NOT_FOUND_TEXT,
  appliedLabel,
  contestLabel,
  decisionLine,
  firstName,
  historyLine,
  isOccurrencesDisabled,
  placeLine,
  pointsLine,
  revokedLine,
  systemRecordedText,
  vacancyLine,
} from "@/modules/admin/application/occurrences-presentation";
import { dayLabel } from "@/modules/admin/application/suspensions-presentation";
import type { OccurrenceDecisionRecord } from "@/modules/admin/infrastructure/occurrences-api";
import { DecideForm } from "./_components/decide-form";
import { RevokeDecisionDialog } from "./_components/revoke-dialog";

const BLOCK = "rounded-lg border border-[#e5e5e5] p-4";
const BLOCK_TITLE = "mb-2 text-sm font-semibold text-[#1d1d1b]";
const TEXT = "text-sm text-[#1d1d1b]";
const MUTED = "text-xs text-[#737373]";

/**
 * O caso (D5 §C.2): o que o sistema registrou e aplicou, a contestação, a vaga, o histórico, as
 * decisões (com "Desfazer") e o formulário "Decidir o caso". Usa o primeiro nome da pessoa.
 */
export default function OcorrenciaPage() {
  const { isChecking, allowed } = useAreaGuard("FREELANCERS");
  const params = useParams<{ id: string }>();
  const id = params?.id ?? null;
  const detail = useOccurrence(id, allowed);
  const [revoking, setRevoking] = useState<OccurrenceDecisionRecord | null>(null);
  // O formulário fica montado depois de aparecer: a decisão recarrega o caso (já decidido,
  // `canDecide: false`), e a mensagem de sucesso, o erro 409 e o texto escrito moram nele. Só sai
  // quando o admin pede "Ver o caso de novo".
  const [formLatched, setFormLatched] = useState(false);
  const canDecideNow = detail.data?.options.canDecide === true;
  useEffect(() => {
    if (canDecideNow) setFormLatched(true);
  }, [canDecideNow]);
  const reloadCase = () => {
    setFormLatched(false);
    void detail.refetch();
  };

  if (isChecking || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#eca826]" />
      </div>
    );
  }

  const back = (
    <Link href="/ocorrencias" className="mb-3 inline-flex items-center gap-1 text-sm text-[#737373] underline">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Voltar à fila
    </Link>
  );

  if (detail.isLoading) {
    return (
      <div>
        {back}
        <div className="space-y-2" aria-label="Carregando o caso">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (detail.isError || !detail.data) {
    const e = apiErrorOf(detail.error);
    const text = isOccurrencesDisabled(detail.error)
      ? DISABLED_TEXT
      : e.code === "OCCURRENCE_NOT_FOUND"
        ? NOT_FOUND_TEXT
        : DETAIL_ERROR_TEXT;
    return (
      <div>
        {back}
        <div className="rounded-lg bg-[#f7f7f7] p-4 text-sm text-[#737373]">
          <p>{text}</p>
          {text === DETAIL_ERROR_TEXT && (
            <Button className="mt-3" size="sm" variant="outline" onClick={() => detail.refetch()}>
              Tentar de novo
            </Button>
          )}
        </div>
      </div>
    );
  }

  const data = detail.data;
  const { item } = data;
  const n = firstName(item);
  const active = data.decisions.find((d) => d.revokedAt === null) ?? null;

  return (
    <div className="space-y-4">
      {back}
      <PageHeader
        title={item.person.name ?? item.person.email ?? "Ocorrência"}
        description={`Falta sem aviso registrada em ${dayLabel(item.createdAt)}. ${[item.person.phone, item.person.email].filter(Boolean).join(" · ")}`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={BLOCK} aria-label="O que o sistema registrou">
          <h2 className={BLOCK_TITLE}>O que o sistema registrou</h2>
          <p className={TEXT}>{systemRecordedText(item)}</p>
          <p className={`${MUTED} mt-1`}>{pointsLine(item)}</p>
        </section>

        <section className={BLOCK} aria-label="O que já foi aplicado">
          <h2 className={BLOCK_TITLE}>O que já foi aplicado</h2>
          <p className={TEXT}>{appliedLabel(item)}</p>
          {item.decision?.suspensionEndsAt && (
            <p className={`${MUTED} mt-1`}>
              Suspensão da decisão: até {dayLabel(item.decision.suspensionEndsAt)}
              {item.decision.suspensionLiftedAt ? " (levantada)" : ""}.
            </p>
          )}
        </section>

        <section className={BLOCK} aria-label="Contestação">
          <h2 className={BLOCK_TITLE}>Contestação</h2>
          <p className={TEXT}>{contestLabel(item)}</p>
          {item.contest.justification && (
            <p className={`${MUTED} mt-1`}>
              {n} escreveu: “{item.contest.justification}”
            </p>
          )}
          {item.resolution?.note && (
            <p className={`${MUTED} mt-1`}>
              {item.resolution.byName ?? "Suporte"}: “{item.resolution.note}”
            </p>
          )}
        </section>

        <section className={BLOCK} aria-label="A vaga">
          <h2 className={BLOCK_TITLE}>A vaga</h2>
          <p className={TEXT}>{vacancyLine(item)}</p>
          {placeLine(item) && <p className={MUTED}>{placeLine(item)}</p>}
          {item.vacancy.id && (
            <a
              href={`/jobs?vaga=${item.vacancy.id}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[#b9770e] underline"
            >
              Abrir a vaga em outra aba
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
        </section>
      </div>

      <section className={BLOCK} aria-label="Histórico">
        <h2 className={BLOCK_TITLE}>Histórico</h2>
        <p className={TEXT}>{historyLine(data.history)}</p>
      </section>

      {data.decisions.length > 0 && (
        <section className={BLOCK} aria-label="Decisões">
          <h2 className={BLOCK_TITLE}>Decisões</h2>
          <ul className="space-y-3">
            {data.decisions.map((d) => (
              <li key={d.id} className="text-sm">
                <p className={d.revokedAt ? "text-[#737373] line-through" : "text-[#1d1d1b]"}>
                  {decisionLine(d)}
                </p>
                <p className={MUTED}>“{d.whatHappened}”</p>
                {revokedLine(d) && <p className={MUTED}>{revokedLine(d)}</p>}
                {d.id === active?.id && d.decision !== "ANNUL" && (
                  <Button className="mt-1" size="sm" variant="outline" onClick={() => setRevoking(d)}>
                    Desfazer a decisão
                  </Button>
                )}
                {d.id === active?.id && d.decision === "ANNUL" && (
                  <p className={MUTED}>Falta anulada não tem volta.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(data.options.canDecide || formLatched) && (
        <DecideForm key={item.infractionId} detail={data} onReload={reloadCase} />
      )}

      {revoking && <RevokeDecisionDialog decision={revoking} item={item} onClose={() => setRevoking(null)} />}
    </div>
  );
}

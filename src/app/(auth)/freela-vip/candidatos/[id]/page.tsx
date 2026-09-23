"use client";

import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useVipApplication, useVipApplicationMutations, useVipCycle, useVipRole } from "@/modules/admin/application/use-freela-vip";
import { alertLabel, breakdownRows, formatDate, scoreBand, scoreBandClass, VIP_CRITERIA_LABELS, VIP_STATUS_LABELS } from "@/modules/admin/application/freela-vip-presentation";
import { VipGuard } from "../../_components/vip-guard";
import { ApplicationActions } from "../../_components/application-actions";
import { BackgroundSection } from "../../_components/background-section";
import { QueryError } from "../../_components/query-error";

export default function VipApplicationPage() {
  return (
    <VipGuard>
      <ApplicationScreen />
    </VipGuard>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <h2 className="mb-2 text-[14px] font-semibold text-[#0F172A]">{title}</h2>
      {children}
    </section>
  );
}

function ApplicationScreen() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const role = useVipRole();
  const { data: d, isLoading, isError, refetch } = useVipApplication(id);
  const { data: cycle } = useVipCycle(d?.cycleId ?? "");
  const m = useVipApplicationMutations(id, d?.cycleId);

  if (isLoading) return <div className="flex justify-center py-12 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>;

  if (isError || !d) {
    return (
      <div className="flex flex-col gap-4 px-4 pb-8 sm:px-6">
        <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="mr-1 h-4 w-4" aria-hidden />Voltar</Button>
        <QueryError message="Não foi possível carregar a ficha." onRetry={() => refetch()} />
      </div>
    );
  }

  const band = scoreBand(d.score.totalScore);
  const rows = breakdownRows(d.score.breakdown);
  const name = d.formBasics?.fullName ?? "Candidato";

  return (
    <div className="flex flex-col gap-4 px-4 pb-8 sm:px-6">
      <PageHeader
        title={name}
        description={`${VIP_STATUS_LABELS[d.status]} · ${d.formBasics?.city ?? "—"} · ${d.formBasics?.mainRole ?? "—"} · origem ${d.source === "LINK" ? "link" : "base"}${d.origin ? ` (${d.origin})` : ""}${d.cpf ? ` · CPF ${d.cpf}` : ""}`}
        action={<Button variant="outline" onClick={() => router.push(`/freela-vip/${d.cycleId}`)}><ArrowLeft className="mr-1 h-4 w-4" aria-hidden />Funil</Button>}
      />

      {role.canAdmin && <ApplicationActions detail={d} cycleHasJustification={!!cycle?.backgroundJustification} />}
      {role.readOnly && <p className="text-[12.5px] text-[#64748B]">Somente leitura: dados pessoais redigidos e sem ações.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Nota">
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-[14px] font-semibold ${scoreBandClass(band)}`}>{d.score.totalScore === null ? "sem nota" : Math.round(d.score.totalScore)}</span>
            <span className="text-[12.5px] text-[#64748B]">currículo {d.score.curriculumScore ?? "—"} · app {d.score.appScore ?? "—"}</span>
          </div>
          {rows.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {rows.map((r) => (
                <li key={r.key} className="text-[12.5px]">
                  <div className="flex justify-between"><span>{VIP_CRITERIA_LABELS[r.key] ?? r.key}</span><span className="tabular-nums">{r.value}{r.max !== null ? ` / ${r.max}` : ""}</span></div>
                  {r.max !== null && r.max > 0 && <div className="h-1.5 rounded bg-[#F1F5F9]"><div className="h-1.5 rounded bg-[#334155]" style={{ width: `${Math.min(100, (r.value / r.max) * 100)}%` }} /></div>}
                </li>
              ))}
            </ul>
          )}
          {d.alerts.length > 0 && (
            <ul className="mt-3 space-y-1">
              {d.alerts.map((a, i) => <li key={i} className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#DC2626]"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />{alertLabel(a)}</li>)}
            </ul>
          )}
        </Section>

        <Section title="Formulário">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
            <dt className="text-[#64748B]">Nascimento</dt><dd>{d.formBasics?.birthdate ? formatDate(d.formBasics.birthdate) : "—"}</dd>
            <dt className="text-[#64748B]">Bairro</dt><dd>{d.formBasics?.neighborhood ?? "—"}</dd>
            <dt className="text-[#64748B]">Funções secundárias</dt><dd>{d.formBasics?.secondaryRoles?.join(", ") || "—"}</dd>
            <dt className="text-[#64748B]">Consentimentos</dt><dd>dados {d.consentDataUse ? `${formatDate(d.consentDataUse.acceptedAt)} v${d.consentDataUse.version}` : "—"} · referências {d.consentReferences ? `${formatDate(d.consentReferences.acceptedAt)} v${d.consentReferences.version}` : "—"}</dd>
          </dl>
          {d.formAvailability && (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-[#F8FAFC] p-2 text-[11px] text-[#475569]">{JSON.stringify(d.formAvailability, null, 1)}</pre>
          )}
        </Section>

        <Section title="Experiências">
          {d.experiences.length === 0 && <p className="text-[12.5px] text-[#94A3B8]">—</p>}
          <ul className="divide-y divide-[#F1F5F9]">
            {d.experiences.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px]">
                <span><strong>{e.company}</strong> · {e.role} · {e.type} · {e.startMonth ?? "?"} – {e.isCurrent ? "atual" : e.endMonth ?? "?"}{e.highVolume ? " · alto movimento" : ""} <Badge variant="secondary">{e.confirmed === "YES" ? "confirmada" : e.confirmed === "NO" ? "não confirmada" : "pendente"}</Badge></span>
                {role.canAdmin && (
                  <span className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={m.confirmExperience.isPending} onClick={() => m.confirmExperience.mutate({ expId: e.id, confirmed: "YES" })}>Sim</Button>
                    <Button size="sm" variant="outline" disabled={m.confirmExperience.isPending} onClick={() => m.confirmExperience.mutate({ expId: e.id, confirmed: "NO" })}>Não</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Referências">
          {d.references.length === 0 && <p className="text-[12.5px] text-[#94A3B8]">—</p>}
          <ul className="divide-y divide-[#F1F5F9]">
            {d.references.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px]">
                <span>{r.name ?? "—"} · {r.company ?? "—"} · {r.phone ?? "—"} <Badge variant="secondary">{r.result === "CONFIRMED" ? "confirmada" : r.result === "NOT_CONFIRMED" ? "não confirmada" : r.result === "NO_CONTACT" ? "sem contato" : "pendente"}</Badge></span>
                {role.canAdmin && (
                  <span className="flex gap-1">
                    {(["CONFIRMED", "NOT_CONFIRMED", "NO_CONTACT"] as const).map((v) => (
                      <Button key={v} size="sm" variant="outline" disabled={m.confirmReference.isPending} onClick={() => m.confirmReference.mutate({ refId: r.id, result: v })}>
                        {v === "CONFIRMED" ? "Confirmar" : v === "NOT_CONFIRMED" ? "Negar" : "Sem contato"}
                      </Button>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Respostas">
          {d.answers.length === 0 ? <p className="text-[12.5px] text-[#94A3B8]">—</p> : (
            <ul className="text-[12.5px]">{d.answers.map((a) => <li key={a.questionId}>Pergunta {a.questionId.slice(0, 8)} · opção {a.selectedOptionIndex + 1} · {a.pointsAwarded} pts</li>)}</ul>
          )}
        </Section>

        <Section title="Documentos">
          {d.documents.length === 0 ? <p className="text-[12.5px] text-[#94A3B8]">—</p> : (
            <ul className="text-[12.5px]">{d.documents.map((doc) => <li key={doc.id}>{doc.type} · {doc.fileName} · {formatDate(doc.uploadedAt)}</li>)}</ul>
          )}
          {d.decision && (
            <p className="mt-2 text-[12.5px] text-[#64748B]">Decisão: {d.decision.rejectionReason ? `reprovado — ${d.decision.rejectionReason}` : d.decision.approvedByAdminId ? `aprovado por ${d.decision.approvedByAdminId}` : "—"}</p>
          )}
        </Section>
      </div>

      {role.canBackground && (
        <BackgroundSection applicationId={d.id} cycleId={d.cycleId} status={d.status} backgroundResult={d.decision?.backgroundResult ?? null} />
      )}

      <Section title="Histórico">
        {d.history.length === 0 ? <p className="text-[12.5px] text-[#94A3B8]">—</p> : (
          <ul className="divide-y divide-[#F1F5F9] text-[12.5px]">
            {d.history.map((h) => (
              <li key={h.id} className="py-1.5">
                <span className="text-[#64748B]">{new Date(h.createdAt).toLocaleString("pt-BR")}</span> · {h.action}
                {h.statusBefore || h.statusAfter ? ` · ${h.statusBefore ? VIP_STATUS_LABELS[h.statusBefore] : "—"} → ${h.statusAfter ? VIP_STATUS_LABELS[h.statusAfter] : "—"}` : ""}
                {h.actorAdminId ? ` · admin ${h.actorAdminId.slice(0, 8)}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

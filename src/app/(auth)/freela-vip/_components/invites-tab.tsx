"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useResendVipInvites, useVipKanban } from "@/modules/admin/application/use-freela-vip";
import { vipInviteSituation, type VipInviteSituation } from "@/modules/admin/application/freela-vip-flow";
import type { VipKanbanCard, VipResendResult } from "@/modules/admin/infrastructure/freela-vip-api";
import { QueryError } from "./query-error";

const TONE_VARIANT: Record<VipInviteSituation["tone"], "muted" | "success" | "warning"> = {
  muted: "muted",
  ok: "success",
  warn: "warning",
};

const SKIP_REASON: Record<VipResendResult["skipped"][number]["reason"], string> = {
  NOT_FOUND: "não encontrado neste ciclo",
  NOT_RESENDABLE: "já passou do formulário ou entrou pelo link",
  RECENTLY_SENT: "recebeu convite há menos de 12 h",
};

const WHATSAPP_LABEL: Record<VipResendResult["resent"][number]["whatsapp"], string> = {
  SENT: "enviado ao WhatsApp",
  NO_PHONE: "sem telefone no cadastro",
  FAILED: "o WhatsApp recusou",
};

function when(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Convidados que ainda não enviaram o formulário: situação, datas e reenvio. */
export function InvitesTab({ cycleId, canAdmin }: { cycleId: string; canAdmin: boolean }) {
  const router = useRouter();
  const { data: board, isLoading, isError, refetch } = useVipKanban(cycleId);
  const resend = useResendVipInvites(cycleId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<VipResendResult | null>(null);

  const rows = useMemo(() => {
    const now = new Date();
    const cards = (board?.columns ?? [])
      .filter((c) => c.stage === "INVITED" || c.stage === "FORM_STARTED" || c.stage === "SELF_ENROLLED")
      .flatMap((c) => c.cards);
    return cards
      .map((card) => ({ card, situation: vipInviteSituation(card, now) }))
      .sort((a, b) => (b.card.lastInviteSentAt ?? b.card.createdAt).localeCompare(a.card.lastInviteSentAt ?? a.card.createdAt));
  }, [board]);
  const nameById = useMemo(() => new Map(rows.map((r) => [r.card.id, r.card.displayName ?? "Candidato"])), [rows]);
  const resendableIds = rows.filter((r) => r.situation.canResend).map((r) => r.card.id);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const send = (ids: string[]) =>
    resend.mutate(ids, {
      onSuccess: (r) => {
        setResult(r);
        setSelected(new Set());
      },
    });

  if (isLoading) return <div className="flex justify-center py-10 text-[#94A3B8]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>;
  if (isError || !board) return <QueryError message="Não foi possível carregar os convites." onRetry={() => refetch()} />;

  const selectedResendable = [...selected].filter((id) => resendableIds.includes(id));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-[#475569]">
        Quem foi convidado e ainda não enviou o formulário. Reenviar manda o mesmo link de novo e renova a validade por 7 dias
        (no máximo um envio a cada 12 h por pessoa). O convite sai pelo WhatsApp principal — se o número estiver desconectado, a
        mensagem fica na fila até reconectar.
      </p>

      {canAdmin && rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={resendableIds.length === 0} onClick={() => setSelected(new Set(resendableIds))}>
            Selecionar quem pode receber ({resendableIds.length})
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>Limpar</Button>
          <Button size="sm" disabled={selectedResendable.length === 0 || resend.isPending} onClick={() => send(selectedResendable)}>
            {resend.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <><Send className="mr-1 h-4 w-4" aria-hidden />Reenviar convite ({selectedResendable.length})</>}
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-[#E2E8F0] bg-white p-4 text-center text-[13px] text-[#94A3B8]">
          Ninguém aguardando. Os convidados que já enviaram o formulário estão no Funil.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] bg-white">
          {rows.map(({ card, situation }) => (
            <InviteRow
              key={card.id}
              card={card}
              situation={situation}
              canAdmin={canAdmin}
              checked={selected.has(card.id)}
              onToggle={() => toggle(card.id)}
              onResend={() => send([card.id])}
              busy={resend.isPending}
              onOpen={() => router.push(`/freela-vip/candidatos/${card.id}`)}
            />
          ))}
        </ul>
      )}

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reenvio de convites</DialogTitle>
            <DialogDescription>
              Reenviados: {result?.resent.length ?? 0} · Pulados: {result?.skipped.length ?? 0}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-[12.5px] text-[#475569]">
            {result?.resent.map((r) => (
              <li key={r.applicationId}>
                <strong className="text-[#0F172A]">{nameById.get(r.applicationId) ?? "Candidato"}</strong> — {WHATSAPP_LABEL[r.whatsapp]}
              </li>
            ))}
            {result?.skipped.map((s) => (
              <li key={s.applicationId}>
                <strong className="text-[#0F172A]">{nameById.get(s.applicationId) ?? "Candidato"}</strong> — pulado: {SKIP_REASON[s.reason]}
              </li>
            ))}
          </ul>
          <DialogFooter><Button onClick={() => setResult(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InviteRow({ card, situation, canAdmin, checked, onToggle, onResend, busy, onOpen }: {
  card: VipKanbanCard;
  situation: VipInviteSituation;
  canAdmin: boolean;
  checked: boolean;
  onToggle: () => void;
  onResend: () => void;
  busy: boolean;
  onOpen: () => void;
}) {
  const name = card.displayName ?? "Candidato";
  return (
    <li className="flex flex-col gap-2 p-3 text-[13px] sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {canAdmin && (
          <input
            type="checkbox"
            className="mt-1"
            aria-label={`Selecionar ${name}`}
            checked={checked}
            disabled={!situation.canResend}
            onChange={onToggle}
          />
        )}
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <span className="block truncate font-medium text-[#0F172A] hover:underline">{name}</span>
          <span className="block text-[12px] text-[#64748B]">
            {card.source === "LINK" ? "Entrou pelo link" : `Convidado em ${when(card.invitedAt)}`}
            {card.lastInviteSentAt && card.lastInviteSentAt !== card.invitedAt ? ` · último envio ${when(card.lastInviteSentAt)}` : ""}
            {card.inviteExpiresAt ? ` · vale até ${when(card.inviteExpiresAt)}` : ""}
          </span>
        </button>
      </div>
      <div className="flex items-center gap-2 pl-7 sm:pl-0">
        <Badge variant={TONE_VARIANT[situation.tone]}>{situation.label}</Badge>
        {canAdmin && card.source === "BASE" && (
          <Button size="sm" variant="outline" disabled={!situation.canResend || busy} title={situation.blockedReason} onClick={onResend}>
            Reenviar
          </Button>
        )}
      </div>
    </li>
  );
}

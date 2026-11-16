import { AlertTriangle, Ban, Check, HelpCircle, Megaphone, Reply, Users } from "lucide-react";
import type { PipelineCard } from "@/modules/admin/infrastructure/crm-api";
import { formatSentAt, messageStatusLine, messageStatusOf } from "./funnel-helpers";

/**
 * O que já saiu para este contratante: a situação da última mensagem do
 * Pipeline e, embaixo, o que mais ele recebeu (campanha, mesmo telefone em
 * outra conta, pedido para sair). Usado no card do funil e na lista de
 * cadastros antigos — as duas telas têm de dizer a mesma coisa.
 */
export function MessageStatusInfo({ card }: { card: PipelineCard }) {
  const status = messageStatusOf(card);
  const line = messageStatusLine(card);
  const failed = status === "FAILED";
  const uncertain = status === "UNCERTAIN";
  const StatusIcon = failed ? AlertTriangle : uncertain ? HelpCircle : status === "REPLIED" ? Reply : Check;

  const notes: { key: string; icon: typeof Check; text: string }[] = [];
  if (card.messageOptedOutAt) {
    notes.push({ key: "saiu", icon: Ban, text: "Pediu para não receber campanhas." });
  }
  if (status === "NONE" && card.samePhoneSentAt) {
    notes.push({
      key: "telefone",
      icon: Users,
      text: `Outro cadastro com o mesmo telefone já recebeu ${formatSentAt(card.samePhoneSentAt)}.`,
    });
  }
  if (card.lastCampaign) {
    notes.push({
      key: "campanha",
      icon: Megaphone,
      text: `Recebeu a campanha "${card.lastCampaign.name}" ${formatSentAt(card.lastCampaign.sentAt)}.`,
    });
  }

  if (!line && notes.length === 0) return null;

  return (
    <div className="space-y-1 text-left">
      {line && (
        <p
          className={`flex items-start gap-1 text-[11px] ${
            failed ? "text-red-700" : uncertain ? "text-[#b45309]" : "text-[#8a6d1f]"
          }`}
        >
          <StatusIcon className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="min-w-0 break-words">{line}</span>
        </p>
      )}
      {status === "REPLIED" && card.messageReplyText && (
        <p className="break-words rounded bg-white/70 px-2 py-1 text-[11px] italic text-[#525252]">
          “{card.messageReplyText}”
        </p>
      )}
      {notes.map(({ key, icon: Icon, text }) => (
        <p key={key} className="flex items-start gap-1 text-[11px] text-[#737373]">
          <Icon className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="min-w-0 break-words">{text}</span>
        </p>
      ))}
    </div>
  );
}

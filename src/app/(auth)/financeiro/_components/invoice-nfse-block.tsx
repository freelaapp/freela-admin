import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  MinusCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ddmm,
  ddmmyyyy,
  formatBrl,
  instantWithWeekday,
  retryAtLabel,
  type SituationTone,
} from "@/modules/admin/application/invoice-presentation";
import type {
  AdminInvoiceNfse,
  InvoiceNfseStatus,
  InvoiceStatus,
} from "@/modules/admin/infrastructure/billing-api";
import { TONES } from "./invoice-situation-badge";

/**
 * A regra da nota da fatura (contador e dono, 13/10; plano §17, N1–N6), dita
 * junto da fonte que a API manda: o que entra na base, a competência e o tomador.
 */
const NOTE_RULE =
  "Uma nota por fatura (contador, 13/10): taxa de intermediação de cada vaga, menos cupom e estorno parcial automático; o valor do freelancer, o seguro e a taxa Pix não entram. Competência: dia do fechamento da fatura, em Brasília (dono, 13/10). Tomador: dados da empresa no fechamento. Número e PDF: da prefeitura, na autorização.";

/** Na reemissão manual o tomador não é o do fechamento: são os dados atuais da empresa. */
const REISSUE_TAKER_RULE =
  'Na reemissão ("Reemitir nota"), o tomador sai com os dados atuais da empresa.';

/** O caminho depois dos reenvios automáticos, quando a API oferece a reemissão. */
const REISSUE_PATH = 'Depois dos reenvios automáticos, o caminho é o botão "Reemitir nota".';

/**
 * A regra do reenvio automático da nota FAILED (API-3g, `invoice-nfse-retry.ts`):
 * até 6 reenvios, na varredura das :20, com a espera mínima de cada um, só na
 * janela de 14 dias depois do pagamento. Depois deles, o "Reemitir nota" (quando
 * a API manda `actions.nfseReissue`).
 */
function retryRule(retryUntil: string, reissueAvailable: boolean): string {
  const rule = `reenvio automático da nota da fatura: até 6 reenvios, na varredura dos 20 min de cada hora, com espera mínima de 1 h, 3 h, 6 h, 12 h, 24 h e 24 h depois do envio anterior (o 1º conta da criação da nota), só nos 14 dias depois do pagamento (até ${ddmm(retryUntil)}). Tomador sem CPF/CNPJ não é reenviado.`;
  return reissueAvailable ? `${rule} ${REISSUE_PATH}` : rule;
}

const NO_RETRY_SOURCE =
  "os reenvios automáticos acabaram (6 reenvios feitos, ou falha que reenviar não resolve, como tomador sem CPF/CNPJ).";

const STATUS_BADGE: Record<InvoiceNfseStatus, { tone: SituationTone; icon: LucideIcon; text: string }> = {
  PENDING: { tone: "warning", icon: Clock, text: "Sendo emitida" },
  ISSUED: { tone: "success", icon: CheckCircle2, text: "Emitida" },
  FAILED: { tone: "danger", icon: AlertTriangle, text: "Com problema" },
  NONE: { tone: "muted", icon: MinusCircle, text: "Sem nota" },
};

/**
 * Bloco "Nota fiscal (NFS-e)" do detalhe da fatura no admin (AD2c.2; UX 6.10.3).
 * Uma nota por fatura paga ou quitada com crédito. Todo número com a conta
 * (`calc` da API) e a fonte (`source` + a regra). A FAILED mostra o motivo e a
 * próxima tentativa automática; o botão "Reemitir nota" fica logo abaixo do
 * bloco (`NfseReissueAction`), e o texto só aponta para ele quando ele existe.
 */
export function InvoiceNfseBlock({
  nfse,
  invoiceStatus,
  reissueAvailable = false,
  now = Date.now(),
}: {
  nfse: AdminInvoiceNfse | null;
  invoiceStatus: InvoiceStatus;
  /** A API manda `actions.nfseReissue` (há o botão "Reemitir nota"). */
  reissueAvailable?: boolean;
  /** Para decidir se a hora do reenvio já passou (testes fixam o relógio). */
  now?: number;
}) {
  if (!nfse) {
    return <p className="text-sm text-[#525252]">{pendingText(invoiceStatus)}</p>;
  }

  const badge = STATUS_BADGE[nfse.status];
  const BadgeIcon = badge.icon;
  const badgeText =
    nfse.status === "ISSUED" && nfse.issuedAt
      ? `Emitida em ${instantWithWeekday(nfse.issuedAt)}`
      : badge.text;
  const valueLine = `${amountLabel(nfse.amountInCents)} · competência ${competenceLabel(nfse.competenceDate)}`;

  return (
    <div className="space-y-2 text-sm">
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
          TONES[badge.tone],
        )}
      >
        <BadgeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {badgeText}
      </span>

      {nfse.status === "NONE" ? (
        <p className="text-[#1d1d1b]">Taxa líquida zero: nada a emitir.</p>
      ) : (
        <>
          {nfse.status === "PENDING" && (
            <p className="text-[#1d1d1b]">Enviada à prefeitura; aguardando autorização.</p>
          )}
          <p className="font-medium text-[#1d1d1b]">
            {nfse.status === "ISSUED" && nfse.number
              ? `Nota fiscal nº ${nfse.number} · ${valueLine}`
              : valueLine}
          </p>
        </>
      )}

      <div className="space-y-0.5 text-xs">
        <p className="text-[#525252]">{`Conta: ${nfse.calc || "—"}`}</p>
        <p className="text-[#737373]">
          {`Fonte: ${nfse.source || "—"} ${NOTE_RULE}${reissueAvailable ? ` ${REISSUE_TAKER_RULE}` : ""}`}
        </p>
      </div>

      {nfse.status === "ISSUED" &&
        (nfse.pdfUrl ? (
          <a
            href={nfse.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#e5e5e5] px-3 text-sm font-medium text-[#1d1d1b] hover:bg-[#f7f7f7]"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Abrir PDF da nota
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        ) : (
          <p className="text-xs text-[#525252]">
            O PDF ainda não está disponível: a prefeitura devolve o link alguns instantes depois de
            autorizar. Recarregue em alguns minutos.
          </p>
        ))}

      {nfse.status === "FAILED" && (
        <FailedNote nfse={nfse} now={now} reissueAvailable={reissueAvailable} />
      )}
    </div>
  );
}

function FailedNote({
  nfse,
  now,
  reissueAvailable,
}: {
  nfse: AdminInvoiceNfse;
  now: number;
  reissueAvailable: boolean;
}) {
  const retry = retryText(nfse, now, reissueAvailable);
  return (
    <div className="space-y-1 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-2.5">
      <p className="text-[#b91c1c]">
        {`Motivo: ${nfse.failureReason ?? "a emissora não informou o motivo"}`}
      </p>
      <p className="font-medium text-[#1d1d1b]">{retry.text}</p>
      <p className="text-xs text-[#525252]">{`Fonte: ${retry.source}`}</p>
    </div>
  );
}

/**
 * A linha do reenvio. `retryUntil` nulo é o único sinal de "acabou" (a API zera
 * os dois campos quando para); a tela não recalcula a janela de 14 dias.
 */
function retryText(
  nfse: AdminInvoiceNfse,
  now: number,
  reissueAvailable: boolean,
): { text: string; source: string } {
  if (!nfse.retryUntil) {
    return reissueAvailable
      ? {
          text: 'Sem nova tentativa automática. Se o motivo for dado errado, corrija o cadastro da empresa e use "Reemitir nota".',
          source: `${NO_RETRY_SOURCE} O caminho agora é o botão "Reemitir nota", com os dados atuais da empresa.`,
        }
      : {
          text: "Sem nova tentativa automática. Fale com o time de tecnologia.",
          source: NO_RETRY_SOURCE,
        };
  }
  const source = retryRule(nfse.retryUntil, reissueAvailable);
  if (!nfse.nextRetryAt) {
    return { text: `Reenvio automático pendente (até ${ddmm(nfse.retryUntil)}).`, source };
  }
  const at = new Date(nfse.nextRetryAt).getTime();
  if (Number.isFinite(at) && at <= now) {
    return {
      text: "Próxima tentativa automática: na próxima varredura (aos 20 min de cada hora)",
      source,
    };
  }
  return {
    text: `Próxima tentativa automática: ${retryAtLabel(nfse.nextRetryAt)} (Brasília)`,
    source,
  };
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Valor da nota. Dado quebrado vira "—", nunca R$ 0,00 (que diria "nota de zero"). */
function amountLabel(cents: number | null): string {
  return typeof cents === "number" && Number.isFinite(cents) ? formatBrl(cents) : "—";
}

/** "23/10/2026 (data de fechamento da fatura)"; fora de `AAAA-MM-DD`, "—". */
function competenceLabel(key: string | null): string {
  return key && DATE_KEY.test(key) ? `${ddmmyyyy(key)} (data de fechamento da fatura)` : "—";
}

/** Sem nota ainda: o texto depende da situação da fatura. */
function pendingText(status: InvoiceStatus): string {
  if (status === "CANCELLED") return "Fatura cancelada: sem nota fiscal.";
  if (status === "ISSUED") return "A nota sai quando a fatura for paga ou quitada com crédito.";
  return "A nota desta fatura ainda não saiu; sai em seguida.";
}

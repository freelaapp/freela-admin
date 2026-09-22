"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, Loader2, MessageCircle, Send, X } from "lucide-react";

import type { SupportChecklist } from "@/modules/admin/application/use-support-checklist";
import type { OutreachStage } from "@/modules/admin/infrastructure/vacancy-outreach-api";
import type { SupportRecipient } from "@/modules/admin/infrastructure/support-checklist-api";

import {
  PRIORIDADE_COR,
  PRIORIDADE_ROTULO,
  acaoEstaCritica,
  formatarTempoRestante,
  resolverPendencias,
  tempoDeReferencia,
  type JanelaDaVaga,
  type SupportAction,
} from "./support-actions";
import { montarMensagem } from "./support-messages";
import { SupportSendDialog } from "./support-send-dialog";
import type { VacancyBucket } from "./vacancy-bucket";

/**
 * Área de trabalho do suporte — a gaveta em que uma contratação é tocada.
 *
 * Gaveta, e não modal: o painel continua visível ao lado, e quem está no
 * telefone acompanha a coluna mudar enquanto trabalha o card. O modal de
 * detalhes da vaga continua existindo e é para outra coisa — lá se LÊ a vaga
 * (candidatos, dinheiro, documentos), aqui se EXECUTA a operação dela.
 *
 * O componente não decide o que é crítico nem o que cada etapa pede: isso vive
 * em `support-actions.ts`. Aqui só se desenha e se dispara.
 */

/** O que a gaveta precisa saber da vaga. Estrutural de propósito: o Freela em
 *  Casa tem as mesmas etapas e vai reusar a gaveta sem herdar o tipo de Empresa. */
export interface WorkspaceVaga {
  id: string;
  bucket: VacancyBucket;
  cargo: string;
  empresa: string;
  cidade: string;
  data: string;
  turno: string;
  valor: string;
  candidatos: number;
  freelancer: string | null;
  /** Contatos dos atalhos. Opcionais: onde a listagem não traz telefone, a
   *  gaveta mostra "sem telefone" em vez de esconder o atalho. */
  freelancerTelefone?: string | null;
  contratanteContato?: string | null;
  contratanteTelefone?: string | null;
}

export interface WorkspaceHandlers {
  /** Reenvia o anúncio no grupo da cidade. */
  onReenviarGrupo?: (vacancyId: string) => Promise<void>;
  /** Dispara o aviso de etapa no WhatsApp do contratante. */
  onCobrar?: (vacancyId: string, stage: OutreachStage) => Promise<void>;
  /**
   * Envia a mensagem da ação pela plataforma (resolve o telefone no servidor) e
   * tica a ação. Sem este handler, o atalho de WhatsApp não aparece.
   */
  onEnviarWhatsapp?: (
    vacancyId: string,
    actionId: string,
    recipient: SupportRecipient,
    text: string,
  ) => Promise<void>;
  /** Abre o modal de detalhes da vaga (candidatos, dinheiro, documentos). */
  onAbrirDetalhes?: (vacancyId: string) => void;
}

const ETAPA_ROTULO: Partial<Record<VacancyBucket, string>> = {
  open: "Aberta · sem candidato",
  awaitingSelection: "Aguardando seleção",
  awaitingPayment: "Aguardando pagamento",
  confirmed: "Freela confirmado",
  inProgress: "Em andamento",
  completedAwaitingReview: "Aguardando avaliação",
  completedReviewed: "Concluída",
  cancelled: "Cancelada",
  lost: "Expirou sem contratação",
};

/** "hoje 14:32" / "12/08 09:10" — o suficiente para saber se o tique é de agora. */
function formatarTique(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  const mesmoDia = d.toDateString() === new Date().toDateString();
  if (mesmoDia) return `hoje ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })} ${hora}`;
}

/** Um dado do resumo. `null`/vazio vira "—" em vez de sumir: a ausência do
 *  telefone do contratante é exatamente o que explica a saudação não sair. */
function Dado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
        {rotulo}
      </div>
      <div className="truncate text-[12.5px] font-medium text-[#334155]" title={valor ?? undefined}>
        {valor && valor !== "N/A" ? valor : "—"}
      </div>
    </div>
  );
}

function AtalhoDaAcao({
  acao,
  vaga,
  handlers,
  ocupado,
}: {
  acao: SupportAction;
  vaga: WorkspaceVaga;
  handlers: WorkspaceHandlers;
  ocupado: boolean;
}) {
  const contexto = useMemo(
    () => ({
      cargo: vaga.cargo,
      empresa: vaga.empresa,
      data: vaga.data,
      turno: vaga.turno,
      freelancer: vaga.freelancer ?? "",
      contato: vaga.contratanteContato ?? "",
    }),
    [vaga],
  );
  const [dialogAberto, setDialogAberto] = useState(false);

  if (!acao.atalho) return null;

  const classe =
    "inline-flex shrink-0 items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-[11px] font-semibold text-[#334155] transition-colors hover:bg-[#F1F5F9] disabled:cursor-wait disabled:opacity-60";

  if (acao.atalho === "whatsappContratante" || acao.atalho === "whatsappFreelancer") {
    const paraFreela = acao.atalho === "whatsappFreelancer";
    const recipient: SupportRecipient = paraFreela ? "freelancer" : "contractor";
    const telefone = paraFreela ? vaga.freelancerTelefone : vaga.contratanteTelefone;
    const enviar = handlers.onEnviarWhatsapp;
    // Sem o handler de envio não há como mandar pela plataforma — some o atalho.
    if (!enviar) return null;
    return (
      <>
        <button
          type="button"
          onClick={() => setDialogAberto(true)}
          className={`${classe} cursor-pointer`}
        >
          <MessageCircle className="h-3 w-3" aria-hidden />
          {paraFreela ? "WhatsApp freela" : "WhatsApp contratante"}
        </button>
        {dialogAberto ? (
          <SupportSendDialog
            titulo={acao.label}
            destinatarioRotulo={
              paraFreela
                ? `Freelancer${vaga.freelancer ? ` · ${vaga.freelancer}` : ""}`
                : `Contratante${vaga.contratanteContato ? ` · ${vaga.contratanteContato}` : ""}`
            }
            // O telefone é só para exibir/abrir o wa.me: o envio pela plataforma
            // resolve o número no servidor, então mesmo em branco aqui vale tentar.
            telefone={telefone ?? null}
            textoInicial={montarMensagem(acao.id, contexto)}
            onEnviar={(texto) => enviar(vaga.id, acao.id, recipient, texto)}
            onClose={() => setDialogAberto(false)}
          />
        ) : null}
      </>
    );
  }

  if (acao.atalho === "reenviarGrupo") {
    if (!handlers.onReenviarGrupo) return null;
    return (
      <button
        type="button"
        disabled={ocupado}
        onClick={() => handlers.onReenviarGrupo?.(vaga.id)}
        className={`${classe} cursor-pointer`}
      >
        {ocupado ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <Send className="h-3 w-3" aria-hidden />
        )}
        Reenviar no grupo
      </button>
    );
  }

  if (!handlers.onCobrar) return null;
  const stage: OutreachStage =
    acao.atalho === "cobrarEscolha" ? "awaitingSelection" : "awaitingPayment";
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={() => handlers.onCobrar?.(vaga.id, stage)}
      className={`${classe} cursor-pointer`}
    >
      {ocupado ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <Send className="h-3 w-3" aria-hidden />
      )}
      Enviar cobrança
    </button>
  );
}

function LinhaDeAcao({
  acao,
  vaga,
  janela,
  checklist,
  handlers,
  ocupado,
}: {
  acao: SupportAction;
  vaga: WorkspaceVaga;
  janela: JanelaDaVaga;
  checklist: SupportChecklist;
  handlers: WorkspaceHandlers;
  ocupado: boolean;
}) {
  const tique = checklist.tique(vaga.id, acao.id);
  const feita = Boolean(tique);
  const critica = !feita && acaoEstaCritica(acao, janela);

  return (
    <li
      className={`rounded-[10px] border px-3 py-2.5 transition-colors ${
        feita
          ? "border-[#BBF7D0] bg-[#F0FDF4]"
          : critica
            ? "border-[#FECACA] bg-[#FEF2F2]"
            : "border-[#E2E8F0] bg-white"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* O tique é o próprio botão, não um checkbox decorativo ao lado de um
            label clicável: alvo grande é o que se acerta com uma mão no
            telefone e a outra no mouse. */}
        <button
          type="button"
          role="checkbox"
          aria-checked={feita}
          // O rótulo da caixa é a AÇÃO, não "marcar": quem navega por leitor de
          // tela ouviria sete "marcar como feita" seguidos sem saber qual é qual.
          aria-label={acao.label}
          onClick={() => checklist.alternar(vaga.id, acao.id)}
          title={feita ? "Desmarcar" : "Marcar como feita"}
          className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[5px] border transition-colors ${
            feita
              ? "border-[#16A34A] bg-[#16A34A]"
              : critica
                ? "border-[#DC2626] bg-white hover:bg-[#FEE2E2]"
                : "border-[#CBD5E1] bg-white hover:bg-[#F1F5F9]"
          }`}
        >
          {feita ? <Check className="h-3 w-3 text-white" aria-hidden /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`text-[13px] font-semibold leading-tight ${
                feita ? "text-[#166534] line-through decoration-[#86EFAC]" : "text-[#0F172A]"
              }`}
            >
              {acao.label}
            </span>
            {critica ? (
              <span className="rounded-full bg-[#DC2626] px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-white">
                crítica
              </span>
            ) : null}
          </div>

          <p className={`mt-0.5 text-[11.5px] leading-snug ${feita ? "text-[#65A30D]" : "text-[#64748B]"}`}>
            {acao.hint}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <AtalhoDaAcao acao={acao} vaga={vaga} handlers={handlers} ocupado={ocupado} />
            {tique ? (
              <span className="text-[10.5px] font-medium text-[#16A34A]">
                ✓ {tique.by ? `${tique.by} · ` : ""}
                {formatarTique(tique.at)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

export function SupportWorkspace({
  vaga,
  janela,
  checklist,
  handlers,
  ocupado = false,
  onClose,
}: {
  vaga: WorkspaceVaga;
  janela: JanelaDaVaga;
  checklist: SupportChecklist;
  handlers: WorkspaceHandlers;
  /** Um disparo (grupo/cobrança) em curso nesta vaga. */
  ocupado?: boolean;
  onClose: () => void;
}) {
  const fecharRef = useRef<HTMLButtonElement>(null);

  // Esc fecha: a gaveta é aberta e fechada dezenas de vezes num turno, e ir ao
  // X com o mouse a cada vaga custa mais que o trabalho em si.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    fecharRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const feitas = checklist.feitasDaVaga(vaga.id);
  const pendencias = resolverPendencias(vaga.bucket, janela, feitas);
  const { cor, corFundo } = PRIORIDADE_COR[pendencias.prioridade];
  const pendentesIds = pendencias.acoes.filter((a) => !feitas.has(a.id)).map((a) => a.id);
  const progresso = pendencias.total === 0 ? 100 : (pendencias.feitas / pendencias.total) * 100;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        data-testid="workspace-overlay"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Área de trabalho do suporte — ${vaga.cargo} em ${vaga.empresa}`}
        className="relative flex h-full w-full max-w-[460px] flex-col bg-white shadow-[-8px_0_32px_rgba(15,23,42,.14)]"
      >
        <header className="border-b border-[#E2E8F0] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                Área de trabalho do suporte
              </p>
              <h2 className="truncate text-[17px] font-bold leading-tight text-[#0F172A]">
                {vaga.cargo}
              </h2>
              <p className="truncate text-[12.5px] text-[#475569]">{vaga.empresa}</p>
            </div>
            <button
              ref={fecharRef}
              type="button"
              onClick={onClose}
              aria-label="Fechar área de trabalho"
              className="shrink-0 cursor-pointer rounded-md p-1.5 text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-semibold text-[#334155]">
              {ETAPA_ROTULO[vaga.bucket] ?? vaga.bucket}
            </span>
            <span
              style={{ background: corFundo, color: cor }}
              className="rounded-full px-2 py-0.5 text-[11px] font-bold"
            >
              {PRIORIDADE_ROTULO[pendencias.prioridade]} ·{" "}
              {formatarTempoRestante(tempoDeReferencia(vaga.bucket, janela))}
            </span>
            <span className="font-mono text-[10.5px] font-semibold text-[#94A3B8]">
              {vaga.id.slice(0, 8)}
            </span>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-[10px] bg-[#F8FAFC] px-3 py-2.5">
            <Dado rotulo="Data · turno" valor={`${vaga.data} · ${vaga.turno}`} />
            <Dado rotulo="Cidade" valor={vaga.cidade} />
            <Dado rotulo="Valor" valor={vaga.valor} />
            <Dado
              rotulo={vaga.freelancer ? "Freelancer" : "Candidatos"}
              valor={vaga.freelancer ?? `${vaga.candidatos}`}
            />
            <Dado rotulo="Contato do contratante" valor={vaga.contratanteContato ?? null} />
            <Dado rotulo="Telefone" valor={vaga.contratanteTelefone ?? null} />
          </div>

          {/* Progresso antes da lista: quem abre a gaveta quer saber, em meio
              segundo, se esta vaga já foi trabalhada por alguém. */}
          <div className="mt-3.5">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[#64748B]">
                Ações desta contratação
              </span>
              <span className="text-[12px] font-bold tabular-nums text-[#334155]">
                {pendencias.feitas}/{pendencias.total}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#E2E8F0]">
              <div
                style={{
                  width: `${progresso}%`,
                  background: pendencias.concluida ? "#16A34A" : cor,
                }}
                className="h-full rounded-full transition-[width]"
              />
            </div>
          </div>

          {pendencias.criticasPendentes.length > 0 ? (
            <p className="mt-2.5 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] font-semibold text-[#991B1B]">
              {pendencias.criticasPendentes.length} ação(ões) crítica(s) ainda não feita(s) nesta
              vaga.
            </p>
          ) : null}

          {pendencias.total === 0 ? (
            <p className="mt-3 rounded-[10px] border border-dashed border-[#CBD5E1] py-6 text-center text-[12px] text-[#94A3B8]">
              Ciclo fechado — nada a cobrar nesta vaga.
            </p>
          ) : (
            <ul className="mt-2.5 flex flex-col gap-2">
              {pendencias.acoes.map((acao) => (
                <LinhaDeAcao
                  key={acao.id}
                  acao={acao}
                  vaga={vaga}
                  janela={janela}
                  checklist={checklist}
                  handlers={handlers}
                  ocupado={ocupado}
                />
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-[#E2E8F0] px-4 py-3">
          <button
            type="button"
            disabled={pendentesIds.length === 0}
            onClick={() => checklist.ticarTodas(vaga.id, pendentesIds)}
            className="cursor-pointer rounded-lg border border-[#E2E8F0] px-3 py-2 text-[12px] font-semibold text-[#334155] transition-colors hover:bg-[#F1F5F9] disabled:cursor-not-allowed disabled:opacity-50"
            title="Para quem resolveu a vaga inteira no telefone"
          >
            Ticar as {pendentesIds.length} restantes
          </button>
          {handlers.onAbrirDetalhes ? (
            <button
              type="button"
              onClick={() => handlers.onAbrirDetalhes?.(vaga.id)}
              className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#1d1d1b] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#333]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Abrir a vaga
            </button>
          ) : null}
        </footer>
      </aside>
    </div>
  );
}

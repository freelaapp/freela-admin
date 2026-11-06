"use client";

import {
  CalendarCheck,
  Loader2,
  Mail,
  Phone,
  RotateCcw,
  ShieldCheck,
  Undo2,
  UserCheck,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import type { VacancyCandidacyItem } from "@/modules/admin/infrastructure/admin-api";
import {
  choiceSlotOf,
  nextFreeSlot,
  type ChoiceSelection,
} from "@/modules/admin/application/selection-round-presentation";
import { formatInstantDate, formatVacancyTime } from "@/lib/date.utils";
import { PrestartCheckStatus } from "./prestart-check-status";

/**
 * Lista de candidatos de uma vaga, no modal de detalhes do painel.
 *
 * COMPARTILHADA entre Vagas Empresa e Vagas — Casa de propósito. As duas telas
 * mostram a mesma coisa (status, contato, quem aprovou, confirmação de presença,
 * desvincular) sobre a mesma resposta de API; duas cópias divergiriam, e divergir
 * aqui significa o painel contar história diferente para cada vertical.
 *
 * O que muda entre elas é só a ORIGEM dos dados e das ações — por isso tudo entra
 * por prop e nada é buscado aqui dentro.
 */
/**
 * Modo "Escolher titular e suplentes" (Vagas Empresa): os cartões PENDENTES viram caixas de marcar
 * (1º toque = titular, depois suplente 1 e 2) e uma faixa fixa no pé mostra os 3 lugares. Os
 * botões de cada cartão somem enquanto o modo estiver ligado (botão dentro de botão não vale).
 */
export interface CandidacyChooseMode {
  selection: ChoiceSelection;
  onToggle: (candidacyId: string) => void;
  /** Quem pode ser suplente (vem do GET de suplentes do admin). Só o titular pode ser qualquer um. */
  reserveEligibleIds: ReadonlySet<string>;
  /** Quantos suplentes cabem (0 a 2). */
  maxReserves: number;
  onReview: () => void;
  /** Aprovando: a marcação trava. */
  busy?: boolean;
}

export interface VacancyCandidacyListProps {
  /** Ligado ⇒ a lista vira o modo de marcação do "Escolher titular e suplentes". */
  chooseMode?: CandidacyChooseMode;
  /**
   * Limita a lista a ~55vh com rolagem própria (padrão). Em um modal que já tem
   * a sua rolagem (Vagas Empresa), passe `false` para não ter rolagem aninhada.
   */
  scrollable?: boolean;
  /** Barra de ações no topo da lista (ex.: "Selecionar agora"). Ausente ⇒ nada aparece. */
  actions?: ReactNode;
  candidacies: VacancyCandidacyItem[] | undefined;
  loading: boolean;
  /** Confirma a presença pelo painel quando o freelancer avisou por fora. */
  onConfirm: (candidacyId: string, providerName: string) => void;
  confirming: boolean;
  /** Ausente ⇒ o botão de desvincular não aparece (ex.: vaga sem id resolvido). */
  onUnlink?: (target: { candidacyId: string; providerName: string }) => void;
  /**
   * Recoloca na vaga quem foi aprovado e desalocado por não confirmar no link.
   * Ausente ⇒ o botão não aparece (área sem permissão).
   */
  onReinstate?: (candidacyId: string, providerName: string) => void;
  reinstating?: boolean;
  /**
   * Coloca na vaga um candidato PENDENTE — o mesmo aceite que o contratante faz,
   * feito pelo suporte. Ausente ⇒ o botão não aparece (área sem permissão).
   */
  onAccept?: (candidacyId: string, providerName: string) => void;
  accepting?: boolean;
  /**
   * Devolve à lista (PENDENTE) quem foi recusado ou não selecionado.
   * Ausente ⇒ o botão não aparece (área sem permissão).
   */
  onRestore?: (candidacyId: string, providerName: string) => void;
  restoring?: boolean;
  /** Vaga aberta? Só nela dá para voltar alguém para a lista de candidatos. */
  vacancyOpen?: boolean;
  /**
   * "Confirmar por telefone" da confirmação do dia (3 h antes).
   * Ausente ⇒ o botão não aparece (área sem permissão ou vertical sem a pergunta).
   */
  onPrestartConfirm?: (candidacyId: string, providerName: string) => void;
  prestartConfirming?: boolean;
}

/** Quem o "Recolocar" atende — aprovado e desalocado. */
function canReinstate(c: { status: string; acceptedAt?: string | null }): boolean {
  return (
    Boolean(c.acceptedAt) &&
    (c.status === "CANCELLED_BY_CONTRACTOR" || c.status === "WITHDRAWN" || c.status === "NOT_SELECTED")
  );
}

/**
 * Selo de compatibilidade candidato × vaga, espelhando o painel do contratante.
 *
 * Só aparece quando o backend manda a nota (flag `FREELA_CANDIDATE_MATCH_ENABLED`
 * ligada). `null` = a vaga não tem dado para comparar → texto explícito, nunca
 * "0%". `undefined` = recurso desligado → não renderiza nada. Faixas iguais às
 * dos cards do contratante: ≥70 verde, ≥40 âmbar, abaixo cinza.
 */
export function MatchBadge({ score }: { score?: number | null }) {
  if (score === undefined) return null;
  if (score === null) {
    return (
      <span className="text-[10px] text-[#a3a3a3]">
        Sem dados desta vaga para comparar
      </span>
    );
  }
  const tone =
    score >= 70
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : score >= 40
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${tone}`}
      title="Compatibilidade do candidato com a vaga (mesmo cálculo do contratante)"
    >
      {score}% compatível
    </span>
  );
}

export function VacancyCandidacyList({
  candidacies,
  loading,
  onConfirm,
  confirming,
  onUnlink,
  onReinstate,
  reinstating = false,
  onAccept,
  accepting = false,
  onRestore,
  restoring = false,
  vacancyOpen = false,
  onPrestartConfirm,
  prestartConfirming = false,
  scrollable = true,
  actions,
  chooseMode,
}: VacancyCandidacyListProps) {
  const nameOf = (id: string | null) =>
    id ? (candidacies?.find((c) => c.id === id)?.providerName ?? "Sem nome") : null;
  return (
    <div className="bg-[#f7f7f7] rounded-lg p-3 space-y-2">
      <p className="text-[#737373] text-xs font-medium uppercase tracking-wide">
        Candidatos {candidacies ? `(${candidacies.length})` : ""}
      </p>
      {actions && <div data-testid="candidatos-acoes">{actions}</div>}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-[#737373]">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Carregando candidatos...
        </div>
      )}
      {!loading && candidacies && candidacies.length === 0 && (
        <p className="text-xs text-[#737373]">Nenhum candidato ainda.</p>
      )}
      {!loading && candidacies && candidacies.length > 0 && (
        // Rola a lista por dentro: sem isso, muitos candidatos esticam o modal
        // para além da tela (o Dialog não limita altura) e não dava pra rolar.
        <div
          data-testid="lista-candidatos"
          className={`flex flex-col gap-2 ${scrollable ? "max-h-[55vh] overflow-y-auto pr-1" : ""}`}
        >
          {candidacies.map((c) => {
            // Nunca rotular status desconhecido como "Pendente": WITHDRAWN e
            // CANCELLED_BY_CONTRACTOR caíam no fallback e o admin mostrava
            // candidato "PENDENTE" que o contratante não via (caso Simone).
            const statusColor =
              c.status === "ACCEPTED"
                ? "bg-green-100 text-green-700 border-green-200"
                : c.status === "REJECTED"
                  ? "bg-red-100 text-red-700 border-red-200"
                  : c.status === "PENDING"
                    ? "bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-gray-200 text-gray-600 border-gray-300";
            const statusLabel =
              c.status === "ACCEPTED"
                ? "Aceito"
                : c.status === "REJECTED"
                  ? "Rejeitado"
                  : c.status === "CANCELLED"
                    ? "Cancelado"
                    : c.status === "CANCELLED_BY_CONTRACTOR"
                      ? "Desvinculado"
                      : c.status === "WITHDRAWN"
                        ? "Retirado"
                        : c.status === "PENDING"
                          ? "Pendente"
                          : c.status === "NOT_SELECTED"
                            ? "Não selecionado"
                            : c.status;
            if (chooseMode) {
              return (
                <ChooseCard
                  key={c.id}
                  candidacy={c}
                  statusLabel={statusLabel}
                  mode={chooseMode}
                />
              );
            }
            return (
              <div
                key={c.id}
                className="bg-white border border-[#e5e5e5] rounded-md p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-[#1d1d1b]">
                    {c.providerName ?? "Sem nome"}
                  </p>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${statusColor}`}
                  >
                    {statusLabel}
                  </span>
                </div>
                {c.matchScore !== undefined && (
                  <div className="mt-1">
                    <MatchBadge score={c.matchScore} />
                  </div>
                )}
                <div className="mt-1.5 flex flex-col gap-0.5">
                  {c.providerPhone && (
                    <a
                      href={`tel:${c.providerPhone}`}
                      className="flex items-center gap-1.5 text-xs text-[#1d1d1b] hover:text-[#eca826] transition-colors"
                    >
                      <Phone className="w-3 h-3 text-[#737373]" />
                      {c.providerPhone}
                    </a>
                  )}
                  {c.providerEmail && (
                    <a
                      href={`mailto:${c.providerEmail}`}
                      className="flex items-center gap-1.5 text-xs text-[#1d1d1b] hover:text-[#eca826] transition-colors"
                    >
                      <Mail className="w-3 h-3 text-[#737373]" />
                      {c.providerEmail}
                    </a>
                  )}
                </div>
                {c.approvedBy && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-md border border-green-200 bg-green-50 px-2 py-1.5">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                    <div className="text-[11px] leading-tight text-green-900">
                      <span className="font-semibold">
                        Aprovado por{" "}
                        {c.approvedBy.name ??
                          c.approvedBy.email ??
                          "credencial do contratante"}
                      </span>
                      <span className="ml-1 rounded bg-green-100 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-green-700">
                        {c.approvedBy.role === "ADMIN"
                          ? "Painel"
                          : c.approvedBy.role === "EMPLOYEE"
                            ? `Funcionário${c.approvedBy.employeeLabel ? ` · ${c.approvedBy.employeeLabel}` : ""}`
                            : "Dono"}
                      </span>
                      {c.approvedBy.email && c.approvedBy.name && (
                        <span className="block text-green-700">
                          {c.approvedBy.email}
                        </span>
                      )}
                      {c.acceptedAt && (
                        <span className="block text-green-700">
                          {formatInstantDate(c.acceptedAt)} ·{" "}
                          {formatVacancyTime(c.acceptedAt)}
                        </span>
                      )}
                      {/* De onde partiu. É o que responde "não fui eu"
                       quando a equipe toda divide o login do dono. */}
                      {c.acceptedFrom &&
                        (c.acceptedFrom.device || c.acceptedFrom.ip) && (
                          <span className="block text-green-700">
                            {c.acceptedFrom.device ?? "Origem desconhecida"}
                            {c.acceptedFrom.ip
                              ? ` · IP ${c.acceptedFrom.ip}`
                              : ""}
                          </span>
                        )}
                    </div>
                  </div>
                )}
                {/* Confirmação de presença (handshake). Só faz sentido em
                  candidatura ACEITA: nas outras não há o que confirmar. */}
                {c.status === "ACCEPTED" &&
                  (c.confirmedAt ? (
                    <div className="mt-2 flex items-start gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                      <CalendarCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <div className="text-[11px] leading-tight text-emerald-900">
                        <span className="font-semibold">
                          Presença confirmada
                        </span>
                        {c.confirmationChannel === "admin" && (
                          <span className="ml-1 rounded bg-emerald-100 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
                            pelo painel
                          </span>
                        )}
                        <span className="block text-emerald-700">
                          {formatInstantDate(c.confirmedAt)} ·{" "}
                          {formatVacancyTime(c.confirmedAt)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5">
                      <p className="text-[11px] leading-tight text-amber-900">
                        <span className="font-semibold">
                          Aguardando o freelancer confirmar.
                        </span>
                        {c.confirmDeadlineAt && (
                          <span className="block text-amber-700">
                            Prazo dele: {formatInstantDate(c.confirmDeadlineAt)}{" "}
                            · {formatVacancyTime(c.confirmDeadlineAt)}
                          </span>
                        )}
                      </p>
                      <button
                        onClick={() =>
                          onConfirm(c.id, c.providerName ?? "O freelancer")
                        }
                        disabled={confirming}
                        className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {confirming ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CalendarCheck className="h-3 w-3" />
                        )}
                        Confirmar presença por ele
                      </button>
                      <p className="mt-1 text-[10px] leading-tight text-amber-700">
                        Use quando ele já avisou por telefone. Fica registrado
                        que quem confirmou foi o painel.
                      </p>
                    </div>
                  ))}
                {/* Confirmação do dia ("Você vai mesmo?", 3 h antes). */}
                {c.prestartCheck && (
                  <PrestartCheckStatus
                    check={c.prestartCheck}
                    confirming={prestartConfirming}
                    onConfirm={
                      onPrestartConfirm && c.status === "ACCEPTED"
                        ? () => onPrestartConfirm(c.id, c.providerName ?? "O freelancer")
                        : undefined
                    }
                  />
                )}
                {/*
                  Desalocado por não confirmar no link. O suporte fala com a
                  pessoa por telefone e precisa de um caminho — antes disto o
                  único era UPDATE em produção (dois casos em 17/08/2026).
                  Recolocar confirma a presença junto: o prazo dela já passou, e
                  sem confirmar a varredura a cortaria de novo em minutos.
                */}
                {onReinstate && canReinstate(c) && (
                    <button
                      onClick={() => onReinstate(c.id, c.providerName ?? "Freelancer")}
                      disabled={reinstating}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                      title="Devolve a vaga a esta pessoa e confirma a presença pelo painel"
                    >
                      {reinstating ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Recolocar na vaga
                    </button>
                  )}
                {/*
                  Voltar para candidatos: recusado (inclusive por engano do
                  contratante) ou não selecionado volta a PENDENTE, para ser
                  escolhido de novo. Antes disto era UPDATE em produção (duas
                  vagas em 29/09/2026). Quem pode ser recolocado usa o botão de
                  cima — um segundo botão verde no mesmo cartão só confundiria.
                */}
                {onRestore &&
                  vacancyOpen &&
                  (c.status === "REJECTED" || c.status === "NOT_SELECTED") &&
                  !(onReinstate && canReinstate(c)) && (
                    <button
                      onClick={() => onRestore(c.id, c.providerName ?? "Freelancer")}
                      disabled={restoring}
                      className="mt-2 mr-3 inline-flex items-center gap-1.5 rounded-md border border-emerald-600 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-60"
                      title="Devolve a pessoa à lista de candidatos, como pendente"
                    >
                      {restoring ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Undo2 className="h-3 w-3" />
                      )}
                      Voltar para candidatos
                    </button>
                  )}
                {/*
                  Colocar na vaga: o suporte aceita no lugar do contratante
                  (pedido do dono, 24/09/2026). É o mesmo aceite do cliente —
                  a vaga fecha, os outros candidatos são dispensados e o
                  contratante recebe o aviso para pagar.
                */}
                {onAccept && c.status === "PENDING" && (
                  <button
                    onClick={() => onAccept(c.id, c.providerName ?? "Freelancer")}
                    disabled={accepting}
                    className="mt-2 mr-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                    title="Aceita este candidato no lugar do contratante"
                  >
                    {accepting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <UserCheck className="h-3 w-3" />
                    )}
                    Colocar na vaga
                  </button>
                )}
                {(c.status === "ACCEPTED" || c.status === "PENDING") &&
                  onUnlink && (
                    <button
                      onClick={() =>
                        onUnlink({
                          candidacyId: c.id,
                          providerName: c.providerName ?? "Freelancer",
                        })
                      }
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Desvincular da vaga
                    </button>
                  )}
              </div>
            );
          })}
        </div>
      )}
      {chooseMode && (
        <ChooseStrip
          mode={chooseMode}
          principalName={nameOf(chooseMode.selection.principal)}
          reserveNames={[nameOf(chooseMode.selection.reserves[0]), nameOf(chooseMode.selection.reserves[1])]}
        />
      )}
    </div>
  );
}

const SLOT_BADGE = { principal: "TITULAR", 1: "SUPLENTE 1", 2: "SUPLENTE 2" } as const;
const SLOT_ARIA = { principal: "titular", 1: "suplente 1", 2: "suplente 2" } as const;

/** O cartão no modo "Escolher": o cartão inteiro é a caixa de marcar (56 px ou mais). */
function ChooseCard({
  candidacy: c,
  statusLabel,
  mode,
}: {
  candidacy: VacancyCandidacyItem;
  statusLabel: string;
  mode: CandidacyChooseMode;
}) {
  const name = c.providerName ?? "Sem nome";
  if (c.status !== "PENDING") {
    return (
      <div className="rounded-md border border-[#e5e5e5] bg-white p-2.5 opacity-60">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-[#1d1d1b]">{name}</p>
          <span className="rounded border border-gray-300 bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
            {statusLabel}
          </span>
        </div>
        <p className="mt-1 text-xs text-[#737373]">Não está na lista de candidatos.</p>
      </div>
    );
  }
  const slot = choiceSlotOf(mode.selection, c.id);
  const free = nextFreeSlot(mode.selection, mode.maxReserves);
  const full = slot === null && free === null;
  const onlyPrincipal =
    slot === null && free !== null && free !== "principal" && !mode.reserveEligibleIds.has(c.id);
  const blocked = full || onlyPrincipal;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={slot !== null}
      aria-disabled={blocked || mode.busy ? true : undefined}
      aria-label={slot !== null ? `${name}, ${SLOT_ARIA[slot]}` : name}
      onClick={() => !mode.busy && mode.onToggle(c.id)}
      className={`flex min-h-14 w-full items-start gap-3 rounded-md border p-2.5 text-left transition-colors ${
        slot !== null
          ? "border-[#eca826] bg-amber-50"
          : blocked
            ? "border-[#e5e5e5] bg-white opacity-60"
            : "border-[#e5e5e5] bg-white hover:bg-[#fafafa]"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
          slot !== null ? "border-[#eca826] bg-[#eca826] text-[#1d1d1b]" : "border-[#a3a3a3]"
        }`}
      >
        {slot === "principal" ? 1 : slot === 1 ? 2 : slot === 2 ? 3 : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-[#1d1d1b]">{name}</span>
          {slot !== null && (
            <span className="shrink-0 rounded bg-[#eca826] px-2 py-0.5 text-xs font-bold text-[#1d1d1b]">
              {SLOT_BADGE[slot]}
            </span>
          )}
        </span>
        {c.matchScore !== undefined && (
          <span className="mt-1 block">
            <MatchBadge score={c.matchScore} />
          </span>
        )}
        {full && (
          <span className="mt-1 block text-xs text-[#737373]">
            Máximo de {mode.maxReserves} suplente{mode.maxReserves === 1 ? "" : "s"}. Desmarque alguém para trocar.
          </span>
        )}
        {onlyPrincipal && (
          <span className="mt-1 block text-xs text-[#737373]">
            Não dá para ser suplente. Pode ser o titular.
          </span>
        )}
      </span>
    </button>
  );
}

/** A faixa do pé: os 3 lugares e o botão "Revisar e aprovar". */
function ChooseStrip({
  mode,
  principalName,
  reserveNames,
}: {
  mode: CandidacyChooseMode;
  principalName: string | null;
  reserveNames: (string | null)[];
}) {
  const slots = Array.from({ length: mode.maxReserves }, (_, i) => `${i + 1} ${reserveNames[i] ?? "—"}`);
  return (
    <div
      data-testid="escolher-faixa"
      className="sticky bottom-0 -mx-3 -mb-3 space-y-2 rounded-b-lg border-t border-[#e5e5e5] bg-white p-3"
    >
      <div aria-live="polite" className="space-y-0.5 text-sm text-[#1d1d1b]">
        <p>
          <span className="font-semibold">Titular:</span>{" "}
          {principalName ?? "toque em quem vai trabalhar"}
        </p>
        {mode.maxReserves > 0 && (
          <p>
            <span className="font-semibold">Suplentes:</span> {slots.join(" · ")}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={mode.onReview}
        disabled={!principalName || mode.busy}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-[#eca826] px-4 text-sm font-semibold text-[#1d1d1b] hover:bg-[#d99a20] disabled:opacity-50"
      >
        Revisar e aprovar
      </button>
    </div>
  );
}

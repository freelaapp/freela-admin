"use client";

import {
  CalendarCheck,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { VacancyCandidacyItem } from "@/modules/admin/infrastructure/admin-api";
import { formatInstantDate, formatVacancyTime } from "@/lib/date.utils";

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
export interface VacancyCandidacyListProps {
  candidacies: VacancyCandidacyItem[] | undefined;
  loading: boolean;
  /** Confirma a presença pelo painel quando o freelancer avisou por fora. */
  onConfirm: (candidacyId: string, providerName: string) => void;
  confirming: boolean;
  /** Ausente ⇒ o botão de desvincular não aparece (ex.: vaga sem id resolvido). */
  onUnlink?: (target: { candidacyId: string; providerName: string }) => void;
}

export function VacancyCandidacyList({
  candidacies,
  loading,
  onConfirm,
  confirming,
  onUnlink,
}: VacancyCandidacyListProps) {
  return (
    <div className="bg-[#f7f7f7] rounded-lg p-3 space-y-2">
      <p className="text-[#737373] text-xs font-medium uppercase tracking-wide">
        Candidatos {candidacies ? `(${candidacies.length})` : ""}
      </p>
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
        <div className="flex flex-col gap-2">
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
                          : c.status;
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
                        {c.approvedBy.role === "EMPLOYEE"
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
    </div>
  );
}

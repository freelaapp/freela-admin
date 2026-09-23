"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAxiosErrorMessage } from "./use-admin-cancel-vacancy";
import { useAuth } from "@/modules/auth/application/use-auth";
import { getAdminContractors } from "../infrastructure/admin-api";
import { vipRoleFromPermissions, type VipRole } from "./freela-vip-role";
import { moveCardBetweenColumns } from "./freela-vip-presentation";
import {
  confirmVipExperience,
  confirmVipReference,
  createVipCycle,
  createVipQuestion,
  decideVipApplication,
  decideVipBackground,
  deleteVipQuestion,
  getActiveVips,
  getVipApplication,
  getVipBackgroundDocuments,
  getVipCycle,
  getVipCycles,
  getVipDocumentDownload,
  getVipIndicators,
  getVipKanban,
  getVipMessageTemplates,
  getVipPreselected,
  getVipQuestions,
  getVipScoringConfig,
  moveVipStage,
  openVipBackground,
  putVipMessageTemplate,
  putVipScoringConfig,
  rescoreVipApplication,
  sendVipInvites,
  updateVipCycle,
  updateVipQuestion,
  type CreateVipCycleInput,
  type UpdateVipCycleInput,
  type VipKanbanBoard,
  type VipQuestionInput,
  type VipScoringConfig,
  type VipStatus,
} from "../infrastructure/freela-vip-api";

export const VIP_KEYS = {
  cycles: (active?: boolean) => ["admin", "vip", "cycles", active ?? "all"] as const,
  cycle: (id: string) => ["admin", "vip", "cycle", id] as const,
  preselected: (id: string, limit: number) => ["admin", "vip", "preselected", id, limit] as const,
  kanban: (id: string) => ["admin", "vip", "kanban", id] as const,
  indicators: (id: string) => ["admin", "vip", "indicators", id] as const,
  application: (id: string) => ["admin", "vip", "application", id] as const,
  backgroundDocs: (id: string) => ["admin", "vip", "background-docs", id] as const,
  vips: (contractorUserId: string) => ["admin", "vip", "vips", contractorUserId] as const,
  questions: (role?: string) => ["admin", "vip", "questions", role ?? "all"] as const,
  scoring: ["admin", "vip", "scoring"] as const,
  templates: ["admin", "vip", "templates"] as const,
  contractors: ["admin", "contractors", "all"] as const,
};

const fail = (fallback: string) => (e: unknown) => toast.error(getAxiosErrorMessage(e, fallback));

/** Papel VIP da sessão (ver `vipRoleFromPermissions`). */
export function useVipRole(): VipRole {
  const { hasPermission } = useAuth();
  return useMemo(() => vipRoleFromPermissions(hasPermission), [hasPermission]);
}

/** Lista de contratantes (para o seletor de rede). Cache longo: muda pouco. */
export function useAdminContractorsList() {
  return useQuery({ queryKey: VIP_KEYS.contractors, queryFn: getAdminContractors, staleTime: 5 * 60_000 });
}

// ─── Ciclos ──────────────────────────────────────────────────────────────────
export function useVipCycles(active?: boolean) {
  return useQuery({ queryKey: VIP_KEYS.cycles(active), queryFn: () => getVipCycles(active), staleTime: 30_000 });
}
export function useVipCycle(id: string) {
  return useQuery({ queryKey: VIP_KEYS.cycle(id), queryFn: () => getVipCycle(id), enabled: !!id, staleTime: 30_000 });
}
export function useVipCycleMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "vip", "cycles"] });
  const create = useMutation({
    mutationFn: (input: CreateVipCycleInput) => createVipCycle(input),
    onSuccess: () => { invalidate(); toast.success("Ciclo criado."); },
    onError: fail("Erro ao criar o ciclo."),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; input: UpdateVipCycleInput }) => updateVipCycle(v.id, v.input),
    onSuccess: (_d, v) => { invalidate(); qc.invalidateQueries({ queryKey: VIP_KEYS.cycle(v.id) }); toast.success("Ciclo atualizado."); },
    onError: fail("Erro ao atualizar o ciclo."),
  });
  return { create, update };
}

// ─── Pré-seleção / convites ──────────────────────────────────────────────────
export function useVipPreselected(id: string, limit: number) {
  return useQuery({ queryKey: VIP_KEYS.preselected(id, limit), queryFn: () => getVipPreselected(id, limit), enabled: !!id && limit > 0 });
}
export function useSendVipInvites(cycleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (candidateIds: string[]) => sendVipInvites(cycleId, candidateIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VIP_KEYS.kanban(cycleId) });
      qc.invalidateQueries({ queryKey: ["admin", "vip", "preselected", cycleId] });
      qc.invalidateQueries({ queryKey: VIP_KEYS.indicators(cycleId) });
    },
    onError: fail("Erro ao enviar convites."),
  });
}

// ─── Funil ───────────────────────────────────────────────────────────────────
export function useVipKanban(cycleId: string) {
  return useQuery({ queryKey: VIP_KEYS.kanban(cycleId), queryFn: () => getVipKanban(cycleId), enabled: !!cycleId, refetchInterval: 60_000 });
}
/** Move otimista; 409 (transição inválida) devolve o card e mostra a mensagem do servidor. */
export function useMoveVipStage(cycleId: string) {
  const qc = useQueryClient();
  const key = VIP_KEYS.kanban(cycleId);
  return useMutation({
    mutationFn: (v: { applicationId: string; stage: VipStatus }) => moveVipStage(v.applicationId, v.stage),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<VipKanbanBoard>(key);
      if (previous) qc.setQueryData<VipKanbanBoard>(key, moveCardBetweenColumns(previous, v.applicationId, v.stage));
      return { previous };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      toast.error(getAxiosErrorMessage(e, "Não foi possível mover o candidato."));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: VIP_KEYS.indicators(cycleId) });
    },
  });
}
export function useVipIndicators(cycleId: string) {
  return useQuery({ queryKey: VIP_KEYS.indicators(cycleId), queryFn: () => getVipIndicators(cycleId), enabled: !!cycleId, staleTime: 30_000 });
}

// ─── Ficha ───────────────────────────────────────────────────────────────────
export function useVipApplication(id: string) {
  return useQuery({ queryKey: VIP_KEYS.application(id), queryFn: () => getVipApplication(id), enabled: !!id });
}
export function useVipApplicationMutations(id: string, cycleId?: string) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: VIP_KEYS.application(id) });
    if (cycleId) {
      qc.invalidateQueries({ queryKey: VIP_KEYS.kanban(cycleId) });
      qc.invalidateQueries({ queryKey: VIP_KEYS.indicators(cycleId) });
    }
  };
  const confirmReference = useMutation({
    mutationFn: (v: { refId: string; result: "CONFIRMED" | "NOT_CONFIRMED" | "NO_CONTACT" }) => confirmVipReference(id, v.refId, v.result),
    onSuccess: () => { refresh(); toast.success("Referência atualizada."); },
    onError: fail("Erro ao atualizar a referência."),
  });
  const confirmExperience = useMutation({
    mutationFn: (v: { expId: string; confirmed: "YES" | "NO" }) => confirmVipExperience(id, v.expId, v.confirmed),
    onSuccess: () => { refresh(); toast.success("Experiência atualizada."); },
    onError: fail("Erro ao atualizar a experiência."),
  });
  const decide = useMutation({
    mutationFn: (v: { action: "approve" | "reject"; rejectionReason?: string }) => decideVipApplication(id, v.action, v.rejectionReason),
    onSuccess: (r) => { refresh(); toast.success(r.promotedToVip ? "Promovido a VIP!" : "Candidatura atualizada."); },
    onError: fail("Erro ao decidir a candidatura."),
  });
  const rescore = useMutation({
    mutationFn: () => rescoreVipApplication(id),
    onSuccess: (r) => { refresh(); toast.success(`Nota recalculada: ${r.totalScore ?? "—"}.`); },
    onError: fail("Erro ao recalcular a nota."),
  });
  const openBackground = useMutation({
    mutationFn: () => openVipBackground(id),
    onSuccess: () => { refresh(); toast.success("Etapa de antecedentes aberta."); },
    onError: fail("Não foi possível abrir a etapa de antecedentes."),
  });
  const decideBackground = useMutation({
    mutationFn: (result: "APT" | "NOT_APT") => decideVipBackground(id, result),
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: VIP_KEYS.backgroundDocs(id) }); toast.success("Decisão de antecedentes registrada."); },
    onError: fail("Erro ao registrar a decisão."),
  });
  return { confirmReference, confirmExperience, decide, rescore, openBackground, decideBackground };
}
export function useVipBackgroundDocuments(id: string, enabled: boolean) {
  return useQuery({ queryKey: VIP_KEYS.backgroundDocs(id), queryFn: () => getVipBackgroundDocuments(id), enabled: enabled && !!id });
}
export function useVipDocumentDownload(applicationId: string) {
  return useMutation({
    mutationFn: (docId: string) => getVipDocumentDownload(applicationId, docId),
    onSuccess: (r) => {
      window.open(r.url, "_blank", "noopener,noreferrer");
      toast.info(`Link válido por ${Math.round(r.expiresInSeconds / 60)} min. A abertura fica registrada.`);
    },
    onError: fail("Não foi possível abrir o documento."),
  });
}

// ─── Config ──────────────────────────────────────────────────────────────────
export function useVipQuestions(role?: string) {
  return useQuery({ queryKey: VIP_KEYS.questions(role), queryFn: () => getVipQuestions(role), staleTime: 30_000 });
}
export function useVipQuestionMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "vip", "questions"] });
  const create = useMutation({
    mutationFn: (input: VipQuestionInput) => createVipQuestion(input),
    onSuccess: () => { invalidate(); toast.success("Pergunta criada."); },
    onError: fail("Erro ao criar a pergunta."),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; input: Partial<VipQuestionInput> }) => updateVipQuestion(v.id, v.input),
    onSuccess: () => { invalidate(); toast.success("Pergunta atualizada."); },
    onError: fail("Erro ao atualizar a pergunta."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteVipQuestion(id),
    onSuccess: () => { invalidate(); toast.success("Pergunta removida."); },
    onError: fail("Erro ao remover a pergunta."),
  });
  return { create, update, remove };
}
export function useVipScoringConfig() {
  return useQuery({ queryKey: VIP_KEYS.scoring, queryFn: getVipScoringConfig, staleTime: 30_000 });
}
export function useSaveVipScoringConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (config: VipScoringConfig) => putVipScoringConfig(config),
    onSuccess: () => { qc.invalidateQueries({ queryKey: VIP_KEYS.scoring }); toast.success("Configuração de nota salva (nova versão)."); },
    onError: fail("Erro ao salvar a configuração de nota."),
  });
}
export function useVipMessageTemplates() {
  return useQuery({ queryKey: VIP_KEYS.templates, queryFn: getVipMessageTemplates, staleTime: 30_000 });
}
export function useSaveVipMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { moment: string; text: string }) => putVipMessageTemplate(v.moment, v.text),
    onSuccess: () => { qc.invalidateQueries({ queryKey: VIP_KEYS.templates }); toast.success("Mensagem salva."); },
    onError: fail("Erro ao salvar a mensagem."),
  });
}

// ─── VIPs ativos ─────────────────────────────────────────────────────────────
export function useActiveVips(contractorUserId: string) {
  return useQuery({ queryKey: VIP_KEYS.vips(contractorUserId), queryFn: () => getActiveVips(contractorUserId), enabled: !!contractorUserId });
}

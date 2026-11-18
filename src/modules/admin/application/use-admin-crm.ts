"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAxiosErrorMessage } from "./use-admin-cancel-vacancy";
import {
  addCrmContact,
  addCrmNote,
  createCrmCompany,
  createCrmTask,
  deleteCrmCompany,
  deleteCrmContact,
  deleteCrmNote,
  deleteCrmTask,
  getCrmCompany,
  getCrmOldSignups,
  getCrmPipeline,
  getCrmPipelineSettings,
  listCrmCompanies,
  listCrmTasks,
  moveCrmCompany,
  searchCrmContractors,
  sendPipelineWhatsApp,
  updateCrmCompany,
  updateCrmPipelineSettings,
  updateCrmTask,
  type CreateCompanyInput,
  type CreateContactInput,
  type CreateTaskInput,
  type CrmCompanyStatus,
  type CrmPriority,
  type PipelinePeriodParams,
  type PipelineSendSource,
  type UpdatePipelineSettingsInput,
  type UpdateCompanyInput,
  type UpdateTaskInput,
} from "../infrastructure/crm-api";

const ROOT = ["admin", "crm"] as const;

export function useCrmCompanies(filters?: { priority?: CrmPriority; q?: string }) {
  return useQuery({
    queryKey: [...ROOT, "companies", filters ?? {}],
    queryFn: () => listCrmCompanies(filters),
    staleTime: 15_000,
  });
}

export function useCrmCompany(id: string | null) {
  return useQuery({
    queryKey: [...ROOT, "company", id],
    queryFn: () => getCrmCompany(id as string),
    enabled: !!id,
  });
}

export function useCrmTasks(filters?: { done?: boolean; priority?: CrmPriority }) {
  return useQuery({
    queryKey: [...ROOT, "tasks", filters ?? {}],
    queryFn: () => listCrmTasks(filters),
    staleTime: 15_000,
  });
}

/** Funil de contratantes (kanban da aba Pipeline) — colunas calculadas pela API. */
export function useCrmPipeline(params?: PipelinePeriodParams) {
  return useQuery({
    queryKey: [...ROOT, "pipeline", params ?? {}],
    queryFn: () => getCrmPipeline(params),
    staleTime: 30_000,
  });
}

/**
 * Cadastros antigos: contratantes cadastrados há mais de N dias (padrão 30, o
 * que fica para trás da janela do funil). A chave começa por "pipeline" de
 * propósito: o envio de mensagem invalida o funil E esta lista de uma vez.
 */
export function useCrmOldSignups(days?: number) {
  return useQuery({
    queryKey: [...ROOT, "pipeline", "old-signups", days ?? null],
    queryFn: () => getCrmOldSignups(days),
    staleTime: 30_000,
  });
}

/** Mensagem do Pipeline: modelo da Meta, WhatsApp do marketing e resposta automática. */
export function useCrmPipelineSettings() {
  return useQuery({
    queryKey: [...ROOT, "pipeline", "settings"],
    queryFn: getCrmPipelineSettings,
    staleTime: 30_000,
    // API antiga (sem a rota) responde 404: tentar de novo só atrasa a tela.
    retry: false,
  });
}

export function useUpdateCrmPipelineSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePipelineSettingsInput) => updateCrmPipelineSettings(input),
    onSuccess: (settings) => {
      qc.setQueryData([...ROOT, "pipeline", "settings"], settings);
    },
  });
}

/**
 * Botão do card: dispara a mensagem automática de WhatsApp ao contratante. `source` diz de
 * qual aba saiu o clique (os cadastros antigos têm a mensagem da aba).
 */
export function usePipelineWhatsApp(source?: PipelineSendSource) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => sendPipelineWhatsApp(userId, source),
    onSuccess: (r) => {
      const etapa = r.stage ? ` (mensagem da etapa)` : "";
      toast.success(
        r.channel === "META"
          ? `Mensagem enviada pelo WhatsApp oficial para ${r.phone}${etapa}.`
          : `Mensagem enviada para ${r.phone}.`,
      );
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao enviar a mensagem de WhatsApp.")),
    // Recarrega o funil e os cadastros antigos TAMBÉM quando falha: a recusa
    // muda o card ("não chegou", "pode ter sido enviada"), e é isso que impede
    // a segunda tentativa às cegas. Sem recarregar, o amarelo e o motivo só
    // apareceriam no próximo F5.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [...ROOT, "pipeline"] });
    },
  });
}

export function useCrmContractorSearch(q: string) {
  return useQuery({
    queryKey: [...ROOT, "contractor-search", q],
    queryFn: () => searchCrmContractors(q),
    enabled: q.trim().length >= 2,
  });
}

/** Todas as mutações do CRM; invalidam a raiz ['admin','crm'] para refletir em todas as telas. */
export function useCrmMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ROOT });

  return {
    createCompany: useMutation({
      mutationFn: (dto: CreateCompanyInput) => createCrmCompany(dto),
      onSuccess: invalidate,
    }),
    updateCompany: useMutation({
      mutationFn: ({ id, dto }: { id: string; dto: UpdateCompanyInput }) => updateCrmCompany(id, dto),
      onSuccess: invalidate,
    }),
    moveCompany: useMutation({
      mutationFn: ({ id, status, boardOrder }: { id: string; status: CrmCompanyStatus; boardOrder?: number }) =>
        moveCrmCompany(id, status, boardOrder),
      onSuccess: invalidate,
    }),
    deleteCompany: useMutation({
      mutationFn: (id: string) => deleteCrmCompany(id),
      onSuccess: invalidate,
    }),
    addContact: useMutation({
      mutationFn: ({ companyId, dto }: { companyId: string; dto: CreateContactInput }) =>
        addCrmContact(companyId, dto),
      onSuccess: invalidate,
    }),
    deleteContact: useMutation({
      mutationFn: (id: string) => deleteCrmContact(id),
      onSuccess: invalidate,
    }),
    createTask: useMutation({
      mutationFn: (dto: CreateTaskInput) => createCrmTask(dto),
      onSuccess: invalidate,
    }),
    updateTask: useMutation({
      mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskInput }) => updateCrmTask(id, dto),
      onSuccess: invalidate,
    }),
    deleteTask: useMutation({
      mutationFn: (id: string) => deleteCrmTask(id),
      onSuccess: invalidate,
    }),
    addNote: useMutation({
      mutationFn: ({ companyId, body }: { companyId: string; body: string }) => addCrmNote(companyId, body),
      onSuccess: invalidate,
    }),
    deleteNote: useMutation({
      mutationFn: (id: string) => deleteCrmNote(id),
      onSuccess: invalidate,
    }),
  };
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  listCrmCompanies,
  listCrmTasks,
  moveCrmCompany,
  searchCrmContractors,
  updateCrmCompany,
  updateCrmTask,
  type CreateCompanyInput,
  type CreateContactInput,
  type CreateTaskInput,
  type CrmCompanyStatus,
  type CrmPriority,
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

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAxiosErrorMessage } from "./use-admin-cancel-vacancy";
import {
  createCatalogCategory,
  createCatalogRole,
  deactivateCatalogCategory,
  getCatalogCategories,
  getCatalogRoles,
  removeCatalogCategoryRole,
  setCatalogCategoryRole,
  updateCatalogCategory,
  updateCatalogRole,
  type CreateCategoryInput,
  type CreateRoleInput,
  type SetCategoryRoleInput,
  type UpdateCategoryInput,
  type UpdateRoleInput,
} from "../infrastructure/catalog-api";

const KEYS = {
  categories: ["admin", "catalog", "categories"] as const,
  roles: ["admin", "catalog", "roles"] as const,
};

export function useCatalogCategories() {
  return useQuery({
    queryKey: KEYS.categories,
    queryFn: getCatalogCategories,
    staleTime: 30000,
  });
}

export function useCatalogRoles() {
  return useQuery({
    queryKey: KEYS.roles,
    queryFn: getCatalogRoles,
    staleTime: 30000,
  });
}

export function useCatalogMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: KEYS.categories });
    qc.invalidateQueries({ queryKey: KEYS.roles });
  };

  const createCategory = useMutation({
    mutationFn: (dto: CreateCategoryInput) => createCatalogCategory(dto),
    onSuccess: () => {
      invalidate();
      toast.success("Categoria criada.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao criar categoria.")),
  });

  const updateCategory = useMutation({
    mutationFn: (v: { id: string; dto: UpdateCategoryInput }) =>
      updateCatalogCategory(v.id, v.dto),
    onSuccess: () => {
      invalidate();
      toast.success("Categoria atualizada.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao atualizar categoria.")),
  });

  const deactivateCategory = useMutation({
    mutationFn: (id: string) => deactivateCatalogCategory(id),
    onSuccess: () => {
      invalidate();
      toast.success("Categoria desativada.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao desativar categoria.")),
  });

  const createRole = useMutation({
    mutationFn: (dto: CreateRoleInput) => createCatalogRole(dto),
    onSuccess: () => {
      invalidate();
      toast.success("Função criada.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao criar função.")),
  });

  const updateRole = useMutation({
    mutationFn: (v: { id: string; dto: UpdateRoleInput }) =>
      updateCatalogRole(v.id, v.dto),
    onSuccess: () => {
      invalidate();
      toast.success("Função atualizada.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao atualizar função.")),
  });

  const setCategoryRole = useMutation({
    mutationFn: (v: { categoryId: string; roleId: string; dto: SetCategoryRoleInput }) =>
      setCatalogCategoryRole(v.categoryId, v.roleId, v.dto),
    onSuccess: () => {
      invalidate();
      toast.success("Preço salvo.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao salvar preço.")),
  });

  const removeCategoryRole = useMutation({
    mutationFn: (v: { categoryId: string; roleId: string }) =>
      removeCatalogCategoryRole(v.categoryId, v.roleId),
    onSuccess: () => {
      invalidate();
      toast.success("Função removida da categoria.");
    },
    onError: (e) =>
      toast.error(getAxiosErrorMessage(e, "Erro ao remover função da categoria.")),
  });

  return {
    createCategory,
    updateCategory,
    deactivateCategory,
    createRole,
    updateRole,
    setCategoryRole,
    removeCategoryRole,
  };
}

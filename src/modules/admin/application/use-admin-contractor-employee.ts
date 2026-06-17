"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContractorEmployee,
  getContractorEmployee,
  removeContractorEmployee,
  rotateContractorEmployeePassword,
  updateContractorEmployee,
  type CreateContractorEmployeeInput,
  type UpdateContractorEmployeeInput,
} from "../infrastructure/contractor-employees-api";

const key = (ownerUserId: string) =>
  ["admin", "contractor-employee", ownerUserId] as const;

export function useAdminContractorEmployee(ownerUserId: string, enabled: boolean) {
  return useQuery({
    queryKey: key(ownerUserId),
    queryFn: () => getContractorEmployee(ownerUserId),
    enabled: enabled && !!ownerUserId,
    staleTime: 30000,
  });
}

export function useAdminContractorEmployeeMutations(ownerUserId: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: key(ownerUserId) });

  const create = useMutation({
    mutationFn: (dto: CreateContractorEmployeeInput) =>
      createContractorEmployee(ownerUserId, dto),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (dto: UpdateContractorEmployeeInput) =>
      updateContractorEmployee(ownerUserId, dto),
    onSuccess: invalidate,
  });

  const rotate = useMutation({
    mutationFn: (password: string) =>
      rotateContractorEmployeePassword(ownerUserId, password),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: () => removeContractorEmployee(ownerUserId),
    onSuccess: invalidate,
  });

  return { create, update, rotate, remove };
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAxiosErrorMessage } from "./use-admin-cancel-vacancy";
import {
  createTrainingVideo,
  deleteTrainingVideo,
  getTrainingVideos,
  updateTrainingVideo,
  type CreateTrainingVideoInput,
  type UpdateTrainingVideoInput,
} from "../infrastructure/training-videos-api";

const KEY = ["admin", "training-videos"] as const;

export function useTrainingVideos() {
  return useQuery({ queryKey: KEY, queryFn: getTrainingVideos, staleTime: 30000 });
}

export function useTrainingVideoMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: (dto: CreateTrainingVideoInput) => createTrainingVideo(dto),
    onSuccess: () => {
      invalidate();
      toast.success("Vídeo adicionado.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao adicionar vídeo.")),
  });

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTrainingVideoInput }) =>
      updateTrainingVideo(id, dto),
    onSuccess: () => {
      invalidate();
      toast.success("Vídeo atualizado.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao atualizar vídeo.")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTrainingVideo(id),
    onSuccess: () => {
      invalidate();
      toast.success("Vídeo removido.");
    },
    onError: (e) => toast.error(getAxiosErrorMessage(e, "Erro ao remover vídeo.")),
  });

  return { create, update, remove };
}

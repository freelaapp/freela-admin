"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminRemoveCandidacy } from "../infrastructure/admin-api";

export function useAdminRemoveCandidacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      vacancyId,
      candidacyId,
      reason,
    }: {
      vacancyId: string;
      candidacyId: string;
      reason?: string;
    }) => adminRemoveCandidacy(vacancyId, candidacyId, reason),
    // `onSettled` e nao `onSuccess`: recarrega a lista TAMBEM quando falha.
    //
    // A recusa mais comum aqui e 422 "a candidatura nao esta mais ativa" — e ela
    // significa exatamente que a tela esta mostrando um estado que o servidor ja
    // nao tem. Era o pior momento possivel para NAO recarregar: em 19/08/2026
    // uma profissional desistiu as 19:12, a tela seguiu exibindo-a como
    // vinculada, e o botao "Confirmar desvinculo" foi clicado DEZ vezes contra
    // um vinculo que nao existia mais.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin", "vacancies"] });
      qc.invalidateQueries({ queryKey: ["admin", "vacancy-candidacies"] });
    },
  });
}

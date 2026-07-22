"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminCreateVacancy,
  type AdminCreateVacancyInput,
} from "../infrastructure/admin-vacancies-api";

/**
 * Abre uma vaga por hora (Bares & Restaurantes) em nome de um contratante.
 *
 * A vaga já nasce PUBLICADA (status OPEN) — o painel só publica; aprovar
 * candidatura e pagar continua com o contratante. O toast de sucesso/erro fica
 * na tela que chama (padrão dos outros fluxos do painel).
 */
export function useAdminCreateVacancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminCreateVacancyInput) => adminCreateVacancy(input),
    onSuccess: () => {
      // A vaga nova entra nas listagens de vagas e nos contadores do contratante.
      qc.invalidateQueries({ queryKey: ["admin", "vacancies"] });
      qc.invalidateQueries({ queryKey: ["admin", "contractors"] });
      qc.invalidateQueries({ queryKey: ["admin", "metrics"] });
    },
  });
}

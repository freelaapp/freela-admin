"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminCreateVacancy,
  type AdminCreateVacancyInput,
} from "../infrastructure/admin-vacancies-api";
import { adminCreateCasaVacancy } from "../infrastructure/casa-vacancies-api";

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

/**
 * Abre uma vaga do Freela em Casa em nome de um contratante.
 *
 * Gêmeo do de Empresa, na base `/v1/home-services/admin`. Invalida as chaves do
 * Casa: as duas telas têm listas próprias, e cruzá-las faria uma recarregar à
 * toa enquanto a outra segue desatualizada.
 */
export function useAdminCreateCasaVacancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminCreateVacancyInput) => adminCreateCasaVacancy(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "casa-vacancies"] });
      qc.invalidateQueries({ queryKey: ["admin", "casa-contractors"] });
      qc.invalidateQueries({ queryKey: ["admin", "metrics"] });
    },
  });
}

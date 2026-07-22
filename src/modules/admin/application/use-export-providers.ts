"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { GetAdminProvidersParams } from "../infrastructure/admin-api";
import {
  fetchAllAdminProviders,
  providerSignupDate,
  type ProviderExportItem,
} from "../infrastructure/providers-export-api";
import { getAxiosErrorMessage } from "./use-admin-cancel-vacancy";
import { downloadCsv } from "@/lib/csv";
import { formatInstantDate } from "@/lib/date.utils";
import { formatPhoneBr } from "@/lib/utils";

/** "garcom_bartender" → "Garcom Bartender" (mesma regra da tabela). */
export function formatCargo(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Filtro de prioridade — client-side: a API não tem esse parâmetro. */
export type PriorityFilter = "" | "low" | "normal";

export interface ExportProvidersOptions {
  /** Mesmos filtros mandados para a listagem (sem page/limit). */
  filters: Omit<GetAdminProvidersParams, "page" | "limit">;
  priority?: PriorityFilter;
}

const CSV_HEADER = [
  "Nome",
  "E-mail",
  "Telefone",
  "Cidade",
  "UF",
  "Cargo principal",
  "Cargos disponíveis",
  "Avaliação",
  "Trabalhos concluídos",
  "Score",
  "Status",
  "Prioridade",
  "Data de cadastro (conta)",
  "Perfil B&R criado em",
];

function statusLabel(p: ProviderExportItem): string {
  if (p.banned === true) return "Banido";
  return p.isActive ? "Ativo" : "Inativo";
}

function toCsvRow(p: ProviderExportItem): (string | number)[] {
  const signup = providerSignupDate(p);
  return [
    p.name || (p.jobTitle ? `Profissional (${p.jobTitle})` : "Sem nome"),
    p.email ?? "",
    p.phone ? formatPhoneBr(p.phone) : "",
    p.city ?? "",
    p.uf ?? "",
    p.jobTitle ? formatCargo(p.jobTitle) : "",
    (p.services ?? []).map(formatCargo).join(", "),
    p.avaliacao != null && p.avaliacao > 0 ? p.avaliacao.toFixed(1).replace(".", ",") : "",
    p.trabalhos ?? 0,
    p.score ?? "",
    statusLabel(p),
    p.lowPriority === true ? "Baixa" : "Normal",
    // Quando a API ainda não manda `userCreatedAt`, a coluna da conta fica
    // vazia em vez de mentir com a data do perfil.
    signup.isAccount && signup.value ? formatInstantDate(signup.value) : "",
    p.createdAt ? formatInstantDate(p.createdAt) : "",
  ];
}

function applyPriority(rows: ProviderExportItem[], priority: PriorityFilter): ProviderExportItem[] {
  if (priority === "low") return rows.filter((r) => r.lowPriority === true);
  if (priority === "normal") return rows.filter((r) => r.lowPriority !== true);
  return rows;
}

/**
 * Exporta a listagem de freelancers para CSV **respeitando os filtros da
 * tela** e varrendo todas as páginas — não só a página visível.
 */
export function useExportProviders() {
  const [isExporting, setIsExporting] = useState(false);

  const exportCsv = useCallback(
    async ({ filters, priority = "" }: ExportProvidersOptions) => {
      if (isExporting) return;
      setIsExporting(true);
      try {
        const all = await fetchAllAdminProviders(filters);
        const rows = applyPriority(all, priority);

        if (rows.length === 0) {
          toast.info("Nenhum freelancer para exportar com os filtros atuais.");
          return;
        }

        const today = new Date().toLocaleDateString("en-CA", {
          timeZone: "America/Sao_Paulo",
        });
        downloadCsv(`freelancers-${today}.csv`, CSV_HEADER, rows.map(toCsvRow));
        toast.success(`${rows.length.toLocaleString("pt-BR")} freelancer(s) exportado(s).`);
      } catch (err) {
        toast.error(getAxiosErrorMessage(err, "Não foi possível exportar os freelancers."));
      } finally {
        setIsExporting(false);
      }
    },
    [isExporting],
  );

  return { exportCsv, isExporting };
}

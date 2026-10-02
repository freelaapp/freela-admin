"use client";

import { useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { Archive, CopyPlus, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useArchiveMarketingTemplate,
  useMarketingTemplates,
  useNewMarketingTemplateVersion,
} from "@/modules/admin/application/use-marketing-templates";
import type {
  MarketingTemplateStatus,
  MarketingTemplateView,
} from "@/modules/admin/infrastructure/marketing-templates-api";
import { MarketingStatusBadge } from "./marketing-status-badge";
import { MarketingTemplateEditor } from "./marketing-template-editor";

const EDITABLE: ReadonlySet<MarketingTemplateStatus> = new Set([
  "DRAFT",
  "REJECTED",
]);
/** Já foram para a Meta: mudar o texto é criar a próxima versão (a antiga segue valendo). */
const VERSIONABLE: ReadonlySet<MarketingTemplateStatus> = new Set([
  "PENDING",
  "APPROVED",
  "PAUSED",
  "DISABLED",
]);

/** "2 campanhas · 1 automática" ou "—". */
export function usageLabel(usage: {
  campaigns: number;
  automatic: number;
}): string {
  const parts: string[] = [];
  if (usage.campaigns > 0)
    parts.push(
      `${usage.campaigns} campanha${usage.campaigns === 1 ? "" : "s"}`,
    );
  if (usage.automatic > 0)
    parts.push(
      `${usage.automatic} automática${usage.automatic === 1 ? "" : "s"}`,
    );
  return parts.length ? parts.join(" · ") : "—";
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface Props {
  /** "Usar" num modelo aprovado: a página abre a nova campanha já com ele. */
  onUse: (template: MarketingTemplateView) => void;
}

/**
 * Aba "Modelos" das duas páginas de campanha (spec 2026-10-01 campanhas parte 1 §8.1):
 * a biblioteca com situação na Meta, motivo de recusa, uso e as ações de cada situação.
 */
export function MarketingTemplatesTab({ onUse }: Props) {
  const templates = useMarketingTemplates();
  const newVersion = useNewMarketingTemplateVersion();
  const archive = useArchiveMarketingTemplate();
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<{
    open: boolean;
    template: MarketingTemplateView | null;
  }>({
    open: false,
    template: null,
  });
  // Salvando/enviando: fechar o diálogo (overlay/Esc) perderia o resultado da chamada.
  const mutating = useIsMutating() > 0;
  const [confirmingArchive, setConfirmingArchive] = useState<string | null>(
    null,
  );

  const needle = normalize(search.trim());
  const rows = (templates.data ?? []).filter((t) =>
    normalize(t.name).includes(needle),
  );

  async function handleNewVersion(template: MarketingTemplateView) {
    try {
      const created = await newVersion.mutateAsync(template.id);
      toast.success(`Versão ${created.version} criada como rascunho.`);
      setEditor({ open: true, template: created });
    } catch (err) {
      toast.error(
        getAxiosErrorMessage(err, "Não foi possível criar a nova versão."),
      );
    }
  }

  async function handleArchive(template: MarketingTemplateView) {
    try {
      await archive.mutateAsync(template.id);
      toast.success("Modelo arquivado. Campanhas em andamento continuam.");
      setConfirmingArchive(null);
    } catch (err) {
      toast.error(
        getAxiosErrorMessage(err, "Não foi possível arquivar o modelo."),
      );
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="min-h-11"
          onClick={() => setEditor({ open: true, template: null })}
        >
          <Plus className="h-4 w-4" aria-hidden /> Novo modelo
        </Button>
        <Input
          className="min-h-11 sm:flex-1"
          placeholder="Buscar modelo"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {templates.isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando
          modelos…
        </div>
      )}
      {templates.isError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span className="flex-1">Não foi possível carregar os modelos.</span>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => templates.refetch()}
          >
            Tentar de novo
          </Button>
        </div>
      )}
      {templates.data && rows.length === 0 && (
        <p className="py-6 text-center text-sm text-neutral-500">
          Nenhum modelo encontrado.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map((template) => (
          <li
            key={template.id}
            data-testid={`template-row-${template.id}`}
            className="flex flex-col gap-3 rounded-lg border border-[#e5e5e5] bg-white p-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0 space-y-1">
              <p className="break-words font-medium text-[#1d1d1b]">
                {template.name}{" "}
                <span className="text-xs font-normal text-neutral-500">
                  v{template.version}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <MarketingStatusBadge status={template.status} />
                {template.status === "REJECTED" && template.rejectedReason && (
                  <span className="min-w-0 max-w-full break-words text-red-700">
                    Motivo: {template.rejectedReason}
                  </span>
                )}
                <span className="text-neutral-600">
                  Usado em: {usageLabel(template.usage)}
                </span>
              </div>
              {template.categoryWarning && (
                <p className="text-xs text-amber-800">
                  A Meta classificou como {template.metaCategory}: o preço por
                  mensagem muda, a campanha segue.
                </p>
              )}
              {template.ruleErrors.length > 0 && (
                <p role="alert" className="text-xs text-red-700">
                  Precisa de ajuste antes de enviar:{" "}
                  {template.ruleErrors.map((error) => error.message).join(" ")}
                </p>
              )}
              {confirmingArchive === template.id && (
                <p className="text-xs text-neutral-700">
                  Some da escolha de modelo; campanhas em andamento continuam.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2 sm:justify-end">
              {template.status === "APPROVED" && (
                <Button
                  size="sm"
                  className="min-h-11"
                  onClick={() => onUse(template)}
                >
                  Usar
                </Button>
              )}
              {EDITABLE.has(template.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setEditor({ open: true, template })}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  {template.status === "REJECTED" ? "Corrigir" : "Editar"}
                </Button>
              )}
              {VERSIONABLE.has(template.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  disabled={newVersion.isPending}
                  onClick={() => handleNewVersion(template)}
                >
                  <CopyPlus className="h-3.5 w-3.5" aria-hidden /> Nova versão
                </Button>
              )}
              {confirmingArchive === template.id ? (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="min-h-11"
                    disabled={archive.isPending}
                    onClick={() => handleArchive(template)}
                  >
                    Sim, arquivar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-11"
                    onClick={() => setConfirmingArchive(null)}
                  >
                    Não
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => setConfirmingArchive(template.id)}
                >
                  <Archive className="h-3.5 w-3.5" aria-hidden /> Arquivar
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <MarketingTemplateEditor
        open={editor.open}
        template={editor.template}
        onOpenChange={(open) => {
          if (!open && mutating) return;
          setEditor((current) => ({ ...current, open }));
        }}
      />
    </section>
  );
}

"use client";

import { useId, useState } from "react";
import axios from "axios";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getAxiosErrorMessage } from "@/modules/admin/application/use-admin-cancel-vacancy";
import {
  useAdminContractorSettings,
  useAdminContractorSettingsHistory,
  useUpdateAdminContractorSettings,
} from "@/modules/admin/application/use-admin-contractor-settings";
import type {
  ContractorSettingsView,
  PaperworkKey,
  SettingsHistoryEntry,
} from "@/modules/admin/infrastructure/contractor-settings-api";
import {
  changeSummary,
  groupHistory,
  historyChangeLine,
  historyHeadLine,
  isValidReason,
  lastChangeByKey,
  lastChangeLine,
  paperworkOptions,
  REASON_ERROR,
} from "../_lib/paperwork-presentation";
import { BillingTab } from "./billing-tab";

export type PreferencesTabKey = "burocracias" | "cobranca" | "historico";
type TabKey = PreferencesTabKey;

const TABS: { key: TabKey; label: string }[] = [
  { key: "burocracias", label: "Burocracias" },
  { key: "cobranca", label: "Cobrança" },
  { key: "historico", label: "Histórico" },
];

/** Corpo de erro da API: `{ error: { code, message } }` (filtro global). */
function getAxiosErrorCode(err: unknown): string | undefined {
  if (!axios.isAxiosError(err)) return undefined;
  const code = (err.response?.data as { error?: { code?: unknown } } | undefined)?.error?.code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Modal "Documentos e cobrança" da empresa (UX Fase 2, item 5). Fica dentro do
 * `DialogContent` da página de Empresas.
 */
export function PreferencesDialog({
  contractorUserId,
  companyName,
  companyDocument,
  blockEnabled,
  onClose,
  onEditCompany,
  initialTab = "burocracias",
}: {
  contractorUserId: string;
  companyName: string;
  /** CNPJ do cadastro, para os pré-requisitos da aba Cobrança. */
  companyDocument?: string | null;
  /** Chave do bloqueio por atraso (lista de Empresas, API-3e). */
  blockEnabled?: boolean;
  onClose: () => void;
  /** "Corrigir cadastro" da aba Cobrança: abre o modal "Editar Empresa". */
  onEditCompany?: () => void;
  /** Aba que abre primeiro ("Empresas faturadas" do Financeiro abre na Cobrança). */
  initialTab?: PreferencesTabKey;
}) {
  const baseId = useId();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const settings = useAdminContractorSettings(contractorUserId);
  const history = useAdminContractorSettingsHistory(contractorUserId);
  // Chave da API desligada: o GET avisa por `readOnlyReason`; o PATCH, por 404.
  const [disabledByPatch, setDisabledByPatch] = useState(false);
  const featureDisabled =
    disabledByPatch ||
    settings.data?.readOnlyReason === "FEATURE_DISABLED" ||
    getAxiosErrorCode(settings.error) === "FEATURE_DISABLED";

  const tabId = (key: TabKey) => `${baseId}-tab-${key}`;
  const panelId = (key: TabKey) => `${baseId}-panel-${key}`;

  // Setas trocam de aba (padrão WAI-ARIA de abas).
  const onTabsKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = TABS.findIndex((t) => t.key === tab);
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = TABS[(index + step + TABS.length) % TABS.length].key;
    setTab(next);
    document.getElementById(tabId(next))?.focus();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Documentos e cobrança · {companyName}</DialogTitle>
      </DialogHeader>
      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
        <TabsList
          role="tablist"
          aria-label="Documentos e cobrança"
          onKeyDown={onTabsKeyDown}
          className="max-w-full justify-start overflow-x-auto"
        >
          {TABS.map(({ key, label }) => (
            <TabsTrigger
              key={key}
              value={key}
              id={tabId(key)}
              role="tab"
              type="button"
              aria-selected={tab === key}
              aria-controls={panelId(key)}
              tabIndex={tab === key ? 0 : -1}
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent
          value="burocracias"
          id={panelId("burocracias")}
          role="tabpanel"
          aria-labelledby={tabId("burocracias")}
          className="mt-4"
        >
          {featureDisabled ? (
            <ComingSoon />
          ) : (
            <PaperworkTab
              contractorUserId={contractorUserId}
              settings={settings}
              history={history.data}
              onClose={onClose}
              onFeatureDisabled={() => setDisabledByPatch(true)}
            />
          )}
        </TabsContent>

        <TabsContent
          value="cobranca"
          id={panelId("cobranca")}
          role="tabpanel"
          aria-labelledby={tabId("cobranca")}
          className="mt-4"
        >
          <BillingTab
            contractorUserId={contractorUserId}
            companyName={companyName}
            companyDocument={companyDocument}
            blockEnabled={blockEnabled}
            onClose={onClose}
            onEditCompany={onEditCompany}
          />
        </TabsContent>

        <TabsContent
          value="historico"
          id={panelId("historico")}
          role="tabpanel"
          aria-labelledby={tabId("historico")}
          className="mt-4"
        >
          <HistoryTab history={history} />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ─── Aba Burocracias ─────────────────────────────────────────────────────────

function PaperworkTab({
  contractorUserId,
  settings,
  history,
  onClose,
  onFeatureDisabled,
}: {
  contractorUserId: string;
  settings: ReturnType<typeof useAdminContractorSettings>;
  history: SettingsHistoryEntry[] | undefined;
  onClose: () => void;
  onFeatureDisabled: () => void;
}) {
  if (settings.isLoading) return <SwitchesSkeleton />;
  if (settings.isError || !settings.data) {
    return (
      <LoadError
        message="Não conseguimos carregar as preferências desta empresa."
        onRetry={() => settings.refetch()}
      />
    );
  }
  return (
    <PaperworkForm
      contractorUserId={contractorUserId}
      view={settings.data}
      history={history}
      onClose={onClose}
      onFeatureDisabled={onFeatureDisabled}
    />
  );
}

function PaperworkForm({
  contractorUserId,
  view,
  history,
  onClose,
  onFeatureDisabled,
}: {
  contractorUserId: string;
  view: ContractorSettingsView;
  history: SettingsHistoryEntry[] | undefined;
  onClose: () => void;
  onFeatureDisabled: () => void;
}) {
  const baseId = useId();
  const reasonId = `${baseId}-reason`;
  const update = useUpdateAdminContractorSettings(contractorUserId);
  // Só o que o admin mexeu; o resto vale o que veio da API.
  const [draft, setDraft] = useState<Partial<Record<PaperworkKey, boolean>>>({});
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  const valueOf = (key: PaperworkKey) => draft[key] ?? view[key];
  const hasChanges = Object.keys(draft).length > 0;
  const canSave = hasChanges && isValidReason(reason) && !update.isPending;
  const lastChange = lastChangeByKey(history);

  const toggle = (key: PaperworkKey) => {
    const nextValue = !valueOf(key);
    setDraft((current) => {
      const next = { ...current };
      if (nextValue === view[key]) delete next[key];
      else next[key] = nextValue;
      return next;
    });
  };

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await update.mutateAsync({ ...draft, reason: reason.trim() });
      toast.success(`Salvo. ${changeSummary(draft)}.`);
      setDraft({});
      setReason("");
      setReasonError(null);
    } catch (err) {
      const code = getAxiosErrorCode(err);
      if (code === "REASON_REQUIRED") {
        setReasonError(REASON_ERROR);
        return;
      }
      // A chave foi desligada entre abrir e salvar: estado calmo, não erro.
      if (code === "FEATURE_DISABLED") {
        onFeatureDisabled();
        return;
      }
      toast.error(getAxiosErrorMessage(err, "Não foi possível salvar as burocracias."));
    }
  };

  return (
    <div>
      <div className="max-h-[55vh] overflow-y-auto pr-1">
        <p className="text-sm text-[#737373]">
          Valem para as vagas publicadas depois da mudança. Recibo, recibo do freelancer e nota
          fiscal da taxa sempre saem.
        </p>
        <ul className="mt-4 divide-y divide-[#e5e5e5]">
          {paperworkOptions(view.options).map(({ key, title, summary }) => {
            const titleId = `${baseId}-${key}-title`;
            const summaryId = `${baseId}-${key}-summary`;
            const change = lastChange[key];
            return (
              <li key={key} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p id={titleId} className="text-sm font-semibold text-[#1d1d1b]">
                    {title}
                  </p>
                  <p id={summaryId} className="mt-0.5 text-xs text-[#737373]">
                    {summary}
                  </p>
                  {change && (
                    <p className="mt-1 text-xs text-[#525252]">{lastChangeLine(change)}</p>
                  )}
                </div>
                <Switch
                  checked={valueOf(key)}
                  onCheckedChange={() => toggle(key)}
                  aria-labelledby={titleId}
                  aria-describedby={summaryId}
                  className="mt-0.5"
                />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor={reasonId}>Motivo da mudança (obrigatório)</Label>
        <Input
          id={reasonId}
          value={reason}
          maxLength={500}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={`${reasonId}-help`}
          onChange={(e) => {
            setReason(e.target.value);
            if (reasonError && isValidReason(e.target.value)) setReasonError(null);
          }}
          onBlur={() => {
            // Passar pelo campo vazio sem ter mudado nada não é erro.
            const untouched = !hasChanges && reason.trim().length === 0;
            setReasonError(isValidReason(reason) || untouched ? null : REASON_ERROR);
          }}
          className={cn(reasonError && "border-red-400 focus-visible:ring-red-300")}
        />
        <p id={`${reasonId}-help`} className="text-xs text-[#737373]">
          {reasonError ? (
            <span role="alert" className="text-red-600">
              {reasonError}
            </span>
          ) : (
            "Pelo menos 5 caracteres. Fica no histórico e o cliente não vê."
          )}
        </p>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={onClose}
          className="border-[#e5e5e5] text-[#737373] hover:bg-[#f7f7f7]"
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={!canSave}
          className="bg-[#eca826] text-white hover:bg-[#d4951e]"
        >
          {update.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar burocracias"
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}

/** Burocracias com a chave da API desligada: aviso calmo, sem controles. */
function ComingSoon() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#e5e5e5] bg-[#f7f7f7] p-4 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#737373]" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold text-[#1d1d1b]">Disponível em breve</p>
        <p className="text-[#525252]">
          A escolha de documentos e burocracias ainda não está ligada. Por enquanto, toda empresa
          segue o padrão: contrato assinado, RPA e lembretes do INSS ligados.
        </p>
      </div>
    </div>
  );
}

// ─── Aba Histórico ───────────────────────────────────────────────────────────

function HistoryTab({ history }: { history: ReturnType<typeof useAdminContractorSettingsHistory> }) {
  if (history.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Carregando">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (history.isError || !history.data) {
    return (
      <LoadError
        message="Não conseguimos carregar o histórico desta empresa."
        onRetry={() => history.refetch()}
      />
    );
  }
  if (history.data.length === 0) {
    return (
      <p className="text-sm text-[#737373]">
        Nenhuma mudança ainda. A empresa usa o padrão: tudo ligado e pré-pago.
      </p>
    );
  }
  return (
    <ol className="max-h-[55vh] divide-y divide-[#e5e5e5] overflow-y-auto pr-1">
      {groupHistory(history.data).map(({ id, head, entries }) => (
        <li key={id} className="space-y-0.5 py-3 text-sm">
          <p className="font-semibold text-[#1d1d1b]">{historyHeadLine(head)}</p>
          {entries.map((entry) => (
            <p key={entry.id} className="text-[#1d1d1b]">
              {historyChangeLine(entry)}
            </p>
          ))}
          {head.reason && <p className="text-[#737373]">{`Motivo: "${head.reason}"`}</p>}
        </li>
      ))}
    </ol>
  );
}

// ─── Estados de apoio ────────────────────────────────────────────────────────

function SwitchesSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
          </div>
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-[#e5e5e5] p-4 text-sm text-[#1d1d1b]">
      <p>{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="mt-3">
        Tentar de novo
      </Button>
    </div>
  );
}

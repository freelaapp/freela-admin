"use client";

import { useId, useState } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2, Smartphone, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInstantDate } from "@/lib/date.utils";
import { cn } from "@/lib/utils";
import {
  useAdminBillingMode,
  useUpdateAdminBillingMode,
} from "@/modules/admin/application/use-admin-billing-mode";
import { useAdminContractorSettings } from "@/modules/admin/application/use-admin-contractor-settings";
import { apiErrorOf } from "@/modules/admin/infrastructure/api-error";
import type {
  BillingMode,
  BillingModeSettings,
  CompanyDataField,
  UpdateBillingModeInput,
} from "@/modules/admin/infrastructure/billing-mode-api";
import {
  appUsageHint,
  BILLING_MODE_OPTION,
  BILLING_MODES,
  CYCLE_DESCRIPTION,
  currentModeLabel,
  billingChangeSummary,
  isInvoicedMode,
  missingFromServer,
  missingPhrase,
  requirementRows,
  todayKeyBrasilia,
  whatChanges,
} from "../_lib/billing-presentation";
import { isValidReason, REASON_ERROR } from "../_lib/paperwork-presentation";
import { BillingModeConfirmDialog } from "./billing-mode-confirm-dialog";

export interface BillingTabProps {
  /** User.id do dono da empresa. */
  contractorUserId: string;
  companyName: string;
  /** CNPJ como está no cadastro, só para mostrar nos pré-requisitos. */
  companyDocument?: string | null;
  /**
   * `BILLING_OVERDUE_BLOCK_ENABLED` (vem da lista de Empresas). Desligado: nada
   * ameaça bloqueio. Ausente (API sem o campo): nenhuma frase sobre o bloqueio.
   */
  blockEnabled?: boolean;
  onClose: () => void;
  /** "Corrigir cadastro": abre o modal "Editar Empresa". */
  onEditCompany?: () => void;
}

/**
 * Aba "Cobrança" do modal "Documentos e cobrança" (UX 5.3–5.5, Fase 3). O admin
 * com FINANCE escolhe pré-pago ou faturado 7/15/30, sempre com motivo. Os
 * pré-requisitos (CNPJ, endereço completo e e-mail) aparecem antes, para o 422
 * não pegar ninguém de surpresa.
 */
export function BillingTab(props: BillingTabProps) {
  const billing = useAdminBillingMode(props.contractorUserId);
  // Sem FINANCE o GET da cobrança responde 403: o modo vem das preferências.
  const forbidden = apiErrorOf(billing.error).status === 403;
  const settings = useAdminContractorSettings(props.contractorUserId, forbidden);
  // O PATCH respondeu 404 FEATURE_DISABLED: a chave foi desligada com a aba aberta.
  const [featureOff, setFeatureOff] = useState(false);

  if (billing.isLoading) return <RadiosSkeleton />;
  if (forbidden) {
    return (
      <ReadOnlyBilling
        mode={settings.data?.billingMode ?? null}
        notice="Só quem tem acesso ao Financeiro muda o modo de cobrança."
        showRadios
      />
    );
  }
  if (billing.isError || !billing.data) {
    return (
      <div className="rounded-lg border border-[#e5e5e5] p-4 text-sm text-[#1d1d1b]">
        <p>Não conseguimos carregar o modo de cobrança desta empresa.</p>
        <Button variant="outline" size="sm" onClick={() => billing.refetch()} className="mt-3">
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (featureOff || !billing.data.editable) {
    return (
      <ReadOnlyBilling
        mode={featureOff ? "PREPAID" : billing.data.mode}
        notice="O faturamento ainda não está ligado. Por enquanto, toda empresa segue no pré-pago."
      />
    );
  }
  return (
    <BillingForm
      {...props}
      view={billing.data}
      onFeatureDisabled={() => {
        setFeatureOff(true);
        void billing.refetch();
      }}
    />
  );
}

/** Modo atual em texto, com o porquê de não dar para mudar (403 ou chave desligada). */
function ReadOnlyBilling({
  mode,
  notice,
  showRadios = false,
}: {
  mode: BillingMode | null;
  notice: string;
  showRadios?: boolean;
}) {
  const baseId = useId();
  return (
    <div className="space-y-4 text-sm">
      <p className="text-[#1d1d1b]">
        <span>Modo atual:</span>{" "}
        <strong className="font-semibold">{mode ? currentModeLabel(mode) : "carregando…"}</strong>
      </p>
      <div className="flex items-start gap-3 rounded-lg border border-[#e5e5e5] bg-[#f7f7f7] p-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#737373]" aria-hidden="true" />
        <p className="text-[#525252]">{notice}</p>
      </div>
      {showRadios && (
        <fieldset disabled className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-[#1d1d1b]">Modo de cobrança</legend>
          {BILLING_MODES.map((option) => {
            const optionId = `${baseId}-${option}`;
            return (
              <div key={option} className="rounded-lg border border-[#e5e5e5] px-3 py-2.5 opacity-70">
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    id={optionId}
                    name={`${baseId}-mode`}
                    checked={mode === option}
                    readOnly
                    aria-describedby={`${optionId}-description`}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#eca826]"
                  />
                  <div className="min-w-0">
                    <label htmlFor={optionId} className="text-sm font-medium text-[#1d1d1b]">
                      {BILLING_MODE_OPTION[option]}
                    </label>
                    <p id={`${optionId}-description`} className="mt-0.5 text-xs text-[#737373]">
                      {CYCLE_DESCRIPTION[option]}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}

function BillingForm({
  view,
  contractorUserId,
  companyName,
  companyDocument,
  blockEnabled,
  onClose,
  onEditCompany,
  onFeatureDisabled,
}: BillingTabProps & { view: BillingModeSettings; onFeatureDisabled: () => void }) {
  const baseId = useId();
  const emailId = `${baseId}-email`;
  const reasonId = `${baseId}-reason`;
  const [selected, setSelected] = useState<BillingMode>(view.mode);
  const [email, setEmail] = useState(view.email ?? "");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  // 422 BILLING_REQUIRES_COMPANY_DATA: o cadastro mudou depois de a aba abrir.
  const [serverMissing, setServerMissing] = useState<CompanyDataField[] | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const update = useUpdateAdminBillingMode(contractorUserId);

  const missing = view.requirements.missing;
  const modeChanged = selected !== view.mode;
  const emailChanged = email.trim() !== (view.email ?? "");
  const hasChanges = modeChanged || emailChanged;
  const canSave = hasChanges && isValidReason(reason) && !update.isPending;
  const preview = whatChanges(view, selected, blockEnabled);
  const requirements = requirementRows(missing, {
    cnpj: companyDocument,
    contactEmail: view.contactEmail,
  });
  const appHint = appUsageHint(view.appUsage.lastAppDay, todayKeyBrasilia());

  const save = async () => {
    const patch: UpdateBillingModeInput = { reason: reason.trim() };
    if (modeChanged) patch.billingMode = selected;
    if (emailChanged) patch.billingEmail = email.trim() || null;
    try {
      const saved = await update.mutateAsync(patch);
      toast.success(`Salvo. ${billingChangeSummary(patch)}.`);
      setConfirmOpen(false);
      setSelected(saved.mode);
      setEmail(saved.email ?? "");
      setReason("");
      setReasonError(null);
      setServerMissing(null);
    } catch (err) {
      setConfirmOpen(false);
      const { code, message, extra } = apiErrorOf(err);
      if (code === "REASON_REQUIRED") {
        setReasonError(REASON_ERROR);
        return;
      }
      if (code === "BILLING_REQUIRES_COMPANY_DATA") {
        const fields = Array.isArray(extra.missing) ? (extra.missing as CompanyDataField[]) : [];
        setServerMissing(fields);
        return;
      }
      // A chave foi desligada entre abrir e salvar: estado calmo, não erro.
      if (code === "FEATURE_DISABLED") {
        onFeatureDisabled();
        return;
      }
      if (code === "BILLING_EMAIL_INVALID") {
        setEmailError(message ?? "O e-mail do financeiro não parece válido.");
        return;
      }
      toast.error(message ?? "Não foi possível salvar a cobrança.");
    }
  };

  const handleSave = () => {
    if (!canSave) return;
    // Trocar o modo pede confirmação com o efeito (UX 5.3); só o e-mail, não.
    if (modeChanged) setConfirmOpen(true);
    else void save();
  };

  return (
    <div>
      <div className="space-y-5">
        <p className="text-sm text-[#1d1d1b]">
          <span>Modo atual:</span>{" "}
          <strong className="font-semibold">{currentModeLabel(view.mode)}</strong>
          {view.since && (
            <>
              {" "}
              <span className="text-[#737373]">{`desde ${formatInstantDate(view.since)}`}</span>
            </>
          )}
        </p>

        {appHint && (
          <div className="flex items-start gap-2 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-sm text-[#b45309]">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{appHint}</p>
          </div>
        )}

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-semibold text-[#1d1d1b]">Modo de cobrança</legend>
          {BILLING_MODES.map((mode) => {
            const optionId = `${baseId}-${mode}`;
            const descriptionId = `${optionId}-description`;
            const missingId = `${optionId}-missing`;
            // Com cadastro incompleto, só dá para ficar onde está (ou voltar ao pré-pago).
            const blocked = isInvoicedMode(mode) && mode !== view.mode && missing.length > 0;
            return (
              <div
                key={mode}
                className={cn(
                  "rounded-lg border px-3 py-2.5",
                  selected === mode ? "border-[#eca826] bg-[#eca826]/5" : "border-[#e5e5e5]",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="radio"
                    id={optionId}
                    name={`${baseId}-mode`}
                    value={mode}
                    checked={selected === mode}
                    disabled={blocked}
                    onChange={() => {
                      setSelected(mode);
                      setServerMissing(null);
                    }}
                    aria-describedby={blocked ? `${descriptionId} ${missingId}` : descriptionId}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#eca826]"
                  />
                  <div className="min-w-0">
                    <label
                      htmlFor={optionId}
                      className={cn(
                        "text-sm font-medium text-[#1d1d1b]",
                        blocked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                      )}
                    >
                      {BILLING_MODE_OPTION[mode]}
                    </label>
                    <p id={descriptionId} className="mt-0.5 text-xs text-[#737373]">
                      {CYCLE_DESCRIPTION[mode]}
                    </p>
                    {blocked && (
                      <p
                        id={missingId}
                        className="mt-1 flex items-start gap-1 text-xs font-medium text-[#b45309]"
                      >
                        <AlertCircle
                          className="mt-px h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                          data-testid="missing-icon"
                        />
                        <span>{missingPhrase(missing)}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </fieldset>

        <section aria-labelledby={`${baseId}-req`} className="space-y-1.5">
          <h3 id={`${baseId}-req`} className="text-sm font-semibold text-[#1d1d1b]">
            Para faturar, o cadastro precisa de:
          </h3>
          <ul className="space-y-1">
            {requirements.map((row) => (
              <li key={row.key} className="flex items-start gap-1.5 text-sm">
                {row.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#15803d]" aria-hidden="true" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#b91c1c]" aria-hidden="true" />
                )}
                <span className={row.ok ? "text-[#1d1d1b]" : "font-medium text-[#b91c1c]"}>
                  {row.text}
                </span>
              </li>
            ))}
          </ul>
          {missing.length > 0 && onEditCompany && (
            <Button variant="outline" size="sm" onClick={onEditCompany} className="mt-1">
              Corrigir cadastro
            </Button>
          )}
        </section>

        <div className="space-y-1.5">
          <Label htmlFor={emailId}>E-mail do financeiro (opcional)</Label>
          <Input
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            maxLength={200}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={`${emailId}-help`}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(null);
            }}
            className={cn(emailError && "border-red-400 focus-visible:ring-red-300")}
          />
          <p id={`${emailId}-help`} className="text-xs text-[#737373]">
            {emailError ? (
              <span role="alert" className="text-red-600">
                {emailError}
              </span>
            ) : (
              `As faturas vão para este e-mail. Vazio: vão para o e-mail de contato (${
                view.contactEmail || "sem e-mail de contato no cadastro"
              }).`
            )}
          </p>
        </div>

        {preview && (
          <section
            aria-labelledby={`${baseId}-changes`}
            className="rounded-lg border border-[#e5e5e5] bg-[#f7f7f7] p-3 text-sm"
          >
            <h3 id={`${baseId}-changes`} className="font-semibold text-[#1d1d1b]">
              O que muda
            </h3>
            <p className="mt-1 text-[#525252]">{preview}</p>
          </section>
        )}

        {serverMissing && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-[#fecaca] bg-[#fef2f2] p-3 text-sm text-[#b91c1c]"
          >
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="space-y-2">
              <p>{missingFromServer(serverMissing)}</p>
              {onEditCompany && (
                <Button variant="outline" size="sm" onClick={onEditCompany}>
                  Corrigir cadastro
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
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
      </div>

      <DialogFooter className="sticky bottom-0 bg-white py-3 sm:static sm:py-0">
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
          {update.isPending && !confirmOpen ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Salvando...
            </>
          ) : (
            "Salvar cobrança"
          )}
        </Button>
      </DialogFooter>

      {confirmOpen && (
        <BillingModeConfirmDialog
          open
          view={view}
          next={selected}
          companyName={companyName}
          blockEnabled={blockEnabled}
          pending={update.isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void save()}
        />
      )}
    </div>
  );
}

function RadiosSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-4 w-56" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

"use client";

import { useId, useState } from "react";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAdminBillingMode } from "@/modules/admin/application/use-admin-billing-mode";
import type {
  BillingMode,
  BillingModeSettings,
} from "@/modules/admin/infrastructure/billing-mode-api";
import {
  BILLING_MODE_OPTION,
  BILLING_MODES,
  CYCLE_DESCRIPTION,
  currentModeLabel,
  isInvoicedMode,
  missingPhrase,
  requirementRows,
  whatChanges,
} from "../_lib/billing-presentation";

export interface BillingTabProps {
  /** User.id do dono da empresa. */
  contractorUserId: string;
  companyName: string;
  /** CNPJ como está no cadastro, só para mostrar nos pré-requisitos. */
  companyDocument?: string | null;
  /** `BILLING_OVERDUE_BLOCK_ENABLED` (vem da lista de Empresas). Desligado: nada ameaça bloqueio. */
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

  if (billing.isLoading) return <RadiosSkeleton />;
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
  return <BillingForm {...props} view={billing.data} />;
}

function BillingForm({
  view,
  companyDocument,
  blockEnabled = false,
  onClose,
  onEditCompany,
}: BillingTabProps & { view: BillingModeSettings }) {
  const baseId = useId();
  const emailId = `${baseId}-email`;
  const reasonId = `${baseId}-reason`;
  const [selected, setSelected] = useState<BillingMode>(view.mode);
  const [email, setEmail] = useState(view.email ?? "");
  const [reason, setReason] = useState("");

  const missing = view.requirements.missing;
  const modeChanged = selected !== view.mode;
  const emailChanged = email.trim() !== (view.email ?? "");
  const hasChanges = modeChanged || emailChanged;
  const preview = whatChanges(view, selected, blockEnabled);
  const requirements = requirementRows(missing, {
    cnpj: companyDocument,
    contactEmail: view.contactEmail,
  });

  return (
    <div>
      <div className="space-y-5">
        <p className="text-sm text-[#1d1d1b]">
          <span>Modo atual:</span>{" "}
          <strong className="font-semibold">{currentModeLabel(view.mode)}</strong>
        </p>

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
                    onChange={() => setSelected(mode)}
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
            aria-describedby={`${emailId}-help`}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p id={`${emailId}-help`} className="text-xs text-[#737373]">
            {`As faturas vão para este e-mail. Vazio: vão para o e-mail de contato (${
              view.contactEmail || "sem e-mail de contato no cadastro"
            }).`}
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

        <div className="space-y-1.5">
          <Label htmlFor={reasonId}>Motivo da mudança (obrigatório)</Label>
          <Input
            id={reasonId}
            value={reason}
            maxLength={500}
            aria-describedby={`${reasonId}-help`}
            onChange={(e) => setReason(e.target.value)}
          />
          <p id={`${reasonId}-help`} className="text-xs text-[#737373]">
            Pelo menos 5 caracteres. Fica no histórico e o cliente não vê.
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
        <Button disabled={!hasChanges} className="bg-[#eca826] text-white hover:bg-[#d4951e]">
          Salvar cobrança
        </Button>
      </DialogFooter>
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

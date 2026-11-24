import { formatInstantDateTime } from "@/lib/date.utils";
import {
  PARAMETER_REASON_MAX,
  PARAMETER_REASON_MIN,
  type PlatformParameter,
  type PlatformParameterChange,
} from "../infrastructure/platform-parameters-api";

/** Textos do cartão "Parâmetros das regras" (ux.md §1). Puro, sem React. */

/** "50%" (a unidade colada) ou "2 turnos" (separada). */
export function formatParameterValue(value: number, unit: string): string {
  if (!unit) return String(value);
  return unit === "%" ? `${value}%` : `${value} ${unit}`;
}

/** Só a chave V3 liga a regra; com ela desligada o valor fica guardado. */
export function stateLabel(param: Pick<PlatformParameter, "inEffect">): string {
  return param.inEffect ? "Em vigor" : "Guardado; regra desligada";
}

/**
 * Com o tamanho real da rodada (pré-selecionados): "5 da lista de 10" (a API arredonda para baixo:
 * `floor(tamanho x %)`). Sem ele a tela não inventa lista: só "teto 50%".
 */
export function capSeatsLabel(capPct: number, roundSize?: number | null): string {
  if (!roundSize || roundSize <= 0) return `teto ${capPct}%`;
  return `${Math.floor((roundSize * capPct) / 100)} da lista de ${roundSize}`;
}

/** `version > 0` = alguém já alterou (mesmo que o valor tenha voltado ao padrão). */
export function lastChangeLabel(param: PlatformParameter): string {
  if (param.version <= 0 || !param.updatedAt) return "Valor inicial (ninguém alterou)";
  return `Alterado por ${param.updatedBy ?? "um admin"} em ${formatInstantDateTime(param.updatedAt)}`;
}

export interface ParameterInputErrors {
  value: string | null;
  reason: string | null;
}

/** Valida o que foi digitado no diálogo (a API valida de novo: 422). */
export function validateParameterInput(
  param: Pick<PlatformParameter, "min" | "max" | "value">,
  rawValue: string,
  rawReason: string,
): ParameterInputErrors {
  const text = rawValue.trim();
  const number = text === "" ? Number.NaN : Number(text);
  let value: string | null = null;
  if (!Number.isInteger(number) || number < param.min || number > param.max) {
    value = `Use um número entre ${param.min} e ${param.max}.`;
  } else if (number === param.value) {
    value = "É o valor de hoje.";
  }
  const reasonLength = rawReason.trim().length;
  let reason: string | null = null;
  if (reasonLength < PARAMETER_REASON_MIN) {
    reason = `Conte o motivo em pelo menos ${PARAMETER_REASON_MIN} letras.`;
  } else if (reasonLength > PARAMETER_REASON_MAX) {
    reason = `O motivo pode ter até ${PARAMETER_REASON_MAX} letras.`;
  }
  return { value, reason };
}

/** "23/11/2026 14:05 · Ana Lima · 50% → 30% · "motivo"". */
export function changeLine(change: PlatformParameterChange, unit: string): string {
  const from = change.oldValue ?? change.defaultValue;
  const to = formatParameterValue(change.newValue, unit);
  const range = from === null ? to : `${formatParameterValue(from, unit)} → ${to}`;
  return `${formatInstantDateTime(change.createdAt)} · ${change.admin ?? "um admin"} · ${range} · "${change.reason}"`;
}

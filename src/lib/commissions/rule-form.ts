import type { CommissionMode, CommissionRule, CommissionRulePayload } from "./types";

export const MODE_LABEL: Record<CommissionMode, string> = {
  OFF: "Desligada",
  PERCENT_OF_FEE: "% da taxa da Freela por serviço",
  FIXED_PER_HIRE: "Valor fixo por serviço (contratação)",
  FIXED_PER_CLIENT: "Valor fixo por cliente (1º serviço)",
};

export interface RuleFormValues {
  mode: CommissionMode;
  percent: string;
  amount: string;
  durationMonths: string;
  includeEmpresa: boolean;
  includeCasa: boolean;
}

export function ruleToForm(rule: CommissionRule | null): RuleFormValues {
  if (!rule || rule.mode === "OFF") {
    return { mode: "OFF", percent: "", amount: "", durationMonths: "", includeEmpresa: true, includeCasa: false };
  }
  return {
    mode: rule.mode,
    percent: rule.percent != null ? String(rule.percent).replace(".", ",") : "",
    amount: rule.amountInCents != null ? (rule.amountInCents / 100).toFixed(2).replace(".", ",") : "",
    durationMonths: rule.durationMonths != null ? String(rule.durationMonths) : "",
    includeEmpresa: rule.includeEmpresa,
    includeCasa: rule.includeCasa,
  };
}

/**
 * "10,5" e "10.5" valem 10,5. Com vírgula, ponto é milhar ("1.234,50");
 * sem vírgula, ponto é decimal — exceto no formato de milhar ("1.000").
 */
export function parseDecimal(raw: string): number {
  const s = raw.trim();
  if (!s) return Number.NaN;
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  // Sem vírgula, "1.000" e "12.345.678" são milhar (é assim que se digita
  // dinheiro no Brasil); "10.5" e "5.50" seguem como casa decimal.
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return Number(s);
}

export type BuildRuleResult = { ok: true; payload: CommissionRulePayload } | { ok: false; error: string };

export function buildRulePayload(v: RuleFormValues): BuildRuleResult {
  if (v.mode === "OFF") {
    return {
      ok: true,
      payload: { mode: "OFF", percent: null, amountInCents: null, durationMonths: null, includeEmpresa: false, includeCasa: false },
    };
  }
  if (!v.includeEmpresa && !v.includeCasa) {
    return { ok: false, error: "Escolha pelo menos um produto: Empresa ou Em Casa." };
  }

  let durationMonths: number | null = null;
  if (v.durationMonths.trim()) {
    durationMonths = Number(v.durationMonths.trim());
    if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 120) {
      return { ok: false, error: "O prazo deve ser de 1 a 120 meses, ou vazio para sem prazo." };
    }
  }

  if (v.mode === "PERCENT_OF_FEE") {
    const percent = parseDecimal(v.percent);
    if (!Number.isFinite(percent) || percent < 0.01 || percent > 100) {
      return { ok: false, error: "Informe a porcentagem entre 0,01 e 100." };
    }
    return {
      ok: true,
      payload: { mode: v.mode, percent, amountInCents: null, durationMonths, includeEmpresa: v.includeEmpresa, includeCasa: v.includeCasa },
    };
  }

  const reais = parseDecimal(v.amount);
  const amountInCents = Math.round(reais * 100);
  if (!Number.isFinite(reais) || amountInCents < 1) {
    return { ok: false, error: "Informe um valor fixo maior que zero." };
  }
  return {
    ok: true,
    payload: { mode: v.mode, percent: null, amountInCents, durationMonths, includeEmpresa: v.includeEmpresa, includeCasa: v.includeCasa },
  };
}

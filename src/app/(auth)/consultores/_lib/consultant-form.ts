/**
 * Funções puras do formulário de consultor (criar/editar): validar os campos e
 * montar o payload da API, e o caminho inverso (consultor → valores do
 * formulário) para o modo edição. Nada aqui toca DOM, rede ou estado.
 */
import type {
  ConsultantItem,
  CreateConsultantPayload,
  UpdateConsultantPayload,
} from "@/modules/admin/infrastructure/consultants-api";

export interface ConsultantFormValues {
  name: string;
  code: string;
  city: string;
  uf: string;
  phone: string;
  email: string;
  commissionRate: string;
  notes: string;
}

export const EMPTY_CONSULTANT_FORM: ConsultantFormValues = {
  name: "",
  code: "",
  city: "",
  uf: "",
  phone: "",
  email: "",
  commissionRate: "",
  notes: "",
};

export type BuildResult<T> = { ok: true; payload: T } | { ok: false; error: string };

export function consultantToFormValues(c: ConsultantItem): ConsultantFormValues {
  return {
    name: c.name,
    code: c.code,
    city: c.city ?? "",
    uf: c.uf ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    commissionRate: c.commissionRate != null ? String(c.commissionRate) : "",
    notes: c.notes ?? "",
  };
}

interface CommonFields {
  name: string;
  email: string;
  city: string;
  uf: string;
  phone: string;
  commissionRate: number | undefined;
  notes: string;
}

/** Validação comum aos dois modos. Nome e e-mail (login do consultor) são obrigatórios. */
function validateCommon(v: ConsultantFormValues): BuildResult<CommonFields> {
  const name = v.name.trim();
  if (!name) return { ok: false, error: "Informe o nome do consultor." };

  const email = v.email.trim();
  if (!email) {
    return {
      ok: false,
      error: "Informe o e-mail (login do consultor). A senha temporária é enviada nele.",
    };
  }

  const uf = v.uf.trim().toUpperCase();
  if (uf && !/^[A-Z]{2}$/.test(uf)) {
    return { ok: false, error: "UF inválida (use 2 letras, ex.: SP)." };
  }

  const rawRate = v.commissionRate.trim();
  const commissionRate = rawRate ? Number(rawRate.replace(",", ".")) : undefined;
  if (
    commissionRate !== undefined &&
    (Number.isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100)
  ) {
    return { ok: false, error: "Comissão deve ser um número entre 0 e 100." };
  }

  return {
    ok: true,
    payload: {
      name,
      email,
      city: v.city.trim(),
      uf,
      phone: v.phone.trim(),
      commissionRate,
      notes: v.notes.trim(),
    },
  };
}

/** Criação: opcionais vazios são omitidos; código vazio → a API gera a partir do nome. */
export function buildCreateConsultantPayload(
  v: ConsultantFormValues,
): BuildResult<CreateConsultantPayload> {
  const common = validateCommon(v);
  if (!common.ok) return common;
  const f = common.payload;
  const code = v.code.trim().toUpperCase();

  return {
    ok: true,
    payload: {
      name: f.name,
      ...(code ? { code } : {}),
      ...(f.city ? { city: f.city } : {}),
      ...(f.uf ? { uf: f.uf } : {}),
      ...(f.phone ? { phone: f.phone } : {}),
      email: f.email,
      ...(f.commissionRate !== undefined ? { commissionRate: f.commissionRate } : {}),
      ...(f.notes ? { notes: f.notes } : {}),
    },
  };
}

/**
 * Edição: manda todos os campos editáveis — opcional apagado vai como `null` para
 * limpar o valor salvo. O código não vai (só leitura: links `?ref=CÓDIGO` já
 * distribuídos parariam de atribuir) e o status tem botão próprio.
 */
export function buildUpdateConsultantPayload(
  v: ConsultantFormValues,
): BuildResult<UpdateConsultantPayload> {
  const common = validateCommon(v);
  if (!common.ok) return common;
  const f = common.payload;

  return {
    ok: true,
    payload: {
      name: f.name,
      email: f.email,
      city: f.city || null,
      uf: f.uf || null,
      phone: f.phone || null,
      commissionRate: f.commissionRate ?? null,
      notes: f.notes || null,
    },
  };
}

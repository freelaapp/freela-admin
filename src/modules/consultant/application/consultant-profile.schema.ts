import { z } from "zod";
import { isValidBrPhoneDigits, nationalPhoneDigits } from "./phone-mask";
import type { UpdateConsultantProfilePayload } from "@/modules/consultant/domain/types";

export const consultantProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Informe seu nome (mínimo 3 letras).")
    .max(120, "Nome muito longo (máximo 120 caracteres)."),
  phone: z.string().refine((value) => {
    const digits = nationalPhoneDigits(value);
    return digits.length === 0 || isValidBrPhoneDigits(digits);
  }, "Informe o telefone com DDD, ex.: (11) 98888-7777."),
});

export type ConsultantProfileFormValues = z.infer<typeof consultantProfileSchema>;

/** Telefone vazio não vai no PATCH (a API não apaga telefone); preenchido vai em E.164. */
export function toUpdateProfilePayload(
  values: ConsultantProfileFormValues,
): UpdateConsultantProfilePayload {
  const digits = nationalPhoneDigits(values.phone);
  return { name: values.name.trim(), ...(digits ? { phone: `+55${digits}` } : {}) };
}

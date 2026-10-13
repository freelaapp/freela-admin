/**
 * CEP do "Editar Empresa": o faturado exige o endereço completo, e um CEP
 * truncado iria parar na fatura e na NFS-e. Máscara 00000-000, só números.
 */
export function formatCepMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

/** Vazio = não mexer (não é erro). Com números, precisam ser 8. */
export function cepError(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return null;
  return digits.length === 8 ? null : "O CEP tem 8 números, por exemplo 36000-000.";
}

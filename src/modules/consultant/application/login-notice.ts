export const CONSULTANT_DEACTIVATED_NOTICE = "Seu acesso de consultor foi desativado.";

/** Aviso do login do consultor a partir do `?motivo=` que o redirect do 401 põe. */
export function loginNoticeFromSearch(search: string): string | null {
  const reason = new URLSearchParams(search).get("motivo");
  return reason === "desativado" ? CONSULTANT_DEACTIVATED_NOTICE : null;
}

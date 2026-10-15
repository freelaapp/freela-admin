/** `?motivo=` do login do painel depois da troca de senha. */
export const PASSWORD_CHANGED_REASON = "senha-trocada";
export const ADMIN_PASSWORD_CHANGED_NOTICE = "Senha trocada. Entre com a nova senha.";

/**
 * Aviso do login do painel a partir do `?motivo=`. Lido no cliente (sem
 * `useSearchParams`, que pediria Suspense no build estático) — mesmo padrão do
 * login do consultor.
 */
export function adminLoginNoticeFromSearch(search: string): string | null {
  const reason = new URLSearchParams(search).get("motivo");
  return reason === PASSWORD_CHANGED_REASON ? ADMIN_PASSWORD_CHANGED_NOTICE : null;
}

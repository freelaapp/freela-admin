/**
 * Monta o link de indicação (`/cadastro?ref=CÓDIGO`) do consultor.
 *
 * A base do app público é configurável por env (`NEXT_PUBLIC_WEB_APP_URL`); na ausência
 * dela, deriva da URL da API removendo o subdomínio `api.` (ex.:
 * `https://api.freelaservicosapp.com.br` → `https://freelaservicosapp.com.br`). Se nada
 * estiver disponível, retorna um caminho relativo.
 */
export interface ReferralLinkEnv {
  webAppUrl?: string;
  apiUrl?: string;
}

export function deriveWebAppBaseUrl(env: ReferralLinkEnv): string {
  if (env.webAppUrl) return env.webAppUrl.replace(/\/+$/, "");
  if (env.apiUrl) {
    return env.apiUrl.replace(/\/+$/, "").replace(/(^https?:\/\/)api\./, "$1");
  }
  return "";
}

export function buildReferralLink(code: string, env: ReferralLinkEnv): string {
  const base = deriveWebAppBaseUrl(env);
  const path = `/cadastro?ref=${encodeURIComponent(code)}`;
  return base ? `${base}${path}` : path;
}

/**
 * Monta o link de cadastro por parceria (`/cadastro?parceria=CÓDIGO`).
 * Mesma derivação de base do link de consultor, trocando o parâmetro de query.
 */
export function buildPartnershipLink(code: string, env: ReferralLinkEnv): string {
  const base = deriveWebAppBaseUrl(env);
  const path = `/cadastro?parceria=${encodeURIComponent(code)}`;
  return base ? `${base}${path}` : path;
}

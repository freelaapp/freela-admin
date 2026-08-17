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

/**
 * Link público da vaga fixa, para o admin divulgar.
 *
 * É a MESMA rota que o aviso de WhatsApp usa (`buildFixedJobsUrl` no
 * `FixedJobPostNotifierService`): a vaga direta, não o mural. O mural filtra por
 * proximidade, então quem abrisse o link da lista podia cair numa tela que não
 * mostrava a vaga anunciada — foi o que aconteceu com as vagas do GENDAI em
 * Jundiaí (14/08/2026). A tela da vaga não filtra.
 */
export function buildFixedJobLink(postId: string, env: ReferralLinkEnv): string {
  const base = deriveWebAppBaseUrl(env);
  const path = `/freelancer/vagas-fixas/${encodeURIComponent(postId)}`;
  return base ? `${base}${path}` : path;
}

/**
 * Decodifica o payload de um JWT sem verificar assinatura (uso client-side,
 * apenas para leitura de claims como `exp`).
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/**
 * Folga para relógio do cliente adiantado: sem ela, um desvio maior que o
 * restante do TTL descartaria no hydrate uma sessão que o servidor ainda
 * aceita — a cada reload. Errar para o lado "não expirado" é seguro: o
 * interceptor de 401 dos clients é quem dá a palavra final.
 */
const EXP_LEEWAY_MS = 5 * 60 * 1000;

/**
 * `true` somente quando o token possui claim `exp` e ela já passou além da
 * folga. Token ilegível ou sem `exp` retorna `false` (na dúvida, quem decide
 * é o backend — o interceptor de 401 cobre esse caso).
 */
export function isJwtExpired(token: string | undefined | null): boolean {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number") return false;
  return exp * 1000 + EXP_LEEWAY_MS <= Date.now();
}

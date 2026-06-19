import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

/**
 * Base da API para os clients admin/consultor.
 *
 * Observação importante: estes clients usam `NEXT_PUBLIC_API_URL` (default :3001),
 * que é uma env DISTINTA da `NEXT_PUBLIC_API_BASE_URL` (default :3000) usada pelo
 * client canônico em `http-client.ts` e pelo rewrite do `next.config.ts`. Manter
 * a env original aqui preserva o comportamento exato dos clients hand-rolled que
 * esta factory substitui — não unificar as duas envs sem uma migração consciente.
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/** Chave de sessão padrão do staff/admin no localStorage. */
const DEFAULT_TOKEN_STORAGE_KEY = "authUser";

export interface AuthedClientOptions {
  /**
   * Chave do localStorage de onde ler `{ accessToken }`. Default: `authUser`
   * (sessão do staff). O consultor usa `consultantUser` (sessão isolada).
   */
  tokenStorageKey?: string;
  /**
   * Quando `true`, instala o interceptor de resposta que, em 401, limpa a
   * sessão e redireciona para `/login`. Default `false` para preservar o
   * comportamento dos clients admin/consultor, que NÃO tinham esse interceptor.
   */
  redirectOn401?: boolean;
}

/** Anexa o Bearer token lido de `tokenStorageKey` na requisição. */
function attachToken(tokenStorageKey: string) {
  return (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(tokenStorageKey);
      if (stored) {
        try {
          const session = JSON.parse(stored);
          if (session.accessToken) {
            config.headers.Authorization = `Bearer ${session.accessToken}`;
          }
        } catch {
          // ignore
        }
      }
    }
    return config;
  };
}

/**
 * Factory única para os clients axios autenticados do admin/consultor.
 *
 * Centraliza: a base-URL (env), o header JSON, o interceptor de request que
 * injeta o Bearer token, e (opcional) o interceptor de 401. `pathPrefix` é
 * concatenado à base — ex.: `/v1/bars-restaurants/admin`, `/v1`, `/v1/consultants`.
 */
export function createAuthedClient(
  pathPrefix: string,
  options: AuthedClientOptions = {},
): AxiosInstance {
  const { tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY, redirectOn401 = false } =
    options;

  const instance = axios.create({
    baseURL: `${API_BASE_URL}${pathPrefix}`,
    headers: {
      "Content-Type": "application/json",
    },
  });

  instance.interceptors.request.use(attachToken(tokenStorageKey));

  if (redirectOn401) {
    instance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;
        if (!originalRequest) return Promise.reject(error);

        if (error.response?.status === 401) {
          if (typeof window !== "undefined") {
            localStorage.removeItem(tokenStorageKey);
            window.location.href = "/login";
          }
        }

        return Promise.reject(error);
      },
    );
  }

  return instance;
}

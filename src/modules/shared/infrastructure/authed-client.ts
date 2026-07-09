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
   * Quando `true` (default), instala o interceptor de resposta que, em 401,
   * limpa a sessão e redireciona para `loginPath`. Sem isso, uma sessão com
   * token expirado prende o usuário: os dados falham em silêncio e a página
   * de login fica inalcançável (o guard vê `authUser` e volta pro dashboard).
   */
  redirectOn401?: boolean;
  /**
   * Rota da tela de login para onde o interceptor de 401 redireciona.
   * Default `/login` (staff/admin); o consultor usa `/consultor/login`.
   */
  loginPath?: string;
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
  const {
    tokenStorageKey = DEFAULT_TOKEN_STORAGE_KEY,
    redirectOn401 = true,
    loginPath = "/login",
  } = options;

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

        if (error.response?.status === 401 && typeof window !== "undefined") {
          // Só redireciona em leitura (GET/HEAD): são as queries das telas que
          // prendem o usuário com sessão vencida. Em mutation, o erro sobe para
          // a página — redirecionar aqui descartaria um formulário preenchido
          // (re-logar em outra aba e tentar de novo continua funcionando, pois
          // o token é relido do localStorage a cada request). E já na tela de
          // login (ex.: senha errada no POST /login do consultor), não navega
          // nem limpa nada — deixa a página tratar o erro.
          const method = (originalRequest.method ?? "get").toLowerCase();
          const isReadRequest = method === "get" || method === "head";
          if (isReadRequest && window.location.pathname !== loginPath) {
            localStorage.removeItem(tokenStorageKey);
            window.location.assign(loginPath);
          }
        }

        return Promise.reject(error);
      },
    );
  }

  return instance;
}

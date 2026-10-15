export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN" | "RECRUITER" | string;
  accessToken: string;
  refreshToken: string;
  /**
   * Entrou com a senha temporária (claim `mustChangePassword` do token): o
   * painel só libera depois da troca. Lido UMA vez, no login; a troca (ou a
   * API antiga sem a rota) grava `false` aqui. Ausente = sessão antiga.
   */
  mustChangePassword?: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

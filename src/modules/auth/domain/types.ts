export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SUPER_ADMIN" | "RECRUITER" | string;
  accessToken: string;
  refreshToken: string;
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

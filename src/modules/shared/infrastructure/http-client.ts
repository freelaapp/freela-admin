import axios, { AxiosError, AxiosInstance } from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

function createHttpClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15_000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  instance.interceptors.request.use((config) => {
    const auth = typeof window !== "undefined" ? localStorage.getItem("authUser") : null;
    if (auth) {
      try {
        const parsed = JSON.parse(auth);
        if (parsed.accessToken) {
          config.headers.Authorization = `Bearer ${parsed.accessToken}`;
        }
      } catch {
        // ignore
      }
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config;
      if (!originalRequest) return Promise.reject(error);

      if (error.response?.status === 401) {
        // TODO: implementar refresh token
        if (typeof window !== "undefined") {
          localStorage.removeItem("authUser");
          window.location.href = "/login";
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
}

export const api = createHttpClient();
export const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
  },
});

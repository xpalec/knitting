import { apiPost } from "./client";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export const authApi = {
  login: (payload: LoginPayload) =>
    apiPost<AuthUser>("/api/v1/auth/login", payload),
  logout: () => apiPost<void>("/api/v1/auth/logout", {}),
  refresh: () => apiPost<AuthUser>("/api/v1/auth/refresh", {}),
};

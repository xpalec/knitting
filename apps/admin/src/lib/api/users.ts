import { apiGet, apiGetWithMeta, apiPost, apiPatch } from "./client";
import type { ApiResponse } from "./client";

export type UserRole = "admin" | "editor" | "reviewer";

export interface AdminUser {
  id: string;
  name?: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  role?: UserRole;
}

export interface CreateUserPayload {
  name?: string;
  email: string;
  password: string;
  role: UserRole;
}

export const usersApi = {
  listUsers: (params?: ListUsersParams): Promise<ApiResponse<AdminUser[]>> =>
    apiGetWithMeta<AdminUser[]>("/api/v1/admin/users", params as Record<string, unknown>),

  createUser: (payload: CreateUserPayload): Promise<AdminUser> =>
    apiPost<AdminUser>("/api/v1/admin/users", payload),

  updateUserRole: (id: string, role: UserRole): Promise<AdminUser> =>
    apiPatch<AdminUser>(`/api/v1/admin/users/${id}`, { role }),
};

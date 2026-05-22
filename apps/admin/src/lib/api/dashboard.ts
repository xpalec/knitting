import { apiGet } from "./client";

export interface DashboardStats {
  publishedEntries: number;
  pendingQueueItems: number;
  enCoverage: number;
  plCoverage: number;
}

export const dashboardApi = {
  getStats: (): Promise<DashboardStats> =>
    apiGet<DashboardStats>("/api/v1/admin/stats"),
};

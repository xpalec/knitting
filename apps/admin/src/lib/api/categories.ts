import { apiGet } from "./client";

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parent_id?: string;
  children?: CategoryNode[];
}

export const categoriesApi = {
  getCategoryTree: (): Promise<CategoryNode[]> =>
    apiGet<CategoryNode[]>("/api/v1/categories/tree"),
};

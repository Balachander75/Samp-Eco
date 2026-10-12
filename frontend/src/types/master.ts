export interface PlantItem {
  id: number;
  code: string;
  name: string;
  location?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlantForm {
  code: string;
  name: string;
  location?: string;
  isActive?: boolean;
}

export interface CustomerItem {
  id: number;
  name: string;
  country?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BindingHierarchyResponse {
  binding1_options: string[];
  binding2_options?: string[];
  hierarchy: Record<string, string[]>;
}

export interface ProductSearchResult {
  id: number;
  sr_number: string;
  material_code: string;
  product_description: string;
  customer?: string;
  target_plant?: string;
  source_sample_code?: string;
  binding_type_1?: string;
  binding_type_2?: string;
  product_category?: string;
  product_sub_category?: string;
  product_third_category?: string;
  c1_caliper_weight?: string;
  c2_material_type?: string;
  c2_cover_finish?: string;
  details_count?: number;
}

export interface ProductCategoryItem {
  name: string;
  subcategories: Array<{
    name: string;
    third_categories: string[];
  }>;
}

export interface ProductCategoriesResponse {
  categories: ProductCategoryItem[];
  flat_categories: string[];
}


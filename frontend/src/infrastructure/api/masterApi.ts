import { apiFetch, API_BASE_URL, createApiHeaders } from "./client";
import {
  PlantItem,
  CreatePlantForm,
  CustomerItem,
  BindingHierarchyResponse,
  ProductSearchResult,
} from "@/features/sample-requests/types";
import { ProductCategoriesResponse } from "@/types/master";

export interface BusinessYearOption {
  year: string;
  label: string;
  is_current: boolean;
  count: number;
}
export interface BusinessYearsResponse {
  current_business_year: string;
  total_records: number;
  years: BusinessYearOption[];
}

export interface ProductDetailItem {
  id: number;
  sampleRequestId: number;
  className: string;
  characteristicName: string;
  value: string | null;
  uom: string | null;
  options: string[];
}

export interface ProductCharacteristicItem {
  id: number;
  class_name: string;
  characteristic_name: string;
  sequence: number;
  uom: string | null;
  options: string[];
  is_active: boolean;
}

export const PRODUCT_CLASS_ORDER = [
  "PRODUCT_CLASS",
  "NB_BINDING",
  "NB_COMPONENT_1",
  "NB_COMPONENT_2",
  "NB_COMPONENT_3",
  "NB_COMPONENT_4",
  "NB_COMPONENT_5",
  "NB_COMPONENT_6",
  "NB_COMPONENT_7",
  "NB_DIVIDER_SPECS",
  "PACKAGING_SPECS_1",
  "PACKING_DETAILS",
  "RULLING_DETAILS",
] as const;

// In-memory caches for master data performance
const BINDING_CACHE_TTL_MS = 30_000;
let bindingHierarchyCache: { data: BindingHierarchyResponse; expiresAt: number } | null = null;

const PRODUCT_CHARACTERISTICS_CACHE_TTL_MS = 5 * 60_000;
let productCharacteristicsCache: { data: ProductCharacteristicItem[]; expiresAt: number } | null = null;
let productCharacteristicsRequest: Promise<ProductCharacteristicItem[]> | null = null;

function normalizeCharacteristics(data: ProductCharacteristicItem[]): ProductCharacteristicItem[] {
  return data.map((item) => ({
    ...item,
    options: Array.isArray(item.options) ? item.options : [],
  }));
}

function getCachedProductCharacteristics(): ProductCharacteristicItem[] | null {
  if (!productCharacteristicsCache || productCharacteristicsCache.expiresAt <= Date.now()) {
    return null;
  }
  return productCharacteristicsCache.data;
}

function sortProductClasses(classNames: string[]): string[] {
  return classNames.sort((a, b) => {
    const aIndex = PRODUCT_CLASS_ORDER.indexOf(a as typeof PRODUCT_CLASS_ORDER[number]);
    const bIndex = PRODUCT_CLASS_ORDER.indexOf(b as typeof PRODUCT_CLASS_ORDER[number]);
    return (aIndex === -1 ? PRODUCT_CLASS_ORDER.length : aIndex) - (bIndex === -1 ? PRODUCT_CLASS_ORDER.length : bIndex);
  });
}

export function invalidateProductCharacteristicsCache(): void {
  productCharacteristicsCache = null;
  bindingHierarchyCache = null;
}

// ==========================================
// BUSINESS YEARS API
// ==========================================

export async function fetchBusinessYearsApi(): Promise<BusinessYearsResponse> {
  try {
    const data = await apiFetch<BusinessYearsResponse>("/api/v1/sample-requests/business-years");
    return data;
  } catch (err) {
    console.error("Error fetching business years:", err);
    return {
      current_business_year: "2026-2027",
      total_records: 0,
      years: [
        { year: "2026-2027", label: "BY 2026-2027", is_current: true, count: 0 },
        { year: "2025-2026", label: "BY 2025-2026", is_current: false, count: 0 },
      ],
    };
  }
}

// ==========================================
// PLANTS MASTER API
// ==========================================

export async function fetchPlantsApi(): Promise<PlantItem[]> {
  try {
    const data = await apiFetch<any[]>("/api/v1/plants");
    return data.map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      location: p.location || undefined,
      isActive: p.is_active,
      createdBy: p.created_by,
      createdAt: p.created_at ? p.created_at.split("T")[0] : "",
      updatedAt: p.updated_at ? p.updated_at.split("T")[0] : "",
    }));
  } catch (err) {
    console.error("Error fetching plants from API:", err);
    return [];
  }
}

export async function createPlantApi(payload: CreatePlantForm, createdBy: string = "Admin"): Promise<PlantItem | null> {
  try {
    const p = await apiFetch<any>("/api/v1/plants", {
      method: "POST",
      jsonBody: {
        code: payload.code,
        name: payload.name,
        location: payload.location,
        created_by: createdBy,
        is_active: payload.isActive ?? true,
      },
    });
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      location: p.location || undefined,
      isActive: p.is_active,
      createdBy: p.created_by,
      createdAt: p.created_at ? p.created_at.split("T")[0] : "",
      updatedAt: p.updated_at ? p.updated_at.split("T")[0] : "",
    };
  } catch (err) {
    console.error("Error adding plant:", err);
    throw err;
  }
}

// ==========================================
// CUSTOMERS MASTER API
// ==========================================

export async function fetchCustomersApi(search?: string): Promise<CustomerItem[]> {
  try {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    const data = await apiFetch<any[]>(`/api/v1/customers${query}`);
    return data.map((c: any) => ({
      id: c.id,
      name: c.name,
      country: c.country,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  } catch (err) {
    console.error("Error fetching customers:", err);
    return [];
  }
}

export async function createCustomerApi(payload: { name: string; country?: string }): Promise<CustomerItem | null> {
  try {
    const c = await apiFetch<any>("/api/v1/customers", {
      method: "POST",
      jsonBody: {
        name: payload.name,
        country: payload.country,
      },
    });
    return {
      id: c.id,
      name: c.name,
      country: c.country,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  } catch (err) {
    console.error("Error creating customer:", err);
    return null;
  }
}

// ==========================================
// PRODUCT CHARACTERISTICS & DETAILS API
// ==========================================

export async function fetchAllProductCharacteristics(): Promise<ProductCharacteristicItem[]> {
  const cached = getCachedProductCharacteristics();
  if (cached) return cached;
  if (productCharacteristicsRequest) return productCharacteristicsRequest;

  productCharacteristicsRequest = apiFetch<ProductCharacteristicItem[]>("/api/v1/product-characteristics")
    .then((data) => {
      const normalized = normalizeCharacteristics(data);
      productCharacteristicsCache = {
        data: normalized,
        expiresAt: Date.now() + PRODUCT_CHARACTERISTICS_CACHE_TTL_MS,
      };
      return normalized;
    })
    .finally(() => {
      productCharacteristicsRequest = null;
    });

  return productCharacteristicsRequest;
}

export async function fetchProductDetailsApi(
  sampleRequestId: number | string,
  excludeNa: boolean = false
): Promise<ProductDetailItem[]> {
  try {
    const endpoint = `/api/v1/product-characteristics/details/${sampleRequestId}${excludeNa ? "?exclude_na=true" : ""}`;
    const [rawDetails, characteristics] = await Promise.all([
      apiFetch<any[]>(endpoint).catch(() => []),
      fetchAllProductCharacteristics(),
    ]);

    const data = Array.isArray(rawDetails) ? rawDetails : [];
    const detailByCharKey = new Map<string, any>();
    for (const d of data) {
      detailByCharKey.set(`${d.class_name}::${d.characteristic_name}`.toLowerCase(), d);
    }

    const configuredClasses = new Set<string>();
    for (const d of data) {
      const val = (d.value || "").toString().trim().toUpperCase();
      if (val && !["NA", "N/A", "NAN", "NULL", "NONE", "—", "-"].includes(val)) {
        if (d.class_name) configuredClasses.add(d.class_name.toUpperCase());
      }
    }

    const presentClasses =
      configuredClasses.size > 0
        ? configuredClasses
        : new Set(data.map((d: any) => (d.class_name || "").toUpperCase()).filter(Boolean));

    const targetCharacteristics =
      excludeNa && presentClasses.size > 0
        ? characteristics.filter((c) => presentClasses.has(c.class_name.toUpperCase()))
        : characteristics;

    const mergedList: ProductDetailItem[] = targetCharacteristics.map((charItem, index) => {
      const key = `${charItem.class_name}::${charItem.characteristic_name}`.toLowerCase();
      const existing = detailByCharKey.get(key);
      if (existing) {
        return {
          id: existing.id,
          sampleRequestId: existing.sample_request_id ?? (Number(sampleRequestId) || 0),
          className: existing.class_name || charItem.class_name,
          characteristicName: existing.characteristic_name || charItem.characteristic_name,
          value: existing.value !== null && existing.value !== undefined ? String(existing.value) : "NA",
          uom: existing.uom || charItem.uom,
          options: Array.isArray(charItem.options) ? charItem.options : [],
        };
      }
      return {
        id: -1 - index,
        sampleRequestId: Number(sampleRequestId) || 0,
        className: charItem.class_name,
        characteristicName: charItem.characteristic_name,
        value: "NA",
        uom: charItem.uom,
        options: Array.isArray(charItem.options) ? charItem.options : [],
      };
    });

    const seenKeys = new Set(targetCharacteristics.map((c) => `${c.class_name}::${c.characteristic_name}`.toLowerCase()));
    for (const d of data) {
      const key = `${d.class_name}::${d.characteristic_name}`.toLowerCase();
      const dVal = (d.value || "").toString().trim().toUpperCase();
      const isConfigured = dVal && !["NA", "N/A", "NAN", "NULL", "NONE", "—", "-"].includes(dVal);
      const isPresentClass = d.class_name && presentClasses.has(d.class_name.toUpperCase());
      if (!seenKeys.has(key) && (isPresentClass || isConfigured)) {
        mergedList.push({
          id: d.id,
          sampleRequestId: d.sample_request_id ?? (Number(sampleRequestId) || 0),
          className: d.class_name,
          characteristicName: d.characteristic_name,
          value: d.value !== null && d.value !== undefined ? String(d.value) : "NA",
          uom: d.uom,
          options: [],
        });
      }
    }

    const sequenceByKey = new Map(characteristics.map((item) => [`${item.class_name}::${item.characteristic_name}`.toLowerCase(), item.sequence]));

    mergedList.sort((a, b) => {
      const aClass = PRODUCT_CLASS_ORDER.indexOf(a.className as typeof PRODUCT_CLASS_ORDER[number]);
      const bClass = PRODUCT_CLASS_ORDER.indexOf(b.className as typeof PRODUCT_CLASS_ORDER[number]);
      const classSort = (aClass === -1 ? PRODUCT_CLASS_ORDER.length : aClass) - (bClass === -1 ? PRODUCT_CLASS_ORDER.length : bClass);
      if (classSort !== 0) return classSort;
      const aSequence = sequenceByKey.get(`${a.className}::${a.characteristicName}`.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      const bSequence = sequenceByKey.get(`${b.className}::${b.characteristicName}`.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      return aSequence - bSequence || String(a.characteristicName).localeCompare(String(b.characteristicName));
    });

    if (excludeNa) {
      return mergedList.filter((item) => {
        const v = (item.value || "").trim().toUpperCase();
        return v && !["NA", "N/A", "NAN", "NULL", "NONE", "—", "-"].includes(v);
      });
    }

    return mergedList;
  } catch (err) {
    console.error("Error fetching product details:", err);
    return [];
  }
}

/** Load the full read-only specification catalog for one saved product record. */
export async function fetchProductInspectionDetailsApi(
  sampleRequestId: number | string
): Promise<ProductDetailItem[]> {
  const [rawDetails, characteristics] = await Promise.all([
    apiFetch<any[]>(`/api/v1/product-characteristics/details/${sampleRequestId}`),
    fetchAllProductCharacteristics(),
  ]);
  const savedDetails = Array.isArray(rawDetails) ? rawDetails : [];
  const detailByCharKey = new Map<string, any>();
  for (const detail of savedDetails) {
    detailByCharKey.set(
      `${detail.class_name || detail.className}::${detail.characteristic_name || detail.characteristicName}`.toLowerCase(),
      detail
    );
  }

  const merged: ProductDetailItem[] = characteristics.map((characteristic, index) => {
    const key = `${characteristic.class_name}::${characteristic.characteristic_name}`.toLowerCase();
    const saved = detailByCharKey.get(key);
    if (saved) detailByCharKey.delete(key);
    return {
      id: saved?.id ?? -1 - index,
      sampleRequestId: Number(sampleRequestId) || 0,
      className: saved?.class_name || saved?.className || characteristic.class_name,
      characteristicName: saved?.characteristic_name || saved?.characteristicName || characteristic.characteristic_name,
      value: saved?.value === null || saved?.value === undefined ? null : String(saved.value),
      uom: saved?.uom || characteristic.uom,
      options: Array.isArray(characteristic.options) ? characteristic.options : [],
    };
  });

  for (const [key, saved] of detailByCharKey) {
    const [className = "", characteristicName = ""] = key.split("::");
    merged.push({
      id: saved.id,
      sampleRequestId: Number(sampleRequestId) || 0,
      className: saved.class_name || saved.className || className,
      characteristicName: saved.characteristic_name || saved.characteristicName || characteristicName,
      value: saved.value === null || saved.value === undefined ? null : String(saved.value),
      uom: saved.uom || null,
      options: [],
    });
  }

  const sequenceByKey = new Map(
    characteristics.map((item) => [`${item.class_name}::${item.characteristic_name}`.toLowerCase(), item.sequence])
  );
  merged.sort((a, b) => {
    const aClass = PRODUCT_CLASS_ORDER.indexOf(a.className as typeof PRODUCT_CLASS_ORDER[number]);
    const bClass = PRODUCT_CLASS_ORDER.indexOf(b.className as typeof PRODUCT_CLASS_ORDER[number]);
    const classSort = (aClass === -1 ? PRODUCT_CLASS_ORDER.length : aClass) - (bClass === -1 ? PRODUCT_CLASS_ORDER.length : bClass);
    if (classSort !== 0) return classSort;
    const aSequence = sequenceByKey.get(`${a.className}::${a.characteristicName}`.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const bSequence = sequenceByKey.get(`${b.className}::${b.characteristicName}`.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    return aSequence - bSequence || a.characteristicName.localeCompare(b.characteristicName);
  });
  return merged;
}

export interface ProductInspectionImage {
  url: string;
  label: string;
}

/** Load image references on demand so material search does not ship image payloads. */
export async function fetchProductInspectionImagesApi(
  sampleRequestId: number | string
): Promise<ProductInspectionImage[]> {
  const record = await apiFetch<any>(`/api/v1/sample-requests/${sampleRequestId}`);
  const rawReferences: Array<{ value: unknown; fallbackLabel: string }> = [
    ...(record?.product_image_path
      ? [{ value: { url: record.product_image_path, name: "Product image" }, fallbackLabel: "Product image" }]
      : []),
    ...(Array.isArray(record?.reference_images)
      ? record.reference_images.map((value: unknown, index: number) => ({ value, fallbackLabel: `Reference image ${index + 1}` }))
      : []),
  ];
  const images = new Map<string, ProductInspectionImage>();
  for (const { value: reference, fallbackLabel } of rawReferences) {
    const url = typeof reference === "string"
      ? reference.trim()
      : reference && typeof reference === "object"
        ? String((reference as any).url || (reference as any).path || (reference as any).image || "").trim()
        : "";
    if (!url || images.has(url)) continue;
    const objectName = reference && typeof reference === "object"
      ? String((reference as any).name || (reference as any).label || "").trim()
      : "";
    images.set(url, {
      url,
      label: objectName || fallbackLabel,
    });
  }
  return [...images.values()];
}

export async function saveProductDetailsApi(
  sampleRequestId: number,
  details: { className: string; characteristicName: string; value: string | null; uom?: string | null }[]
): Promise<boolean> {
  try {
    await apiFetch("/api/v1/product-characteristics/details", {
      method: "POST",
      jsonBody: {
        sample_request_id: sampleRequestId,
        details: details.map((d) => ({
          class_name: d.className,
          characteristic_name: d.characteristicName,
          value: d.value && d.value.trim() ? d.value.trim() : null,
          uom: d.uom || null,
        })),
      },
    });
    return true;
  } catch (err) {
    console.error("Failed to save product details:", err);
    return false;
  }
}

// ==========================================
// BINDING HIERARCHY & SEARCH APIS
// ==========================================

export async function fetchBindingHierarchyApi(
  category?: string,
  subCategory?: string,
  thirdCategory?: string
): Promise<BindingHierarchyResponse> {
  if (!category && !subCategory && !thirdCategory && bindingHierarchyCache && bindingHierarchyCache.expiresAt > Date.now()) {
    return bindingHierarchyCache.data;
  }
  try {
    const params = new URLSearchParams();
    if (category && category.trim()) params.append("category", category.trim());
    if (subCategory && subCategory.trim()) params.append("sub_category", subCategory.trim());
    if (thirdCategory && thirdCategory.trim()) params.append("third_category", thirdCategory.trim());
    const queryStr = params.toString() ? `?${params.toString()}` : "";
    const data = await apiFetch<BindingHierarchyResponse>(`/api/v1/product-characteristics/binding-hierarchy${queryStr}`);
    if (!category && !subCategory && !thirdCategory) {
      bindingHierarchyCache = { data, expiresAt: Date.now() + BINDING_CACHE_TTL_MS };
    }
    return data;
  } catch (err) {
    console.error("Error fetching binding hierarchy:", err);
    return { binding1_options: [], hierarchy: {} };
  }
}

export async function fetchProductClassesApi(): Promise<string[]> {
  try {
    const cached = getCachedProductCharacteristics();
    if (cached) {
      return sortProductClasses([...new Set(cached.map((item) => item.class_name))]);
    }
    const data = await apiFetch<Array<{ class_name?: string }>>("/api/v1/product-characteristics/classes");
    const classNames = data.map((item) => item.class_name).filter(Boolean) as string[];
    return sortProductClasses(classNames);
  } catch {
    return [];
  }
}

export async function fetchCharacteristicsByClassApi(className: string): Promise<ProductCharacteristicItem[]> {
  try {
    const cached = getCachedProductCharacteristics();
    if (cached) return cached.filter((item) => item.class_name === className);
    const data = await apiFetch<ProductCharacteristicItem[]>(`/api/v1/product-characteristics?class_name=${encodeURIComponent(className)}`);
    return normalizeCharacteristics(data);
  } catch {
    return [];
  }
}

export async function createProductCharacteristicApi(
  payload: Omit<ProductCharacteristicItem, "id" | "is_active"> & { is_active?: boolean }
): Promise<ProductCharacteristicItem> {
  const characteristic = await apiFetch<ProductCharacteristicItem>("/api/v1/product-characteristics", {
    method: "POST",
    jsonBody: payload,
  });
  invalidateProductCharacteristicsCache();
  return characteristic;
}

export async function updateProductCharacteristicApi(
  id: number,
  payload: Partial<Omit<ProductCharacteristicItem, "id">>
): Promise<ProductCharacteristicItem> {
  const characteristic = await apiFetch<ProductCharacteristicItem>(`/api/v1/product-characteristics/${id}`, {
    method: "PATCH",
    jsonBody: payload,
  });
  invalidateProductCharacteristicsCache();
  return characteristic;
}

export async function addCharacteristicOptionApi(id: number, option: string): Promise<ProductCharacteristicItem> {
  const characteristic = await apiFetch<ProductCharacteristicItem>(`/api/v1/product-characteristics/${id}/options`, {
    method: "POST",
    jsonBody: { option },
  });
  invalidateProductCharacteristicsCache();
  return characteristic;
}

export async function searchProductsByMaterialApi(code?: string): Promise<ProductSearchResult[]> {
  if (!code?.trim()) return [];
  try {
    const endpoint = `/api/v1/sample-requests/search-materials?query=${encodeURIComponent(code.trim())}`;
    const data = await apiFetch<ProductSearchResult[]>(endpoint);
    return data || [];
  } catch (err) {
    console.error("Error searching product by material:", err);
    return [];
  }
}

export async function searchProductsByBindingApi(
  b1?: string,
  b2?: string,
  c1Caliper?: string,
  c2Material?: string,
  c2Finish?: string,
  limit?: number,
  category?: string,
  subCategory?: string,
  thirdCategory?: string
): Promise<ProductSearchResult[]> {
  try {
    const hasFilter =
      (b1 && b1.trim()) ||
      (b2 && b2.trim()) ||
      (category && category.trim()) ||
      (subCategory && subCategory.trim()) ||
      (thirdCategory && thirdCategory.trim());
    if (!hasFilter) return [];

    const params = new URLSearchParams();
    if (b1 && b1.trim()) params.append("b1", b1.trim());
    if (b2 && b2.trim()) params.append("b2", b2.trim());
    if (category && category.trim()) params.append("category", category.trim());
    if (subCategory && subCategory.trim()) params.append("sub_category", subCategory.trim());
    if (thirdCategory && thirdCategory.trim()) params.append("third_category", thirdCategory.trim());
    if (c1Caliper && c1Caliper.trim()) params.append("c1_caliper", c1Caliper.trim());
    if (c2Material && c2Material.trim()) params.append("c2_material", c2Material.trim());
    if (c2Finish && c2Finish.trim()) params.append("c2_finish", c2Finish.trim());
    if (limit != null) params.append("limit", String(Math.max(1, Math.floor(limit))));

    const endpoint = `/api/v1/product-characteristics/filter-by-binding?${params.toString()}`;
    const results = await apiFetch<ProductSearchResult[]>(endpoint);
    return results || [];
  } catch (err) {
    console.error("Error filtering products by binding:", err);
    return [];
  }
}

// ==========================================
// USERS & TEAMS MANAGEMENT API
// ==========================================

export interface UserItem {
  id: number;
  name: string;
  userid: string;
  email: string;
  role: string;
  subRole?: string;
  team?: string;
  isTeamHead: boolean;
  plantCode?: string;
  plantCodes?: string[];
  isActive: boolean;
  createdAt?: string;
}

export interface CreateUserPayload {
  name: string;
  userid: string;
  email: string;
  password: string;
  role?: string;
  sub_role?: string;
  team?: string;
  is_team_head?: boolean;
  plant_code?: string;
  plant_codes?: string[];
  is_active?: boolean;
}

export interface UpdateUserPayload {
  name?: string;
  userid?: string;
  email?: string;
  password?: string;
  role?: string;
  sub_role?: string;
  team?: string;
  is_team_head?: boolean;
  plant_code?: string;
  plant_codes?: string[];
  is_active?: boolean;
}

export async function fetchUsersApi(team?: string): Promise<UserItem[]> {
  try {
    const query = team && team.toUpperCase() !== "ALL" ? `?team=${encodeURIComponent(team)}` : "";
    const data = await apiFetch<any[]>(`/api/v1/users${query}`);
    return (data || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      userid: u.userid,
      email: u.email,
      role: u.role,
      subRole: u.sub_role || undefined,
      team: u.team || undefined,
      isTeamHead: Boolean(u.is_team_head),
      plantCode: u.plant_code || undefined,
      plantCodes: u.plant_codes || (u.plant_code ? [u.plant_code] : []),
      isActive: Boolean(u.is_active),
      createdAt: u.created_at ? String(u.created_at).split("T")[0] : undefined,
    }));
  } catch (err) {
    console.error("Error fetching users:", err);
    return [];
  }
}

export async function createUserApi(payload: CreateUserPayload): Promise<UserItem> {
  const u = await apiFetch<any>("/api/v1/users", {
    method: "POST",
    jsonBody: payload,
  });
  return {
    id: u.id,
    name: u.name,
    userid: u.userid,
    email: u.email,
    role: u.role,
    subRole: u.sub_role || undefined,
    team: u.team || undefined,
    isTeamHead: Boolean(u.is_team_head),
    plantCode: u.plant_code || undefined,
    plantCodes: u.plant_codes || (u.plant_code ? [u.plant_code] : []),
    isActive: Boolean(u.is_active),
    createdAt: u.created_at ? String(u.created_at).split("T")[0] : undefined,
  };
}

export async function updateUserApi(id: number, payload: UpdateUserPayload): Promise<UserItem> {
  const u = await apiFetch<any>(`/api/v1/users/${id}`, {
    method: "PATCH",
    jsonBody: payload,
  });
  return {
    id: u.id,
    name: u.name,
    userid: u.userid,
    email: u.email,
    role: u.role,
    subRole: u.sub_role || undefined,
    team: u.team || undefined,
    isTeamHead: Boolean(u.is_team_head),
    plantCode: u.plant_code || undefined,
    plantCodes: u.plant_codes || (u.plant_code ? [u.plant_code] : []),
    isActive: Boolean(u.is_active),
    createdAt: u.created_at ? String(u.created_at).split("T")[0] : undefined,
  };
}

export async function deleteUserApi(id: number): Promise<boolean> {
  try {
    await apiFetch(`/api/v1/users/${id}`, { method: "DELETE" });
    return true;
  } catch (err) {
    console.error("Error deleting user:", err);
    return false;
  }
}

export async function updatePlantApi(
  id: number,
  payload: { code?: string; name?: string; location?: string; is_active?: boolean }
): Promise<PlantItem> {
  const p = await apiFetch<any>(`/api/v1/plants/${id}`, {
    method: "PATCH",
    jsonBody: payload,
  });
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    location: p.location || undefined,
    isActive: p.is_active,
    createdBy: p.created_by,
    createdAt: p.created_at ? p.created_at.split("T")[0] : "",
    updatedAt: p.updated_at ? p.updated_at.split("T")[0] : "",
  };
}

export async function deletePlantApi(id: number): Promise<boolean> {
  try {
    await apiFetch(`/api/v1/plants/${id}`, { method: "DELETE" });
    return true;
  } catch (err) {
    console.error("Error deleting plant:", err);
    return false;
  }
}

export async function fetchProductCategoriesApi(): Promise<ProductCategoriesResponse> {
  try {
    const data = await apiFetch<ProductCategoriesResponse>("/api/v1/master/product-categories");
    return data || { categories: [], flat_categories: [] };
  } catch (err) {
    console.error("Error fetching product categories:", err);
    return { categories: [], flat_categories: [] };
  }
}


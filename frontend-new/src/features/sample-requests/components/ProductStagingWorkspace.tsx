import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { UserProfile } from "@/features/auth";
import {
  searchProductsByMaterialApi,
  searchProductsByBindingApi,
  fetchBindingHierarchyApi,
  fetchProductCategoriesApi,
  updateSampleRequestApi,
  releaseSampleRequestIdsApi,
  fetchProductDetailsApi,
} from "@/infrastructure/api";
import { ProductSearchResult, BindingHierarchyResponse, SampleRequestItem } from "../types";
import type { DesignFollowupArtwork } from "../types";
import { ProductCategoryItem } from "@/types/master";
import { useMasterData } from "../hooks/useMasterData";
import { getCurrentBusinessYear } from "@/lib/businessYear";
import { compressReferenceImage } from "@/lib/referenceImage";
import { autoSaveStagedProductsToDraft } from "../utils/autoSaveDraft";
import { getAutomaticSampleRoute } from "../utils/sampleRouting";
import { isMockupCreativeCharacteristic } from "./staging/mockupCreativeFields";
import { requestPostDesignDeliverablesApi } from "@/infrastructure/api/sampleRequestsApi";

// Re-export domain types and helpers for backward compatibility
export type { DeliverableScopeId, DeliverableDefinition, StagedProductItem } from "../types/staging";
export { DELIVERABLES, cleanPlantName } from "../types/staging";
import { DeliverableScopeId, ReferenceImageScopeId, ScopeReferenceImages, StagedProductItem } from "../types/staging";

// Sub-components
import {
  StagingWorkspaceHeader,
  StagingProductList,
  AddProductScopesStep,
  AddProductDesignStep,
  AddProductSamplingStep,
} from "./staging";

const StagedProductDrawer = React.lazy(() =>
  import("./staging/StagedProductDrawer").then((m) => ({ default: m.StagedProductDrawer }))
);
const StagedProductEditModal = React.lazy(() =>
  import("./staging/StagedProductEditModal").then((m) => ({ default: m.StagedProductEditModal }))
);
const CatalogProductInspectModal = React.lazy(() =>
  import("./staging/CatalogProductInspectModal").then((m) => ({ default: m.CatalogProductInspectModal }))
);

export interface ProductStagingWorkspaceProps {
  user?: UserProfile | null;
}

export const ProductStagingWorkspace: React.FC<ProductStagingWorkspaceProps> = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { customers, plants, error: masterDataError } = useMasterData();
  const marketingPlantCode = plants.find((plant) => String(plant.code) === "1505")?.code || "1505";
  const routeState = location.state as {
    designMockupHandoff?: {
      designRequestId: number;
      sourceSrNumber?: string;
      designs: DesignFollowupArtwork[];
    };
    customer?: string;
    programName?: string;
    programYear?: string;
    year?: string;
    targetPlant?: string;
    feasibilityRequestId?: number | string;
    feasibilityRequestType?: "sample" | "mockup";
    feasibilityRequestTypes?: Array<"sample" | "mockup">;
    feasibilityRequestCode?: string;
    feasibilityDescription?: string;
    feasibilityRequiredDate?: string;
    feasibilityReferenceLinks?: string[];
    parentRequestId?: string | number;
    parentSrNumber?: string;
    parentRequestTypes?: string[];
    parentMockupWorkflowState?: SampleRequestItem["mockupWorkflowState"];
    parentCreationMode?: string;
    openedFromDraft?: boolean;
  } | null;
  const designMockupHandoff = routeState?.designMockupHandoff;
  const feasibilityStorageId = routeState?.feasibilityRequestId
    ? String(routeState.feasibilityRequestId).replace(/^feasibility-/, "")
    : "";
  const stagedProductsStorageKey = designMockupHandoff
    ? "samp_design_mockup_handoff_products:" + designMockupHandoff.designRequestId
    : feasibilityStorageId
      ? `samp_feasibility_staged_products:${feasibilityStorageId}`
    : "samp_active_staged_products";
  const programContextStorageKey = designMockupHandoff
    ? "samp_design_mockup_handoff_program:" + designMockupHandoff.designRequestId
    : feasibilityStorageId
      ? `samp_feasibility_program:${feasibilityStorageId}`
    : "samp_active_program_form";

  // Load Program Setup from location state or cached session
  const [programContext, setProgramContext] = useState(() => {
    const state = routeState;

    if (designMockupHandoff || state?.customer || state?.programName || state?.feasibilityRequestId) {
      return {
        customer: state?.customer || "",
        programName: state?.programName || "",
        programYear: state?.programYear || "2026",
        year: state?.year || getCurrentBusinessYear(),
        targetPlant: state?.targetPlant || "",
        parentRequestId: state?.parentRequestId,
        parentSrNumber: state?.parentSrNumber || "",
        parentRequestTypes: state?.parentRequestTypes || [],
        parentMockupWorkflowState: state?.parentMockupWorkflowState,
        parentCreationMode: state?.parentCreationMode,
        openedFromDraft: Boolean(state?.openedFromDraft),
        feasibilityRequestId: state?.feasibilityRequestId,
        feasibilityRequestType: state?.feasibilityRequestType,
        feasibilityRequestTypes: state?.feasibilityRequestTypes,
        feasibilityReferenceLinks: state?.feasibilityReferenceLinks || [],
        feasibilityRequestCode: state?.feasibilityRequestCode || "",
        feasibilityDescription: state?.feasibilityDescription || "",
        feasibilityRequiredDate: state?.feasibilityRequiredDate || "",
      };
    }

    try {
      const cached = sessionStorage.getItem("samp_active_program_form");
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          customer: parsed.customer || "",
          programName: parsed.programName || "",
          programYear: parsed.programYear || "2026",
          year: parsed.year || getCurrentBusinessYear(),
          targetPlant: parsed.targetPlant || "",
          parentRequestId: parsed.parentRequestId,
          parentSrNumber: parsed.parentSrNumber || "",
          parentRequestTypes: parsed.parentRequestTypes || [],
          parentMockupWorkflowState: parsed.parentMockupWorkflowState,
          parentCreationMode: parsed.parentCreationMode,
          openedFromDraft: Boolean(parsed.openedFromDraft),
          feasibilityRequestId: parsed.feasibilityRequestId,
          feasibilityRequestType: parsed.feasibilityRequestType,
          feasibilityRequestTypes: parsed.feasibilityRequestTypes,
          feasibilityReferenceLinks: parsed.feasibilityReferenceLinks || [],
          feasibilityRequestCode: parsed.feasibilityRequestCode || "",
          feasibilityDescription: parsed.feasibilityDescription || "",
          feasibilityRequiredDate: parsed.feasibilityRequiredDate || "",
        };
      }
    } catch {
      // Fallback
    }

    return {
      customer: "",
      programName: "",
      programYear: "2026",
      year: getCurrentBusinessYear(),
      targetPlant: "",
      parentRequestId: undefined,
      parentSrNumber: "",
      parentRequestTypes: [],
      parentMockupWorkflowState: undefined,
      parentCreationMode: undefined,
      openedFromDraft: false,
      feasibilityRequestId: undefined,
      feasibilityRequestType: undefined,
      feasibilityRequestTypes: undefined,
      feasibilityReferenceLinks: [],
      feasibilityRequestCode: "",
      feasibilityDescription: "",
      feasibilityRequiredDate: "",
    };
  });
  const feasibilityHandoff = Boolean(
    programContext.feasibilityRequestId &&
    ((programContext.feasibilityRequestTypes && programContext.feasibilityRequestTypes.length > 0) || programContext.feasibilityRequestType)
  );

  // Staged Products in current batch (persisted across page reloads)
  const [stagedProducts, setStagedProducts] = useState<StagedProductItem[]>(() => {
    try {
      const cached = sessionStorage.getItem(stagedProductsStorageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback
    }
    return [];
  });

  // Sync stagedProducts to sessionStorage whenever updated
  useEffect(() => {
    sessionStorage.setItem(stagedProductsStorageKey, JSON.stringify(stagedProducts));
  }, [stagedProducts, stagedProductsStorageKey]);

  // Add Product Modal & Flow State
  const [isAddModalOpen, setIsAddModalOpen] = useState(Boolean(designMockupHandoff || feasibilityHandoff));
  const [addModalStep, setAddModalStep] = useState<
    "scopes" | "design_brief" | "sampling_config" | "product_search"
  >(designMockupHandoff || feasibilityHandoff ? "sampling_config" : "scopes");
  const [selectedScopes, setSelectedScopes] = useState<DeliverableScopeId[]>(
    designMockupHandoff
      ? ["mockup"]
      : feasibilityHandoff
      ? ((programContext.feasibilityRequestTypes && programContext.feasibilityRequestTypes.length > 0
          ? programContext.feasibilityRequestTypes
          : [programContext.feasibilityRequestType!]) as DeliverableScopeId[])
      : [],
  );
  const [scopeTimestamps, setScopeTimestamps] = useState<Record<string, string>>({});

  // Design Fields
  const [designDesc, setDesignDesc] = useState("");
  const [designCount, setDesignCount] = useState<number | "">("");
  const [designDueDate, setDesignDueDate] = useState("");
  const [designTrend, setDesignTrend] = useState("");
  const [designAudience, setDesignAudience] = useState("");
  const [designRemarks, setDesignRemarks] = useState("");

  // Reference Attachments (Up to 2 images and 1 link)
  const [uploadedImages, setUploadedImages] = useState<Array<{ id: string; url: string; name: string; size?: string }>>([]);
  const [webLinks, setWebLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState<string>("");
  const [mediaTab, setMediaTab] = useState<"files" | "links">("files");
  const [modalError, setModalError] = useState<string | null>(null);
  const [scopeReferenceImages, setScopeReferenceImages] = useState<ScopeReferenceImages>({});
  const [compressingScopeImages, setCompressingScopeImages] = useState<Set<ReferenceImageScopeId>>(() => new Set());

  const updateScopeReferenceImages = (scope: ReferenceImageScopeId, images: NonNullable<ScopeReferenceImages[ReferenceImageScopeId]>) => {
    setScopeReferenceImages((previous) => ({ ...previous, [scope]: images }));
  };

  const setScopeImageProcessing = (scope: ReferenceImageScopeId, processing: boolean) => {
    setCompressingScopeImages((previous) => {
      const next = new Set(previous);
      if (processing) next.add(scope);
      else next.delete(scope);
      return next;
    });
  };

  // Sampling / Specification Configuration State
  const [sampleType, setSampleType] = useState<"full" | "partial">("full");
  const [partialRequirements, setPartialRequirements] = useState("");
  const [samplingSearchMode, setSamplingSearchMode] = useState<"new" | "material_code" | "binding">(
    designMockupHandoff || (feasibilityHandoff && programContext.feasibilityRequestType === "mockup") ? "material_code" : "new",
  );
  const [designNeeded, setDesignNeeded] = useState<boolean | null>(designMockupHandoff ? false : null);
  const [marketingShutterstockNo, setMarketingShutterstockNo] = useState("");
  const [marketingMockupRemark, setMarketingMockupRemark] = useState("");

  // Commercial Taxonomy Hierarchy State
  const [productCategories, setProductCategories] = useState<ProductCategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [selectedThirdCategory, setSelectedThirdCategory] = useState("");

  // Mode A: Search by Material Code
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [materialSearchResults, setMaterialSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearchingMaterial, setIsSearchingMaterial] = useState(false);
  const [selectedDbSample, setSelectedDbSample] = useState<ProductSearchResult | null>(null);
  const materialSearchSequenceRef = useRef(0);

  // Mode B: Search by Binding (Binding 1 & Binding 2)
  const [bindingHierarchy, setBindingHierarchy] = useState<BindingHierarchyResponse>({
    binding1_options: [],
    binding2_options: [],
    hierarchy: {},
  });
  const [isLoadingBindingHierarchy, setIsLoadingBindingHierarchy] = useState(false);
  const bindingHierarchySequenceRef = useRef(0);
  const [selectedBinding1, setSelectedBinding1] = useState("");
  const [selectedBinding2, setSelectedBinding2] = useState("");
  const [bindingSearchResults, setBindingSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearchingBinding, setIsSearchingBinding] = useState(false);
  const bindingSearchSequenceRef = useRef(0);

  // Staged product description for sampling item
  const [samplingDescription, setSamplingDescription] = useState(feasibilityHandoff ? programContext.feasibilityDescription || "" : "");
  const [newProductCustomDetails, setNewProductCustomDetails] = useState<NonNullable<StagedProductItem["customDetails"]>>([]);
  const [, setCatalogProductDescription] = useState("");
  const [qtyDesignCosting, setQtyDesignCosting] = useState("");
  const [qtyForSampling, setQtyForSampling] = useState("1");
  const [qtyForMockup, setQtyForMockup] = useState("1");
  const [mockupRequiredDate, setMockupRequiredDate] = useState(
    feasibilityHandoff && programContext.feasibilityRequestType === "mockup" ? programContext.feasibilityRequiredDate || "" : "",
  );
  const [customerProductCode, setCustomerProductCode] = useState("");
  const [costingBarcode, setCostingBarcode] = useState("");
  const [brandName, setBrandName] = useState("");
  const [unitPcPack, setUnitPcPack] = useState("PC");
  const [qtyPerPack, setQtyPerPack] = useState("1");
  const [costingRequiredDate, setCostingRequiredDate] = useState("");
  const [creativeInputNeeded, setCreativeInputNeeded] = useState(false);
  const [creativeInputRemark, setCreativeInputRemark] = useState("");

  // Toast / Notifications
  const [toastMsg, setToastMsg] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);
  const [isCompressingReferenceImages, setIsCompressingReferenceImages] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [inspectingProduct, setInspectingProduct] = useState<StagedProductItem | null>(null);
  const [inspectingCatalogProduct, setInspectingCatalogProduct] = useState<ProductSearchResult | null>(null);
  const [editingProduct, setEditingProduct] = useState<StagedProductItem | null>(null);
  const [editingDetailsProduct, setEditingDetailsProduct] = useState<StagedProductItem | null>(null);
  const [editingMockupOnly, setEditingMockupOnly] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Auto-save refs to guarantee zero data loss if user navigates away or switches tabs
  const hasAutoSavedRef = useRef(false);
  const stagedProductsRef = useRef(stagedProducts);
  const stagedProductUpdateQueueRef = useRef<Promise<void>>(Promise.resolve());
  stagedProductsRef.current = stagedProducts;
  const programContextRef = useRef(programContext);
  programContextRef.current = programContext;

  const showToast = (text: string, tone: "success" | "error" = "success") => {
    setToastMsg({ text, tone });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Sync to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(programContextStorageKey, JSON.stringify(programContext));
  }, [programContext, programContextStorageKey]);

  // If user navigates away / unmounts with staged products that haven't been saved yet, auto-save to draft
  useEffect(() => {
    return () => {
      if (!hasAutoSavedRef.current && stagedProductsRef.current.length > 0) {
        const cached = sessionStorage.getItem(stagedProductsStorageKey);
        if (cached) {
          hasAutoSavedRef.current = true;
          autoSaveStagedProductsToDraft(
            stagedProductsRef.current,
            programContextRef.current,
            user
          ).then((res) => {
            if (res.success) {
              sessionStorage.removeItem(stagedProductsStorageKey);
              sessionStorage.removeItem(programContextStorageKey);
              window.dispatchEvent(
                new CustomEvent("app:show-toast", {
                  detail: {
                    message: `✓ Auto-saved ${res.count} staged product(s) for "${res.programName || res.customer}" directly to Drafts.`,
                    tone: "success",
                  },
                })
              );
            } else {
              window.dispatchEvent(new CustomEvent("app:show-toast", {
                detail: { message: res.error || "Draft save did not finish. Reopen Product Staging to retry.", tone: "error" },
              }));
            }
          }).catch((err) => {
            console.error("Unmount auto-save draft error:", err);
          });
        }
      }
    };
  }, [user, stagedProductsStorageKey, programContextStorageKey]);

  // Master data fallback only when context is empty
  useEffect(() => {
    if (!customers.length || !plants.length) return;
    setProgramContext((prev) => ({
      ...prev,
      customer: prev.customer || (customers[0]?.name ?? ""),
      targetPlant: prev.targetPlant || (plants.find((plant) => String(plant.code) === "1505")?.name ?? "Navneet - Khaniwade"),
    }));
  }, [customers, plants]);

  useEffect(() => {
    if (masterDataError) showToast(masterDataError, "error");
  }, [masterDataError]);

  useEffect(() => {
    fetchProductCategoriesApi()
      .then((res: any) => {
        if (res?.categories) {
          setProductCategories(res.categories);
        }
      })
      .catch((err: any) => console.error("Failed to load product categories:", err));
  }, []);

  const resetSamplingState = () => {
    setSampleType("full");
    setPartialRequirements("");
    setSamplingSearchMode("new");
    setDesignNeeded(null);
    setMarketingShutterstockNo("");
    setMarketingMockupRemark("");
    setMaterialSearchQuery("");
    setSelectedDbSample(null);
    setSelectedCategory("");
    setSelectedSubCategory("");
    setSelectedThirdCategory("");
    setNewProductCustomDetails([]);
    setSelectedBinding1("");
    setSelectedBinding2("");
    setSamplingDescription("");
    setCatalogProductDescription("");
    setQtyDesignCosting("");
    setQtyForSampling("1");
    setQtyForMockup("1");
    setMockupRequiredDate("");
    setCustomerProductCode("");
    setCostingBarcode("");
    setBrandName("");
    setUnitPcPack("PC");
    setQtyPerPack("1");
    setCostingRequiredDate("");
    setCreativeInputNeeded(false);
    setCreativeInputRemark("");
    setBindingSearchResults([]);
    setModalError(null);
    setScopeReferenceImages({});
    setCompressingScopeImages(new Set());
  };

  const resetDesignState = () => {
    setDesignDesc("");
    setDesignCount("");
    setDesignDueDate("");
    setDesignTrend("");
    setDesignAudience("");
    setDesignRemarks("");
    setUploadedImages([]);
    setWebLinks([]);
    setLinkInput("");
    setMediaTab("files");
    setModalError(null);
  };

  const clearMockupDesignChoice = () => {
    if (designMockupHandoff || !selectedScopes.includes("mockup")) return;
    setDesignNeeded(null);
    setMarketingShutterstockNo("");
    setMarketingMockupRemark("");
    setSelectedScopes((prev) => prev.filter((scope) => scope !== "design"));
    setScopeTimestamps((prev) => {
      const next = { ...prev };
      delete next.design;
      return next;
    });
    resetDesignState();
  };

  // Ask which deliverable is needed before opening the product form.
  const handleOpenAddProduct = () => {
    if (feasibilityHandoff) {
      setIsAddModalOpen(true);
      return;
    }
    setEditingProduct(null);
    setAddModalStep("scopes");
    setSelectedScopes([]);
    setSamplingSearchMode("new");
    setScopeTimestamps({});
    resetDesignState();
    resetSamplingState();
    setIsAddModalOpen(true);
  };

  // Table edits for mockups stay focused on the three handoff fields.
  const handleEditProduct = (item: StagedProductItem, mockupOnly = false) => {
    if (item.scopes.includes("design") && (item.scopes.length === 1 || item.designMetadata)) {
      setEditingProduct(item);
      setSelectedScopes([...item.scopes]);
      setDesignDesc(item.productDescription || "");
      setDesignCount(item.designMetadata?.numberOfDesigns || 1);
      setDesignDueDate(item.designMetadata?.designRequiredDate || item.sampleRequiredDate || "");
      setDesignTrend(
        item.designMetadata?.trend ||
        item.customDetails?.find((d) => (d.characteristicName || d.characteristic_name)?.toUpperCase() === "TREND")?.value ||
        ""
      );
      setDesignAudience(
        item.designMetadata?.targetAudience ||
        item.customDetails?.find((d) => (d.characteristicName || d.characteristic_name)?.toUpperCase() === "TARGET AUDIENCE")?.value ||
        ""
      );
      setDesignRemarks(item.designMetadata?.remarks || item.mockupMetadata?.marketingRemark || "");
      setUploadedImages(item.designMetadata?.images ? [...item.designMetadata.images] : []);
      setWebLinks(item.designMetadata?.webLinks ? [...item.designMetadata.webLinks] : []);
      setLinkInput("");
      setMediaTab("files");
      setModalError(null);
      setAddModalStep("design_brief");
      setIsAddModalOpen(true);
      return;
    }
    setEditingDetailsProduct(item);
    setEditingMockupOnly(mockupOnly);
  };

  const handleUpdateStagedProduct = async (
    item: StagedProductItem,
    updates: Partial<StagedProductItem>
  ): Promise<boolean> => {
    const operation = stagedProductUpdateQueueRef.current.then(async () => {
      setIsSavingDetails(true);
      const nextProducts = stagedProductsRef.current.map((product) => product.id === item.id
        ? {
            ...product,
            ...updates,
            ...(updates.mockupMetadata && {
              mockupMetadata: { ...product.mockupMetadata, ...updates.mockupMetadata },
            }),
          }
        : product
      );
      stagedProductsRef.current = nextProducts;
      setStagedProducts(nextProducts);
      sessionStorage.setItem(stagedProductsStorageKey, JSON.stringify(nextProducts));
      try {
        const result = await autoSaveStagedProductsToDraft(nextProducts, programContext, user);
        if (!result.success) throw new Error(result.error || "Could not save the staged request details.");
        const savedProducts = nextProducts.map((product) =>
          product.id === item.id ? { ...product, isDraftSaved: true } : product
        );
        stagedProductsRef.current = savedProducts;
        setStagedProducts(savedProducts);
        sessionStorage.setItem(stagedProductsStorageKey, JSON.stringify(savedProducts));
        showToast("Staged request details updated.");
        return true;
      } catch (error) {
        console.error("Failed to save staged request details:", error);
        showToast(error instanceof Error ? error.message : "Could not save the staged request details.", "error");
        return false;
      } finally {
        setIsSavingDetails(false);
      }
    });
    stagedProductUpdateQueueRef.current = operation.then(() => undefined, () => undefined);
    return operation;
  };

  const handleSaveStagedRequestDetails = async (updates: Partial<StagedProductItem>) => {
    if (!editingDetailsProduct) return;
    const saved = await handleUpdateStagedProduct(editingDetailsProduct, updates);
    if (saved) {
      setEditingDetailsProduct(null);
      setEditingMockupOnly(false);
    }
  };

  const handleSaveStagedCustomDetails = async (
    item: StagedProductItem,
    details: NonNullable<StagedProductItem["customDetails"]>,
    productDescription: string,
    hasCreativeChanges?: boolean,
    creativePendingCharacteristicKeys?: Array<{ className: string; characteristicName: string }>
  ) => {
    const updatedItemBase: StagedProductItem = {
      ...item,
      customDetails: details,
      productDescription,
      hasCreativeChanges: hasCreativeChanges ?? item.hasCreativeChanges,
      creativeCharacteristicsCleared: hasCreativeChanges ?? item.creativeCharacteristicsCleared,
      creativePendingCharacteristicKeys: creativePendingCharacteristicKeys ?? item.creativePendingCharacteristicKeys,
    };
    const sampleRoute = getAutomaticSampleRoute(updatedItemBase);
    const updatedItem: StagedProductItem = item.scopes.includes("sample")
      ? {
          ...updatedItemBase,
          isResample: sampleRoute.isResample,
          samplingMetadata: {
            ...item.samplingMetadata,
            sampleType: item.samplingMetadata?.sampleType || "full",
            searchMode: item.samplingMetadata?.searchMode || "new",
            isResample: sampleRoute.isResample,
          },
        }
      : updatedItemBase;
    const nextProducts = stagedProducts.map((product) => product.id === item.id ? updatedItem : product);

    if (item.savedRequestId) {
      const existingWorkflowState: Partial<NonNullable<SampleRequestItem["mockupWorkflowState"]>> = {};
      const mockupWorkflowState = item.scopes.includes("mockup")
        ? {
            ...existingWorkflowState,
            stage: "marketing",
            isResample: sampleRoute.isResample,
            designNeeded: item.mockupMetadata?.designNeeded ?? (item.creationMode === "new" || item.scopes.includes("design")),
            creativeChangesRequired: sampleRoute.creativeChangesRequired || Boolean(updatedItem.hasCreativeChanges || updatedItem.creativeCharacteristicsCleared || updatedItem.creativePendingCharacteristicKeys?.length),
            marketingShutterstockNo: item.mockupMetadata?.marketingShutterstockNo || "",
            marketingRemark: item.mockupMetadata?.marketingRemark || "",
            qtyForMockup: item.qtyForMockup || item.mockupMetadata?.qtyForMockup || "1",
            requiredDate: item.mockupMetadata?.requiredDate || item.mockupRequiredDate || "",
            creativePendingCharacteristicKeys: creativePendingCharacteristicKeys ?? item.creativePendingCharacteristicKeys ?? [],
            ...(item.scopes.includes("sample") ? { samplingRouting: {
              ...(existingWorkflowState.samplingRouting || {}),
              stage: "marketing",
              isResample: sampleRoute.isResample,
              creativeChangesRequired: sampleRoute.creativeChangesRequired,
              isDesignVariant: Boolean(item.variantNumber),
              variantNumber: item.variantNumber,
              creativePendingCharacteristicKeys: creativePendingCharacteristicKeys ?? item.creativePendingCharacteristicKeys ?? [],
            } } : {}),
          }
        : item.scopes.includes("sample") ? {
            ...existingWorkflowState,
            stage: "marketing",
            isResample: sampleRoute.isResample,
            samplingRouting: {
              ...(existingWorkflowState.samplingRouting || {}),
              stage: "marketing",
              isResample: sampleRoute.isResample,
              creativeChangesRequired: sampleRoute.creativeChangesRequired,
              isDesignVariant: Boolean(item.variantNumber),
              variantNumber: item.variantNumber,
              creativePendingCharacteristicKeys: creativePendingCharacteristicKeys ?? item.creativePendingCharacteristicKeys ?? [],
            },
          }
        : undefined;
      const saved = await updateSampleRequestApi(item.savedRequestId, {
        productDescription,
        customDetails: details.map((detail) => ({
          className: detail.className || detail.class_name || "Product",
          characteristicName: detail.characteristicName || detail.characteristic_name || "",
          value: detail.value,
          uom: detail.uom || null,
        })).filter((detail) => detail.characteristicName),
        mockupWorkflowState,
      });
      if (!saved) throw new Error("The staged product could not be updated. Please retry.");
    } else {
      const saved = await autoSaveStagedProductsToDraft(nextProducts, programContext, user);
      if (!saved.success) throw new Error(saved.error || "The staged product could not be saved. Please retry.");
    }

    setStagedProducts(nextProducts);
    stagedProductsRef.current = nextProducts;
    sessionStorage.setItem(stagedProductsStorageKey, JSON.stringify(nextProducts));
    setInspectingProduct(updatedItem);
    showToast("Product description and characteristics saved.");
  };

  // Load the shared binding hierarchy; category is not a filter for material code search.
  useEffect(() => {
    if (
      !isAddModalOpen ||
      (addModalStep !== "sampling_config" && addModalStep !== "product_search")
    ) {
      bindingHierarchySequenceRef.current += 1;
      setIsLoadingBindingHierarchy(false);
      return;
    }
    const requestSequence = ++bindingHierarchySequenceRef.current;
    setIsLoadingBindingHierarchy(true);
    const bindingCategory = samplingSearchMode === "binding" ? selectedCategory : undefined;
    const bindingSubCategory = samplingSearchMode === "binding" ? selectedSubCategory : undefined;
    const bindingThirdCategory = samplingSearchMode === "binding" ? selectedThirdCategory : undefined;
    fetchBindingHierarchyApi(bindingCategory, bindingSubCategory, bindingThirdCategory)
      .then((res: any) => {
        if (bindingHierarchySequenceRef.current !== requestSequence) return;
        setBindingHierarchy(res);
        if (selectedBinding1 && !res.binding1_options.includes(selectedBinding1)) {
          setSelectedBinding1("");
          setSelectedBinding2("");
        } else if (selectedBinding2) {
          const validB2 = res.hierarchy[selectedBinding1] || [];
          if (!validB2.includes(selectedBinding2)) {
            setSelectedBinding2("");
          }
        }
      })
      .catch((err: any) => {
        if (bindingHierarchySequenceRef.current !== requestSequence) return;
        setBindingHierarchy({ binding1_options: [], binding2_options: [], hierarchy: {} });
        setSelectedBinding1("");
        setSelectedBinding2("");
        console.error("Failed to fetch binding hierarchy:", err);
      })
      .finally(() => {
        if (bindingHierarchySequenceRef.current === requestSequence) {
          setIsLoadingBindingHierarchy(false);
        }
      });
    return () => {
      if (bindingHierarchySequenceRef.current === requestSequence) {
        bindingHierarchySequenceRef.current += 1;
      }
    };
  }, [
    isAddModalOpen,
    addModalStep,
    samplingSearchMode,
    selectedCategory,
    selectedSubCategory,
    selectedThirdCategory,
  ]);

  // Debounced live material code search
  useEffect(() => {
    if (
      !isAddModalOpen ||
      (addModalStep !== "sampling_config" && addModalStep !== "product_search") ||
      samplingSearchMode !== "material_code"
    ) {
      materialSearchSequenceRef.current += 1;
      setIsSearchingMaterial(false);
      return;
    }
    const requestSequence = ++materialSearchSequenceRef.current;
    const timer = setTimeout(() => {
      setIsSearchingMaterial(true);
      searchProductsByMaterialApi(materialSearchQuery)
        .then((res: any) => {
          if (materialSearchSequenceRef.current === requestSequence) {
            setMaterialSearchResults(res.slice(0, 30));
          }
        })
        .catch((err: any) => console.error("Search material error:", err))
        .finally(() => {
          if (materialSearchSequenceRef.current === requestSequence) {
            setIsSearchingMaterial(false);
          }
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      if (materialSearchSequenceRef.current === requestSequence) {
        materialSearchSequenceRef.current += 1;
      }
    };
  }, [materialSearchQuery, addModalStep, samplingSearchMode, isAddModalOpen]);

  // Search saved products using binding values only.
  useEffect(() => {
    if (
      !isAddModalOpen ||
      (addModalStep !== "sampling_config" && addModalStep !== "product_search") ||
      samplingSearchMode !== "binding"
    ) {
      bindingSearchSequenceRef.current += 1;
      setIsSearchingBinding(false);
      return;
    }
    if (!selectedBinding1 && !selectedBinding2 && !selectedCategory && !selectedSubCategory && !selectedThirdCategory) {
      setBindingSearchResults([]);
      setIsSearchingBinding(false);
      return;
    }
    const requestSequence = ++bindingSearchSequenceRef.current;
    setIsSearchingBinding(true);
    searchProductsByBindingApi(
      selectedBinding1 || undefined,
      selectedBinding2 || undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      selectedCategory || undefined,
      selectedSubCategory || undefined,
      selectedThirdCategory || undefined
    )
      .then((res: any) => {
        if (bindingSearchSequenceRef.current === requestSequence) {
          setBindingSearchResults(res);
        }
      })
      .catch((err: any) => console.error("Search binding error:", err))
      .finally(() => {
        if (bindingSearchSequenceRef.current === requestSequence) {
          setIsSearchingBinding(false);
        }
      });
    return () => {
      if (bindingSearchSequenceRef.current === requestSequence) {
        bindingSearchSequenceRef.current += 1;
      }
    };
  }, [
    selectedBinding1,
    selectedBinding2,
    selectedCategory,
    selectedSubCategory,
    selectedThirdCategory,
    addModalStep,
    samplingSearchMode,
    isAddModalOpen,
  ]);

  const handleSelectDbSample = (item: ProductSearchResult) => {
    if (selectedDbSample?.id !== item.id) clearMockupDesignChoice();
    const keepCurrentFilters = samplingSearchMode === "binding";
    const nextCategory = item.product_category || (keepCurrentFilters ? selectedCategory : "");
    const nextSubCategory = item.product_sub_category || (keepCurrentFilters ? selectedSubCategory : "");
    const nextThirdCategory = item.product_third_category || (keepCurrentFilters ? selectedThirdCategory : "");
    setSelectedDbSample(item);
    setSamplingDescription(item.product_description || "");
    setSelectedCategory(nextCategory);
    setSelectedSubCategory(nextSubCategory);
    setSelectedThirdCategory(nextThirdCategory);
    setSelectedBinding1(item.binding_type_1 || (keepCurrentFilters ? selectedBinding1 : ""));
    setSelectedBinding2(item.binding_type_2 || (keepCurrentFilters ? selectedBinding2 : ""));
  };

  const handleDesignNeededChange = (needed: boolean | null) => {
    setDesignNeeded(needed);
    setMarketingShutterstockNo("");
    setMarketingMockupRemark("");
    setSelectedScopes((prev) => prev.filter((scope) => scope !== "design"));
    setScopeTimestamps((prev) => {
      const next = { ...prev };
      delete next.design;
      return next;
    });
    resetDesignState();
    setModalError(null);
  };


  // Reference Image Upload Handler
  const handleMultipleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = Array.from(input.files || []);
    input.value = "";
    if (!files.length) return;
    const remainingSlots = 2 - uploadedImages.length;
    if (remainingSlots <= 0) {
      setModalError("Maximum 2 images are allowed.");
      return;
    }
    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setModalError(`Only ${remainingSlots} more image slot(s) available. Added ${remainingSlots} image(s).`);
    } else {
      setModalError(null);
    }

    setIsCompressingReferenceImages(true);
    try {
      for (const file of filesToProcess) {
        try {
          const { url, sizeKb } = await compressReferenceImage(file);
          setUploadedImages((prev) => prev.length >= 2 ? prev : [
            ...prev,
            {
              id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              url,
              name: file.name,
              size: `${sizeKb} KB`,
            },
          ]);
        } catch (uploadError: any) {
          setModalError(uploadError?.message || `${file.name} could not be compressed.`);
        }
      }
    } finally {
      setIsCompressingReferenceImages(false);
    }
  };

  const handleRemoveImage = (id: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  // Reference Link Handler
  const handleAddWebLink = (e: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    const trimmed = linkInput.trim();
    if (!trimmed) return;
    if (webLinks.length >= 1) {
      setModalError("Maximum 1 reference link is allowed.");
      return;
    }
    const formatted = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (webLinks.includes(formatted)) {
      setModalError("This web link has already been added.");
      return;
    }
    setWebLinks((prev) => [...prev, formatted]);
    setLinkInput("");
    setModalError(null);
  };

  const handleRemoveWebLink = (idx: number) => {
    setWebLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const isScopeDisabled = (scopeId: DeliverableScopeId): boolean => {
    if (selectedScopes.includes("design")) return scopeId !== "design";
    if (scopeId === "design" && selectedScopes.length > 0) return true;
    return false;
  };

  const handleToggleScope = (scopeId: DeliverableScopeId) => {
    if (isScopeDisabled(scopeId)) return;
    if (selectedScopes.includes(scopeId)) {
      const scopesToRemove: DeliverableScopeId[] =
        scopeId === "mockup" ? ["mockup", "design"] : [scopeId];
      setSelectedScopes((prev) =>
        prev.filter((scope) => !scopesToRemove.includes(scope))
      );
      setScopeReferenceImages((previous) => {
        const next = { ...previous };
        scopesToRemove.forEach((scope) => { if (scope === "sample" || scope === "mockup" || scope === "costing") delete next[scope]; });
        return next;
      });
      setScopeTimestamps((prev) => {
        const next = { ...prev };
        scopesToRemove.forEach((scope) => delete next[scope]);
        return next;
      });
      if (scopeId === "mockup") {
        setDesignNeeded(null);
        setMarketingShutterstockNo("");
        setMarketingMockupRemark("");
        resetDesignState();
      }
      return;
    }

    const pipelineOrder: DeliverableScopeId[] = ["design", "mockup", "sample", "costing"];
    const nextScopes = [...selectedScopes, scopeId].filter((scope) => !(scopeId === "mockup" && scope === "design"));
    setSelectedScopes(pipelineOrder.filter((scope) => nextScopes.includes(scope)));
    setScopeTimestamps((prev) => {
      const next = { ...prev, [scopeId]: new Date().toISOString() };
      if (scopeId === "mockup") delete next.design;
      return next;
    });
    if (scopeId === "mockup") {
      setDesignNeeded(null);
      setMarketingShutterstockNo("");
      setMarketingMockupRemark("");
      resetDesignState();
    }
  };

  // Step 1: Proceed from Deliverables Scopes to next step
  const handleProceedFromScopes = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedScopes.length === 0) {
      showToast("Please select at least one deliverable scope.", "error");
      return;
    }

    // Selecting ONLY Design branches to design-only flow instead of product lookup
    if (selectedScopes.length === 1 && selectedScopes[0] === "design") {
      setAddModalStep("design_brief");
      setModalError(null);
      return;
    }

    // Any other scope (sampling, mockup, costing) opens the unified product config!
    setSamplingSearchMode(selectedScopes.includes("mockup") ? "material_code" : "new");
    setAddModalStep("sampling_config");
    setModalError(null);
  };

  // Step 2: Submit Design Brief and Stage Product
  const handleStageDesignBrief = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isCompressingReferenceImages) {
      setModalError("Wait for the reference images to finish processing before continuing.");
      return;
    }

    if (!designDesc.trim()) {
      setModalError("Product description is mandatory.");
      showToast("Product description is required.", "error");
      return;
    }
    if (designCount === "" || Number(designCount) < 1) {
      setModalError("Please enter the number of designs (minimum 1).");
      showToast("Number of designs is required.", "error");
      return;
    }
    if (!designDueDate.trim()) {
      setModalError("Design required date is mandatory. Please select a date.");
      showToast("Please select the design required date.", "error");
      return;
    }

    if (selectedScopes.includes("mockup") || selectedScopes.includes("sample") || selectedScopes.includes("costing")) {
      setModalError(null);
      setAddModalStep("sampling_config");
      return;
    }

    const plantCode = marketingPlantCode;
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generatedMaterialCode = `DSG-${plantCode}-${randomNum}`;

    const now = new Date();
    const formattedDate = now.toISOString().split("T")[0];
    const formattedTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let nextItem: StagedProductItem;
    let nextProducts: StagedProductItem[];

    if (editingProduct) {
      nextItem = {
        ...editingProduct,
        productDescription: designDesc.trim(),
        scopes: [...selectedScopes],
        requestTypeTimestamps: { ...scopeTimestamps },
        designMetadata: {
          numberOfDesigns: Number(designCount) || 1,
          designRequiredDate: designDueDate.trim(),
          trend: designTrend.trim(),
          targetAudience: designAudience.trim(),
          remarks: designRemarks.trim(),
          images: [...uploadedImages],
          webLinks: [...webLinks],
          referenceImage: uploadedImages[0]?.url || webLinks[0] || "",
        },
      };
      nextProducts = stagedProducts.map((p) => (p.id === editingProduct.id ? nextItem : p));
      setEditingProduct(null);
      showToast(`Updated "${nextItem.productDescription}".`);
    } else {
      nextItem = {
        id: `staged-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        materialCode: generatedMaterialCode,
        productDescription: designDesc.trim(),
        scopes: [...selectedScopes],
        requestTypeTimestamps: { ...scopeTimestamps },
        creationMode: "material_code",
        stagedDate: formattedDate,
        timestamp: formattedTime,
        isDraftSaved: false,
        designMetadata: {
          numberOfDesigns: Number(designCount) || 1,
          designRequiredDate: designDueDate.trim(),
          trend: designTrend.trim(),
          targetAudience: designAudience.trim(),
          remarks: designRemarks.trim(),
          images: [...uploadedImages],
          webLinks: [...webLinks],
          referenceImage: uploadedImages[0]?.url || webLinks[0] || "",
        },
      };
      nextProducts = [...stagedProducts, nextItem];
      showToast(`Added "${nextItem.productDescription}" to Product Staging.`);
    }

    setStagedProducts(nextProducts);
    sessionStorage.setItem(stagedProductsStorageKey, JSON.stringify(nextProducts));
    setIsAddModalOpen(false);
    resetDesignState();

    // Persist staged product directly into Draft in the background
    autoSaveStagedProductsToDraft(nextProducts, programContext, user)
      .then((res) => {
        if (res.success) {
          nextItem.isDraftSaved = true;
          setStagedProducts([...nextProducts]);
          if (res.requestId && !programContext.parentRequestId) {
            setProgramContext((prev) => ({
              ...prev,
              parentRequestId: res.requestId,
              parentSrNumber: res.srNumber || prev.parentSrNumber,
            }));
            const cached = sessionStorage.getItem(programContextStorageKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              parsed.parentRequestId = res.requestId;
              if (res.srNumber) parsed.parentSrNumber = res.srNumber;
              sessionStorage.setItem(programContextStorageKey, JSON.stringify(parsed));
            }
          }
          showToast(`✓ Staged product saved to Draft (${res.srNumber || programContext.parentSrNumber || "Draft queue"}).`);
        }
      })
      .catch((err) => {
        console.error("Auto-save staged product to draft error:", err);
        showToast("Could not save this product as a draft. Your staged details are still here.", "error");
      });
  };

  // Stage the selected catalog product for Mockup or Costing (with the design brief when paired).

  // Step 3: Submit Sampling Configuration and Stage Product
  const handleStageSamplingProduct = async () => {
    if (compressingScopeImages.size > 0) {
      setModalError("Wait for the reference images to finish compressing before continuing.");
      return;
    }

    if (selectedScopes.includes("costing")) {
      if (!qtyDesignCosting.trim() || !Number.isInteger(Number(qtyDesignCosting)) || Number(qtyDesignCosting) < 1) {
        setModalError("Enter a whole-number quantity for costing (minimum 1).");
        return;
      }
      if (unitPcPack !== "PC" && unitPcPack !== "Pack") {
        setModalError("Choose PC or Pack as the costing unit.");
        return;
      }
      if (!costingRequiredDate.trim()) {
        setModalError("Choose a required date for Costing.");
        return;
      }
    }

    if ((selectedScopes.includes("sample") || selectedScopes.includes("costing")) && unitPcPack === "Pack" && (!Number.isInteger(Number(qtyPerPack)) || Number(qtyPerPack) < 1)) {
      setModalError("Enter how many pieces are in one pack.");
      return;
    }

    if (selectedScopes.includes("mockup")) {
      if (!mockupRequiredDate.trim()) {
        setModalError("Choose a required date for the Mockup request.");
        return;
      }
      if (designMockupHandoff && (!selectedDbSample || !selectedDbSample.id || !selectedDbSample.material_code?.trim())) {
        setModalError("Select an existing Material Code or Binding product before creating these Mockup requests.");
        return;
      }
      if (!designMockupHandoff && (!Number.isInteger(Number(qtyForMockup)) || Number(qtyForMockup) < 1)) {
        setModalError("Enter a whole-number Mockup quantity (minimum 1).");
        return;
      }
      if (!designMockupHandoff && designNeeded === null) {
        setModalError("Choose whether a new design is needed.");
        return;
      }
      if (!designMockupHandoff && designNeeded && !marketingShutterstockNo.trim() && !marketingMockupRemark.trim()) {
        setModalError("Enter a Shutterstock number or remark when design is needed.");
        return;
      }
      if (designMockupHandoff && !designMockupHandoff.designs.length) {
        setModalError("No selected designs were found for this Mockup handoff.");
        return;
      }
    }

    if (selectedScopes.includes("sample") && sampleType === "partial" && !partialRequirements.trim()) {
      setModalError("Partial sample details are mandatory.");
      showToast("Partial sample details are required.", "error");
      return;
    }

    const desc =
      samplingDescription.trim() ||
      selectedDbSample?.product_description ||
      "";

    if (!desc) {
      setModalError(
        samplingSearchMode === "new"
          ? "Product description is required."
          : "Please select a product from search or enter a product description."
      );
      showToast("Please enter product description or select a product.", "error");
      return;
    }

    const plantCode = marketingPlantCode;
    const prefix = selectedScopes.includes("sample")
      ? "SMP"
      : selectedScopes.includes("mockup")
        ? "MUP"
        : "PRD";
    const matCode =
      selectedDbSample?.material_code ||
      `${prefix}-${plantCode}-${Math.floor(1000 + Math.random() * 9000)}`;

    const now = new Date();
    const formattedDate = now.toISOString().split("T")[0];
    const formattedTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const isNewProduct = samplingSearchMode === "new";
    const bindingType1 = isNewProduct ? undefined : selectedBinding1 || selectedDbSample?.binding_type_1;
    const bindingType2 = isNewProduct ? undefined : selectedBinding2 || selectedDbSample?.binding_type_2;
    const sampleSourceId = isNewProduct
      ? undefined
      : selectedDbSample?.id || editingProduct?.sourceSampleRequestId || editingProduct?.catalogMetadata?.sourceProductId || editingProduct?.samplingMetadata?.sourceSampleId;
    const isBrandNewSample = selectedScopes.includes("sample") && !sampleSourceId;
    const stagedCustomDetails = isBrandNewSample
      ? newProductCustomDetails.map((detail) => {
          const className = detail.className || detail.class_name || "Product";
          const characteristicName = detail.characteristicName || detail.characteristic_name || "";
          return isMockupCreativeCharacteristic(className, characteristicName)
            ? { ...detail, value: "" }
            : detail;
        })
      : newProductCustomDetails;
    const newProductCreativeKeys = isBrandNewSample
      ? stagedCustomDetails
          .filter((detail) => isMockupCreativeCharacteristic(
            detail.className || detail.class_name || "Product",
            detail.characteristicName || detail.characteristic_name || ""
          ))
          .map((detail) => ({
            className: detail.className || detail.class_name || "Product",
            characteristicName: detail.characteristicName || detail.characteristic_name || "",
          }))
      : [];
    const retainedCreativeKeys = editingProduct?.creativePendingCharacteristicKeys || [];
    const sampleRoute = getAutomaticSampleRoute({
      ...(editingProduct || {}),
      scopes: selectedScopes,
      sourceSampleRequestId: sampleSourceId,
      samplingMetadata: {
        ...editingProduct?.samplingMetadata,
        sampleType,
        searchMode: samplingSearchMode,
        sourceSampleId: sampleSourceId,
      },
      catalogMetadata: {
        ...editingProduct?.catalogMetadata,
        sourceProductId: sampleSourceId,
        sourceDescription: selectedDbSample?.product_description || desc,
      },
      hasCreativeChanges: isBrandNewSample || Boolean(editingProduct?.hasCreativeChanges),
      creativeCharacteristicsCleared: isBrandNewSample || Boolean(editingProduct?.creativeCharacteristicsCleared),
      creativePendingCharacteristicKeys: isBrandNewSample ? newProductCreativeKeys : retainedCreativeKeys,
      variantNumber: editingProduct?.variantNumber,
    });

    let nextItem: StagedProductItem;
    let nextProducts: StagedProductItem[];

    if (editingProduct) {
      nextItem = {
        ...editingProduct,
        productDescription: desc,
        scopes: [...selectedScopes],
        requestTypeTimestamps: { ...scopeTimestamps },
        creationMode: samplingSearchMode,
        customDetails: isNewProduct ? stagedCustomDetails : editingProduct.customDetails,
        unitPcPack,
        qtyPerPack: unitPcPack === "Pack" ? qtyPerPack.trim() : "1",
        ...(selectedScopes.includes("sample") && {
          qtyForSampling: qtyForSampling.trim() || "1",
          sampleRequiredDate: programContext.feasibilityRequiredDate || editingProduct.sampleRequiredDate,
        }),
        ...(selectedScopes.includes("mockup") && {
          qtyForMockup: qtyForMockup.trim() || "1",
          mockupRequiredDate: mockupRequiredDate.trim() || undefined,
        }),
        ...((selectedScopes.includes("mockup") || selectedScopes.includes("costing")) && {
          customerProductCode: customerProductCode.trim(),
          brandName: brandName.trim(),
        }),
        ...(selectedScopes.includes("costing") && {
          qtyDesignCosting: qtyDesignCosting.trim(),
          barcode: costingBarcode.trim(),
          costingRequiredDate: costingRequiredDate.trim(),
          costingCreativeInputNeeded: creativeInputNeeded,
          costingCreativeInputRemark: creativeInputNeeded ? creativeInputRemark.trim() : "",
        }),
        sourceSampleRequestId: sampleSourceId,
        sourceRequestCode: isNewProduct ? undefined : (
          selectedDbSample?.request_codes?.mockup || selectedDbSample?.request_codes?.design ||
          (selectedDbSample?.request_code && /^(FC|DR|MR)-\d{2}-\d{3,}$/.test(selectedDbSample.request_code)
            ? selectedDbSample.request_code
            : undefined)
        ),
        sourceSampleCode: isNewProduct ? undefined : selectedDbSample?.material_code || editingProduct.sourceSampleCode || editingProduct.catalogMetadata?.sourceMaterialCode,
        productCategory: selectedDbSample?.product_category || selectedCategory || (isNewProduct ? undefined : editingProduct.productCategory),
        productSubCategory: selectedDbSample?.product_sub_category || selectedSubCategory || (isNewProduct ? undefined : editingProduct.productSubCategory),
        productThirdCategory: selectedDbSample?.product_third_category || selectedThirdCategory || (isNewProduct ? undefined : editingProduct.productThirdCategory),
        customBinding1: bindingType1 || (isNewProduct ? undefined : editingProduct.customBinding1),
        customBinding2: bindingType2 || (isNewProduct ? undefined : editingProduct.customBinding2),
        samplingMetadata: selectedScopes.includes("sample") ? {
          sampleType,
          isResample: sampleRoute.isResample,
          partialRequirements: partialRequirements.trim() || undefined,
          searchMode: samplingSearchMode,
          sourceSampleId: sampleSourceId,
          sourceSrNumber: isNewProduct ? undefined : selectedDbSample?.sr_number || editingProduct.samplingMetadata?.sourceSrNumber || undefined,
          selectedMaterialCode: isNewProduct ? undefined : selectedDbSample?.material_code || editingProduct.samplingMetadata?.selectedMaterialCode,
          bindingType1: bindingType1 || (isNewProduct ? undefined : editingProduct.samplingMetadata?.bindingType1),
          bindingType2: bindingType2 || (isNewProduct ? undefined : editingProduct.samplingMetadata?.bindingType2),
          customerReference: selectedDbSample?.customer || (isNewProduct ? undefined : editingProduct.samplingMetadata?.customerReference),
          targetPlant: selectedDbSample?.target_plant || (isNewProduct ? undefined : editingProduct.samplingMetadata?.targetPlant),
        } : editingProduct.samplingMetadata,
        designMetadata: selectedScopes.includes("design") ? {
          numberOfDesigns: Number(designCount) || 1,
          designRequiredDate: designDueDate.trim(),
          trend: designTrend.trim(),
          targetAudience: designAudience.trim(),
          remarks: designRemarks.trim(),
          images: uploadedImages,
          webLinks,
          referenceImage: uploadedImages[0]?.url || webLinks[0] || "",
        } : undefined,
        mockupMetadata: selectedScopes.includes("mockup") ? {
          designNeeded: designNeeded === true,
          marketingShutterstockNo: marketingShutterstockNo.trim() || undefined,
          marketingRemark: marketingMockupRemark.trim() || undefined,
          qtyForMockup: qtyForMockup.trim() || "1",
          requiredDate: mockupRequiredDate.trim() || undefined,
        } : undefined,
        scopeReferenceImages: Object.fromEntries(
          (["sample", "mockup", "costing"] as ReferenceImageScopeId[])
            .filter((scope) => selectedScopes.includes(scope))
            .map((scope) => [scope, scopeReferenceImages[scope] || []]),
        ),
        catalogMetadata: {
          sourceProductId: sampleSourceId,
          sourceRequestNumber: isNewProduct ? undefined : selectedDbSample?.sr_number || editingProduct.catalogMetadata?.sourceRequestNumber || undefined,
          sourceMaterialCode: isNewProduct ? undefined : selectedDbSample?.material_code || editingProduct.catalogMetadata?.sourceMaterialCode,
          sourceDescription: selectedDbSample?.product_description || desc,
          bindingType1: bindingType1 || (isNewProduct ? undefined : editingProduct.catalogMetadata?.bindingType1),
          bindingType2: bindingType2 || (isNewProduct ? undefined : editingProduct.catalogMetadata?.bindingType2),
        },
        ...(selectedScopes.includes("sample") && {
          isResample: sampleRoute.isResample,
          hasCreativeChanges: sampleRoute.creativeChangesRequired,
          creativeCharacteristicsCleared: sampleRoute.creativeChangesRequired,
          creativePendingCharacteristicKeys: isBrandNewSample ? newProductCreativeKeys : retainedCreativeKeys,
        }),
      };
      nextProducts = stagedProducts.map((p) => (p.id === editingProduct.id ? nextItem : p));
      setEditingProduct(null);
      showToast(`Updated "${nextItem.productDescription}".`);
    } else {
      nextItem = {
        id: `staged-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        materialCode: matCode,
        productDescription: desc,
        scopes: [...selectedScopes],
        requestTypeTimestamps: { ...scopeTimestamps },
        creationMode: samplingSearchMode,
        customDetails: isNewProduct ? stagedCustomDetails : undefined,
        unitPcPack,
        qtyPerPack: unitPcPack === "Pack" ? qtyPerPack.trim() : "1",
        ...(selectedScopes.includes("sample") && {
          qtyForSampling: qtyForSampling.trim() || "1",
          sampleRequiredDate: programContext.feasibilityRequiredDate || undefined,
        }),
        ...(selectedScopes.includes("mockup") && {
          qtyForMockup: qtyForMockup.trim() || "1",
          mockupRequiredDate: mockupRequiredDate.trim() || undefined,
        }),
        scopeReferenceImages: Object.fromEntries(
          (["sample", "mockup", "costing"] as ReferenceImageScopeId[])
            .filter((scope) => selectedScopes.includes(scope))
            .map((scope) => [scope, scopeReferenceImages[scope] || []]),
        ),
        ...((selectedScopes.includes("mockup") || selectedScopes.includes("costing")) && {
          customerProductCode: customerProductCode.trim(),
          brandName: brandName.trim(),
        }),
        ...(selectedScopes.includes("costing") && {
          qtyDesignCosting: qtyDesignCosting.trim(),
          barcode: costingBarcode.trim(),
          costingRequiredDate: costingRequiredDate.trim(),
          costingCreativeInputNeeded: creativeInputNeeded,
          costingCreativeInputRemark: creativeInputNeeded ? creativeInputRemark.trim() : "",
        }),
        sourceSampleRequestId: sampleSourceId,
        sourceRequestCode: (
          selectedDbSample?.request_codes?.mockup || selectedDbSample?.request_codes?.design ||
          (selectedDbSample?.request_code && /^(FC|DR|MR)-\d{2}-\d{3,}$/.test(selectedDbSample.request_code)
            ? selectedDbSample.request_code
            : undefined)
        ),
        sourceSampleCode: selectedDbSample?.material_code,
        productCategory: selectedDbSample?.product_category || selectedCategory || undefined,
        productSubCategory: selectedDbSample?.product_sub_category || selectedSubCategory || undefined,
        productThirdCategory: selectedDbSample?.product_third_category || selectedThirdCategory || undefined,
        customBinding1: bindingType1,
        customBinding2: bindingType2,
        stagedDate: formattedDate,
        timestamp: formattedTime,
        isDraftSaved: false,
        ...(selectedScopes.includes("design") && {
          designMetadata: {
            numberOfDesigns: Number(designCount) || 1,
            designRequiredDate: designDueDate.trim(),
            trend: designTrend.trim(),
            targetAudience: designAudience.trim(),
            remarks: designRemarks.trim(),
            images: uploadedImages,
            webLinks,
            referenceImage: uploadedImages[0]?.url || webLinks[0] || "",
          },
        }),
        ...(selectedScopes.includes("mockup") && {
          mockupMetadata: {
            designNeeded: designNeeded === true,
            marketingShutterstockNo: marketingShutterstockNo.trim() || undefined,
            marketingRemark: marketingMockupRemark.trim() || undefined,
            qtyForMockup: qtyForMockup.trim() || "1",
            requiredDate: mockupRequiredDate.trim() || undefined,
          },
        }),
        ...(selectedScopes.includes("sample") && {
          isResample: sampleRoute.isResample,
          hasCreativeChanges: sampleRoute.creativeChangesRequired,
          creativeCharacteristicsCleared: sampleRoute.creativeChangesRequired,
          creativePendingCharacteristicKeys: newProductCreativeKeys,
          samplingMetadata: {
            sampleType,
            isResample: sampleRoute.isResample,
            partialRequirements: partialRequirements.trim() || undefined,
            searchMode: samplingSearchMode,
            sourceSampleId: sampleSourceId,
            sourceSrNumber: selectedDbSample?.sr_number || undefined,
            selectedMaterialCode: selectedDbSample?.material_code,
            bindingType1,
            bindingType2,
            customerReference: selectedDbSample?.customer,
            targetPlant: selectedDbSample?.target_plant,
          },
        }),
        catalogMetadata: {
          sourceProductId: sampleSourceId,
          sourceRequestNumber: selectedDbSample?.sr_number || undefined,
          sourceMaterialCode: selectedDbSample?.material_code,
          sourceDescription: selectedDbSample?.product_description || desc,
          bindingType1,
          bindingType2,
        },
      };
      nextProducts = [...stagedProducts, nextItem];
      showToast(`Added "${nextItem.productDescription}" to Product Staging.`);
    }

    if (designMockupHandoff) {
      const handoffItems = designMockupHandoff.designs.map((artwork) => ({
        ...nextItem,
        id: "design-mockup-" + designMockupHandoff.designRequestId + "-" + encodeURIComponent(artwork.designNumber),
        productDescription: desc + " · " + artwork.designNumber,
        scopes: ["mockup"] as DeliverableScopeId[],
        qtyForMockup: "1",
        mockupRequiredDate: mockupRequiredDate.trim(),
        mockupMetadata: {
          designNeeded: false,
          marketingShutterstockNo: artwork.shutterstockNo.trim(),
          marketingRemark: artwork.remarks.trim(),
          qtyForMockup: "1",
          requiredDate: mockupRequiredDate.trim(),
          designArtwork: artwork,
        },
      }));
      setStagedProducts(handoffItems);
      stagedProductsRef.current = handoffItems;
      sessionStorage.setItem(stagedProductsStorageKey, JSON.stringify(handoffItems));
      setIsSubmittingAll(true);
      try {
        const saved = await autoSaveStagedProductsToDraft(handoffItems, programContext, user);
        if (!saved.success || !saved.savedIds || saved.savedIds.length !== handoffItems.length) {
          throw new Error(saved.error || "Some per-design Mockup drafts could not be saved.");
        }
        await requestPostDesignDeliverablesApi(
          designMockupHandoff.designRequestId,
          ["mockup"],
          { mockup: designMockupHandoff.designs.map((design) => design.designNumber) },
          { mockupRequiredDate: mockupRequiredDate.trim(), mockupRequestIds: saved.savedIds },
        );
        sessionStorage.removeItem(stagedProductsStorageKey);
        sessionStorage.removeItem(programContextStorageKey);
        stagedProductsRef.current = [];
        setStagedProducts([]);
        setIsAddModalOpen(false);
        navigate("/sample-requests", { state: { refresh: Date.now(), stage: "studio" } });
        window.dispatchEvent(new CustomEvent("app:show-toast", {
          detail: { message: saved.savedIds.length + " Mockup request(s) sent directly to Studio.", tone: "success" },
        }));
      } catch (error: any) {
        setStagedProducts(handoffItems);
        stagedProductsRef.current = handoffItems;
        showToast(error?.message || "Could not release these Mockup requests. Their saved draft details remain here.", "error");
      } finally {
        setIsSubmittingAll(false);
      }
      return;
    }

    setStagedProducts(nextProducts);
    sessionStorage.setItem(stagedProductsStorageKey, JSON.stringify(nextProducts));
    setIsAddModalOpen(false);
    resetSamplingState();

    // Persist staged product directly into Draft
    autoSaveStagedProductsToDraft(nextProducts, programContext, user)
      .then((res) => {
        if (res.success) {
          if (feasibilityHandoff) {
            hasAutoSavedRef.current = true;
            stagedProductsRef.current = [];
            setStagedProducts([]);
            sessionStorage.removeItem(stagedProductsStorageKey);
            sessionStorage.removeItem(programContextStorageKey);
            navigate("/sample-requests", { state: { refresh: Date.now(), stage: "draft" } });
            window.dispatchEvent(new CustomEvent("app:show-toast", {
              detail: {
                message: `${
                  (programContext.feasibilityRequestTypes && programContext.feasibilityRequestTypes.length === 2)
                    ? "Sample & Mockup"
                    : programContext.feasibilityRequestTypes?.includes("mockup") || programContext.feasibilityRequestType === "mockup"
                    ? "Mockup"
                    : "Sample"
                } details staged and linked to ${programContext.feasibilityRequestCode || "the feasibility request"}.`,
                tone: "success",
              },
            }));
            return;
          }
          nextItem.isDraftSaved = true;
          setStagedProducts([...nextProducts]);
          showToast(`✓ Staged product saved to Draft (${res.srNumber || programContext.parentSrNumber || "Draft queue"}).`);
        } else showToast(res.error || "Could not save this product as a draft. Your staged details are still here.", "error");
      })
      .catch((err) => {
        console.error("Auto-save draft error:", err);
        showToast("Could not save this product as a draft. Your staged details are still here.", "error");
      });
  };

  const handleRemoveStagedItem = (id: string) => {
    const item = stagedProducts.find((staged) => staged.id === id);
    const nextProducts = stagedProducts.filter((staged) => staged.id !== id);
    setStagedProducts(nextProducts);
    stagedProductsRef.current = nextProducts;
    try {
      sessionStorage.setItem(stagedProductsStorageKey, JSON.stringify(nextProducts));
    } catch {
      // ignore
    }
    showToast(
      item?.savedRequestId
        ? `Removed "${item.productDescription || "Product"}" from staging. Its saved request remains available in Drafts.`
        : `Removed "${item?.productDescription || "Product"}" from staging.`
    );
  };

  const handleClearStaging = () => {
    setStagedProducts([]);
    stagedProductsRef.current = [];
    try {
      sessionStorage.removeItem(stagedProductsStorageKey);
    } catch {
      // ignore
    }
    showToast("Cleared staging. Any saved request drafts remain available in Drafts.");
  };

  const handleDuplicateStagedItem = async (item: StagedProductItem) => {
    const plantCode = marketingPlantCode;
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const now = new Date();
    const isSamplingVariant = item.scopes.includes("sample");
    const baseDescription = item.variantBaseDescription || item.productDescription.replace(/\s+D\d+$/i, "");
    let customDetails = item.customDetails;
    if (isSamplingVariant && !customDetails?.length) {
      const sourceId = item.savedRequestId || item.sourceSampleRequestId || item.samplingMetadata?.sourceSampleId;
      if (sourceId) {
        const details = await fetchProductDetailsApi(sourceId, false);
        customDetails = details.map((detail) => ({
          className: detail.className,
          characteristicName: detail.characteristicName,
          value: detail.value,
          uom: detail.uom || null,
        }));
      }
    }
    const currentStagedProducts = stagedProductsRef.current;
    const variantNumber = isSamplingVariant
      ? currentStagedProducts.reduce((max, candidate) => {
          const candidateBase = candidate.variantBaseDescription || candidate.productDescription.replace(/\s+D\d+$/i, "");
          const descriptionVariant = Number(candidate.productDescription.match(/\s+D(\d+)$/i)?.[1]) || 0;
          return candidateBase.toLocaleLowerCase() === baseDescription.toLocaleLowerCase()
            ? Math.max(max, candidate.variantNumber || descriptionVariant)
            : max;
        }, 0) + 1
      : undefined;
    const creativePendingCharacteristicKeys = isSamplingVariant
      ? (customDetails || [])
          .filter((detail) => isMockupCreativeCharacteristic(
            detail.className || detail.class_name || "",
            detail.characteristicName || detail.characteristic_name || "",
          ))
          .map((detail) => ({
            className: detail.className || detail.class_name || "Product",
            characteristicName: detail.characteristicName || detail.characteristic_name || "",
          }))
      : item.creativePendingCharacteristicKeys || [];
    const variantDetails = isSamplingVariant
      ? (customDetails || []).map((detail) => {
          const creativeOwned = isMockupCreativeCharacteristic(
            detail.className || detail.class_name || "",
            detail.characteristicName || detail.characteristic_name || "",
          );
          return {
            ...detail,
            value: creativeOwned ? "" : detail.value,
          };
        })
      : customDetails;

    const clone: StagedProductItem = {
      ...item,
      id: `staged-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      savedRequestId: undefined,
      savedSrNumber: undefined,
      isDraftSaved: false,
      sourceSampleRequestId: Number(item.savedRequestId || item.sourceSampleRequestId || item.samplingMetadata?.sourceSampleId) || undefined,
      sourceSampleCode: item.sourceSampleCode || item.samplingMetadata?.selectedMaterialCode || item.materialCode,
      materialCode:
        item.scopes.includes("design") && item.scopes.length === 1
          ? `DSG-${plantCode}-${randomNum}`
          : `NB-${plantCode}-${randomNum}`,
      productDescription: isSamplingVariant ? `${baseDescription} D${variantNumber}` : `${item.productDescription} (Copy)`,
      ...(isSamplingVariant ? {
        variantBaseDescription: baseDescription,
        variantNumber,
        isResample: false,
        samplingMetadata: item.samplingMetadata ? {
          ...item.samplingMetadata,
          sampleType: item.samplingMetadata.sampleType || "full",
          isResample: false,
        } : undefined,
        customDetails: variantDetails,
        hasCreativeChanges: true,
        creativeCharacteristicsCleared: true,
        creativePendingCharacteristicKeys,
      } : {}),
      stagedDate: now.toISOString().split("T")[0],
      timestamp: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    const nextProducts = [...currentStagedProducts, clone];
    stagedProductsRef.current = nextProducts;
    setStagedProducts(nextProducts);
    showToast(isSamplingVariant
      ? `Created design variant D${variantNumber}; Creative-owned characteristics were cleared.`
      : `Duplicated "${item.productDescription}".`);
  };

  // Return to Sample Requests desk with automatic draft preservation if items staged
  const handleReturnToDesk = async () => {
    if (stagedProducts.length > 0) {
      hasAutoSavedRef.current = true;
      showToast(`Auto-saving ${stagedProducts.length} product(s) directly to Drafts...`);
      autoSaveStagedProductsToDraft(stagedProducts, programContext, user).then((res) => {
        if (res.success) {
          sessionStorage.removeItem(stagedProductsStorageKey);
          sessionStorage.removeItem(programContextStorageKey);
          navigate("/sample-requests", { state: { refresh: Date.now(), stage: "draft" } });
          window.dispatchEvent(
            new CustomEvent("app:show-toast", {
              detail: {
                message: `✓ Auto-saved ${res.count} staged product(s) for "${res.programName || res.customer}" directly to Drafts.`,
                tone: "success",
              },
            })
          );
        } else {
          hasAutoSavedRef.current = false;
          window.dispatchEvent(new CustomEvent("app:show-toast", {
            detail: { message: res.error || "Draft save failed. Your staged details are still here; retry before leaving.", tone: "error" },
          }));
        }
      });
      return;
    }
    if (designMockupHandoff) {
      sessionStorage.removeItem(stagedProductsStorageKey);
      sessionStorage.removeItem(programContextStorageKey);
    }
    if (feasibilityHandoff) {
      sessionStorage.removeItem(stagedProductsStorageKey);
      sessionStorage.removeItem(programContextStorageKey);
    }
    navigate("/sample-requests");
  };

  // Save current staged products to Drafts explicitly
  const handleSaveAsDraft = async () => {
    if (stagedProducts.length === 0) return;
    setIsSubmittingAll(true);
    hasAutoSavedRef.current = true;

    try {
      const res = await autoSaveStagedProductsToDraft(stagedProducts, programContext, user);
      if (res.success) {
        sessionStorage.removeItem(programContextStorageKey);
        sessionStorage.removeItem(stagedProductsStorageKey);
        showToast(`Successfully saved ${res.count} specification(s) to Draft queue!`);
        setTimeout(() => {
          navigate("/sample-requests", { state: { refresh: Date.now(), stage: "draft" } });
        }, 700);
      } else {
        hasAutoSavedRef.current = false;
        showToast(res.error || "Draft save failed. Your staged details are still here; retry the save.", "error");
      }
    } catch {
      hasAutoSavedRef.current = false;
      showToast("Failed to save staged products to Drafts. Your staged details are still here; retry the save.", "error");
    } finally {
      setIsSubmittingAll(false);
    }
  };

  // Submit all staged products into Sample Requests & Design pipelines
  const handleSubmitBatch = async () => {
    if (stagedProducts.length === 0) return;
    if (!programContext.customer) {
      showToast("A customer is required before saving products.", "error");
      return;
    }
    setIsSubmittingAll(true);
    hasAutoSavedRef.current = true;

    try {
      const res = await autoSaveStagedProductsToDraft(stagedProducts, programContext, user);
      if (res.success) {
        sessionStorage.removeItem(programContextStorageKey);
        sessionStorage.removeItem(stagedProductsStorageKey);
        sessionStorage.removeItem("samp_active_staged_items");
        setStagedProducts([]);
      showToast(`Successfully saved ${res.count} product(s) to ${programContext.parentSrNumber || "the request"}. Returning to desk...`);
        setTimeout(() => {
          navigate("/sample-requests", { state: { refresh: Date.now(), stage: "draft" } });
        }, 700);
      } else {
        hasAutoSavedRef.current = false;
        showToast(res.error || "Draft save failed. Your staged products are still here; retry the save.", "error");
      }
    } catch {
      hasAutoSavedRef.current = false;
      showToast("The staged request(s) could not be saved. Your staged products are still here; retry the save.", "error");
    } finally {
      setIsSubmittingAll(false);
    }
  };



  // Release each staged request to the destination selected in its workflow details.
  const handleReleaseRequest = async () => {
    if (!programContext.customer && !programContext.parentRequestId) {
      showToast("Customer account is required before releasing.", "error");
      return;
    }
    if (stagedProducts.length === 0 && !programContext.parentRequestId) {
      showToast("Please add at least one product before releasing.", "error");
      return;
    }

    setIsReleasing(true);
    hasAutoSavedRef.current = true;

    let allDraftsSaved = stagedProducts.length === 0;
    try {
      let targetSrNumber = programContext.parentSrNumber;

      // 1. If there are staged products in memory, persist them to draft first
      if (stagedProducts.length > 0) {
        const res = await autoSaveStagedProductsToDraft(stagedProducts, programContext, user);
        if (!res.success) throw new Error(res.error || "Could not save the staged products before release.");
        allDraftsSaved = true;
        if (res.srNumber) targetSrNumber = targetSrNumber || res.srNumber;
        if (res.savedIds && res.savedIds.length === stagedProducts.length) {
          res.savedIds.forEach((id, idx) => {
            if (stagedProducts[idx]) stagedProducts[idx].savedRequestId = id;
          });
        }
      }

      // 2. Release every persisted product; Costing's workflow follows the saved Creative input choice.
      const itemsByStatus = new Map<string, StagedProductItem[]>();
      for (const item of stagedProducts) {
        const isDirectStudioMockup = item.scopes.length === 1
          && item.scopes.includes("mockup")
          && item.mockupMetadata?.designNeeded === false;
        const isSamplingOnly = item.scopes.length === 1 && item.scopes.includes("sample");
        const hasSamplingCreativeChanges = Boolean(item.hasCreativeChanges || item.creativeCharacteristicsCleared || item.creativePendingCharacteristicKeys?.length || item.variantNumber);
        const status = isDirectStudioMockup
          ? "Studio"
          : isSamplingOnly
            ? hasSamplingCreativeChanges ? "Creative" : "Released to Plant"
            : "Creative";
        itemsByStatus.set(status, [...(itemsByStatus.get(status) || []), item]);
      }
      if (stagedProducts.length === 0 && programContext.parentRequestId) {
        const status = "Creative";
        itemsByStatus.set(status, []);
      }

      const releasedStatuses: Record<string, string> = {};
      for (const [status, items] of itemsByStatus) {
        const ids = items.map((item) => item.savedRequestId).filter((id): id is string | number => id !== undefined && id !== null);
        if (items.length > 0 && ids.length !== items.length) {
          throw new Error("One or more staged products were not saved. They remain in Draft; retry after saving.");
        }
        if (!items.length && programContext.parentRequestId) ids.push(programContext.parentRequestId);
        if (ids.length > 0) {
          Object.assign(releasedStatuses, await releaseSampleRequestIdsApi(ids, status));
        }
      }
      const destinations = Array.from(new Set(Object.values(releasedStatuses).length
        ? Object.values(releasedStatuses)
        : Array.from(itemsByStatus.keys())));
      const newStatus = destinations.join(" and ") || "Creative";

      // 4. Clear staging session storage, in-memory list and refs
      sessionStorage.removeItem(programContextStorageKey);
      sessionStorage.removeItem(stagedProductsStorageKey);
      sessionStorage.removeItem("samp_active_staged_items");
      stagedProductsRef.current = [];
      hasAutoSavedRef.current = true;
      setStagedProducts([]);

      const label = targetSrNumber ? `Request ${targetSrNumber}` : "Draft request";
      const creativeFirstCount = stagedProducts.filter((item) => item.scopes.includes("costing") && item.costingCreativeInputNeeded === true).length;
      const directCostingCount = stagedProducts.filter((item) => item.scopes.includes("costing") && item.costingCreativeInputNeeded !== true).length;
      const mockupStudioCount = stagedProducts.filter((item) => item.scopes.includes("mockup") && item.mockupMetadata?.designNeeded === false).length;
      const mockupCreativeCount = stagedProducts.filter((item) => item.scopes.includes("mockup") && item.mockupMetadata?.designNeeded === true).length;
      const samplingResampleDirectPlantCount = stagedProducts.filter((item) => item.scopes.length === 1 && getAutomaticSampleRoute(item).isResample).length;
      const samplingReviewCount = stagedProducts.filter((item) => item.scopes.length === 1 && item.scopes.includes("sample")
        && !getAutomaticSampleRoute(item).isResample && !getAutomaticSampleRoute(item).creativeChangesRequired).length;
      const samplingCreativeCount = stagedProducts.filter((item) => item.scopes.length === 1 && getAutomaticSampleRoute(item).creativeChangesRequired).length;
      const otherScopeCount = stagedProducts.filter((item) => item.scopes.some((scope) => scope !== "costing" && scope !== "mockup" && scope !== "sample")).length;
      const routes = [
        creativeFirstCount ? `${creativeFirstCount} Costing request(s) to Creative first` : "",
        directCostingCount ? `${directCostingCount} directly to Costing` : "",
        mockupStudioCount ? `${mockupStudioCount} Mockup request(s) directly to Studio` : "",
        mockupCreativeCount ? `${mockupCreativeCount} Mockup request(s) to Creative` : "",
        samplingReviewCount ? `${samplingReviewCount} Sampling request(s) to Sampling Team review` : "",
        samplingResampleDirectPlantCount ? `${samplingResampleDirectPlantCount} Resample(s) directly to Plant` : "",
        samplingCreativeCount ? `${samplingCreativeCount} new/changed Sampling request(s) through Creative, Studio, Creative approval, Sampling review, then Plant` : "",
        otherScopeCount ? "other selected scopes to their workflows" : "",
      ].filter(Boolean).join("; ");
      showToast(`✓ ${label} released${routes ? `: ${routes}` : ` into ${newStatus}`}!`);

      const isStudio = destinations.includes("Studio") || mockupStudioCount > 0;
      const isPlant = destinations.includes("Released to Plant") || samplingResampleDirectPlantCount > 0;
      const isDesign = mockupCreativeCount > 0 || creativeFirstCount > 0
        || (destinations.includes("Creative") && mockupStudioCount === 0);

      setTimeout(() => {
        navigate("/sample-requests", {
          state: {
            refresh: Date.now(),
            stage: isDesign ? "creative" : isStudio ? "studio" : isPlant ? "plant" : "pmt",
          },
        });
      }, 700);
    } catch (err) {
      console.error("Failed to release request from staging:", err);
      hasAutoSavedRef.current = allDraftsSaved;
      showToast(err instanceof Error ? err.message : "Could not release the draft request.", "error");
    } finally {
      setIsReleasing(false);
    }
  };

  return (
    <div className="flex-1 flex min-h-0 flex-col overflow-y-auto bg-[var(--surface-base)] text-zinc-900 dark:text-zinc-100 font-sans select-text">
      {/* Main Container */}
      <div className="w-full flex-1 space-y-4 px-4 py-4 sm:px-6 lg:px-8">

        {/* 1. Master Workspace Header (Navigation, Program Context & Action Ribbon) */}
        <StagingWorkspaceHeader
          programContext={programContext}
          stagedProducts={stagedProducts}
          isSubmittingAll={isSubmittingAll}
          isReleasing={isReleasing}
          onNavigateBack={handleReturnToDesk}
          onOpenAddModal={handleOpenAddProduct}
          onClearAll={handleClearStaging}
          onSaveAsDraft={handleSaveAsDraft}
          onSubmitAll={handleSubmitBatch}
          onReleaseRequest={handleReleaseRequest}
        />

        {/* 2. Staged Products Queue & Table */}
        <StagingProductList
          stagedProducts={stagedProducts}
          onOpenAddModal={handleOpenAddProduct}
          onInspectProduct={(prod) => setInspectingProduct(prod)}
          onUpdateProduct={handleUpdateStagedProduct}
          onDuplicateProduct={handleDuplicateStagedItem}
          onRemoveProduct={handleRemoveStagedItem}
        />
      </div>

      {/* 3. Add Product Modal Flow (Steps 1, 2, 3) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => {
              if (isSubmittingAll) return;
              if (designMockupHandoff) void handleReturnToDesk();
              else setIsAddModalOpen(false);
            }}
          />

          <div className="flex min-h-full items-center justify-center p-3 sm:p-5">
            {addModalStep === "scopes" && (
              <AddProductScopesStep
                selectedScopes={selectedScopes}
                isScopeDisabled={isScopeDisabled}
                onToggleScope={handleToggleScope}
                onClose={() => setIsAddModalOpen(false)}
                onProceed={handleProceedFromScopes}
              />
            )}

            {addModalStep === "design_brief" && (
              <AddProductDesignStep
                programContext={programContext}
                selectedScopes={selectedScopes}
                isEditing={Boolean(editingProduct)}
                productAlreadySelected={Boolean(
                  selectedScopes.includes("mockup") &&
                    (selectedDbSample || samplingDescription.trim() || editingProduct)
                )}
                designDesc={designDesc}
                designCount={designCount}
                designDueDate={designDueDate}
                designTrend={designTrend}
                designAudience={designAudience}
                designRemarks={designRemarks}
                uploadedImages={uploadedImages}
                webLinks={webLinks}
                linkInput={linkInput}
                mediaTab={mediaTab}
                modalError={modalError}
                isSubmitting={isSubmittingAll}
                isCompressingImages={isCompressingReferenceImages}
                onSetDesignDesc={setDesignDesc}
                onSetDesignCount={setDesignCount}
                onSetDesignDueDate={setDesignDueDate}
                onSetDesignTrend={setDesignTrend}
                onSetDesignAudience={setDesignAudience}
                onSetDesignRemarks={setDesignRemarks}
                onSetLinkInput={setLinkInput}
                onSetMediaTab={setMediaTab}
                onSetModalError={setModalError}
                onMultipleImageUpload={handleMultipleImageUpload}
                onRemoveImage={handleRemoveImage}
                onAddWebLink={handleAddWebLink}
                onRemoveWebLink={handleRemoveWebLink}
                onBackToScopes={() => {
                  const hasMockupProduct = Boolean(
                    selectedScopes.includes("mockup") &&
                      (selectedDbSample || samplingDescription.trim() || editingProduct)
                  );
                  setAddModalStep(hasMockupProduct ? "sampling_config" : "scopes");
                  setModalError(null);
                }}
                onClose={() => setIsAddModalOpen(false)}
                onSubmit={handleStageDesignBrief}
              />
            )}

            {(addModalStep === "sampling_config" || addModalStep === "product_search") && (
              <AddProductSamplingStep
                designMockupHandoff={Boolean(designMockupHandoff)}
                designHandoffDesigns={designMockupHandoff?.designs}
                selectedScopes={selectedScopes}
                modalError={modalError}
                sampleType={sampleType}
                partialRequirements={partialRequirements}
                scopeReferenceImages={scopeReferenceImages}
                isCompressingScopeImages={compressingScopeImages.size > 0}
                onSetScopeReferenceImages={updateScopeReferenceImages}
                onScopeImageProcessingChange={setScopeImageProcessing}
                samplingSearchMode={samplingSearchMode}
                productDescription={samplingDescription}
                qtyForSampling={qtyForSampling}
              onSetQtyForSampling={setQtyForSampling}
              qtyDesignCosting={qtyDesignCosting}
                customerProductCode={customerProductCode}
                barcode={costingBarcode}
                brandName={brandName}
                unitPcPack={unitPcPack}
                qtyPerPack={qtyPerPack}
                costingRequiredDate={costingRequiredDate}
                creativeInputNeeded={creativeInputNeeded}
                creativeInputRemark={creativeInputRemark}
                materialSearchQuery={materialSearchQuery}
                materialSearchResults={materialSearchResults}
                isSearchingMaterial={isSearchingMaterial}
                selectedDbSample={selectedDbSample}
                bindingHierarchy={bindingHierarchy}
                isLoadingBindingHierarchy={isLoadingBindingHierarchy}
                selectedBinding1={selectedBinding1}
                selectedBinding2={selectedBinding2}
                productCategories={productCategories}
                newProductCustomDetails={newProductCustomDetails}
                selectedCategory={selectedCategory}
                selectedSubCategory={selectedSubCategory}
                selectedThirdCategory={selectedThirdCategory}
                bindingSearchResults={bindingSearchResults}
                isSearchingBinding={isSearchingBinding}
                isSubmittingAll={isSubmittingAll}
                designNeeded={designNeeded}
                qtyForMockup={qtyForMockup}
                mockupRequiredDate={mockupRequiredDate}
                marketingShutterstockNo={marketingShutterstockNo}
                marketingMockupRemark={marketingMockupRemark}
                onSetModalError={setModalError}
                onSetSampleType={setSampleType}
                onSetPartialRequirements={setPartialRequirements}
                onSetSamplingSearchMode={(mode) => {
                  if (mode === samplingSearchMode) return;
                  clearMockupDesignChoice();
                  setSamplingSearchMode(mode);
                  setSelectedDbSample(null);
                  setSamplingDescription("");
                  setMaterialSearchQuery("");
                  setSelectedCategory("");
                  setSelectedSubCategory("");
                  setSelectedThirdCategory("");
                  setNewProductCustomDetails([]);
                  setSelectedBinding1("");
                  setSelectedBinding2("");
                  setModalError(null);
                                  }}
                onSetDesignNeeded={handleDesignNeededChange}
                onSetMarketingShutterstockNo={setMarketingShutterstockNo}
                onSetMarketingMockupRemark={setMarketingMockupRemark}
                onSetProductDescription={setSamplingDescription}
                onSetQtyForMockup={setQtyForMockup}
                onSetMockupRequiredDate={setMockupRequiredDate}
                onSetQtyDesignCosting={setQtyDesignCosting}
                onSetCustomerProductCode={setCustomerProductCode}
                onSetBarcode={setCostingBarcode}
                onSetBrandName={setBrandName}
                onSetUnitPcPack={(value) => {
                  setUnitPcPack(value);
                  setQtyPerPack(value === "PC" ? "1" : "");
                }}
                onSetQtyPerPack={setQtyPerPack}
                onSetCostingRequiredDate={setCostingRequiredDate}
                onSetCreativeInputNeeded={(value) => {
                  setCreativeInputNeeded(value);
                  if (!value) setCreativeInputRemark("");
                }}
                onSetCreativeInputRemark={setCreativeInputRemark}
                onSetMaterialSearchQuery={(query) => {
                  if (selectedDbSample) clearMockupDesignChoice();
                  setMaterialSearchQuery(query);
                  setSelectedDbSample(null);
                  setSamplingDescription("");
                  setModalError(null);
                }}
                onSelectDbSample={handleSelectDbSample}
                onInspectProduct={setInspectingCatalogProduct}
                onSelectCategory={(cat) => {
                  if (selectedDbSample) {
                    clearMockupDesignChoice();
                    setSamplingDescription("");
                  }
                  setBindingSearchResults([]);
                  setSelectedBinding1("");
                  setSelectedBinding2("");
                  setSelectedCategory(cat);
                  setSelectedSubCategory("");
                  setSelectedThirdCategory("");
                  setSelectedDbSample(null);
                }}
                onSelectSubCategory={(sub) => {
                  if (selectedDbSample) {
                    clearMockupDesignChoice();
                    setSamplingDescription("");
                  }
                  setBindingSearchResults([]);
                  setSelectedBinding1("");
                  setSelectedBinding2("");
                  setSelectedSubCategory(sub);
                  setSelectedThirdCategory("");
                  setSelectedDbSample(null);
                }}
                onSelectThirdCategory={(third) => {
                  if (selectedDbSample) {
                    clearMockupDesignChoice();
                    setSamplingDescription("");
                  }
                  setBindingSearchResults([]);
                  setSelectedBinding1("");
                  setSelectedBinding2("");
                  setSelectedThirdCategory(third);
                  setSelectedDbSample(null);
                }}
                onSetNewProductCustomDetails={setNewProductCustomDetails}
                onSelectBinding1={(b1) => {
                  if (selectedDbSample) {
                    clearMockupDesignChoice();
                    setSamplingDescription("");
                  }
                  setSelectedBinding1(b1);
                  setSelectedBinding2("");
                  setSelectedDbSample(null);
                }}
                onSelectBinding2={(b2) => {
                  if (selectedDbSample) {
                    clearMockupDesignChoice();
                    setSamplingDescription("");
                  }
                  setSelectedBinding2(b2);
                  setSelectedDbSample(null);
                }}
                onBackToScopes={() => {
                  if (isSubmittingAll) return;
                  if (feasibilityHandoff) return;
                  setModalError(null);
                  if (designMockupHandoff) void handleReturnToDesk();
                  else setAddModalStep("scopes");
                }}
                onClose={() => {
                  if (isSubmittingAll) return;
                  if (designMockupHandoff) void handleReturnToDesk();
                  else setIsAddModalOpen(false);
                }}
                onSubmit={handleStageSamplingProduct}
              />
            )}
          </div>
        </div>
      )}

      {/* 4. Inspect Specification Modal Drawer & Modals */}
      <React.Suspense fallback={null}>
        <StagedProductDrawer
          inspectingProduct={inspectingProduct}
          programYear={programContext.programYear}
          programContext={programContext}
          onClose={() => setInspectingProduct(null)}
          onRemoveProduct={(id) => {
            setInspectingProduct(null);
            handleRemoveStagedItem(id);
          }}
          onDuplicateProduct={(item) => {
            setInspectingProduct(null);
            handleDuplicateStagedItem(item);
          }}
          onEditProduct={(item) => {
            setInspectingProduct(null);
            handleEditProduct(item);
          }}
          onSaveCustomDetails={handleSaveStagedCustomDetails}
        />

        {editingDetailsProduct && (
          <StagedProductEditModal
            key={editingDetailsProduct.id}
            item={editingDetailsProduct}
            mockupOnly={editingMockupOnly}
            isSaving={isSavingDetails}
            onClose={() => { setEditingDetailsProduct(null); setEditingMockupOnly(false); }}
            onSave={handleSaveStagedRequestDetails}
          />
        )}

        <CatalogProductInspectModal
          product={inspectingCatalogProduct}
          onClose={() => setInspectingCatalogProduct(null)}
        />
      </React.Suspense>

      {/* 5. Floating Bottom Popup Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-[100] max-w-md px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold flex items-center justify-between gap-3 transition-all duration-200 ${
            toastMsg.tone === "success"
              ? "border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-zinc-900 text-emerald-800 dark:text-emerald-300 shadow-[0_8px_30px_rgba(16,185,129,0.15)]"
              : "border-rose-200 dark:border-rose-900/60 bg-white dark:bg-zinc-900 text-rose-800 dark:text-rose-300 shadow-[0_8px_30px_rgba(225,29,72,0.15)]"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {toastMsg.tone === "success" ? (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              </span>
            ) : (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 stroke-[2.5]" />
              </span>
            )}
            <span className="truncate leading-snug">{toastMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 shrink-0"
            aria-label="Close notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductStagingWorkspace;

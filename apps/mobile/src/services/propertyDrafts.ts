import AsyncStorage from "@react-native-async-storage/async-storage";

export type PropertyDraft = {
  id: string;
  title: string;
  city: string;
  neighborhood: string;
  purpose: "Venda" | "Locação";
  category: "Casa" | "Apartamento" | "Comercial" | "Rural";
  segment?: "Residencial" | "Comercial";
  zone?: "Urbana" | "Rural";
  price: string;
  bedrooms: string;
  suites?: string;
  bathrooms: string;
  parking: string;
  builtArea?: string;
  landArea?: string;
  address?: string;
  addressPublic?: boolean;
  description: string;
  photoUris: string[];
  updatedAt: string;
};

const STORAGE_KEY = "@imobiliarias/property-drafts";

function normalizeDraft(draft: PropertyDraft): PropertyDraft {
  return {
    ...draft,
    segment: draft.segment || (draft.category === "Comercial" ? "Comercial" : "Residencial"),
    zone: draft.zone || (draft.category === "Rural" ? "Rural" : "Urbana"),
    suites: draft.suites ?? "0",
    builtArea: draft.builtArea ?? "",
    landArea: draft.landArea ?? "",
    address: draft.address ?? "",
    addressPublic: draft.addressPublic ?? false,
    photoUris: Array.isArray(draft.photoUris) ? draft.photoUris : [],
  };
}

export async function getPropertyDrafts(): Promise<PropertyDraft[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PropertyDraft[];
    return parsed.map(normalizeDraft);
  } catch {
    return [];
  }
}

export async function savePropertyDraft(draft: Omit<PropertyDraft, "id" | "updatedAt"> & { id?: string }) {
  const drafts = await getPropertyDrafts();
  const id = draft.id || `draft-${Date.now()}`;
  const next = normalizeDraft({ ...draft, id, updatedAt: new Date().toISOString() } as PropertyDraft);
  const index = drafts.findIndex((item) => item.id === id);
  if (index >= 0) drafts[index] = next;
  else drafts.unshift(next);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  return next;
}

export async function removePropertyDraft(id: string) {
  const drafts = await getPropertyDrafts();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.filter((item) => item.id !== id)));
}

import AsyncStorage from "@react-native-async-storage/async-storage";

export type PropertyDraft = {
  id: string;
  title: string;
  city: string;
  neighborhood: string;
  purpose: "Venda" | "Locação";
  category: "Casa" | "Apartamento" | "Comercial" | "Rural";
  price: string;
  bedrooms: string;
  bathrooms: string;
  parking: string;
  description: string;
  photoUris: string[];
  updatedAt: string;
};

const STORAGE_KEY = "@imobiliarias/property-drafts";

export async function getPropertyDrafts(): Promise<PropertyDraft[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PropertyDraft[];
  } catch {
    return [];
  }
}

export async function savePropertyDraft(draft: Omit<PropertyDraft, "id" | "updatedAt"> & { id?: string }) {
  const drafts = await getPropertyDrafts();
  const id = draft.id || `draft-${Date.now()}`;
  const next: PropertyDraft = { ...draft, id, updatedAt: new Date().toISOString() };
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

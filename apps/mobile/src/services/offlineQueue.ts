import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { mobileSupabase } from "../lib/supabase";
import type { PropertyDraft } from "./propertyDrafts";
import { removePropertyDraft } from "./propertyDrafts";

export type SyncState = "waiting_network" | "syncing" | "synced" | "error";

export type OfflineJob = {
  clientOperationId: string;
  entityType: "property" | "property_photo" | "property_draft";
  entityLocalId: string;
  state: SyncState;
  attempts: number;
  payload: Record<string, unknown>;
  lastError?: string;
  createdAt: string;
};

const STORAGE_KEY = "@imobiliarias/offline-sync-queue";

async function readQueue(): Promise<OfflineJob[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as OfflineJob[]; } catch { return []; }
}

async function writeQueue(queue: OfflineJob[]) { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue)); }

export async function enqueueOfflineJob(job: Omit<OfflineJob, "state" | "attempts" | "createdAt">) {
  const queue = await readQueue();
  const existing = queue.find((item) => item.clientOperationId === job.clientOperationId);
  if (existing) {
    existing.payload = job.payload;
    existing.state = "waiting_network";
    existing.lastError = undefined;
  } else queue.push({ ...job, state: "waiting_network", attempts: 0, createdAt: new Date().toISOString() });
  await writeQueue(queue);
}

export async function getOfflineQueue() { return readQueue(); }

export async function retryFailedJobs() {
  const queue = await readQueue();
  queue.forEach((job) => { if (job.state === "error") { job.state = "waiting_network"; job.lastError = undefined; } });
  await writeQueue(queue);
  return processOfflineQueue();
}

function slugify(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

async function syncDraft(draft: PropertyDraft) {
  if (!mobileSupabase) throw new Error("Supabase não configurado.");
  const session = await mobileSupabase.auth.getSession();
  const userId = session.data.session?.user.id;
  if (!userId) throw new Error("Faça login no aplicativo antes de publicar.");

  const brokerResult = await mobileSupabase.from("brokers").select("id").eq("user_id", userId).eq("active", true).single();
  if (brokerResult.error) throw new Error("Usuário sem corretor ativo vinculado.");

  const cityParts = draft.city.split("-").map((part) => part.trim());
  const cityName = cityParts[0];
  const stateCode = cityParts[1]?.slice(0, 2).toUpperCase();
  let cityQuery = mobileSupabase.from("cities").select("id").ilike("name", cityName);
  if (stateCode) cityQuery = cityQuery.eq("state_code", stateCode);
  const cityResult = await cityQuery.limit(1).maybeSingle();
  if (cityResult.error || !cityResult.data) throw new Error(`Cidade não cadastrada no sistema: ${draft.city}`);

  const typeResult = await mobileSupabase.from("property_types").select("id").ilike("name", draft.category).eq("active", true).limit(1).maybeSingle();
  if (typeResult.error || !typeResult.data) throw new Error(`Tipo de imóvel não cadastrado: ${draft.category}`);

  let neighborhoodId: string | null = null;
  if (draft.neighborhood.trim()) {
    const neighborhood = await mobileSupabase.from("neighborhoods").select("id").eq("city_id", cityResult.data.id).ilike("name", draft.neighborhood.trim()).limit(1).maybeSingle();
    if (neighborhood.error) throw neighborhood.error;
    if (neighborhood.data?.id) neighborhoodId = neighborhood.data.id;
    else {
      const created = await mobileSupabase.from("neighborhoods").insert({ city_id: cityResult.data.id, name: draft.neighborhood.trim() }).select("id").single();
      if (created.error) throw created.error;
      neighborhoodId = created.data.id;
    }
  }

  const numericId = draft.id.replace(/\D/g, "").slice(-6).padStart(6, "0");
  const code = `IM-${numericId}`;
  const propertyPayload = {
    code,
    broker_id: brokerResult.data.id,
    city_id: cityResult.data.id,
    neighborhood_id: neighborhoodId,
    property_type_id: typeResult.data.id,
    title: draft.title.trim(),
    slug: `${slugify(draft.title)}-${code.toLowerCase()}`,
    description: draft.description.trim() || null,
    purpose: draft.purpose === "Venda" ? "sale" : "rent",
    zone: draft.zone === "Rural" ? "rural" : "urban",
    segment: draft.segment === "Comercial" ? "commercial" : "residential",
    publication_state: "published",
    status: "available",
    price: Number(draft.price.replace(/[^0-9.,]/g, "").replace(/\./g, "").replace(",", ".")) || 0,
    bedrooms: Number(draft.bedrooms) || 0,
    suites: Number(draft.suites) || 0,
    bathrooms: Number(draft.bathrooms) || 0,
    parking_spaces: Number(draft.parking) || 0,
    built_area_m2: Number(String(draft.builtArea || "").replace(",", ".")) || null,
    land_area_m2: Number(String(draft.landArea || "").replace(",", ".")) || null,
    address: draft.address?.trim() || null,
    address_public: Boolean(draft.addressPublic),
    published_at: new Date().toISOString(),
  };

  const propertyResult = await mobileSupabase.from("properties").upsert(propertyPayload, { onConflict: "code" }).select("id").single();
  if (propertyResult.error) throw propertyResult.error;

  for (let index = 0; index < draft.photoUris.length; index += 1) {
    const uri = draft.photoUris[index];
    const response = await fetch(uri);
    const blob = await response.blob();
    const extension = uri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
    const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
    const storagePath = `${propertyResult.data.id}/mobile/${draft.id}-${index}.${safeExtension}`;
    const upload = await mobileSupabase.storage.from("property-photos").upload(storagePath, blob, { upsert: true, contentType: blob.type || `image/${safeExtension === "jpg" ? "jpeg" : safeExtension}` });
    if (upload.error) throw upload.error;
    const photo = await mobileSupabase.from("property_photos").upsert({ property_id: propertyResult.data.id, storage_path: storagePath, position: index, is_cover: index === 0, alt_text: `${draft.title} - foto ${index + 1}` }, { onConflict: "property_id,storage_path" });
    if (photo.error) throw photo.error;
  }

  await removePropertyDraft(draft.id);
}

export async function processOfflineQueue() {
  const network = await NetInfo.fetch();
  if (!network.isConnected || !mobileSupabase) return { processed: 0, pending: (await readQueue()).length };
  const queue = await readQueue();
  let processed = 0;
  for (const job of queue) {
    if (job.state === "synced") continue;
    job.state = "syncing"; job.attempts += 1; await writeQueue(queue);
    try {
      if (job.entityType === "property_draft") await syncDraft(job.payload as unknown as PropertyDraft);
      else if (job.entityType === "property") {
        const { error } = await mobileSupabase.from("properties").upsert(job.payload, { onConflict: "code" });
        if (error) throw error;
      } else {
        const { error } = await mobileSupabase.from("property_photos").upsert(job.payload);
        if (error) throw error;
      }
      job.state = "synced"; job.lastError = undefined; processed += 1;
    } catch (error) {
      job.state = "error";
      job.lastError = error instanceof Error ? error.message : String(error);
    }
    await writeQueue(queue);
  }
  const remaining = queue.filter((item) => item.state !== "synced");
  await writeQueue(remaining);
  return { processed, pending: remaining.length };
}

export function startNetworkSyncListener() { return NetInfo.addEventListener((state) => { if (state.isConnected) void processOfflineQueue(); }); }

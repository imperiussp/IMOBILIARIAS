import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { getMobileAgencyContext } from "../lib/currentAgency";
import { mobileSupabase } from "../lib/supabase";
import { preparePropertyPhoto } from "./imageProcessing";
import type { PropertyDraft } from "./propertyDrafts";
import { removePropertyDraft } from "./propertyDrafts";

export type SyncState = "waiting_network" | "syncing" | "synced" | "error";

export type OfflineJob = {
  clientOperationId: string;
  entityType: "property" | "property_photo" | "property_draft";
  entityLocalId: string;
  agencyId?: string;
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
  try {
    const parsed = JSON.parse(raw) as OfflineJob[];
    return parsed.map((job) => job.state === "syncing" ? { ...job, state: "waiting_network" as SyncState, lastError: job.lastError || "Envio anterior interrompido; pronto para nova tentativa." } : job);
  } catch { return []; }
}

async function writeQueue(queue: OfflineJob[]) { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue)); }

export async function enqueueOfflineJob(job: Omit<OfflineJob, "state" | "attempts" | "createdAt" | "agencyId"> & { agencyId?: string }) {
  const context = await getMobileAgencyContext();
  const agencyId = job.agencyId || context?.agencyId;
  if (!agencyId) throw new Error("Não foi possível identificar a imobiliária antes de salvar a fila offline.");

  const queue = await readQueue();
  const existing = queue.find((item) => item.clientOperationId === job.clientOperationId);
  if (existing) {
    if (existing.agencyId && existing.agencyId !== agencyId) throw new Error("Esta operação offline pertence a outra imobiliária.");
    existing.agencyId = agencyId;
    existing.payload = job.payload;
    existing.state = "waiting_network";
    existing.lastError = undefined;
  } else queue.push({ ...job, agencyId, state: "waiting_network", attempts: 0, createdAt: new Date().toISOString() });
  await writeQueue(queue);
}

export async function getOfflineQueue() { return readQueue(); }

export async function removeOfflineJob(clientOperationId: string) {
  const queue = await readQueue();
  await writeQueue(queue.filter((job) => job.clientOperationId !== clientOperationId));
}

export async function retryFailedJobs() {
  const context = await getMobileAgencyContext();
  const queue = await readQueue();
  queue.forEach((job) => {
    if (job.state === "error" && (!context || !job.agencyId || job.agencyId === context.agencyId)) {
      job.state = "waiting_network";
      job.lastError = undefined;
    }
  });
  await writeQueue(queue);
  return processOfflineQueue();
}

function slugify(value: string) { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

function stableDraftCode(draftId: string) {
  const clean = draftId.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (clean.length >= 12) return `IM-${clean.slice(-12)}`;
  let hash = 2166136261;
  for (let index = 0; index < draftId.length; index += 1) {
    hash ^= draftId.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const suffix = `${clean}${hash.toString(36).toUpperCase()}`.padStart(12, "0").slice(-12);
  return `IM-${suffix}`;
}

async function blobFromUri(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error("Não foi possível preparar a imagem para envio.");
  return response.blob();
}

async function syncDraft(draft: PropertyDraft, expectedAgencyId: string) {
  if (!mobileSupabase) throw new Error("Supabase não configurado.");
  const context = await getMobileAgencyContext();
  if (!context || context.role !== "broker" || !context.brokerId) throw new Error("Usuário sem corretor ativo vinculado a uma imobiliária.");
  if (context.agencyId !== expectedAgencyId) throw new Error("A fila offline pertence a outra imobiliária e não será enviada.");

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
    const neighborhood = await mobileSupabase.from("neighborhoods").select("id").eq("city_id", cityResult.data.id).or(`agency_id.is.null,agency_id.eq.${context.agencyId}`).ilike("name", draft.neighborhood.trim()).limit(1).maybeSingle();
    if (neighborhood.error) throw neighborhood.error;
    if (neighborhood.data?.id) neighborhoodId = neighborhood.data.id;
    else throw new Error(`Bairro não cadastrado: ${draft.neighborhood}. Cadastre o bairro no painel administrativo e tente sincronizar novamente.`);
  }

  const code = stableDraftCode(draft.id);
  const propertyPayload = {
    agency_id: context.agencyId,
    code,
    broker_id: context.brokerId,
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

  const existing = await mobileSupabase.from("properties").select("id,agency_id").eq("agency_id", context.agencyId).eq("code", code).maybeSingle();
  if (existing.error) throw existing.error;

  const propertyResult = existing.data?.id
    ? await mobileSupabase.from("properties").update(propertyPayload).eq("id", existing.data.id).eq("agency_id", context.agencyId).select("id").single()
    : await mobileSupabase.from("properties").insert(propertyPayload).select("id").single();
  if (propertyResult.error) throw propertyResult.error;

  for (let index = 0; index < draft.photoUris.length; index += 1) {
    const originalUri = draft.photoUris[index];
    let prepared;
    try {
      prepared = await preparePropertyPhoto(originalUri);
    } catch {
      throw new Error(`Não foi possível otimizar a foto ${index + 1}.`);
    }

    const [fullBlob, thumbnailBlob] = await Promise.all([
      blobFromUri(prepared.fullUri),
      blobFromUri(prepared.thumbnailUri),
    ]);

    const baseName = `${draft.id}-${index}.jpg`;
    const storagePath = `${context.agencyId}/${propertyResult.data.id}/mobile/${baseName}`;
    const thumbnailPath = `${context.agencyId}/${propertyResult.data.id}/mobile/thumbs/${baseName}`;

    const fullUpload = await mobileSupabase.storage.from("property-photos").upload(storagePath, fullBlob, { upsert: true, contentType: "image/jpeg", cacheControl: "31536000" });
    if (fullUpload.error) throw fullUpload.error;

    const thumbUpload = await mobileSupabase.storage.from("property-photos").upload(thumbnailPath, thumbnailBlob, { upsert: true, contentType: "image/jpeg", cacheControl: "31536000" });
    if (thumbUpload.error) {
      await mobileSupabase.storage.from("property-photos").remove([storagePath]);
      throw thumbUpload.error;
    }

    const photo = await mobileSupabase.from("property_photos").upsert({
      property_id: propertyResult.data.id,
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
      position: index,
      is_cover: index === 0,
      alt_text: `${draft.title} - foto ${index + 1}`,
    }, { onConflict: "property_id,storage_path" });
    if (photo.error) {
      await mobileSupabase.storage.from("property-photos").remove([storagePath, thumbnailPath]);
      throw photo.error;
    }
  }

  await removePropertyDraft(draft.id);
}

export async function processOfflineQueue() {
  const network = await NetInfo.fetch();
  if (!network.isConnected || !mobileSupabase) return { processed: 0, pending: (await readQueue()).length };

  const context = await getMobileAgencyContext();
  if (!context || context.role !== "broker" || !context.brokerId) return { processed: 0, pending: (await readQueue()).length };

  const queue = await readQueue();
  let processed = 0;
  for (const job of queue) {
    if (job.state === "synced") continue;
    if (job.agencyId && job.agencyId !== context.agencyId) continue;
    job.state = "syncing"; job.attempts += 1; await writeQueue(queue);
    try {
      if (!job.agencyId) throw new Error("Operação offline antiga sem identificação de imobiliária. Salve novamente este item antes de enviar.");

      if (job.entityType === "property_draft") await syncDraft(job.payload as unknown as PropertyDraft, job.agencyId);
      else if (job.entityType === "property") {
        const payloadAgency = String(job.payload.agency_id || job.agencyId);
        if (payloadAgency !== context.agencyId) throw new Error("Imóvel offline com imobiliária divergente.");
        const payload = { ...job.payload, agency_id: context.agencyId };
        const { error } = await mobileSupabase.from("properties").upsert(payload);
        if (error) throw error;
      } else {
        const propertyId = String(job.payload.property_id || "");
        if (!propertyId) throw new Error("Foto offline sem imóvel associado.");
        const owner = await mobileSupabase.from("properties").select("id").eq("id", propertyId).eq("agency_id", context.agencyId).maybeSingle();
        if (owner.error || !owner.data) throw new Error("O imóvel desta foto não pertence à imobiliária atual.");
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

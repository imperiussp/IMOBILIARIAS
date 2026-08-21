import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { mobileSupabase } from "../lib/supabase";

export type SyncState = "waiting_network" | "syncing" | "synced" | "error";

export type OfflineJob = {
  clientOperationId: string;
  entityType: "property" | "property_photo";
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
  try {
    return JSON.parse(raw) as OfflineJob[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: OfflineJob[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export async function enqueueOfflineJob(job: Omit<OfflineJob, "state" | "attempts" | "createdAt">) {
  const queue = await readQueue();
  if (queue.some((item) => item.clientOperationId === job.clientOperationId)) return;
  queue.push({ ...job, state: "waiting_network", attempts: 0, createdAt: new Date().toISOString() });
  await writeQueue(queue);
}

export async function getOfflineQueue() {
  return readQueue();
}

export async function processOfflineQueue() {
  const network = await NetInfo.fetch();
  if (!network.isConnected || !mobileSupabase) return { processed: 0, pending: (await readQueue()).length };

  const queue = await readQueue();
  let processed = 0;

  for (const job of queue) {
    if (job.state === "synced") continue;
    job.state = "syncing";
    job.attempts += 1;
    await writeQueue(queue);

    try {
      if (job.entityType === "property") {
        const { error } = await mobileSupabase.from("properties").upsert(job.payload, { onConflict: "code" });
        if (error) throw error;
      } else {
        const { error } = await mobileSupabase.from("property_photos").upsert(job.payload);
        if (error) throw error;
      }
      job.state = "synced";
      job.lastError = undefined;
      processed += 1;
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

export function startNetworkSyncListener() {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) void processOfflineQueue();
  });
}

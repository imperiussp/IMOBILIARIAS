import { mobileSupabase } from "./supabase";

let cached: boolean | null = null;

export async function isImobiliariasBackend() {
  if (cached !== null) return cached;
  if (!mobileSupabase) return false;
  try {
    const { data, error } = await mobileSupabase.rpc("project_identity");
    cached = !error && data === "IMOBILIARIAS";
  } catch {
    cached = false;
  }
  return cached;
}

export function resetProjectGuard() { cached = null; }

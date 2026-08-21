import { supabaseBrowser } from "./supabaseBrowser";

let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;

export async function isImobiliariasBackend() {
  if (cached !== null) return cached;
  if (!supabaseBrowser) return false;
  if (pending) return pending;
  pending = supabaseBrowser.rpc("project_identity").then(({ data, error }) => {
    cached = !error && data === "IMOBILIARIAS";
    pending = null;
    return cached;
  }).catch(() => {
    cached = false;
    pending = null;
    return false;
  });
  return pending;
}

export function resetProjectGuard() { cached = null; pending = null; }

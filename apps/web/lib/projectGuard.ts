import { supabaseBrowser } from "./supabaseBrowser";

let cached: boolean | null = null;
let pending: Promise<boolean> | null = null;

export async function isImobiliariasBackend() {
  if (cached !== null) return cached;
  if (!supabaseBrowser) return false;
  if (pending) return pending;

  pending = (async () => {
    try {
      const { data, error } = await supabaseBrowser.rpc("project_identity");
      cached = !error && data === "IMOBILIARIAS";
      return cached;
    } catch {
      cached = false;
      return false;
    } finally {
      pending = null;
    }
  })();

  return pending;
}

export function resetProjectGuard() { cached = null; pending = null; }

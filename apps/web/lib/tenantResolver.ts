import { isImobiliariasBackend } from "./projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "./supabaseBrowser";

export type TenantProfile = {
  agency_id: string;
  slug: string;
  name: string;
  tagline: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  company_creci: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

function cleanHost(host: string) {
  return host.toLowerCase().trim().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
}

export function currentHostname() {
  if (typeof window === "undefined") return "";
  return cleanHost(window.location.hostname);
}

export async function resolveCurrentTenant(): Promise<TenantProfile | null> {
  if (!isSupabaseConfigured || !supabaseBrowser) return null;
  const validBackend = await isImobiliariasBackend();
  if (!validBackend) return null;
  const host = currentHostname();
  if (!host) return null;
  const { data, error } = await supabaseBrowser.rpc("resolve_agency_by_host", { p_hostname: host });
  if (error || !Array.isArray(data) || !data[0]) return null;
  return data[0] as TenantProfile;
}

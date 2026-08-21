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

export const PLATFORM_HOST = (process.env.NEXT_PUBLIC_PLATFORM_HOST || "imoveis.lenoy.com.br").toLowerCase();

function cleanHost(host: string) {
  return host.toLowerCase().trim().replace(/^https?:\/\//, "").split("/")[0].split(":")[0].replace(/\.$/, "");
}

export function currentHostname() {
  if (typeof window === "undefined") return "";
  return cleanHost(window.location.hostname);
}

export function platformTenantSlug(hostname: string) {
  const host = cleanHost(hostname);
  const suffix = `.${PLATFORM_HOST}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  if (!slug || slug.includes(".")) return null;
  return slug;
}

export function isPlatformRoot(hostname: string) {
  const host = cleanHost(hostname);
  return host === PLATFORM_HOST || host === `www.${PLATFORM_HOST}`;
}

export async function resolveCurrentTenant(): Promise<TenantProfile | null> {
  if (!isSupabaseConfigured || !supabaseBrowser) return null;
  const validBackend = await isImobiliariasBackend();
  if (!validBackend) return null;
  const host = currentHostname();
  if (!host || isPlatformRoot(host)) return null;

  const direct = await supabaseBrowser.rpc("resolve_agency_by_host", { p_hostname: host });
  if (!direct.error && Array.isArray(direct.data) && direct.data[0]) return direct.data[0] as TenantProfile;

  const slug = platformTenantSlug(host);
  if (!slug) return null;
  const bySlug = await supabaseBrowser.rpc("resolve_agency_by_slug", { p_slug: slug });
  if (bySlug.error || !Array.isArray(bySlug.data) || !bySlug.data[0]) return null;
  return bySlug.data[0] as TenantProfile;
}

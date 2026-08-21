import { isImobiliariasBackend } from "./projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "./supabaseBrowser";

export type CurrentAgency = {
  agencyId: string;
  agencyName: string;
  agencySlug: string;
  role: "owner" | "admin" | "broker" | "staff";
};

const ACTIVE_AGENCY_KEY = "@imobiliarias/active-agency-id";
const ACTIVE_STATUSES = ["trial", "active", "past_due"];

export function getPreferredAgencyId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_AGENCY_KEY) || "";
}

export function setPreferredAgencyId(agencyId: string) {
  if (typeof window === "undefined") return;
  if (agencyId) window.localStorage.setItem(ACTIVE_AGENCY_KEY, agencyId);
  else window.localStorage.removeItem(ACTIVE_AGENCY_KEY);
}

export async function getAvailableAgencies(): Promise<CurrentAgency[]> {
  if (!isSupabaseConfigured || !supabaseBrowser) return [];
  const validBackend = await isImobiliariasBackend();
  if (!validBackend) return [];

  const { data: sessionData } = await supabaseBrowser.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return [];

  const { data: memberships, error: membershipError } = await supabaseBrowser
    .from("agency_memberships")
    .select("agency_id,role,active")
    .eq("user_id", userId)
    .eq("active", true);

  if (membershipError || !memberships?.length) return [];
  const agencyIds = memberships.map((membership) => membership.agency_id);
  const { data: agencies, error: agencyError } = await supabaseBrowser
    .from("agencies")
    .select("id,name,slug,status")
    .in("id", agencyIds);

  if (agencyError || !agencies) return [];
  const membershipByAgency = new Map(memberships.map((membership) => [membership.agency_id, membership]));

  return agencies
    .filter((agency) => ACTIVE_STATUSES.includes(agency.status))
    .map((agency) => ({
      agencyId: agency.id,
      agencyName: agency.name,
      agencySlug: agency.slug,
      role: membershipByAgency.get(agency.id)?.role as CurrentAgency["role"],
    }))
    .sort((a, b) => a.agencyName.localeCompare(b.agencyName, "pt-BR"));
}

export async function getCurrentAgency(): Promise<CurrentAgency | null> {
  const agencies = await getAvailableAgencies();
  if (!agencies.length) return null;

  const preferredId = getPreferredAgencyId();
  const selected = agencies.find((agency) => agency.agencyId === preferredId) || agencies[0];
  if (selected.agencyId !== preferredId) setPreferredAgencyId(selected.agencyId);
  return selected;
}

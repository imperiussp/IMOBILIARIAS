import { isImobiliariasBackend } from "./projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "./supabaseBrowser";

export type CurrentAgency = {
  agencyId: string;
  agencyName: string;
  agencySlug: string;
  role: "owner" | "admin" | "broker" | "staff";
};

export async function getCurrentAgency(): Promise<CurrentAgency | null> {
  if (!isSupabaseConfigured || !supabaseBrowser) return null;
  const validBackend = await isImobiliariasBackend();
  if (!validBackend) return null;

  const { data: sessionData } = await supabaseBrowser.auth.getSession();
  const userId = sessionData.session?.user?.id;
  if (!userId) return null;

  const { data: memberships, error: membershipError } = await supabaseBrowser
    .from("agency_memberships")
    .select("agency_id,role,active")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1);

  const membership = memberships?.[0];
  if (membershipError || !membership) return null;

  const { data: agency, error: agencyError } = await supabaseBrowser
    .from("agencies")
    .select("id,name,slug,status")
    .eq("id", membership.agency_id)
    .maybeSingle();

  if (agencyError || !agency || !["trial", "active", "past_due"].includes(agency.status)) return null;

  return {
    agencyId: agency.id,
    agencyName: agency.name,
    agencySlug: agency.slug,
    role: membership.role as CurrentAgency["role"],
  };
}

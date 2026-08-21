import { isImobiliariasBackend } from "./projectGuard";
import { mobileSupabase, mobileSupabaseConfigured } from "./supabase";

export type MobileAgencyContext = {
  agencyId: string;
  agencyName: string;
  agencySlug: string;
  role: "owner" | "admin" | "broker" | "staff";
  brokerId: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
};

function validHex(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

export async function getMobileAgencyContext(): Promise<MobileAgencyContext | null> {
  if (!mobileSupabaseConfigured || !mobileSupabase) return null;
  const validBackend = await isImobiliariasBackend();
  if (!validBackend) return null;

  const { data: sessionData } = await mobileSupabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;

  const { data: memberships, error: membershipError } = await mobileSupabase
    .from("agency_memberships")
    .select("agency_id,role,active")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1);

  const membership = memberships?.[0];
  if (membershipError || !membership) return null;

  const { data: agency, error: agencyError } = await mobileSupabase
    .from("agencies")
    .select("id,name,slug,status,logo_url,primary_color,secondary_color")
    .eq("id", membership.agency_id)
    .maybeSingle();

  if (agencyError || !agency || !["trial", "active", "past_due"].includes(agency.status)) return null;

  const { data: broker } = await mobileSupabase
    .from("brokers")
    .select("id,active")
    .eq("agency_id", agency.id)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  return {
    agencyId: agency.id,
    agencyName: agency.name,
    agencySlug: agency.slug,
    role: membership.role as MobileAgencyContext["role"],
    brokerId: broker?.id || null,
    logoUrl: agency.logo_url || null,
    primaryColor: validHex(agency.primary_color, "#17202a"),
    secondaryColor: validHex(agency.secondary_color, "#f4f6f8"),
  };
}

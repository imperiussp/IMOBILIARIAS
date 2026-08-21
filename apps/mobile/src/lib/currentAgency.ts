import AsyncStorage from "@react-native-async-storage/async-storage";
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

const PREFERRED_AGENCY_KEY = "@imobiliarias/mobile-preferred-agency";

function validHex(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

export async function setPreferredMobileAgencyId(agencyId: string | null) {
  if (agencyId) await AsyncStorage.setItem(PREFERRED_AGENCY_KEY, agencyId);
  else await AsyncStorage.removeItem(PREFERRED_AGENCY_KEY);
}

export async function getPreferredMobileAgencyId() {
  return AsyncStorage.getItem(PREFERRED_AGENCY_KEY);
}

export async function getMobileAvailableAgencies(): Promise<MobileAgencyContext[]> {
  if (!mobileSupabaseConfigured || !mobileSupabase) return [];
  const validBackend = await isImobiliariasBackend();
  if (!validBackend) return [];

  const { data: sessionData } = await mobileSupabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return [];

  const { data: memberships, error: membershipError } = await mobileSupabase
    .from("agency_memberships")
    .select("agency_id,role,active")
    .eq("user_id", user.id)
    .eq("active", true);
  if (membershipError || !memberships?.length) return [];

  const brokerMemberships = memberships.filter((membership) => membership.role === "broker");
  if (!brokerMemberships.length) return [];
  const agencyIds = brokerMemberships.map((membership) => membership.agency_id);

  const [{ data: agencies, error: agencyError }, { data: brokers, error: brokerError }] = await Promise.all([
    mobileSupabase
      .from("agencies")
      .select("id,name,slug,status,logo_url,primary_color,secondary_color")
      .in("id", agencyIds),
    mobileSupabase
      .from("brokers")
      .select("id,agency_id,active")
      .eq("user_id", user.id)
      .eq("active", true)
      .in("agency_id", agencyIds),
  ]);
  if (agencyError || brokerError || !agencies?.length || !brokers?.length) return [];

  const membershipByAgency = new Map(brokerMemberships.map((membership) => [membership.agency_id, membership]));
  const brokerByAgency = new Map(brokers.map((broker) => [broker.agency_id, broker]));

  return agencies
    .filter((agency) => ["trial", "active", "past_due"].includes(agency.status) && brokerByAgency.has(agency.id))
    .map((agency) => {
      const membership = membershipByAgency.get(agency.id)!;
      const broker = brokerByAgency.get(agency.id)!;
      return {
        agencyId: agency.id,
        agencyName: agency.name,
        agencySlug: agency.slug,
        role: membership.role as MobileAgencyContext["role"],
        brokerId: broker.id,
        logoUrl: agency.logo_url || null,
        primaryColor: validHex(agency.primary_color, "#17202a"),
        secondaryColor: validHex(agency.secondary_color, "#f4f6f8"),
      };
    })
    .sort((a, b) => a.agencyName.localeCompare(b.agencyName, "pt-BR"));
}

export async function getMobileAgencyContext(): Promise<MobileAgencyContext | null> {
  const agencies = await getMobileAvailableAgencies();
  if (!agencies.length) return null;

  const preferred = await getPreferredMobileAgencyId();
  const selected = agencies.find((agency) => agency.agencyId === preferred) || agencies[0];
  if (!preferred || preferred !== selected.agencyId) await setPreferredMobileAgencyId(selected.agencyId);
  return selected;
}

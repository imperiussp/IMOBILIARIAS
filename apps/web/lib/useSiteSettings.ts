"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "./supabaseBrowser";

export type SiteSettings = {
  agency_name: string;
  tagline: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  company_creci: string | null;
  logo_url: string | null;
};

export const defaultSiteSettings: SiteSettings = {
  agency_name: "IMOBILIARIAS",
  tagline: "Seu imóvel, sua escolha, seu próximo passo.",
  phone: null,
  whatsapp: null,
  email: null,
  address: null,
  company_creci: null,
  logo_url: null,
};

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseBrowser) return;
    let active = true;
    void supabaseBrowser.from("site_settings").select("agency_name,tagline,phone,whatsapp,email,address,company_creci,logo_url").eq("id", 1).maybeSingle().then(({ data }) => {
      if (active && data) setSettings({ ...defaultSiteSettings, ...data } as SiteSettings);
    });
    return () => { active = false; };
  }, []);

  return settings;
}

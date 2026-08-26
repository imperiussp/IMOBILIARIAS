"use client";

import { useEffect, useState } from "react";
import { isImobiliariasBackend } from "./projectGuard";
import { isSupabaseConfigured, supabaseBrowser } from "./supabaseBrowser";
import { currentHostname, isPlatformRoot, resolveCurrentTenant } from "./tenantResolver";

export type SiteSettings = {
  agency_name: string;
  tagline: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  company_creci: string | null;
  logo_url: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  youtube_url?: string | null;
  agency_id?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  background_color?: string | null;
  text_color?: string | null;
  theme_preset?: "classic" | "modern" | "elegant" | "minimal" | null;
  button_style?: "rounded" | "square" | "pill" | null;
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
  instagram_url: null,
  facebook_url: null,
  youtube_url: null,
  agency_id: null,
  primary_color: "#17202a",
  secondary_color: "#d6ac58",
  background_color: "#f7f8fa",
  text_color: "#18212b",
  theme_preset: "classic",
  button_style: "rounded",
};

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseBrowser) return;
    let active = true;
    void (async () => {
      const host = currentHostname();
      const tenant = await resolveCurrentTenant();
      if (!active) return;
      if (tenant) {
        let theme: Partial<SiteSettings> = {};
        let socials: Partial<SiteSettings> = {};
        const [themeResult, socialResult] = await Promise.all([
          supabaseBrowser.rpc("resolve_agency_theme", { p_agency_id: tenant.agency_id }),
          supabaseBrowser.rpc("public_agency_socials_for_host", { p_hostname: window.location.hostname }),
        ]);
        if (!themeResult.error && Array.isArray(themeResult.data) && themeResult.data[0]) {
          theme = themeResult.data[0] as Partial<SiteSettings>;
        }
        if (!socialResult.error && Array.isArray(socialResult.data) && socialResult.data[0]) {
          socials = socialResult.data[0] as Partial<SiteSettings>;
        }
        if (!active) return;
        setSettings({
          ...defaultSiteSettings,
          agency_name: tenant.name,
          tagline: tenant.tagline || defaultSiteSettings.tagline,
          phone: socials.phone || tenant.phone,
          whatsapp: socials.whatsapp || tenant.whatsapp,
          email: tenant.email,
          address: tenant.address,
          company_creci: tenant.company_creci,
          logo_url: tenant.logo_url,
          instagram_url: socials.instagram_url || null,
          facebook_url: socials.facebook_url || null,
          youtube_url: socials.youtube_url || null,
          agency_id: tenant.agency_id,
          primary_color: tenant.primary_color || theme.primary_color || defaultSiteSettings.primary_color,
          secondary_color: tenant.secondary_color || theme.secondary_color || defaultSiteSettings.secondary_color,
          background_color: theme.background_color || defaultSiteSettings.background_color,
          text_color: theme.text_color || defaultSiteSettings.text_color,
          theme_preset: (theme.theme_preset as SiteSettings["theme_preset"]) || defaultSiteSettings.theme_preset,
          button_style: (theme.button_style as SiteSettings["button_style"]) || defaultSiteSettings.button_style,
        });
        return;
      }

      const localHost = host === "localhost" || host === "127.0.0.1";
      if (host && !isPlatformRoot(host) && !localHost) {
        setSettings({
          ...defaultSiteSettings,
          agency_name: "Imobiliária",
          tagline: "Imóveis selecionados para você.",
          logo_url: null,
          agency_id: null,
        });
        return;
      }

      const validBackend = await isImobiliariasBackend();
      if (!active || !validBackend) return;
      const { data } = await supabaseBrowser.from("site_settings").select("agency_name,tagline,phone,whatsapp,email,address,company_creci,logo_url,instagram_url,facebook_url,youtube_url").eq("id", 1).maybeSingle();
      if (active && data) setSettings({ ...defaultSiteSettings, ...data } as SiteSettings);
    })();
    return () => { active = false; };
  }, []);

  return settings;
}

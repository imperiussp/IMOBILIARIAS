"use client";

import { useEffect } from "react";
import { resolveCurrentTenant } from "../lib/tenantResolver";
import { supabaseBrowser } from "../lib/supabaseBrowser";

export default function TenantHeroBackgroundMount() {
  useEffect(() => {
    if (!supabaseBrowser || typeof window === "undefined") return;
    if (/\/(admin|app|login|plataforma)(\/|$)/.test(window.location.pathname)) return;

    let disposed = false;
    let observer: MutationObserver | null = null;
    let currentUrl = "";

    function applyBackground(url: string) {
      const hero = document.querySelector<HTMLElement>(".catalogHero");
      if (!hero) return false;
      const safeUrl = String(url || "").replace(/["\\]/g, "");
      if (safeUrl) {
        hero.classList.add("hasAgencyCustomBackground");
        hero.style.setProperty("--agency-hero-background", `linear-gradient(90deg, rgba(5,16,31,.78) 0%, rgba(5,16,31,.58) 48%, rgba(5,16,31,.38) 100%), url("${safeUrl}")`);
      } else {
        hero.classList.remove("hasAgencyCustomBackground");
        hero.style.removeProperty("--agency-hero-background");
      }
      return true;
    }

    void (async () => {
      const tenant = await resolveCurrentTenant();
      if (!tenant || disposed) return;
      const result = await supabaseBrowser.rpc("resolve_agency_hero_background", { p_agency_id: tenant.agency_id });
      if (disposed || result.error) return;
      currentUrl = String(result.data || "").trim();
      if (!applyBackground(currentUrl)) {
        observer = new MutationObserver(() => {
          if (applyBackground(currentUrl)) observer?.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    })();

    const onChanged = (event: Event) => {
      const custom = event as CustomEvent<{ url?: string }>;
      currentUrl = String(custom.detail?.url || "");
      applyBackground(currentUrl);
    };
    window.addEventListener("lenoy:hero-background-changed", onChanged);

    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("lenoy:hero-background-changed", onChanged);
    };
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

export default function MobileAgencyBranding() {
  useEffect(() => {
    if (!supabaseBrowser || !window.location.pathname.startsWith("/app")) return;

    let active = true;
    let observer: MutationObserver | null = null;

    function renderBrand(logoUrl: string, agencyName: string) {
      const initial = (agencyName.trim().charAt(0) || "I").toUpperCase();
      const targets = Array.from(document.querySelectorAll<HTMLElement>(".mobileAppBrand, .mobileDrawerBrand"));

      targets.forEach((target) => {
        target.querySelectorAll("img, .mobileAgencyDynamicLogo").forEach((node) => node.remove());

        const brand = document.createElement("span");
        brand.className = "mobileAgencyDynamicLogo";
        brand.setAttribute("aria-hidden", "true");

        if (logoUrl) {
          const image = document.createElement("img");
          image.src = logoUrl;
          image.alt = "";
          image.loading = "eager";
          brand.appendChild(image);
        } else {
          brand.textContent = initial;
          brand.classList.add("isInitial");
        }

        target.prepend(brand);

        const small = target.querySelector("small");
        if (small) small.textContent = agencyName || "Sua imobiliária";
      });
    }

    void (async () => {
      const current = await getCurrentAgency();
      if (!active || !current) return;

      const result = await supabaseBrowser
        .from("agencies")
        .select("logo_url,name")
        .eq("id", current.agencyId)
        .maybeSingle();
      if (!active) return;

      const agencyName = String(result.data?.name || current.agencyName || "Sua imobiliária");
      const logoUrl = String(result.data?.logo_url || "").trim();
      renderBrand(logoUrl, agencyName);

      observer = new MutationObserver(() => renderBrand(logoUrl, agencyName));
      observer.observe(document.body, { childList: true, subtree: true });
    })();

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, []);

  return <style>{`
    .mobileAppBrand > img,
    .mobileDrawerBrand > img { display:none !important; }
    .mobileAgencyDynamicLogo {
      width:40px;
      height:40px;
      flex:0 0 40px;
      display:grid;
      place-items:center;
      overflow:hidden;
      border-radius:10px;
      background:#fff;
    }
    .mobileAgencyDynamicLogo img {
      display:block !important;
      width:100%;
      height:100%;
      object-fit:contain;
    }
    .mobileAgencyDynamicLogo.isInitial {
      background:#07182d;
      color:#fff;
      font-size:17px;
      font-weight:900;
    }
  `}</style>;
}

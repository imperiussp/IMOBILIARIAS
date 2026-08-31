"use client";

import { useEffect } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";

type AgencyVisual = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
};

type BrokerVisual = {
  agency_id: string | null;
  photo_url: string | null;
  active: boolean | null;
};

function initials(name: string) {
  const value = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  return value || "CL";
}

function initialsDataUrl(name: string) {
  const label = initials(name).replace(/[<>&"']/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="48" fill="#102a45"/><circle cx="70" cy="24" r="22" fill="#d4a640" opacity=".22"/><text x="48" y="57" text-anchor="middle" font-family="Arial,sans-serif" font-size="31" font-weight="700" fill="#ffffff">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function cssUrl(value: string) {
  return `url("${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
}

export default function PlatformClientVisualFix() {
  useEffect(() => {
    if (typeof window === "undefined" || window.location.pathname !== "/plataforma") return;

    let disposed = false;
    let agencyBySlug = new Map<string, AgencyVisual>();
    let brokerPhotoByAgency = new Map<string, string>();

    const apply = () => {
      if (disposed) return;
      const cards = Array.from(document.querySelectorAll<HTMLElement>(".platformCommercialPage .commercialClientCard"));

      cards.forEach((card) => {
        const header = card.querySelector<HTMLElement>(".commercialClientHeader");
        const identity = header?.querySelector<HTMLElement>(":scope > div");
        if (!identity) return;

        const name = identity.querySelector("strong")?.textContent?.trim() || "Cliente";
        const host = identity.querySelector("small")?.textContent?.trim() || "";
        const slug = host.split(".")[0]?.trim() || "";
        const agency = slug ? agencyBySlug.get(slug) : undefined;
        const photo = agency?.logo_url?.trim() || (agency ? brokerPhotoByAgency.get(agency.id) : undefined) || initialsDataUrl(name);

        identity.classList.add("commercialClientIdentityVisual");
        identity.style.setProperty("--platform-client-avatar", cssUrl(photo));
      });
    };

    apply();

    const observer = new MutationObserver(() => apply());
    observer.observe(document.body, { childList: true, subtree: true });

    const loadVisuals = async () => {
      if (!supabaseBrowser || !isSupabaseConfigured) return;

      const agencyResult = await supabaseBrowser
        .from("agencies")
        .select("id,slug,name,logo_url");

      if (!agencyResult.error && agencyResult.data) {
        agencyBySlug = new Map(
          (agencyResult.data as AgencyVisual[]).map((agency) => [agency.slug, agency])
        );
      }

      const brokerResult = await supabaseBrowser
        .from("brokers")
        .select("agency_id,photo_url,active")
        .not("photo_url", "is", null);

      if (!brokerResult.error && brokerResult.data) {
        const next = new Map<string, string>();
        (brokerResult.data as BrokerVisual[])
          .sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)))
          .forEach((broker) => {
            if (!broker.agency_id || !broker.photo_url?.trim() || next.has(broker.agency_id)) return;
            next.set(broker.agency_id, broker.photo_url.trim());
          });
        brokerPhotoByAgency = next;
      }

      apply();
    };

    void loadVisuals();

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, []);

  return (
    <style>{`
      @media (min-width: 1101px) {
        html body .platformCommercialPage.platformCommercialPage .commercialClientsPanel .commercialClientGrid {
          display: grid !important;
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 16px !important;
        }

        html body .platformCommercialPage.platformCommercialPage .commercialClientsPanel .commercialClientCard.isEditing {
          grid-column: 1 / -1 !important;
        }
      }

      @media (max-width: 1100px) {
        html body .platformCommercialPage.platformCommercialPage .commercialClientsPanel .commercialClientGrid {
          grid-template-columns: 1fr !important;
        }

        html body .platformCommercialPage.platformCommercialPage .commercialClientsPanel .commercialClientCard.isEditing {
          grid-column: auto !important;
        }
      }

      html body .platformCommercialPage.platformCommercialPage .commercialClientHeader .commercialClientIdentityVisual {
        position: relative !important;
        min-height: 50px !important;
        padding-left: 62px !important;
        align-content: center !important;
      }

      html body .platformCommercialPage.platformCommercialPage .commercialClientHeader .commercialClientIdentityVisual::before {
        content: "" !important;
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 48px !important;
        height: 48px !important;
        border-radius: 999px !important;
        background-color: #102a45 !important;
        background-image: var(--platform-client-avatar) !important;
        background-position: center !important;
        background-repeat: no-repeat !important;
        background-size: cover !important;
        border: 2px solid #fff !important;
        box-shadow: 0 0 0 1px #d9e2e9, 0 4px 12px rgba(16, 42, 69, .12) !important;
      }
    `}</style>
  );
}

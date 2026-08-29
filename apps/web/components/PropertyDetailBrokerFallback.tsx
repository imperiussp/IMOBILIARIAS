"use client";

import { useEffect } from "react";
import { useSiteSettings } from "../lib/useSiteSettings";

function formatCreci(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const clean = raw.replace(/^creci\s*:?[\s-]*/i, "").trim();
  return clean ? `CRECI ${clean}` : "";
}

export default function PropertyDetailBrokerFallback() {
  const site = useSiteSettings();
  useEffect(() => {
    const apply = () => {
      const card = document.querySelector<HTMLElement>(".brokerCard");
      if (!card) return false;
      const title = card.querySelector<HTMLElement>("h3");
      const eyebrow = card.querySelector<HTMLElement>(".eyebrow");
      const creci = card.querySelector<HTMLElement>(".brokerCreci");
      if (!title || !creci) return false;
      const generic = !title.textContent?.trim() || /^corretor respons[aá]vel$/i.test(title.textContent.trim());
      if (!generic) return true;
      if (eyebrow) eyebrow.textContent = "ATENDIMENTO DA IMOBILIÁRIA";
      title.textContent = String(site.agency_name || "Imobiliária").trim() || "Imobiliária";
      creci.textContent = formatCreci(site.company_creci) || "CRECI da imobiliária não informado";
      card.classList.add("agencyFallbackBrokerCard");
      return true;
    };
    if (apply()) return;
    const observer = new MutationObserver(() => { if (apply()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [site.agency_name, site.company_creci]);
  return null;
}

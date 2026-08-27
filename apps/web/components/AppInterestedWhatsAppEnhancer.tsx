"use client";

import { useEffect } from "react";
import { getCurrentAgency } from "../lib/currentAgency";

function whatsappNumber(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.length >= 10 ? digits : "";
}

export default function AppInterestedWhatsAppEnhancer() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.pathname.includes("/app")) return;

    let disposed = false;
    let queued = false;
    let observer: MutationObserver | null = null;
    let agencyName = "imobiliária";

    void getCurrentAgency().then((agency) => {
      if (!disposed && agency?.agencyName) agencyName = agency.agencyName;
    });

    function enhance() {
      if (disposed) return;
      const dialog = document.querySelector<HTMLElement>(".appInterestedDialog");
      if (!dialog) return;

      const propertyTitle = dialog.querySelector<HTMLElement>(".appInterestedHead strong")?.textContent?.trim() || "imóvel";
      const propertyCode = dialog.querySelector<HTMLElement>(".appInterestedHead span")?.textContent?.trim() || "";

      dialog.querySelectorAll<HTMLElement>(".appInterestedContact.already").forEach((row) => {
        if (row.dataset.whatsappEnhanced === "1") return;

        const name = row.querySelector<HTMLElement>("span > strong")?.textContent?.trim() || "cliente";
        const details = row.querySelector<HTMLElement>("span > small")?.textContent?.trim() || "";
        const phoneCandidate = details.split("·")[0]?.trim() || "";
        const phone = whatsappNumber(phoneCandidate);
        const status = row.querySelector<HTMLElement>(":scope > em");

        const actions = document.createElement("div");
        actions.className = "appInterestedContactActions";
        if (status) actions.appendChild(status);

        if (phone) {
          const whatsapp = document.createElement("a");
          whatsapp.className = "appInterestedWhatsAppLink";
          whatsapp.href = `https://wa.me/${phone}?text=${encodeURIComponent(`Olá, ${name}. Aqui é da ${agencyName}. Estou entrando em contato sobre seu interesse no imóvel ${propertyTitle}${propertyCode ? ` (${propertyCode})` : ""}.`)}`;
          whatsapp.target = "_blank";
          whatsapp.rel = "noreferrer";
          whatsapp.textContent = "WhatsApp";
          whatsapp.setAttribute("aria-label", `Conversar com ${name} pelo WhatsApp`);
          whatsapp.addEventListener("click", (event) => event.stopPropagation());
          actions.appendChild(whatsapp);
        } else {
          const unavailable = document.createElement("span");
          unavailable.className = "appInterestedWhatsAppUnavailable";
          unavailable.textContent = "Sem WhatsApp";
          actions.appendChild(unavailable);
        }

        row.appendChild(actions);
        row.dataset.whatsappEnhanced = "1";
      });
    }

    function schedule() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        enhance();
      });
    }

    enhance();
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    return () => {
      disposed = true;
      observer?.disconnect();
    };
  }, []);

  return null;
}

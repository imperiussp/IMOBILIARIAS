"use client";

import { useEffect } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";
import saasHeroBgChunk1 from "../lib/saasHeroBgChunk1";
import saasHeroBgChunk2 from "../lib/saasHeroBgChunk2";
import saasHeroBgChunk3 from "../lib/saasHeroBgChunk3";

const FIELD_CLASS = "restoredFinancingField";
const SAAS_HERO_BG = `url("data:image/webp;base64,${saasHeroBgChunk1}${saasHeroBgChunk2}${saasHeroBgChunk3}")`;

function propertyIdFromForm(form: HTMLFormElement) {
  const link = form.querySelector<HTMLAnchorElement>('a[href*="/imovel/?id="]');
  if (!link) return "";
  try {
    return new URL(link.href, window.location.origin).searchParams.get("id") || "";
  } catch {
    return "";
  }
}

export default function PreserveCurrentFixesMount() {
  useEffect(() => {
    function applySaasHeroBackground() {
      if (!window.matchMedia("(min-width: 701px)").matches) return;
      const hero = document.querySelector<HTMLElement>(".platformLanding .platformHero");
      if (!hero) return;
      hero.style.setProperty("background-image", SAAS_HERO_BG, "important");
      hero.style.setProperty("background-repeat", "no-repeat", "important");
      hero.style.setProperty("background-position", "center center", "important");
      hero.style.setProperty("background-size", "cover", "important");
      hero.style.setProperty("background-color", "#061322", "important");
    }

    applySaasHeroBackground();
    const heroObserver = new MutationObserver(applySaasHeroBackground);
    heroObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", applySaasHeroBackground);

    return () => {
      heroObserver.disconnect();
      window.removeEventListener("resize", applySaasHeroBackground);
    };
  }, []);

  useEffect(() => {
    if (!supabaseBrowser) return;

    let active = true;
    let agencyId = "";
    const pending = new WeakMap<HTMLFormElement, string>();
    const synced = new Set<string>();

    void getCurrentAgency().then((agency) => {
      if (active) agencyId = agency?.agencyId || "";
    });

    function injectField(form: HTMLFormElement) {
      if (form.querySelector(`.${FIELD_CLASS}`)) return;

      const label = document.createElement("label");
      label.className = FIELD_CLASS;
      label.textContent = "Aceita financiamento?";

      const select = document.createElement("select");
      select.name = "financing_accepted";
      select.required = true;
      select.innerHTML = '<option value="" selected disabled>Selecione</option><option value="true">Sim</option><option value="false">Não</option>';
      label.appendChild(select);

      const description = form.querySelector<HTMLTextAreaElement>('textarea[name="description"]')?.closest("label");
      if (description) form.insertBefore(label, description);
      else form.appendChild(label);
    }

    async function syncFinancing(form: HTMLFormElement) {
      const client = supabaseBrowser;
      if (!client) return;
      const propertyId = propertyIdFromForm(form);
      if (!propertyId || synced.has(propertyId) || !agencyId) return;
      const selected = pending.get(form) || form.querySelector<HTMLSelectElement>('select[name="financing_accepted"]')?.value || "";
      if (selected !== "true" && selected !== "false") return;

      const { error } = await client
        .from("properties")
        .update({ financing_accepted: selected === "true" })
        .eq("id", propertyId)
        .eq("agency_id", agencyId);

      if (!error) {
        synced.add(propertyId);
        return;
      }

      const field = form.querySelector<HTMLElement>(`.${FIELD_CLASS}`);
      if (field && !field.querySelector("small")) {
        const warning = document.createElement("small");
        warning.textContent = "O imóvel foi salvo, mas a informação de financiamento não pôde ser registrada. Tente salvar novamente.";
        field.appendChild(warning);
      }
    }

    function scan() {
      document.querySelectorAll<HTMLFormElement>("form.propertyForm.mobilePropertyForm").forEach((form) => {
        injectField(form);
        if (propertyIdFromForm(form)) void syncFinancing(form);
      });
    }

    function onSubmit(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.matches("form.propertyForm.mobilePropertyForm")) return;
      const value = form.querySelector<HTMLSelectElement>('select[name="financing_accepted"]')?.value || "";
      if (value === "true" || value === "false") pending.set(form, value);
    }

    document.addEventListener("submit", onSubmit, true);
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    scan();

    return () => {
      active = false;
      document.removeEventListener("submit", onSubmit, true);
      observer.disconnect();
    };
  }, []);

  return <style>{`
    .tenantThemeRoot .tenantFooter{
      background:#07182d!important;
      color:rgba(255,255,255,.72)!important;
      border-top:0!important;
    }
    .tenantThemeRoot .tenantFooter strong,
    .tenantThemeRoot .tenantFooter a{color:#fff!important}
    .tenantThemeRoot .tenantFooter p,
    .tenantThemeRoot .tenantFooter span{color:rgba(255,255,255,.72)!important}
    .tenantThemeRoot .tenantFooter .tenantFooterTitle,
    .tenantThemeRoot .tenantFooter .eyebrow,
    .tenantThemeRoot .tenantFooterBrand small{color:var(--tenant-secondary,#d6ac58)!important}
    .tenantThemeRoot .tenantFooterBottom{border-top-color:rgba(255,255,255,.1)!important}
    .${FIELD_CLASS}{display:grid;gap:7px}
    .${FIELD_CLASS} small{color:#a13d3d;font-size:11px}
  `}</style>;
}
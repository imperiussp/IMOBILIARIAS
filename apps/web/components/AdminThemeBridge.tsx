"use client";

import { useEffect } from "react";
import { getCurrentAgency } from "../lib/currentAgency";
import { supabaseBrowser } from "../lib/supabaseBrowser";

function validHex(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

export default function AdminThemeBridge() {
  useEffect(() => {
    if (!window.location.pathname.includes("/admin") || !supabaseBrowser) return;
    let active = true;

    void (async () => {
      const agency = await getCurrentAgency();
      if (!agency || !active || !supabaseBrowser) return;

      const { data } = await supabaseBrowser
        .from("agencies")
        .select("primary_color,secondary_color,background_color,text_color,button_style")
        .eq("id", agency.agencyId)
        .maybeSingle();
      if (!active) return;

      const root = document.documentElement;
      root.style.setProperty("--admin-tenant-primary", validHex(data?.primary_color, "#0c2946"));
      root.style.setProperty("--admin-tenant-secondary", validHex(data?.secondary_color, "#d8ad48"));
      root.style.setProperty("--admin-tenant-background", validHex(data?.background_color, "#f5f7f9"));
      root.style.setProperty("--admin-tenant-text", validHex(data?.text_color, "#18212b"));
      root.style.setProperty("--admin-tenant-radius", data?.button_style === "pill" ? "999px" : data?.button_style === "square" ? "5px" : "12px");
    })();

    return () => { active = false; };
  }, []);

  return null;
}

"use client";

import type { CSSProperties, ReactNode } from "react";
import { useSiteSettings } from "../lib/useSiteSettings";

function validHex(value: string | null | undefined, fallback: string) {
  const text = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text : fallback;
}

export default function TenantThemeShell({ children }: { children: ReactNode }) {
  const settings = useSiteSettings();
  const primary = validHex(settings.primary_color, "#17202a");
  const secondary = validHex(settings.secondary_color, "#d6ac58");
  const background = validHex(settings.background_color, "#f7f8fa");
  const text = validHex(settings.text_color, "#18212b");
  const radius = settings.button_style === "pill" ? "999px" : settings.button_style === "square" ? "5px" : "12px";
  const vars = {
    "--tenant-primary": primary,
    "--tenant-secondary": secondary,
    "--tenant-background": background,
    "--tenant-text": text,
    "--tenant-button-radius": radius,
  } as CSSProperties;

  return <div className={`tenantThemeRoot tenantTheme-${settings.theme_preset || "classic"}`} style={vars}>{children}</div>;
}

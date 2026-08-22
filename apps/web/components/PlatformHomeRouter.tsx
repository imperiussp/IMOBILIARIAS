"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";
import { currentHostname, isPlatformRoot, resolveCurrentTenant } from "../lib/tenantResolver";
import PlatformLanding from "./PlatformLanding";
import TenantCatalogPaused from "./TenantCatalogPaused";
import TenantHome from "./TenantHome";
import TenantUnavailable from "./TenantUnavailable";

type Mode = "loading" | "platform" | "tenant" | "paused" | "unknown";

function isGitHubPagesPreview(host: string) {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname.toLowerCase();
  return host.endsWith(".github.io") && (path === "/imobiliarias" || path.startsWith("/imobiliarias/"));
}

async function publicCatalogAllowed(){
  if(!isSupabaseConfigured||!supabaseBrowser)return true;
  const result=await supabaseBrowser.rpc("platform_public_catalog_status");
  if(result.error)return false;
  const row=Array.isArray(result.data)?result.data[0]:result.data as any;
  return row?.enabled===true;
}

export default function PlatformHomeRouter() {
  const [mode, setMode] = useState<Mode>("loading");
  const [hostname, setHostname] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const host = currentHostname();
      if (!active) return;
      setHostname(host);

      if (isGitHubPagesPreview(host)) {
        setMode("platform");
        return;
      }
      if (!host || host === "localhost" || host === "127.0.0.1") {
        setMode("tenant");
        return;
      }
      if (isPlatformRoot(host)) {
        setMode("platform");
        return;
      }

      const tenant = await resolveCurrentTenant();
      if (!active) return;
      if(!tenant){setMode("unknown");return;}
      const allowed=await publicCatalogAllowed();
      if (!active) return;
      setMode(allowed?"tenant":"paused");
    })();
    return () => { active = false; };
  }, []);

  if (mode === "loading") return <main className="platformLoading"><span>LENOY IMOBILIÁRIAS</span></main>;
  if (mode === "platform") return <PlatformLanding />;
  if (mode === "paused") return <TenantCatalogPaused />;
  if (mode === "unknown") return <TenantUnavailable hostname={hostname} />;
  return <TenantHome />;
}

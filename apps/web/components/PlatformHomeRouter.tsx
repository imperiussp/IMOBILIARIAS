"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabaseBrowser } from "../lib/supabaseBrowser";
import { currentHostname, isPlatformRoot, resolveCurrentTenant } from "../lib/tenantResolver";
import HomeCouponCaptureModal from "./HomeCouponCaptureModal";
import HomePlansMirror from "./HomePlansMirror";
import PlatformLanding from "./PlatformLanding";
import TenantCatalogPaused from "./TenantCatalogPaused";
import TenantHome from "./TenantHome";
import TenantUnavailable from "./TenantUnavailable";
import TenantBillingNotice from "./TenantBillingNotice";

type Mode = "loading" | "platform" | "tenant" | "paused" | "unknown" | "billing-limited" | "billing-suspended";

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
  const [billingAgencyName,setBillingAgencyName] = useState("");

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

      if(isSupabaseConfigured && supabaseBrowser){
        const access = await supabaseBrowser.rpc("billing_public_visibility_for_host", {p_hostname:host});
        if(!active)return;
        if(access.error){setMode("paused");return;}
        if(Array.isArray(access.data) && access.data[0]){
          const state=access.data[0] as {visibility?:string;agency_name?:string};
          if(state.visibility==="limited"||state.visibility==="suspended"){
            setBillingAgencyName(state.agency_name||"");
            setMode(state.visibility==="limited"?"billing-limited":"billing-suspended");
            return;
          }
        }
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
  if (mode === "platform") return <><PlatformLanding /><HomePlansMirror /><HomeCouponCaptureModal /></>;
  if (mode === "paused") return <TenantCatalogPaused />;
  if (mode === "billing-limited") return <TenantBillingNotice level="limited" agencyName={billingAgencyName} />;
  if (mode === "billing-suspended") return <TenantBillingNotice level="suspended" agencyName={billingAgencyName} />;
  if (mode === "unknown") return <TenantUnavailable hostname={hostname} />;
  return <TenantHome />;
}

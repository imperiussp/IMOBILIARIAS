"use client";

import { useEffect, useState } from "react";
import { currentHostname, isPlatformRoot, resolveCurrentTenant } from "../lib/tenantResolver";
import PlatformLanding from "./PlatformLanding";
import TenantHome from "./TenantHome";
import TenantUnavailable from "./TenantUnavailable";

type Mode = "loading" | "platform" | "tenant" | "unknown";

export default function PlatformHomeRouter() {
  const [mode, setMode] = useState<Mode>("loading");
  const [hostname, setHostname] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const host = currentHostname();
      if (!active) return;
      setHostname(host);

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
      setMode(tenant ? "tenant" : "unknown");
    })();
    return () => { active = false; };
  }, []);

  if (mode === "loading") return <main className="platformLoading"><span>LENOY IMÓVEIS</span></main>;
  if (mode === "platform") return <PlatformLanding />;
  if (mode === "unknown") return <TenantUnavailable hostname={hostname} />;
  return <TenantHome />;
}

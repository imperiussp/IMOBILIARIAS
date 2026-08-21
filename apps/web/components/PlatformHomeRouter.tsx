"use client";

import { useEffect, useState } from "react";
import { currentHostname, isPlatformRoot } from "../lib/tenantResolver";
import PlatformLanding from "./PlatformLanding";
import TenantHome from "./TenantHome";

export default function PlatformHomeRouter() {
  const [mode, setMode] = useState<"loading" | "platform" | "tenant">("loading");

  useEffect(() => {
    const host = currentHostname();
    if (!host || host === "localhost" || host === "127.0.0.1") {
      setMode("tenant");
      return;
    }
    setMode(isPlatformRoot(host) ? "platform" : "tenant");
  }, []);

  if (mode === "loading") return <main className="platformLoading"><span>LENOY IMÓVEIS</span></main>;
  return mode === "platform" ? <PlatformLanding /> : <TenantHome />;
}

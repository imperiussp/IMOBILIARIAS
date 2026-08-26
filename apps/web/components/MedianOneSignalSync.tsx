"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type MedianOneSignalBridge = {
  login?: (externalId: string) => unknown;
  logout?: () => unknown;
};

type MedianWindow = Window & {
  median?: {
    onesignal?: MedianOneSignalBridge;
  };
};

function getOneSignalBridge() {
  if (typeof window === "undefined") return null;
  return (window as MedianWindow).median?.onesignal || null;
}

// Mantém a assinatura nativa do OneSignal vinculada ao usuário Supabase autenticado.
export default function MedianOneSignalSync() {
  useEffect(() => {
    if (!supabaseBrowser) return;

    let disposed = false;
    let syncVersion = 0;
    let lastExternalId: string | null = null;

    async function runWhenBridgeAvailable(
      version: number,
      action: (bridge: MedianOneSignalBridge) => void | Promise<void>,
    ) {
      for (let attempt = 0; attempt < 24; attempt += 1) {
        if (disposed || version !== syncVersion) return;
        const bridge = getOneSignalBridge();
        if (bridge) {
          await action(bridge);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
    }

    function syncExternalId(externalId: string | null) {
      const version = ++syncVersion;

      if (externalId) {
        if (externalId === lastExternalId) return;
        lastExternalId = externalId;
        void runWhenBridgeAvailable(version, async (bridge) => {
          if (typeof bridge.login === "function") await bridge.login(externalId);
        });
        return;
      }

      lastExternalId = null;
      void runWhenBridgeAvailable(version, async (bridge) => {
        if (typeof bridge.logout === "function") await bridge.logout();
      });
    }

    void supabaseBrowser.auth.getSession().then(({ data }) => {
      if (!disposed) syncExternalId(data.session?.user?.id || null);
    });

    const { data: authListener } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (disposed) return;
      if (event === "SIGNED_OUT") {
        syncExternalId(null);
        return;
      }
      if (session?.user?.id) syncExternalId(session.user.id);
    });

    return () => {
      disposed = true;
      syncVersion += 1;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return null;
}

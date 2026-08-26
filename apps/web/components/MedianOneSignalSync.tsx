"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type OneSignalInfo = {
  oneSignalId?: string | null;
  externalId?: string | null;
  subscription?: {
    id?: string | null;
    token?: string | null;
    optedIn?: boolean | null;
  } | null;
};

type MedianOneSignalBridge = {
  login?: (externalId: string) => Promise<unknown> | unknown;
  logout?: () => Promise<unknown> | unknown;
  info?: (() => Promise<OneSignalInfo> | OneSignalInfo) | ((options: { callback: string }) => unknown);
  onesignalInfo?: () => Promise<OneSignalInfo> | OneSignalInfo;
};

type MedianWindow = Window & {
  median?: {
    onesignal?: MedianOneSignalBridge;
  };
  median_library_ready?: () => void;
  median_onesignal_info?: (data: OneSignalInfo) => void;
};

function getMedianWindow() {
  if (typeof window === "undefined") return null;
  return window as MedianWindow;
}

function getOneSignalBridge() {
  return getMedianWindow()?.median?.onesignal || null;
}

async function readOneSignalInfo(bridge: MedianOneSignalBridge): Promise<OneSignalInfo | null> {
  try {
    if (typeof bridge.onesignalInfo === "function") {
      return (await bridge.onesignalInfo()) || null;
    }
  } catch {
    // Algumas builds expõem apenas info().
  }

  try {
    if (typeof bridge.info === "function") {
      const value = await (bridge.info as () => Promise<OneSignalInfo> | OneSignalInfo)();
      if (value && typeof value === "object") return value;
    }
  } catch {
    // O retry abaixo tentará novamente quando o bridge estiver pronto.
  }

  return null;
}

// Vincula automaticamente cada instalação nativa ao UUID do usuário autenticado.
// O external_id usado no backend é exatamente o Supabase auth.user.id.
export default function MedianOneSignalSync() {
  useEffect(() => {
    if (!supabaseBrowser) return;

    const medianWindow = getMedianWindow();
    if (!medianWindow) return;

    let disposed = false;
    let currentExternalId: string | null = null;
    let confirmedExternalId: string | null = null;
    let syncInFlight: Promise<void> | null = null;
    let latestInfo: OneSignalInfo | null = null;

    const previousInfoCallback = medianWindow.median_onesignal_info;
    medianWindow.median_onesignal_info = (data: OneSignalInfo) => {
      latestInfo = data || null;
      if (data?.externalId && data.externalId === currentExternalId) {
        confirmedExternalId = data.externalId;
      }
      previousInfoCallback?.(data);
    };

    async function syncOneSignalIdentity(): Promise<void> {
      if (disposed || !currentExternalId) return;
      if (confirmedExternalId === currentExternalId) return;
      if (syncInFlight) return syncInFlight;

      const bridge = getOneSignalBridge();
      if (!bridge || typeof bridge.login !== "function") return;

      syncInFlight = (async () => {
        try {
          await bridge.login!(currentExternalId!);

          const info = (await readOneSignalInfo(bridge)) || latestInfo;
          if (info?.externalId === currentExternalId) {
            confirmedExternalId = currentExternalId;
          }
        } catch {
          // Falha transitória: o timer tentará novamente sem quebrar o app.
        } finally {
          syncInFlight = null;
        }
      })();

      await syncInFlight;
    }

    async function clearOneSignalIdentity(): Promise<void> {
      confirmedExternalId = null;
      latestInfo = null;
      const bridge = getOneSignalBridge();
      if (!bridge || typeof bridge.logout !== "function") return;
      try {
        await bridge.logout();
      } catch {
        // Logout nativo não pode impedir o logout da sessão web.
      }
    }

    const previousMedianReady = medianWindow.median_library_ready;
    const onMedianReady = () => {
      try {
        previousMedianReady?.();
      } finally {
        void syncOneSignalIdentity();
      }
    };
    medianWindow.median_library_ready = onMedianReady;

    void supabaseBrowser.auth.getSession().then(({ data }) => {
      if (disposed) return;
      currentExternalId = data.session?.user?.id || null;
      if (currentExternalId) void syncOneSignalIdentity();
    });

    const { data: authListener } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (disposed) return;

      const nextExternalId = event === "SIGNED_OUT" ? null : session?.user?.id || null;
      const wasLoggedIn = Boolean(currentExternalId);
      currentExternalId = nextExternalId;

      if (!nextExternalId) {
        if (wasLoggedIn) void clearOneSignalIdentity();
        return;
      }

      if (confirmedExternalId !== nextExternalId) {
        confirmedExternalId = null;
        void syncOneSignalIdentity();
      }
    });

    // Se o bridge já foi injetado antes do React montar, não esperamos callback.
    if (medianWindow.median) void syncOneSignalIdentity();

    // WebViews podem inicializar Supabase e o bridge em ordens diferentes.
    // Repetimos apenas até o external_id correto estar confirmado.
    const retryTimer = window.setInterval(() => {
      if (disposed || !currentExternalId) return;
      if (confirmedExternalId === currentExternalId) return;
      if (!getOneSignalBridge()) return;
      void syncOneSignalIdentity();
    }, 1500);

    return () => {
      disposed = true;
      window.clearInterval(retryTimer);
      authListener.subscription.unsubscribe();
      if (medianWindow.median_library_ready === onMedianReady) {
        medianWindow.median_library_ready = previousMedianReady;
      }
      if (medianWindow.median_onesignal_info) {
        medianWindow.median_onesignal_info = previousInfoCallback;
      }
    };
  }, []);

  return null;
}

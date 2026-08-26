"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type OneSignalInfo = {
  oneSignalId?: string | null;
  externalId?: string | null;
  subscription?: {
    id?: string | null;
    optedIn?: boolean | null;
  } | null;
};

type MedianOneSignalBridge = {
  login?: (externalId: string) => Promise<unknown> | unknown;
  logout?: () => Promise<unknown> | unknown;
  info?: () => Promise<OneSignalInfo> | OneSignalInfo;
};

type MedianWindow = Window & {
  median?: {
    onesignal?: MedianOneSignalBridge;
  };
  median_library_ready?: () => void;
};

function getMedianWindow() {
  if (typeof window === "undefined") return null;
  return window as MedianWindow;
}

function getOneSignalBridge() {
  return getMedianWindow()?.median?.onesignal || null;
}

// Mantém a assinatura nativa do OneSignal vinculada ao usuário Supabase autenticado.
// Usa o callback oficial do Median e fallback idempotente caso a biblioteca já esteja pronta.
export default function MedianOneSignalSync() {
  useEffect(() => {
    if (!supabaseBrowser) return;

    const medianWindow = getMedianWindow();
    if (!medianWindow) return;

    let disposed = false;
    let currentExternalId: string | null = null;
    let lastSyncedExternalId: string | null = null;
    let syncInFlight: Promise<void> | null = null;

    async function syncOneSignalIdentity(): Promise<void> {
      if (disposed) return;
      if (syncInFlight) {
        await syncInFlight;
        return;
      }

      const bridge = getOneSignalBridge();
      if (!bridge) return;

      syncInFlight = (async () => {
        try {
          if (currentExternalId) {
            // login() é idempotente e deve ser chamado após cada restauração de sessão.
            if (typeof bridge.login === "function") {
              await bridge.login(currentExternalId);
              lastSyncedExternalId = currentExternalId;
            }

            // info() confirma que o SDK concluiu a associação com o externalId esperado.
            if (typeof bridge.info === "function") {
              const info = await bridge.info();
              if (info?.externalId && info.externalId !== currentExternalId) {
                if (typeof bridge.login === "function") {
                  await bridge.login(currentExternalId);
                  await bridge.info();
                }
              }
            }
            return;
          }

          if (lastSyncedExternalId && typeof bridge.logout === "function") {
            await bridge.logout();
          }
          lastSyncedExternalId = null;
        } catch {
          // Falhas transitórias do bridge não devem quebrar o app; o fallback tentará novamente.
        } finally {
          syncInFlight = null;
        }
      })();

      await syncInFlight;
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

    // Se a biblioteca já foi injetada antes do React montar, sincroniza imediatamente.
    if (medianWindow.median) {
      void syncOneSignalIdentity();
    }

    // Fallback para WebViews lentas/recarregadas. Fica ocioso após sincronizar.
    const retryTimer = window.setInterval(() => {
      if (disposed) return;
      if (!getOneSignalBridge()) return;
      if (currentExternalId && lastSyncedExternalId === currentExternalId) return;
      void syncOneSignalIdentity();
    }, 1000);

    void supabaseBrowser.auth.getSession().then(({ data }) => {
      if (disposed) return;
      currentExternalId = data.session?.user?.id || null;
      void syncOneSignalIdentity();
    });

    const { data: authListener } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (disposed) return;
      currentExternalId = event === "SIGNED_OUT" ? null : session?.user?.id || null;
      void syncOneSignalIdentity();
    });

    return () => {
      disposed = true;
      window.clearInterval(retryTimer);
      authListener.subscription.unsubscribe();
      if (medianWindow.median_library_ready === onMedianReady) {
        medianWindow.median_library_ready = previousMedianReady;
      }
    };
  }, []);

  return null;
}

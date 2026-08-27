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

type PushOpenPayload = Record<string, unknown> & {
  openPath?: string;
  notificationId?: string;
  leadId?: string;
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
  median_onesignal_push_opened?: (data: unknown) => void;
};

function getMedianWindow() {
  if (typeof window === "undefined") return null;
  return window as MedianWindow;
}

function getOneSignalBridge() {
  return getMedianWindow()?.median?.onesignal || null;
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? value as Record<string, unknown> : null;
}

function normalizePushPayload(value: unknown): PushOpenPayload {
  const root = recordFrom(value) || {};
  const notification = recordFrom(root.notification);
  const additional = recordFrom(root.additionalData)
    || recordFrom(root.data)
    || recordFrom(notification?.additionalData)
    || recordFrom(notification?.data)
    || {};
  return { ...root, ...additional } as PushOpenPayload;
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

// Vincula automaticamente cada instalação nativa ao UUID do usuário autenticado
// e trata o toque da notificação dentro do WebView do aplicativo.
export default function MedianOneSignalSync() {
  useEffect(() => {
    if (!supabaseBrowser) return;

    const db = supabaseBrowser;
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

    const previousPushOpenedCallback = medianWindow.median_onesignal_push_opened;
    medianWindow.median_onesignal_push_opened = (raw: unknown) => {
      try {
        previousPushOpenedCallback?.(raw);
      } catch {
        // Um callback anterior não pode impedir a abertura da notificação.
      }

      const payload = normalizePushPayload(raw);
      const notificationId = typeof payload.notificationId === "string" ? payload.notificationId : "";
      const leadId = typeof payload.leadId === "string" ? payload.leadId : "";
      const suppliedPath = typeof payload.openPath === "string" ? payload.openPath : "";
      const openPath = suppliedPath.startsWith("/app/")
        ? suppliedPath
        : leadId
          ? `/app/?view=contatos&lead=${encodeURIComponent(leadId)}${notificationId ? `&notification=${encodeURIComponent(notificationId)}` : ""}`
          : "/app/";

      void (async () => {
        if (notificationId) {
          try {
            const session = (await db.auth.getSession()).data.session;
            const userId = session?.user?.id || "";
            if (userId) {
              await db
                .from("app_notifications")
                .update({ read_at: new Date().toISOString() })
                .eq("id", notificationId)
                .eq("user_id", userId)
                .is("read_at", null);
            }
          } catch {
            // A leitura pode ser sincronizada depois; a navegação não deve falhar.
          }
        }

        window.dispatchEvent(new CustomEvent("lenoy:notification-opened", { detail: payload }));
        const current = `${window.location.pathname}${window.location.search}`;
        if (current !== openPath) window.location.assign(openPath);
      })();
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

    void db.auth.getSession().then(({ data }) => {
      if (disposed) return;
      currentExternalId = data.session?.user?.id || null;
      if (currentExternalId) void syncOneSignalIdentity();
    });

    const { data: authListener } = db.auth.onAuthStateChange((event, session) => {
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
      if (medianWindow.median_onesignal_push_opened) {
        medianWindow.median_onesignal_push_opened = previousPushOpenedCallback;
      }
    };
  }, []);

  return null;
}

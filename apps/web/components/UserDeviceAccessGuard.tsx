"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type DeviceRow = {
  id: string;
  label: string;
  last_seen_at?: string | null;
  created_at?: string | null;
};

type RegisterResult = {
  allowed?: boolean;
  max_devices?: number;
  active_count?: number;
  session_id?: string;
  devices?: DeviceRow[];
};

const STORAGE_KEY = "lenoy-imobiliarias-device-id-v1";

function getDeviceId() {
  if (typeof window === "undefined") return "";
  let current = window.localStorage.getItem(STORAGE_KEY);
  if (current) return current;
  current = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `web-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  window.localStorage.setItem(STORAGE_KEY, current);
  return current;
}

function getDeviceLabel() {
  if (typeof navigator === "undefined") return "Navegador";
  const ua = navigator.userAgent || "";
  const platform = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iPhone/iPad"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Macintosh|Mac OS X/i.test(ua)
          ? "Mac"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Dispositivo";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /Chrome\//i.test(ua)
      ? "Chrome"
      : /Firefox\//i.test(ua)
        ? "Firefox"
        : /Safari\//i.test(ua)
          ? "Safari"
          : "Navegador";
  return `${browser} · ${platform}`;
}

function formatLastSeen(value?: string | null) {
  if (!value) return "Acesso recente";
  try {
    return `Último acesso: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))}`;
  } catch {
    return "Acesso recente";
  }
}

export default function UserDeviceAccessGuard() {
  const [blocked, setBlocked] = useState(false);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [busyId, setBusyId] = useState("");
  const [maxDevices, setMaxDevices] = useState(2);
  const [checking, setChecking] = useState(false);

  const deviceId = useMemo(() => (typeof window === "undefined" ? "" : getDeviceId()), []);

  useEffect(() => {
    const client = supabaseBrowser;
    if (!client || !deviceId) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const register = async () => {
      const { data: sessionData } = await client.auth.getSession();
      if (!active || !sessionData.session?.user) {
        setBlocked(false);
        setDevices([]);
        return;
      }

      setChecking(true);
      const { data, error } = await client.rpc("register_user_device", {
        p_device_id: deviceId,
        p_device_label: getDeviceLabel(),
        p_user_agent: navigator.userAgent || "",
      });
      if (!active) return;
      setChecking(false);
      if (error) {
        console.error("Falha ao registrar dispositivo", error);
        return;
      }

      const result = (data || {}) as RegisterResult;
      setMaxDevices(Number(result.max_devices || 2));
      setBlocked(result.allowed === false);
      setDevices(Array.isArray(result.devices) ? result.devices : []);
    };

    const touch = async () => {
      const { data: sessionData } = await client.auth.getSession();
      if (!active || !sessionData.session?.user || blocked) return;
      const { data, error } = await client.rpc("touch_user_device", { p_device_id: deviceId });
      if (!active || error) return;
      const result = (data || {}) as { allowed?: boolean };
      if (result.allowed === false) {
        window.alert("Este dispositivo foi desconectado da sua conta porque outro acesso foi autorizado.");
        await client.auth.signOut({ scope: "local" });
        window.location.assign("/login/");
      }
    };

    void register();
    timer = setInterval(() => void touch(), 45000);

    const authListener = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") void register();
      if (event === "SIGNED_OUT") {
        setBlocked(false);
        setDevices([]);
      }
    });

    const visibility = () => {
      if (document.visibilityState === "visible") void touch();
    };
    document.addEventListener("visibilitychange", visibility);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      authListener.data.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [deviceId, blocked]);

  async function replaceDevice(sessionId: string) {
    const client = supabaseBrowser;
    if (!client || !deviceId || busyId) return;
    setBusyId(sessionId);
    const { error } = await client.rpc("revoke_user_device", { p_session_id: sessionId });
    if (!error) {
      const { data, error: registerError } = await client.rpc("register_user_device", {
        p_device_id: deviceId,
        p_device_label: getDeviceLabel(),
        p_user_agent: navigator.userAgent || "",
      });
      const result = (data || {}) as RegisterResult;
      if (!registerError && result.allowed) {
        setBlocked(false);
        setDevices([]);
      }
    }
    setBusyId("");
  }

  if (!blocked) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2147483647, background: "rgba(4,15,29,.78)", display: "grid", placeItems: "center", padding: 20 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="device-limit-title" style={{ width: "min(560px, 100%)", background: "#fff", borderRadius: 22, padding: 26, boxShadow: "0 30px 80px rgba(0,0,0,.32)", color: "#07172b" }}>
        <span style={{ display: "inline-block", fontSize: 12, fontWeight: 900, letterSpacing: ".08em", color: "#9b762d", marginBottom: 8 }}>SEGURANÇA DA CONTA</span>
        <h2 id="device-limit-title" style={{ margin: "0 0 8px", fontSize: 25 }}>Limite de dispositivos atingido</h2>
        <p style={{ margin: "0 0 20px", lineHeight: 1.55, color: "#52606d" }}>Cada usuário pode manter até {maxDevices} dispositivos ativos. Para continuar neste aparelho, escolha um dos acessos abaixo para desconectar.</p>
        <div style={{ display: "grid", gap: 10 }}>
          {devices.map((device) => (
            <div key={device.id} style={{ border: "1px solid #dfe4e8", borderRadius: 14, padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: "block", marginBottom: 4 }}>{device.label || "Dispositivo"}</strong>
                <span style={{ color: "#6d7882", fontSize: 13 }}>{formatLastSeen(device.last_seen_at)}</span>
              </div>
              <button type="button" disabled={Boolean(busyId) || checking} onClick={() => void replaceDevice(device.id)} style={{ border: 0, borderRadius: 10, background: "#a54444", color: "#fff", padding: "10px 12px", fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap", opacity: busyId && busyId !== device.id ? .55 : 1 }}>
                {busyId === device.id ? "Desconectando..." : "Desconectar"}
              </button>
            </div>
          ))}
        </div>
        <p style={{ margin: "18px 0 0", fontSize: 13, color: "#6d7882" }}>Somente o dispositivo escolhido será encerrado. Os demais permanecem conectados.</p>
      </div>
    </div>
  );
}

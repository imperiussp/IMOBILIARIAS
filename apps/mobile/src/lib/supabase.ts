import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Alert, AppState, Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const mobileSupabaseConfigured = Boolean(url && publicKey);

export const mobileSupabase = mobileSupabaseConfigured
  ? createClient(url as string, publicKey as string, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

const DEVICE_STORAGE_KEY = "@imobiliarias/device-id-v1";

type DeviceRow = {
  id: string;
  label?: string | null;
  last_seen_at?: string | null;
};

type DeviceRegistration = {
  allowed?: boolean;
  max_devices?: number;
  active_count?: number;
  devices?: DeviceRow[];
};

async function getOrCreateDeviceId() {
  let current = await AsyncStorage.getItem(DEVICE_STORAGE_KEY);
  if (current) return current;
  current = `app-${Date.now()}-${Math.random().toString(36).slice(2, 14)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_STORAGE_KEY, current);
  return current;
}

function deviceLabel() {
  const os = Platform.OS === "ios" ? "iPhone/iPad" : Platform.OS === "android" ? "Android" : Platform.OS;
  return `Aplicativo LENOY · ${os}`;
}

function lastSeen(value?: string | null) {
  if (!value) return "acesso recente";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return "acesso recente";
  }
}

async function registerDevice(deviceId: string) {
  if (!mobileSupabase) return { allowed: true } as DeviceRegistration;
  const { data, error } = await mobileSupabase.rpc("register_user_device", {
    p_device_id: deviceId,
    p_device_label: deviceLabel(),
    p_user_agent: `react-native/${Platform.OS}`,
  });
  if (error) {
    console.warn("Não foi possível registrar o dispositivo do aplicativo.", error.message);
    return { allowed: true } as DeviceRegistration;
  }
  return (data || {}) as DeviceRegistration;
}

async function signOutBlockedDevice() {
  if (!mobileSupabase) return;
  await mobileSupabase.auth.signOut();
}

async function chooseDeviceToDisconnect(deviceId: string, result: DeviceRegistration) {
  if (!mobileSupabase) return false;
  const devices = Array.isArray(result.devices) ? result.devices.slice(0, 2) : [];
  const description = devices.length
    ? devices.map((device, index) => `${index + 1}. ${device.label || "Dispositivo"} · ${lastSeen(device.last_seen_at)}`).join("\n")
    : "Há dois dispositivos ativos nesta conta.";

  return new Promise<boolean>((resolve) => {
    const buttons = [
      {
        text: "Cancelar",
        style: "cancel" as const,
        onPress: () => {
          void signOutBlockedDevice().finally(() => resolve(false));
        },
      },
      ...devices.map((device, index) => ({
        text: `Desconectar ${index + 1}`,
        onPress: () => {
          void (async () => {
            const { error } = await mobileSupabase.rpc("revoke_user_device", { p_session_id: device.id });
            if (error) {
              Alert.alert("Não foi possível desconectar", "Tente novamente em alguns instantes.");
              await signOutBlockedDevice();
              resolve(false);
              return;
            }
            const retry = await registerDevice(deviceId);
            if (retry.allowed === false) {
              Alert.alert("Limite de dispositivos", "O acesso ainda não pôde ser liberado neste aparelho.");
              await signOutBlockedDevice();
              resolve(false);
              return;
            }
            resolve(true);
          })();
        },
      })),
    ];

    Alert.alert(
      "Limite de dispositivos atingido",
      `Cada usuário pode manter até ${result.max_devices || 2} dispositivos ativos. Para continuar neste aparelho, escolha apenas um acesso para desconectar.\n\n${description}`,
      buttons,
      { cancelable: false },
    );
  });
}

export async function ensureMobileDeviceAccess() {
  if (!mobileSupabase) return true;
  const { data } = await mobileSupabase.auth.getSession();
  if (!data.session?.user) return true;
  const deviceId = await getOrCreateDeviceId();
  const result = await registerDevice(deviceId);
  if (result.allowed !== false) return true;
  return chooseDeviceToDisconnect(deviceId, result);
}

async function touchMobileDevice() {
  if (!mobileSupabase) return;
  const { data } = await mobileSupabase.auth.getSession();
  if (!data.session?.user) return;
  const deviceId = await getOrCreateDeviceId();
  const { data: touch, error } = await mobileSupabase.rpc("touch_user_device", { p_device_id: deviceId });
  if (error) return;
  const result = (touch || {}) as { allowed?: boolean };
  if (result.allowed === false) {
    Alert.alert(
      "Acesso desconectado",
      "Este aparelho foi desconectado porque outro dispositivo foi autorizado para esta conta.",
      [{ text: "OK", onPress: () => void signOutBlockedDevice() }],
      { cancelable: false },
    );
  }
}

function startMobileDeviceGuard() {
  if (!mobileSupabase) return;
  const globalState = globalThis as typeof globalThis & { __lenoyMobileDeviceGuardStarted?: boolean };
  if (globalState.__lenoyMobileDeviceGuardStarted) return;
  globalState.__lenoyMobileDeviceGuardStarted = true;

  let interval: ReturnType<typeof setInterval> | null = null;
  const startHeartbeat = () => {
    if (interval) clearInterval(interval);
    interval = setInterval(() => void touchMobileDevice(), 45000);
  };

  mobileSupabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      void ensureMobileDeviceAccess();
      startHeartbeat();
    }
    if (event === "SIGNED_OUT" && interval) {
      clearInterval(interval);
      interval = null;
    }
  });

  AppState.addEventListener("change", (state) => {
    if (state === "active") void touchMobileDevice();
  });

  void mobileSupabase.auth.getSession().then(({ data }) => {
    if (data.session?.user) {
      void ensureMobileDeviceAccess();
      startHeartbeat();
    }
  });
}

startMobileDeviceGuard();

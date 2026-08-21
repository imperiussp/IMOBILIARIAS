import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getMobileAgencyContext } from "../lib/currentAgency";
import { mobileSupabase } from "../lib/supabase";

export type BrokerNotification = {
  id: string;
  title: string;
  body: string | null;
  source: "portal" | "email" | "system";
  read_at: string | null;
  created_at: string;
  lead_id: string | null;
};

let configured = false;
let lastPresentedId = "";

async function registerDevicePushToken() {
  if (!mobileSupabase || (Platform.OS !== "android" && Platform.OS !== "ios")) return;
  const context = await getMobileAgencyContext();
  if (!context || context.role !== "broker" || !context.brokerId || !context.pushNotificationsEnabled) return;

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") return;

  const { data: authData } = await mobileSupabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return;

  try {
    const pushToken = await Notifications.getExpoPushTokenAsync();
    const token = pushToken.data?.trim();
    if (!token) return;

    await mobileSupabase.from("device_push_tokens").upsert({
      agency_id: context.agencyId,
      user_id: userId,
      platform: Platform.OS,
      token,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "user_id,token" });
  } catch {
    // Em Expo Go/build sem projectId de push, o app continua funcionando sem push remoto.
  }
}

export async function configureBrokerNotifications() {
  const context = await getMobileAgencyContext();
  if (!context || !context.pushNotificationsEnabled) return;

  if (!configured) {
    configured = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    const current = await Notifications.getPermissionsAsync();
    if (current.status !== "granted") await Notifications.requestPermissionsAsync();

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("clientes", {
        name: "Clientes e contatos",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 250, 150, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
  }

  await registerDevicePushToken();
}

export async function disableCurrentDevicePushToken() {
  if (!mobileSupabase || (Platform.OS !== "android" && Platform.OS !== "ios")) return;
  try {
    const pushToken = await Notifications.getExpoPushTokenAsync();
    const token = pushToken.data?.trim();
    if (!token) return;
    const { data: authData } = await mobileSupabase.auth.getUser();
    const userId = authData.user?.id;
    if (!userId) return;
    await mobileSupabase.from("device_push_tokens").update({ enabled: false, last_seen_at: new Date().toISOString() }).eq("user_id", userId).eq("token", token);
  } catch { /* sem token remoto neste build */ }
}

export async function loadBrokerNotifications(limit = 30): Promise<BrokerNotification[]> {
  if (!mobileSupabase) return [];
  const context = await getMobileAgencyContext();
  if (!context || context.role !== "broker" || !context.brokerId) return [];
  const { data, error } = await mobileSupabase
    .from("app_notifications")
    .select("id,title,body,source,read_at,created_at,lead_id")
    .eq("agency_id", context.agencyId)
    .eq("broker_id", context.brokerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []) as BrokerNotification[];
}

export async function countUnreadBrokerNotifications() {
  if (!mobileSupabase) return 0;
  const context = await getMobileAgencyContext();
  if (!context || context.role !== "broker" || !context.brokerId) return 0;
  const { count, error } = await mobileSupabase
    .from("app_notifications")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", context.agencyId)
    .eq("broker_id", context.brokerId)
    .is("read_at", null);
  return error ? 0 : count || 0;
}

export async function markBrokerNotificationsRead(ids?: string[]) {
  if (!mobileSupabase) return;
  const context = await getMobileAgencyContext();
  if (!context || context.role !== "broker" || !context.brokerId) return;
  let query = mobileSupabase
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("agency_id", context.agencyId)
    .eq("broker_id", context.brokerId)
    .is("read_at", null);
  if (ids?.length) query = query.in("id", ids);
  await query;
}

export async function presentNewestUnreadNotification() {
  const context = await getMobileAgencyContext();
  if (!context || !context.pushNotificationsEnabled) return countUnreadBrokerNotifications();
  const rows = await loadBrokerNotifications(10);
  const newest = rows.find((row) => !row.read_at);
  if (!newest || newest.id === lastPresentedId) return countUnreadBrokerNotifications();

  lastPresentedId = newest.id;
  await configureBrokerNotifications();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: newest.title,
      body: newest.body || "Você recebeu uma nova mensagem de cliente.",
      sound: "default",
      data: { notificationId: newest.id, leadId: newest.lead_id || "", source: newest.source },
    },
    trigger: null,
  });
  return countUnreadBrokerNotifications();
}

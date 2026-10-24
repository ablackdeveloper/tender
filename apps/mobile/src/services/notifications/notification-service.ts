import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { secureAuthStorage } from "@/services/auth/secure-auth-storage";
import { supabase } from "@/services/supabase/client";

const installationKey = "tender.notification.installation";
const tokenKey = "tender.notification.token";
const channelId = "tender-reminders";

export type NotificationRegistration =
  | { status: "registered" }
  | { status: "denied" | "simulator" | "not-configured" | "unsupported" };

async function installationId(): Promise<string> {
  const current = await secureAuthStorage.getItem(installationKey);
  if (current) return current;
  const next = Crypto.randomUUID();
  await secureAuthStorage.setItem(installationKey, next);
  return next;
}

async function invokeDevice(action: "register" | "unregister", token?: string) {
  const id = await installationId();
  const { error } = await supabase.functions.invoke("notification-devices", {
    body: { action, installationId: id, platform: Platform.OS, token },
  });
  if (error) throw error;
}

export const notificationService = {
  async registerAfterUserAction(): Promise<NotificationRegistration> {
    if (Platform.OS === "web") return { status: "unsupported" };
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(channelId, {
        name: "Flutterings reminders",
        importance: Notifications.AndroidImportance.DEFAULT,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
        sound: "default",
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const permission = current.granted
      ? current
      : await Notifications.requestPermissionsAsync();
    if (!permission.granted) return { status: "denied" };
    const projectId = Constants.easConfig?.projectId;
    if (!projectId) return { status: "not-configured" };
    try {
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      await invokeDevice("register", token);
      await secureAuthStorage.setItem(tokenKey, token);
      return { status: "registered" };
    } catch (error) {
      if (String(error).toLowerCase().includes("physical device"))
        return { status: "simulator" };
      throw error;
    }
  },
  async rotateToken(token: string): Promise<void> {
    const previous = await secureAuthStorage.getItem(tokenKey);
    if (previous === token) return;
    await invokeDevice("register", token);
    await secureAuthStorage.setItem(tokenKey, token);
  },
  async unregisterForLogout(): Promise<void> {
    if (!(await secureAuthStorage.getItem(installationKey))) return;
    try {
      await invokeDevice("unregister");
    } finally {
      await secureAuthStorage.removeItem(tokenKey);
    }
  },
  async resolveDestination(jobId: string): Promise<string> {
    const client = supabase as unknown as {
      rpc: (
        name: string,
        input: { p_job_id: string },
      ) => Promise<{ data: { route: string }[] | null; error: unknown }>;
    };
    const result = await client.rpc("resolve_notification_destination", {
      p_job_id: jobId,
    });
    const route = result.data?.[0]?.route;
    if (result.error || !route)
      throw result.error ?? new Error("unauthorized_destination");
    return route;
  },
};

export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

import * as LocalAuthentication from "expo-local-authentication";
import { Platform } from "react-native";

import { secureAuthStorage } from "@/services/auth/secure-auth-storage";

export type AppLockAvailability = {
  available: boolean;
  reason: "available" | "not_configured" | "unsupported_platform";
};

const key = (userId: string) => `tender.app_lock.${userId}`;

export const appLockService = {
  async authenticate(): Promise<boolean> {
    if (Platform.OS === "web") return false;
    const result = await LocalAuthentication.authenticateAsync({
      biometricsSecurityLevel: "strong",
      cancelLabel: "Keep locked",
      disableDeviceFallback: false,
      fallbackLabel: "Use device passcode",
      promptMessage: "Unlock Flutterings",
      promptSubtitle: "Your private pregnancy records are protected.",
      requireConfirmation: true,
    });
    return result.success;
  },

  async availability(): Promise<AppLockAvailability> {
    if (Platform.OS === "web") {
      return { available: false, reason: "unsupported_platform" };
    }
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level === LocalAuthentication.SecurityLevel.NONE
      ? { available: false, reason: "not_configured" }
      : { available: true, reason: "available" };
  },

  async clear(userId: string): Promise<void> {
    await secureAuthStorage.removeItem(key(userId));
  },

  async isEnabled(userId: string): Promise<boolean> {
    return (await secureAuthStorage.getItem(key(userId))) === "enabled";
  },

  async setEnabled(userId: string, enabled: boolean): Promise<void> {
    if (enabled) await secureAuthStorage.setItem(key(userId), "enabled");
    else await appLockService.clear(userId);
  },
};

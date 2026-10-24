import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const validSecureStoreKey = /^[A-Za-z0-9._-]+$/;
const webSessionStorage = new Map<string, string>();

function assertValidKey(key: string): void {
  if (!validSecureStoreKey.test(key)) {
    throw new Error("Auth storage key contains unsupported characters.");
  }
}

export const secureAuthStorage = {
  async getItem(key: string): Promise<string | null> {
    assertValidKey(key);
    if (Platform.OS === "web") return webSessionStorage.get(key) ?? null;

    return SecureStore.getItemAsync(key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async setItem(key: string, value: string): Promise<void> {
    assertValidKey(key);
    if (Platform.OS === "web") {
      webSessionStorage.set(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async removeItem(key: string): Promise<void> {
    assertValidKey(key);
    if (Platform.OS === "web") {
      webSessionStorage.delete(key);
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};

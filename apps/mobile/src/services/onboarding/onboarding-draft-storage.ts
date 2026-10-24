import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { onboardingDraftSchema, type OnboardingDraft } from "@/schemas/onboarding";

const webDrafts = new Map<string, string>();
const keyForUser = (userId: string) => `tender.onboarding.${userId}`;

export const onboardingDraftStorage = {
  async clear(userId: string): Promise<void> {
    const key = keyForUser(userId);
    if (Platform.OS === "web") {
      webDrafts.delete(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },

  async load(userId: string): Promise<OnboardingDraft | null> {
    const key = keyForUser(userId);
    const raw =
      Platform.OS === "web"
        ? (webDrafts.get(key) ?? null)
        : await SecureStore.getItemAsync(key, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          });
    if (!raw) return null;

    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      await this.clear(userId);
      return null;
    }
    const parsed = onboardingDraftSchema.safeParse(decoded);
    if (!parsed.success) {
      await this.clear(userId);
      return null;
    }
    return parsed.data;
  },

  async save(userId: string, draft: OnboardingDraft): Promise<void> {
    const key = keyForUser(userId);
    const value = JSON.stringify(onboardingDraftSchema.parse(draft));
    if (Platform.OS === "web") {
      webDrafts.set(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
};

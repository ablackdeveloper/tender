import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

import { mealDraftSchema, type MealDraft } from "@/schemas/meal";

const databaseName = "tender-meal-drafts.db";
const encryptionKeyName = "tender.meals.database-key.v1";
const webDrafts = new Map<string, string>();
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

function key(userId: string, mealId: string): string {
  return `${userId}:${mealId}`;
}

async function encryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(encryptionKeyName, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (existing) return existing;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  await SecureStore.setItemAsync(encryptionKeyName, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return value;
}

async function database(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync(databaseName);
    await db.execAsync(`PRAGMA key = "x'${await encryptionKey()}'";`);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS meal_drafts (
        draft_key TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS meal_drafts_user_idx ON meal_drafts(user_id);
    `);
    return db;
  })();
  return databasePromise;
}

function decode(raw: string | null): MealDraft | null {
  if (!raw) return null;
  try {
    const result = mealDraftSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export const mealDraftStorage = {
  async clear(userId: string, mealId: string): Promise<void> {
    if (Platform.OS === "web") {
      webDrafts.delete(key(userId, mealId));
      return;
    }
    await (
      await database()
    ).runAsync("DELETE FROM meal_drafts WHERE draft_key = ?", key(userId, mealId));
  },
  async clearUser(userId: string): Promise<void> {
    if (Platform.OS === "web") {
      for (const draftKey of webDrafts.keys())
        if (draftKey.startsWith(`${userId}:`)) webDrafts.delete(draftKey);
      return;
    }
    await (
      await database()
    ).runAsync("DELETE FROM meal_drafts WHERE user_id = ?", userId);
  },
  async list(userId: string): Promise<MealDraft[]> {
    if (Platform.OS === "web")
      return [...webDrafts.entries()]
        .filter(([draftKey]) => draftKey.startsWith(`${userId}:`))
        .flatMap(([, raw]) => decode(raw) ?? []);
    const rows = await (
      await database()
    ).getAllAsync<{ payload: string }>(
      "SELECT payload FROM meal_drafts WHERE user_id = ? ORDER BY updated_at DESC",
      userId,
    );
    return rows.flatMap((row) => decode(row.payload) ?? []);
  },
  async load(userId: string, mealId: string): Promise<MealDraft | null> {
    if (Platform.OS === "web")
      return decode(webDrafts.get(key(userId, mealId)) ?? null);
    const row = await (
      await database()
    ).getFirstAsync<{ payload: string }>(
      "SELECT payload FROM meal_drafts WHERE draft_key = ?",
      key(userId, mealId),
    );
    return decode(row?.payload ?? null);
  },
  async save(userId: string, draft: MealDraft): Promise<void> {
    const parsed = mealDraftSchema.parse(draft);
    const payload = JSON.stringify(parsed);
    if (Platform.OS === "web") {
      webDrafts.set(key(userId, parsed.mealId), payload);
      return;
    }
    await (
      await database()
    ).runAsync(
      `INSERT INTO meal_drafts (draft_key, user_id, payload, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(draft_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      key(userId, parsed.mealId),
      userId,
      payload,
      parsed.updatedAt,
    );
  },
};

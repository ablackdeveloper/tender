import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

import { checkInDraftSchema, type CheckInDraft } from "@/schemas/check-in";

const databaseName = "tender-protected-drafts.db";
const encryptionKeyName = "tender.checkins.database-key.v1";
const webDrafts = new Map<string, string>();
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

function draftKey(userId: string, pregnancyId: string, checkinDate: string): string {
  return `${userId}:${pregnancyId}:${checkinDate}`;
}

async function getEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(encryptionKeyName, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (existing) return existing;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  await SecureStore.setItemAsync(encryptionKeyName, key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return key;
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= (async () => {
    const key = await getEncryptionKey();
    const database = await SQLite.openDatabaseAsync(databaseName);
    await database.execAsync(`PRAGMA key = \"x'${key}'\";`);
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS checkin_drafts (
        draft_key TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    return database;
  })();
  return databasePromise;
}

async function decode(raw: string | null): Promise<CheckInDraft | null> {
  if (!raw) return null;
  try {
    const parsed = checkInDraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const checkInDraftStorage = {
  async clear(userId: string, pregnancyId: string, checkinDate: string): Promise<void> {
    const key = draftKey(userId, pregnancyId, checkinDate);
    if (Platform.OS === "web") {
      webDrafts.delete(key);
      return;
    }
    const database = await getDatabase();
    await database.runAsync("DELETE FROM checkin_drafts WHERE draft_key = ?", key);
  },

  async clearUser(userId: string): Promise<void> {
    if (Platform.OS === "web") {
      for (const key of webDrafts.keys()) {
        if (key.startsWith(`${userId}:`)) webDrafts.delete(key);
      }
      return;
    }
    const database = await getDatabase();
    await database.runAsync(
      "DELETE FROM checkin_drafts WHERE draft_key LIKE ?",
      `${userId}:%`,
    );
  },

  async load(
    userId: string,
    pregnancyId: string,
    checkinDate: string,
  ): Promise<CheckInDraft | null> {
    const key = draftKey(userId, pregnancyId, checkinDate);
    if (Platform.OS === "web") return decode(webDrafts.get(key) ?? null);
    const database = await getDatabase();
    const row = await database.getFirstAsync<{ payload: string }>(
      "SELECT payload FROM checkin_drafts WHERE draft_key = ?",
      key,
    );
    const draft = await decode(row?.payload ?? null);
    if (!draft && row) await this.clear(userId, pregnancyId, checkinDate);
    return draft;
  },

  async save(userId: string, draft: CheckInDraft): Promise<void> {
    const parsed = checkInDraftSchema.parse(draft);
    const key = draftKey(userId, parsed.pregnancyId, parsed.checkinDate);
    const payload = JSON.stringify(parsed);
    if (Platform.OS === "web") {
      webDrafts.set(key, payload);
      return;
    }
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO checkin_drafts (draft_key, payload, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(draft_key) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      key,
      payload,
      parsed.updatedAt,
    );
  },
};

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

import { journalDraftSchema, type JournalDraft } from "@/schemas/journal";

const databaseName = "tender-journal-drafts.db";
const encryptionKeyName = "tender.journal.database-key.v1";
const webDrafts = new Map<string, string>();
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

function draftKey(userId: string, entryId: string): string {
  return `${userId}:${entryId}`;
}

async function encryptionKey(): Promise<string> {
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

async function database(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= (async () => {
    const key = await encryptionKey();
    const db = await SQLite.openDatabaseAsync(databaseName);
    await db.execAsync(`PRAGMA key = "x'${key}'";`);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS journal_drafts (
        draft_key TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS journal_drafts_user_idx ON journal_drafts(user_id);
    `);
    return db;
  })();
  return databasePromise;
}

function decode(raw: string | null): JournalDraft | null {
  if (!raw) return null;
  try {
    const result = journalDraftSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export const journalDraftStorage = {
  async clear(userId: string, entryId: string): Promise<void> {
    const key = draftKey(userId, entryId);
    if (Platform.OS === "web") {
      webDrafts.delete(key);
      return;
    }
    await (
      await database()
    ).runAsync("DELETE FROM journal_drafts WHERE draft_key = ?", key);
  },

  async clearUser(userId: string): Promise<void> {
    if (Platform.OS === "web") {
      for (const key of webDrafts.keys()) {
        if (key.startsWith(`${userId}:`)) webDrafts.delete(key);
      }
      return;
    }
    await (
      await database()
    ).runAsync("DELETE FROM journal_drafts WHERE user_id = ?", userId);
  },

  async list(userId: string): Promise<JournalDraft[]> {
    if (Platform.OS === "web") {
      return [...webDrafts.entries()]
        .filter(([key]) => key.startsWith(`${userId}:`))
        .flatMap(([, raw]) => decode(raw) ?? []);
    }
    const rows = await (
      await database()
    ).getAllAsync<{ payload: string }>(
      "SELECT payload FROM journal_drafts WHERE user_id = ? ORDER BY updated_at DESC",
      userId,
    );
    return rows.flatMap((row) => decode(row.payload) ?? []);
  },

  async load(userId: string, entryId: string): Promise<JournalDraft | null> {
    const key = draftKey(userId, entryId);
    if (Platform.OS === "web") return decode(webDrafts.get(key) ?? null);
    const row = await (
      await database()
    ).getFirstAsync<{ payload: string }>(
      "SELECT payload FROM journal_drafts WHERE draft_key = ?",
      key,
    );
    return decode(row?.payload ?? null);
  },

  async save(userId: string, draft: JournalDraft): Promise<void> {
    const parsed = journalDraftSchema.parse(draft);
    const key = draftKey(userId, parsed.entryId);
    const payload = JSON.stringify(parsed);
    if (Platform.OS === "web") {
      webDrafts.set(key, payload);
      return;
    }
    await (
      await database()
    ).runAsync(
      `INSERT INTO journal_drafts (draft_key, user_id, payload, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(draft_key) DO UPDATE SET
         payload = excluded.payload, updated_at = excluded.updated_at`,
      key,
      userId,
      payload,
      parsed.updatedAt,
    );
  },
};

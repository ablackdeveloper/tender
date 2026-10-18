import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string(),
  appointmentId: z.string().nullable(),
  question: z.string().max(2000),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export type QuestionDraft = z.infer<typeof schema>;
const memory = new Map<string, string>();
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;
let pending: Promise<unknown> = Promise.resolve();
function serialize<T>(action: () => Promise<T>): Promise<T> {
  const next = pending.then(action, action);
  pending = next.catch(() => undefined);
  return next;
}
async function database() {
  databasePromise ??= (async () => {
    const keyName = "tender.questions.database-key.v1";
    const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
    let key = await SecureStore.getItemAsync(keyName, options);
    if (!key) {
      key = Array.from(await Crypto.getRandomBytesAsync(32), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      await SecureStore.setItemAsync(keyName, key, options);
    }
    const db = await SQLite.openDatabaseAsync("tender-question-drafts.db");
    await db.execAsync(`PRAGMA key = "x'${key}'";`);
    await db.execAsync(
      "CREATE TABLE IF NOT EXISTS question_drafts (owner_id TEXT NOT NULL, pregnancy_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(owner_id, pregnancy_id));",
    );
    return db;
  })();
  return databasePromise;
}
export const questionDraftStorage = {
  load(ownerId: string, pregnancyId?: string): Promise<QuestionDraft | null> {
    return serialize(async () => {
      const raw =
        Platform.OS === "web"
          ? pregnancyId
            ? memory.get(`${ownerId}:${pregnancyId}`)
            : [...memory].reverse().find(([key]) => key.startsWith(`${ownerId}:`))?.[1]
          : (
              await (
                await database()
              ).getFirstAsync<{ payload: string }>(
                pregnancyId
                  ? "SELECT payload FROM question_drafts WHERE owner_id = ? AND pregnancy_id = ?"
                  : "SELECT payload FROM question_drafts WHERE owner_id = ? ORDER BY updated_at DESC LIMIT 1",
                ...(pregnancyId ? [ownerId, pregnancyId] : [ownerId]),
              )
            )?.payload;
      return raw ? schema.parse(JSON.parse(raw)) : null;
    });
  },
  save(ownerId: string, draft: QuestionDraft): Promise<void> {
    const payload = JSON.stringify(schema.parse(draft));
    return serialize(async () => {
      if (Platform.OS === "web") {
        memory.delete(`${ownerId}:${draft.pregnancyId}`);
        memory.set(`${ownerId}:${draft.pregnancyId}`, payload);
        return;
      }
      await (
        await database()
      ).runAsync(
        "INSERT INTO question_drafts VALUES (?, ?, ?, ?) ON CONFLICT(owner_id, pregnancy_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
        ownerId,
        draft.pregnancyId,
        payload,
        Date.now(),
      );
    });
  },
  clear(ownerId: string, pregnancyId: string): Promise<void> {
    return serialize(async () => {
      if (Platform.OS === "web") {
        memory.delete(`${ownerId}:${pregnancyId}`);
        return;
      }
      await (
        await database()
      ).runAsync(
        "DELETE FROM question_drafts WHERE owner_id = ? AND pregnancy_id = ?",
        ownerId,
        pregnancyId,
      );
    });
  },
  clearUser(ownerId: string): Promise<void> {
    return serialize(async () => {
      if (Platform.OS === "web") {
        for (const key of memory.keys())
          if (key.startsWith(`${ownerId}:`)) memory.delete(key);
        return;
      }
      await (
        await database()
      ).runAsync("DELETE FROM question_drafts WHERE owner_id = ?", ownerId);
    });
  },
};

import { useSyncExternalStore } from "react";

// This key belongs only to the local preview, never to the installed app.
export const storageKey = "flutterings.preview.v1";
const eventName = "flutterings-preview-storage";
type Status = "ready" | "saved" | "error" | "conflict" | "invalid";
let status: Status = "ready";
let knownRaw: string | null = null;
let restored: Record<string, unknown> = {};
const slices = new Map<string, () => unknown>();
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function announce(next: Status) {
  status = next;
  window.dispatchEvent(new Event(eventName));
}
try {
  knownRaw = localStorage.getItem(storageKey);
  if (knownRaw !== null) {
    const saved = JSON.parse(knownRaw);
    if (!record(saved) || saved.version !== 1 || !record(saved.slices))
      throw new Error("Unsupported preview data");
    restored = saved.slices;
    status = "saved";
  }
} catch {
  status = knownRaw === null ? "error" : "invalid";
}

export function registerSlice<T extends object>(
  name: string,
  initial: T,
  valid: (value: unknown) => boolean,
  snapshot: () => unknown = () => initial,
): T {
  if (name in restored) {
    const value = restored[name];
    if (valid(value)) Object.assign(initial, value);
    else status = "invalid";
  }
  slices.set(name, snapshot);
  return initial;
}

// Check the persisted containers before passing them to real app screens.
export function matchesShape(
  value: unknown,
  defaults: Record<string, unknown>,
): boolean {
  if (!record(value)) return false;
  return Object.entries(defaults).every(([key, example]) => {
    const item = value[key];
    if (example === null)
      return item === null || typeof item === "string" || record(item);
    if (Array.isArray(example)) return Array.isArray(item);
    if (record(example)) return matchesShape(item, example);
    return typeof item === typeof example;
  });
}

export function savePreview(): boolean {
  // Never replace an unreadable snapshot or another tab's newer records.
  if (status === "invalid" || status === "conflict") return false;
  try {
    if (localStorage.getItem(storageKey) !== knownRaw) {
      announce("conflict");
      return false;
    }
    const next = JSON.stringify({
      version: 1,
      slices: Object.fromEntries(
        [...slices].map(([key, snapshot]) => [key, snapshot()]),
      ),
    });
    localStorage.setItem(storageKey, next);
    knownRaw = next;
    announce("saved");
    return true;
  } catch {
    announce("error");
    return false;
  }
}

// Save after successful repository writes, not before validation or simulated failures.
export function persistMethods<T extends object>(
  repository: T,
  names: (keyof T)[],
) {
  for (const name of names) {
    const operation = repository[name] as (...args: any[]) => Promise<unknown>;
    (repository as any)[name] = async (...args: any[]) => {
      const result = await operation(...args);
      savePreview();
      return result;
    };
  }
}

export function resetPreview() {
  if (
    !window.confirm(
      "Clear all saved preview records and drafts in this browser? This cannot be undone. Your real app account is not affected.",
    )
  )
    return;
  try {
    localStorage.removeItem(storageKey);
    // Stop delayed autosaves from restoring the cleared data during navigation.
    status = "conflict";
    location.replace("/?screen=today");
  } catch {
    announce("error");
  }
}

window.addEventListener("storage", (event) => {
  if (
    (event.key === storageKey || event.key === null) &&
    event.newValue !== knownRaw
  )
    announce("conflict");
});

export function useSaveStatus() {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener(eventName, listener);
      return () => window.removeEventListener(eventName, listener);
    },
    () => status,
  );
}

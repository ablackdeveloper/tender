import type { CheckInSyncResult } from "@/features/check-in/types";
import {
  checkInDraftSchema,
  emptyCheckInValues,
  type CheckInDraft,
  type CheckInValues,
} from "@/schemas/check-in";

export function createCheckInDraft(
  pregnancyId: string,
  checkinDate: string,
  mutationId: string,
  now: string,
): CheckInDraft {
  return checkInDraftSchema.parse({
    baseServerUpdatedAt: null,
    checkinDate,
    completedAt: null,
    completionRequestedAt: null,
    mutationId,
    pregnancyId,
    status: "dirty",
    updatedAt: now,
    values: emptyCheckInValues,
    version: 1,
  });
}

export function chooseInitialDraft(
  local: CheckInDraft | null,
  server: CheckInDraft | null,
  fallback: CheckInDraft,
): CheckInDraft {
  const normalized =
    local?.status === "syncing" ? { ...local, status: "dirty" as const } : local;
  return normalized && normalized.status !== "synced"
    ? normalized
    : (server ?? normalized ?? fallback);
}

export function updateCheckInValues(
  draft: CheckInDraft,
  values: CheckInValues,
  mutationId: string,
  now: string,
): CheckInDraft {
  return checkInDraftSchema.parse({
    ...draft,
    mutationId,
    status: "dirty",
    updatedAt: now,
    values,
  });
}

export function requestCheckInCompletion(
  draft: CheckInDraft,
  mutationId: string,
  now: string,
): CheckInDraft {
  return checkInDraftSchema.parse({
    ...draft,
    completionRequestedAt: draft.completionRequestedAt ?? now,
    mutationId,
    status: "dirty",
    updatedAt: now,
  });
}

export function applyCheckInSyncResult(
  draft: CheckInDraft,
  result: CheckInSyncResult,
  now: string,
): CheckInDraft {
  return checkInDraftSchema.parse({
    ...draft,
    baseServerUpdatedAt:
      result.status === "applied" ? result.updatedAt : draft.baseServerUpdatedAt,
    completedAt: result.completedAt,
    status: result.status === "applied" ? "synced" : "conflict",
    updatedAt: now,
  });
}

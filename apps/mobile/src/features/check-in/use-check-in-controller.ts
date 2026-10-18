import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCheckInContextQuery } from "@/features/check-in/queries";
import {
  applyCheckInSyncResult,
  chooseInitialDraft,
  createCheckInDraft,
  requestCheckInCompletion,
  updateCheckInValues as updateDraftValues,
} from "@/features/check-in/draft-state";
import { useNetworkStatus } from "@/providers/network-provider";
import type { CheckInDraft, CheckInValues } from "@/schemas/check-in";
import { checkInRepository } from "@/repositories/check-in-repository";
import { checkInDraftStorage } from "@/services/checkins/check-in-draft-storage";

export function useCheckInController(ownerId: string, checkinDate: string) {
  const contextQuery = useCheckInContextQuery(ownerId, checkinDate);
  const { isOnline } = useNetworkStatus();
  const [draft, setDraft] = useState<CheckInDraft | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const activeMutation = useRef<string | null>(null);

  useEffect(() => {
    const context = contextQuery.data;
    if (!context || storageReady) return;
    let active = true;
    void checkInDraftStorage
      .load(ownerId, context.pregnancyId, checkinDate)
      .then((local) => {
        if (!active) return;
        const next = chooseInitialDraft(
          local,
          context.serverDraft,
          createCheckInDraft(
            context.pregnancyId,
            checkinDate,
            Crypto.randomUUID(),
            new Date().toISOString(),
          ),
        );
        setDraft(next);
        setStorageReady(true);
      });
    return () => {
      active = false;
    };
  }, [checkinDate, contextQuery.data, ownerId, storageReady]);

  const persist = useCallback(
    async (next: CheckInDraft) => {
      setDraft(next);
      await checkInDraftStorage.save(ownerId, next);
    },
    [ownerId],
  );

  const sync = useCallback(
    async (source: CheckInDraft) => {
      if (!isOnline || source.status === "conflict") return source;
      const syncing = { ...source, status: "syncing" as const };
      activeMutation.current = source.mutationId;
      await checkInDraftStorage.save(ownerId, syncing);
      setDraft((current) =>
        current?.mutationId === source.mutationId ? syncing : current,
      );
      try {
        const result = await checkInRepository.sync(
          source,
          source.completionRequestedAt !== null,
        );
        const next = applyCheckInSyncResult(source, result, new Date().toISOString());
        if (activeMutation.current === source.mutationId) await persist(next);
        return next;
      } catch (error) {
        const retryable = { ...source, status: "dirty" as const };
        if (activeMutation.current === source.mutationId) await persist(retryable);
        throw error;
      }
    },
    [isOnline, ownerId, persist],
  );

  useEffect(() => {
    if (!draft || draft.status !== "dirty" || !isOnline) return;
    const timeout = setTimeout(() => void sync(draft).catch(() => undefined), 800);
    return () => clearTimeout(timeout);
  }, [draft, isOnline, sync]);

  const updateValues = useCallback(
    (values: CheckInValues) => {
      if (!draft) return;
      const next = updateDraftValues(
        draft,
        values,
        Crypto.randomUUID(),
        new Date().toISOString(),
      );
      activeMutation.current = next.mutationId;
      void persist(next);
    },
    [draft, persist],
  );

  const complete = useCallback(async () => {
    if (!draft) return null;
    const next = requestCheckInCompletion(
      draft,
      Crypto.randomUUID(),
      new Date().toISOString(),
    );
    activeMutation.current = next.mutationId;
    await persist(next);
    return isOnline ? sync(next) : next;
  }, [draft, isOnline, persist, sync]);

  const useServerVersion = useCallback(async () => {
    const refreshed = await contextQuery.refetch();
    if (!refreshed.data?.serverDraft) return;
    await persist(refreshed.data.serverDraft);
  }, [contextQuery, persist]);

  const keepDeviceVersion = useCallback(async () => {
    if (!draft) return;
    const refreshed = await contextQuery.refetch();
    const serverUpdatedAt = refreshed.data?.serverDraft?.baseServerUpdatedAt;
    if (!serverUpdatedAt) return;
    await persist({
      ...draft,
      baseServerUpdatedAt: serverUpdatedAt,
      mutationId: Crypto.randomUUID(),
      status: "dirty",
      updatedAt: new Date().toISOString(),
    });
  }, [contextQuery, draft, persist]);

  return {
    complete,
    context: contextQuery.data,
    contextQuery,
    draft,
    isOnline,
    keepDeviceVersion,
    storageReady,
    updateValues,
    useServerVersion,
  };
}

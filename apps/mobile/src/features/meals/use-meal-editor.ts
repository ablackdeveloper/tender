import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  createMealDraft,
  updateMealDraft,
  updateMealMedia,
} from "@/features/meals/draft-state";
import { mealKeys } from "@/features/meals/queries";
import { mealRepository } from "@/repositories/meal-repository";
import { journalRepository } from "@/repositories/journal-repository";
import type { MealDraft, MealValues } from "@/schemas/meal";
import { journalMediaService } from "@/services/journal/journal-media-service";
import { mealDraftStorage } from "@/services/meals/meal-draft-storage";

export function useMealEditor(input: {
  isOnline: boolean;
  mealId: string;
  ownerId: string;
  pregnancyId: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<MealDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<MealDraft | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    async (next: MealDraft) => {
      ref.current = next;
      setDraft(next);
      await mealDraftStorage.save(input.ownerId, next);
    },
    [input.ownerId],
  );

  const upload = useCallback(
    async (candidate: MealDraft) => {
      for (const job of candidate.media) {
        if (job.status !== "queued" || journalMediaService.isActive(job.assetId))
          continue;
        try {
          const uploading = { ...job, status: "uploading" as const };
          await persist(
            updateMealMedia(
              ref.current ?? candidate,
              uploading,
              new Date().toISOString(),
            ),
          );
          await journalMediaService.upload({
            job: uploading,
            ownerId: input.ownerId,
            pregnancyId: input.pregnancyId,
            onProgress: (progress) => {
              const current = ref.current;
              if (!current) return;
              void persist(
                updateMealMedia(
                  current,
                  {
                    ...uploading,
                    progress,
                    status: progress === 1 ? "ready" : "uploading",
                  },
                  new Date().toISOString(),
                ),
              );
            },
          });
        } catch {
          const current = ref.current;
          if (!current) continue;
          await persist(
            updateMealMedia(
              current,
              { ...job, errorCode: "upload_failed", status: "failed" },
              new Date().toISOString(),
            ),
          );
          setError(
            "The photo will need another upload attempt. Your meal notes are safe.",
          );
        }
      }
    },
    [input.ownerId, input.pregnancyId, persist],
  );

  const sync = useCallback(
    async (candidate?: MealDraft) => {
      const current = candidate ?? ref.current;
      if (!current || !input.isOnline) return;
      const syncing = { ...current, status: "syncing" as const };
      await persist(syncing);
      try {
        const result = await mealRepository.save(syncing);
        const next: MealDraft = {
          ...syncing,
          baseServerUpdatedAt: result.updatedAt,
          status: result.status === "saved" ? "synced" : "conflict",
          updatedAt: new Date().toISOString(),
        };
        await persist(next);
        await queryClient.invalidateQueries({ queryKey: mealKeys.all });
        if (result.status === "saved") void upload(next);
      } catch {
        await persist({ ...syncing, status: "dirty" });
        setError("Saved as a protected device draft. Sync will retry when online.");
      }
    },
    [input.isOnline, persist, queryClient, upload],
  );

  useEffect(() => {
    let active = true;
    void mealDraftStorage.load(input.ownerId, input.mealId).then(async (saved) => {
      if (!active) return;
      const initial =
        saved ??
        createMealDraft(
          input.pregnancyId,
          input.mealId,
          Crypto.randomUUID(),
          new Date().toISOString(),
        );
      const resumed = {
        ...initial,
        media: initial.media.map((job) =>
          job.status === "uploading" ? { ...job, status: "queued" as const } : job,
        ),
      };
      await persist(resumed);
    });
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [input.mealId, input.ownerId, input.pregnancyId, persist]);

  const update = useCallback(
    (patch: Partial<MealValues>) => {
      if (!ref.current) return;
      const next = updateMealDraft(
        ref.current,
        patch,
        Crypto.randomUUID(),
        new Date().toISOString(),
      );
      void persist(next);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void sync(next), 700);
    },
    [persist, sync],
  );

  const addImage = useCallback(
    async (source: "camera" | "library") => {
      const current = ref.current;
      if (!current) return;
      try {
        const job = await journalMediaService.prepareImage({
          assetId: Crypto.randomUUID(),
          mealId: current.mealId,
          objectId: Crypto.randomUUID(),
          source,
        });
        if (!job) return;
        const next = updateMealMedia(current, job, new Date().toISOString());
        await persist(next);
        await sync(next);
      } catch (cause) {
        setError(
          cause instanceof Error && cause.message === "camera_permission_denied"
            ? "Camera permission was not granted."
            : "The photo could not be prepared. Your meal notes are safe.",
        );
      }
    },
    [persist, sync],
  );

  const removeMedia = useCallback(
    async (assetId: string) => {
      const current = ref.current;
      const job = current?.media.find((item) => item.assetId === assetId);
      if (!current || !job) return;
      await journalMediaService.cancel(assetId);
      if (
        job.status === "ready" ||
        job.status === "failed" ||
        job.status === "uploading"
      ) {
        try {
          await journalRepository.deleteMedia(input.ownerId, assetId);
        } catch {
          if (job.status !== "failed") {
            setError("Photo deletion will need to be retried.");
            return;
          }
        }
      }
      journalMediaService.deleteLocal(job.localUri);
      await persist({
        ...current,
        media: current.media.filter((item) => item.assetId !== assetId),
        updatedAt: new Date().toISOString(),
      });
    },
    [input.ownerId, persist],
  );

  const retryMedia = useCallback(
    async (assetId: string) => {
      const current = ref.current;
      const job = current?.media.find((item) => item.assetId === assetId);
      if (!current || !job || job.status !== "failed") return;
      const next = updateMealMedia(
        current,
        { ...job, errorCode: null, progress: 0, status: "queued" },
        new Date().toISOString(),
      );
      await persist(next);
      if (input.isOnline) void upload(next);
    },
    [input.isOnline, persist, upload],
  );

  return { addImage, draft, error, removeMedia, retryMedia, sync, update };
}

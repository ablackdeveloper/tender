import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  applyJournalSave,
  applyMediaFailure,
  chooseJournalDraft,
  createJournalDraft,
  updateJournalDraft,
  updateMediaJob,
} from "@/features/journal/draft-state";
import { journalKeys } from "@/features/journal/queries";
import { entryToDraft, journalRepository } from "@/repositories/journal-repository";
import {
  journalSaveInputSchema,
  type JournalDraft,
  type MediaUploadJob,
} from "@/schemas/journal";
import { journalDraftStorage } from "@/services/journal/journal-draft-storage";
import { journalMediaService } from "@/services/journal/journal-media-service";

export function useJournalEditor(input: {
  entryId: string;
  isOnline: boolean;
  ownerId: string;
  pregnancyId: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<JournalDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef<JournalDraft | null>(null);

  const persist = useCallback(
    async (next: JournalDraft) => {
      draftRef.current = next;
      setDraft(next);
      await journalDraftStorage.save(input.ownerId, next);
    },
    [input.ownerId],
  );

  const uploadJob = useCallback(
    async (job: MediaUploadJob) => {
      const current = draftRef.current;
      if (!current || !input.isOnline || job.status === "review") return;
      const uploading = { ...job, errorCode: null, status: "uploading" as const };
      await persist(updateMediaJob(current, uploading, new Date().toISOString()));
      try {
        await journalMediaService.upload({
          job: uploading,
          onProgress: (progress) => {
            const latest = draftRef.current;
            if (!latest) return;
            void persist(
              updateMediaJob(
                latest,
                {
                  ...uploading,
                  progress,
                  status: progress === 1 ? "ready" : "uploading",
                },
                new Date().toISOString(),
              ),
            );
          },
          ownerId: input.ownerId,
          pregnancyId: input.pregnancyId,
        });
      } catch {
        const latest = draftRef.current;
        if (latest)
          await persist(
            applyMediaFailure(
              latest,
              job.assetId,
              "upload_failed",
              new Date().toISOString(),
            ),
          );
      }
    },
    [input.isOnline, input.ownerId, input.pregnancyId, persist],
  );

  const sync = useCallback(
    async (candidate?: JournalDraft) => {
      const current = candidate ?? draftRef.current;
      if (!current || !input.isOnline) return;
      const parsed = journalSaveInputSchema.safeParse(current);
      if (!parsed.success) return;
      const saving = { ...current, status: "saving" as const };
      await persist(saving);
      try {
        const result = await journalRepository.save(parsed.data);
        const saved = applyJournalSave(saving, result);
        await persist(saved);
        if (result.status === "saved") {
          await queryClient.invalidateQueries({ queryKey: journalKeys.all });
          for (const job of saved.media) {
            if (job.status === "queued" || job.status === "uploading")
              void uploadJob(job);
          }
        }
      } catch {
        await persist({ ...saving, status: "dirty" });
        setError("Entry saved on this device. Server sync will retry.");
      }
    },
    [input.isOnline, persist, queryClient, uploadJob],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      const now = new Date().toISOString();
      const effectiveId = input.entryId === "new" ? Crypto.randomUUID() : input.entryId;
      const [local, serverEntry] = await Promise.all([
        journalDraftStorage.load(input.ownerId, effectiveId),
        input.entryId === "new"
          ? Promise.resolve(null)
          : journalRepository.getEntry(input.ownerId, input.entryId),
      ]);
      if (!active) return;
      const initial = chooseJournalDraft(
        local,
        serverEntry
          ? entryToDraft(serverEntry)
          : createJournalDraft({
              entryId: effectiveId,
              now,
              pregnancyId: input.pregnancyId,
            }),
      );
      if (initial) {
        const resumed = {
          ...initial,
          media: initial.media.map((job) =>
            job.status === "uploading" ? { ...job, status: "queued" as const } : job,
          ),
        };
        await persist(resumed);
        if (input.isOnline && resumed.media.some((job) => job.status === "queued"))
          void sync(resumed);
      }
    })().catch(() => setError("Unable to open this entry."));
    return () => {
      active = false;
    };
  }, [input.entryId, input.isOnline, input.ownerId, input.pregnancyId, persist, sync]);

  const update = useCallback(
    (patch: Parameters<typeof updateJournalDraft>[1]) => {
      const current = draftRef.current;
      if (!current) return;
      const next = updateJournalDraft(current, patch, new Date().toISOString());
      void persist(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void sync(next), 800);
    },
    [persist, sync],
  );

  const addImage = useCallback(
    async (source: "camera" | "library") => {
      const current = draftRef.current;
      if (!current) return;
      try {
        const job = await journalMediaService.prepareImage({
          assetId: Crypto.randomUUID(),
          entryId: current.entryId,
          objectId: Crypto.randomUUID(),
          source,
        });
        if (!job) return;
        const next = updateMediaJob(current, job, new Date().toISOString());
        await persist(next);
        await sync(next);
      } catch (cause) {
        setError(
          cause instanceof Error && cause.message === "camera_permission_denied"
            ? "Camera permission was not granted."
            : "The image could not be prepared. Your text draft is safe.",
        );
      }
    },
    [persist, sync],
  );

  const addVoice = useCallback(
    async (uri: string) => {
      const current = draftRef.current;
      if (!current) return;
      try {
        const job = await journalMediaService.stageVoice({
          assetId: Crypto.randomUUID(),
          entryId: current.entryId,
          objectId: Crypto.randomUUID(),
          uri,
        });
        await persist(updateMediaJob(current, job, new Date().toISOString()));
      } catch {
        setError("The recording could not be prepared. Your text draft is safe.");
      }
    },
    [persist],
  );

  const keepVoice = useCallback(
    async (assetId: string) => {
      const current = draftRef.current;
      const job = current?.media.find((candidate) => candidate.assetId === assetId);
      if (!current || !job || job.status !== "review") return;
      const next = updateMediaJob(
        current,
        { ...job, status: "queued" },
        new Date().toISOString(),
      );
      await persist(next);
      await sync(next);
    },
    [persist, sync],
  );

  const removeMedia = useCallback(
    async (assetId: string) => {
      const current = draftRef.current;
      const job = current?.media.find((candidate) => candidate.assetId === assetId);
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
          setError("Media deletion will need to be retried.");
          return;
        }
      }
      journalMediaService.deleteLocal(job.localUri);
      await persist({
        ...current,
        media: current.media.filter((candidate) => candidate.assetId !== assetId),
        updatedAt: new Date().toISOString(),
      });
    },
    [input.ownerId, persist],
  );

  const retryMedia = useCallback(
    (assetId: string) => {
      const job = draftRef.current?.media.find(
        (candidate) => candidate.assetId === assetId,
      );
      if (job)
        void uploadJob({ ...job, errorCode: null, progress: 0, status: "queued" });
    },
    [uploadJob],
  );

  const useSavedVersion = useCallback(async () => {
    const current = draftRef.current;
    if (!current) return;
    const server = await journalRepository.getEntry(input.ownerId, current.entryId);
    if (!server) return;
    await persist({ ...entryToDraft(server), media: current.media });
  }, [input.ownerId, persist]);

  const keepDeviceVersion = useCallback(async () => {
    const current = draftRef.current;
    if (!current) return;
    const server = await journalRepository.getEntry(input.ownerId, current.entryId);
    if (!server) return;
    const retry = {
      ...current,
      baseServerUpdatedAt: server.updatedAt,
      status: "dirty" as const,
    };
    await persist(retry);
    await sync(retry);
  }, [input.ownerId, persist, sync]);

  return {
    addImage,
    addVoice,
    draft,
    error,
    keepDeviceVersion,
    keepVoice,
    removeMedia,
    retryMedia,
    setError,
    sync,
    update,
    useSavedVersion,
  };
}

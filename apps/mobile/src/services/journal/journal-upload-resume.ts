import { applyMediaFailure, updateMediaJob } from "@/features/journal/draft-state";
import { journalDraftStorage } from "@/services/journal/journal-draft-storage";
import { journalMediaService } from "@/services/journal/journal-media-service";

export async function resumeJournalUploads(userId: string): Promise<void> {
  const drafts = await journalDraftStorage.list(userId);
  for (const initial of drafts) {
    if (!initial.baseServerUpdatedAt) continue;
    for (const job of initial.media) {
      if (
        (job.status !== "queued" && job.status !== "uploading") ||
        journalMediaService.isActive(job.assetId)
      ) {
        continue;
      }
      let current =
        (await journalDraftStorage.load(userId, initial.entryId)) ?? initial;
      const uploading = { ...job, errorCode: null, status: "uploading" as const };
      current = updateMediaJob(current, uploading, new Date().toISOString());
      await journalDraftStorage.save(userId, current);
      try {
        await journalMediaService.upload({
          job: uploading,
          onProgress: (progress) => {
            void journalDraftStorage.load(userId, initial.entryId).then((latest) => {
              if (!latest) return;
              return journalDraftStorage.save(
                userId,
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
            });
          },
          ownerId: userId,
          pregnancyId: current.pregnancyId,
        });
      } catch {
        const latest = await journalDraftStorage.load(userId, initial.entryId);
        if (latest) {
          await journalDraftStorage.save(
            userId,
            applyMediaFailure(
              latest,
              job.assetId,
              "upload_failed",
              new Date().toISOString(),
            ),
          );
        }
      }
    }
  }
}

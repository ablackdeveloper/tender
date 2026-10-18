import { mealRepository } from "@/repositories/meal-repository";
import { journalMediaService } from "@/services/journal/journal-media-service";
import { mealDraftStorage } from "@/services/meals/meal-draft-storage";

export async function resumeMealSync(userId: string): Promise<void> {
  for (const draft of await mealDraftStorage.list(userId)) {
    let current = draft;
    if (current.status === "dirty" || current.status === "syncing") {
      try {
        const result = await mealRepository.save(current);
        current = {
          ...current,
          baseServerUpdatedAt: result.updatedAt,
          status: result.status === "saved" ? "synced" : "conflict",
          updatedAt: new Date().toISOString(),
        };
        await mealDraftStorage.save(userId, current);
      } catch {
        continue;
      }
    }
    if (current.status !== "synced") continue;
    for (const job of current.media) {
      if (
        (job.status !== "queued" && job.status !== "uploading") ||
        journalMediaService.isActive(job.assetId)
      )
        continue;
      try {
        await journalMediaService.upload({
          job: { ...job, status: "uploading" },
          ownerId: userId,
          pregnancyId: current.pregnancyId,
          onProgress: () => undefined,
        });
        current = {
          ...current,
          media: current.media.map((item) =>
            item.assetId === job.assetId
              ? { ...item, progress: 1, status: "ready" as const }
              : item,
          ),
          updatedAt: new Date().toISOString(),
        };
        await mealDraftStorage.save(userId, current);
      } catch {
        current = {
          ...current,
          media: current.media.map((item) =>
            item.assetId === job.assetId
              ? { ...item, errorCode: "upload_failed", status: "failed" as const }
              : item,
          ),
          updatedAt: new Date().toISOString(),
        };
        await mealDraftStorage.save(userId, current);
      }
    }
  }
}

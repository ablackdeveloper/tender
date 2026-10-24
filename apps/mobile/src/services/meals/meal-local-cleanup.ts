import { journalMediaService } from "@/services/journal/journal-media-service";
import { mealDraftStorage } from "@/services/meals/meal-draft-storage";

export async function clearMealLocalData(userId: string): Promise<void> {
  for (const draft of await mealDraftStorage.list(userId)) {
    for (const job of draft.media) {
      await journalMediaService.cancel(job.assetId);
      journalMediaService.deleteLocal(job.localUri);
    }
  }
  await mealDraftStorage.clearUser(userId);
}

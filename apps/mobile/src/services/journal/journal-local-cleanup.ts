import { journalDraftStorage } from "@/services/journal/journal-draft-storage";
import { journalMediaService } from "@/services/journal/journal-media-service";

export async function clearJournalLocalData(userId: string): Promise<void> {
  const drafts = await journalDraftStorage.list(userId);
  for (const draft of drafts) {
    for (const job of draft.media) {
      await journalMediaService.cancel(job.assetId);
      journalMediaService.deleteLocal(job.localUri);
    }
  }
  await journalDraftStorage.clearUser(userId);
}

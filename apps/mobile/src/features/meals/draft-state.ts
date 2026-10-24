import {
  emptyMealValues,
  mealDraftSchema,
  type MealDraft,
  type MealValues,
} from "@/schemas/meal";
import type { MediaUploadJob } from "@/schemas/journal";

export function createMealDraft(
  pregnancyId: string,
  mealId: string,
  mutationId: string,
  now: string,
): MealDraft {
  return mealDraftSchema.parse({
    baseServerUpdatedAt: null,
    mealId,
    media: [],
    mutationId,
    pregnancyId,
    status: "dirty",
    updatedAt: now,
    values: emptyMealValues,
    version: 1,
  });
}

export function updateMealDraft(
  draft: MealDraft,
  patch: Partial<MealValues>,
  mutationId: string,
  now: string,
): MealDraft {
  return mealDraftSchema.parse({
    ...draft,
    mutationId,
    status: "dirty",
    updatedAt: now,
    values: { ...draft.values, ...patch },
  });
}

export function updateMealMedia(
  draft: MealDraft,
  job: MediaUploadJob,
  now: string,
): MealDraft {
  return mealDraftSchema.parse({
    ...draft,
    media: [...draft.media.filter((item) => item.assetId !== job.assetId), job],
    status: "dirty",
    updatedAt: now,
  });
}

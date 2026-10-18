import { z } from "zod";

import { mediaUploadJobSchema } from "@/schemas/journal";

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
export const appetiteResponseSchema = z.enum(["craving", "aversion", "neutral"]);
export const nauseaLevelSchema = z.enum(["none", "a_little", "moderate", "a_lot"]);
export const enjoymentSchema = z.enum(["not_enjoyed", "somewhat", "enjoyed"]);

export const mealValuesSchema = z.object({
  appetiteResponse: appetiteResponseSchema.nullable(),
  enjoyment: enjoymentSchema.nullable(),
  freeText: z.string().max(10_000),
  ingredients: z.array(z.string().trim().min(1).max(120)).max(100),
  mealType: mealTypeSchema.nullable(),
  nauseaAfter: nauseaLevelSchema.nullable(),
  nauseaBefore: nauseaLevelSchema.nullable(),
  occurredAt: z.string().datetime({ offset: true }).nullable(),
  wouldEatAgain: z.boolean().nullable(),
});
export type MealValues = z.infer<typeof mealValuesSchema>;

export const emptyMealValues: MealValues = {
  appetiteResponse: null,
  enjoyment: null,
  freeText: "",
  ingredients: [],
  mealType: null,
  nauseaAfter: null,
  nauseaBefore: null,
  occurredAt: null,
  wouldEatAgain: null,
};

export const mealDraftSchema = z.object({
  baseServerUpdatedAt: z.string().datetime({ offset: true }).nullable(),
  mealId: z.string().uuid(),
  media: z.array(mediaUploadJobSchema).max(8),
  mutationId: z.string().uuid(),
  pregnancyId: z.string().uuid(),
  status: z.enum(["dirty", "syncing", "synced", "conflict"]),
  updatedAt: z.string().datetime({ offset: true }),
  values: mealValuesSchema,
  version: z.literal(1),
});
export type MealDraft = z.infer<typeof mealDraftSchema>;

export const mealFilterSchema = z.object({
  appetiteResponse: appetiteResponseSchema.nullable(),
  mealType: mealTypeSchema.nullable(),
  wouldEatAgain: z.boolean().nullable(),
});
export type MealFilter = z.infer<typeof mealFilterSchema>;

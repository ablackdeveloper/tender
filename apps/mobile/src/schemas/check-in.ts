import { z } from "zod";

export const feelingSchema = z.enum(["good", "okay", "hard", "mixed", "unsure"]);
export const symptomSeveritySchema = z.enum(["mild", "moderate", "severe"]);
export const symptomDurationSchema = z.enum(["today", "few_days", "week_or_more"]);
export const symptomInterferenceSchema = z.enum([
  "not_interfering",
  "somewhat",
  "significant",
]);

const slugSchema = z.string().regex(/^[a-z][a-z0-9-]{0,79}$/u);

export const checkInValuesSchema = z.object({
  emotionSlugs: z
    .array(slugSchema)
    .max(30)
    .refine((items) => new Set(items).size === items.length),
  note: z.string().max(100_000),
  overallFeeling: feelingSchema.nullable(),
  symptoms: z
    .array(
      z.object({
        duration: symptomDurationSchema.nullable(),
        interference: symptomInterferenceSchema.nullable(),
        severity: symptomSeveritySchema.nullable(),
        slug: slugSchema,
      }),
    )
    .max(40)
    .refine((items) => new Set(items.map((item) => item.slug)).size === items.length),
  wellness: z.object({
    eating: z.enum(["difficult", "managing", "well"]).nullable(),
    hydration: z.enum(["low", "okay", "yes"]).nullable(),
    movement: z.enum(["none", "little", "felt_good"]).nullable(),
    sleep: z.enum(["poor", "okay", "good"]).nullable(),
  }),
});

export const checkInDraftSchema = z.object({
  baseServerUpdatedAt: z.string().datetime({ offset: true }).nullable(),
  checkinDate: z.string().date(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  completionRequestedAt: z.string().datetime({ offset: true }).nullable(),
  mutationId: z.string().uuid(),
  pregnancyId: z.string().uuid(),
  status: z.enum(["dirty", "syncing", "synced", "conflict"]),
  updatedAt: z.string().datetime({ offset: true }),
  values: checkInValuesSchema,
  version: z.literal(1),
});

export type CheckInValues = z.infer<typeof checkInValuesSchema>;
export type CheckInDraft = z.infer<typeof checkInDraftSchema>;
export type SymptomDuration = z.infer<typeof symptomDurationSchema>;
export type SymptomInterference = z.infer<typeof symptomInterferenceSchema>;
export type SymptomSeverity = z.infer<typeof symptomSeveritySchema>;

export const emptyCheckInValues: CheckInValues = {
  emotionSlugs: [],
  note: "",
  overallFeeling: null,
  symptoms: [],
  wellness: { eating: null, hydration: null, movement: null, sleep: null },
};

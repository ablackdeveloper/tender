import { z } from "zod";

export const journalPrivacySchema = z.enum(["private", "shared"]);
export type JournalPrivacy = z.infer<typeof journalPrivacySchema>;

export const mediaUploadJobSchema = z
  .object({
    assetId: z.string().uuid(),
    byteSize: z.number().int().positive().max(52_428_800),
    errorCode: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,63}$/)
      .nullable(),
    journalEntryId: z.string().uuid().nullable().default(null),
    mealId: z.string().uuid().nullable().default(null),
    kind: z.enum(["image", "voice"]),
    localUri: z.string().min(1),
    mimeType: z.string().regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/),
    objectPath: z
      .string()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{2,8}$/,
      ),
    progress: z.number().min(0).max(1),
    status: z.enum(["review", "queued", "uploading", "failed", "ready", "canceled"]),
  })
  .refine(
    (job) => Number(job.journalEntryId !== null) + Number(job.mealId !== null) === 1,
    {
      message: "Media must belong to exactly one private resource.",
    },
  );
export type MediaUploadJob = z.infer<typeof mediaUploadJobSchema>;

export const journalDraftSchema = z.object({
  baseServerUpdatedAt: z.string().datetime({ offset: true }).nullable(),
  body: z.string().max(100_000),
  entryAt: z.string().datetime({ offset: true }),
  entryId: z.string().uuid(),
  isFavorite: z.boolean(),
  media: z.array(mediaUploadJobSchema).max(20),
  pregnancyId: z.string().uuid(),
  privacy: journalPrivacySchema,
  resurfaceAllowed: z.boolean().default(false),
  status: z.enum(["dirty", "saving", "saved", "conflict"]),
  tagIds: z.array(z.string().uuid()).max(30),
  title: z.string().max(240),
  updatedAt: z.string().datetime({ offset: true }),
  version: z.literal(1),
});
export type JournalDraft = z.infer<typeof journalDraftSchema>;

export const journalSaveInputSchema = journalDraftSchema
  .pick({
    baseServerUpdatedAt: true,
    body: true,
    entryAt: true,
    entryId: true,
    isFavorite: true,
    pregnancyId: true,
    privacy: true,
    resurfaceAllowed: true,
    tagIds: true,
    title: true,
  })
  .extend({ body: z.string().trim().min(1).max(100_000) });
export type JournalSaveInput = z.infer<typeof journalSaveInputSchema>;

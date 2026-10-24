import { z } from "zod";

const optionalText = (maximum: number) => z.string().trim().max(maximum);

export const providerInputSchema = z
  .object({
    address: optionalText(1000),
    email: z.union([z.literal(""), z.string().trim().email()]),
    isPrimary: z.boolean(),
    name: z.string().trim().min(1).max(200),
    organization: optionalText(240),
    phone: optionalText(50),
    specialty: optionalText(160),
  })
  .refine((value) => Boolean(value.phone || value.email || value.address), {
    message: "Add at least one contact method.",
  });
export type ProviderInput = z.infer<typeof providerInputSchema>;

export const emergencyContactInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  notes: optionalText(2000),
  phone: z.string().trim().min(3).max(50),
  priority: z.number().int().min(1).max(20),
  relationship: optionalText(120),
});
export type EmergencyContactInput = z.infer<typeof emergencyContactInputSchema>;

export const appointmentInputSchema = z.object({
  endsAt: z.string().datetime().nullable(),
  location: optionalText(500),
  providerId: z.string().uuid().nullable(),
  reason: optionalText(2000),
  startsAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(240),
});
export type AppointmentInput = z.infer<typeof appointmentInputSchema>;

export const medicationInputSchema = z.object({
  form: optionalText(100),
  instructions: optionalText(2000),
  name: z.string().trim().min(1).max(200),
  status: z.enum(["active", "paused", "completed", "discontinued"]),
  strength: optionalText(100),
});
export type MedicationInput = z.infer<typeof medicationInputSchema>;

export const medicationChangeInputSchema = z.object({
  changeKind: z.enum(["added_to_list", "details_updated", "status_recorded", "other"]),
  details: optionalText(2000),
  medicationId: z.string().uuid(),
  recordedOn: z.string().date(),
});
export type MedicationChangeInput = z.infer<typeof medicationChangeInputSchema>;

export const documentUploadJobSchema = z.object({
  appointmentId: z.string().uuid().nullable(),
  byteSize: z.number().int().positive().max(52_428_800),
  documentDate: z.string().date().nullable(),
  documentId: z.string().uuid(),
  documentType: z.string().regex(/^[a-z][a-z0-9._-]{0,79}$/),
  errorCode: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,63}$/)
    .nullable(),
  localUri: z.string().min(1),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  objectPath: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/),
  privacy: z.enum(["private", "shared"]),
  progress: z.number().min(0).max(1),
  status: z.enum(["queued", "uploading", "failed", "ready", "canceled"]),
  title: z.string().trim().min(1).max(240),
});
export type DocumentUploadJob = z.infer<typeof documentUploadJobSchema>;

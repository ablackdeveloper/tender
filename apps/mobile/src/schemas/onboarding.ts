import * as Crypto from "expo-crypto";
import { z } from "zod";
import { homeFocusSchema } from "@/features/today-journey/home-preferences";

export const onboardingStepSchema = z.enum([
  "dating",
  "date",
  "estimate",
  "pregnancy_type",
  "home_focus",
  "preferences",
  "notifications",
  "app_lock",
  "privacy",
  "partner",
  "complete",
]);

export const onboardingDraftSchema = z
  .object({
    appointmentReminders: z.boolean(),
    homeFocus: homeFocusSchema.default("balanced"),
    datingMethod: z.enum(["lmp", "clinician"]).nullable(),
    estimatedDueDate: z.string(),
    measurementSystem: z.enum(["metric", "imperial"]),
    planningReminders: z.boolean(),
    preferredName: z.string().max(120),
    pregnancyDate: z.string(),
    pregnancyId: z.string().uuid(),
    pregnancyType: z.enum(["singleton", "multiple", "unspecified"]),
    protectAppLater: z.boolean().nullable(),
    step: onboardingStepSchema,
    themePreference: z.enum(["system", "light", "dark"]),
    timezone: z.string().min(1).max(100),
    weeklyUpdates: z.boolean(),
  })
  .strict();

export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

export function createOnboardingDraft(timezone: string): OnboardingDraft {
  return {
    appointmentReminders: false,
    homeFocus: "balanced",
    datingMethod: null,
    estimatedDueDate: "",
    measurementSystem: "metric",
    planningReminders: false,
    preferredName: "",
    pregnancyDate: "",
    pregnancyId: Crypto.randomUUID(),
    pregnancyType: "unspecified",
    protectAppLater: null,
    step: "dating",
    themePreference: "system",
    timezone,
    weeklyUpdates: false,
  };
}

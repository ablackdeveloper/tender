import { z } from "zod";
import type { PregnancyExperience } from "@tender/domain";

export const homeFocusSchema = z.enum(["balanced", "memories", "care", "support"]);
export const homePreferencesSchema = z.object({
  focus: homeFocusSchema,
  showWeeklyContent: z.boolean(),
  showDueDate: z.boolean(),
  showProgressCounts: z.boolean(),
  showSizeComparisons: z.boolean(),
});
export type HomePreferences = z.infer<typeof homePreferencesSchema>;
export const defaultHomePreferences: HomePreferences = {
  focus: "balanced",
  showWeeklyContent: true,
  showDueDate: true,
  showProgressCounts: true,
  showSizeComparisons: true,
};
export const homeFocusOptions = [
  { value: "balanced", label: "Balanced" },
  { value: "memories", label: "Memories" },
  { value: "care", label: "Care preparation" },
  { value: "support", label: "Support" },
] as const;

// Personal settings can hide content, but cannot override lifecycle protections.
export function applyHomePreferences(
  experience: PregnancyExperience,
  preferences: HomePreferences,
): PregnancyExperience {
  return {
    ...experience,
    showCountdown: experience.showCountdown && preferences.showDueDate,
    showGestationalProgress:
      experience.showGestationalProgress && preferences.showProgressCounts,
    showSizeComparisons:
      experience.showSizeComparisons && preferences.showSizeComparisons,
    showWeeklyContent: experience.showWeeklyContent && preferences.showWeeklyContent,
  };
}

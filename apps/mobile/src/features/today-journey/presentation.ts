import type { PregnancyDatingResult } from "@tender/domain";

export type Trimester = "First trimester" | "Second trimester" | "Third trimester";

export function trimesterForWeek(week: number): Trimester | null {
  if (week < 0) return null;
  if (week <= 13) return "First trimester";
  if (week <= 27) return "Second trimester";
  return "Third trimester";
}

export function contentWeek(dating: PregnancyDatingResult): number | null {
  const week = dating.gestationalAge?.weeks;
  if (week === undefined || week < 1) return null;
  return Math.min(45, week);
}

export function formatCalendarDate(value: string, locale = "en-US"): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function estimatedDueDateWording(dating: PregnancyDatingResult): string {
  if (!dating.activeDueDate) return "Estimated due date unavailable";
  const prefix = dating.source === "clinician" ? "Due date" : "Estimated due date";
  return `${prefix} ${formatCalendarDate(dating.activeDueDate)}`;
}

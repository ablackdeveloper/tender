import type {
  DueDateSource,
  PregnancyDatingResult,
  PregnancyExperience,
  PregnancyLifecycleStatus,
} from "@tender/domain";
import type { HomePreferences } from "./home-preferences";

export type PregnancyRecord = {
  clinicianConfirmedAt: string | null;
  dueDateSource: DueDateSource | "unknown";
  endedAt: string | null;
  estimatedDueDate: string | null;
  id: string;
  lmpDate: string | null;
  compassionateMode: boolean;
  lifecycleStatus: PregnancyLifecycleStatus;
  postpartumMode: boolean;
  statusBeforeArchive: PregnancyLifecycleStatus | null;
  timezone: string;
};

export type AppointmentSummary = {
  id: string;
  location: string | null;
  providerName: string | null;
  startsAt: string;
  timezone: string;
  title: string;
};

export type MemorySummary = {
  body: string;
  entryAt: string;
  id: string;
  title: string | null;
};

export type SupportRequestSummary = {
  dueAt: string | null;
  id: string;
  status: "accepted" | "open";
  title: string;
};

export type HomeModuleKey =
  "appointment" | "check_in" | "health_context" | "memory" | "plans" | "weekly_content";

export type ContentSource = {
  accessedAt: string | null;
  jurisdiction: string | null;
  publisher: string | null;
  title: string;
  url: string;
};

export type ReviewedWeekContent = {
  articleId: string;
  body: string;
  contentKind: "care_preparation" | "education" | "planning" | "wellbeing";
  publishedAt: string;
  reviewedAt: string;
  reviewerCredentials: string;
  reviewerName: string;
  sources: ContentSource[];
  summary: string | null;
  title: string;
  version: number;
  week: number;
};

export type TodayData = {
  homePreferences?: HomePreferences;
  appointment: AppointmentSummary | null;
  content: ReviewedWeekContent | null;
  dating: PregnancyDatingResult;
  dueDateSource: DueDateSource | "unknown";
  experience: PregnancyExperience;
  hiddenModules: HomeModuleKey[];
  memory: MemorySummary | null;
  pregnancy: PregnancyRecord;
  pregnancyId: string;
  supportRequest: SupportRequestSummary | null;
};

export type JourneyData = {
  currentWeek: number | null;
  dating: PregnancyDatingResult;
  dueDateSource: DueDateSource | "unknown";
  experience: PregnancyExperience;
  pregnancy: PregnancyRecord;
  pregnancyId: string;
  weeks: ReviewedWeekContent[];
};

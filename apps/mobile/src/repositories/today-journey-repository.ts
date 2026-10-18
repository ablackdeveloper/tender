import {
  derivePregnancyDating,
  pregnancyExperience,
  pregnancyLifecycleStatuses,
  type DueDateSource,
  type PregnancyLifecycleStatus,
} from "@tender/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getClientEnv } from "@/config/env";
import {
  isReviewedContentAllowed,
  plainTextFromMarkdown,
  type EditorialCandidate,
} from "@/features/today-journey/content-gate";
import type {
  AppointmentSummary,
  ContentSource,
  HomeModuleKey,
  JourneyData,
  MemorySummary,
  PregnancyRecord,
  ReviewedWeekContent,
  SupportRequestSummary,
  TodayData,
} from "@/features/today-journey/types";
import { contentWeek } from "@/features/today-journey/presentation";
import { supabase } from "@/services/supabase/client";
import { homePreferencesRepository } from "@/repositories/home-preferences-repository";
import { applyHomePreferences } from "@/features/today-journey/home-preferences";

type Table<Row> = {
  Insert: Partial<Row>;
  Relationships: [];
  Row: Row;
  Update: Partial<Row>;
};

type PregnancyRow = {
  clinician_confirmed_at: string | null;
  created_at: string;
  due_date_source: string;
  ended_at: string | null;
  estimated_due_date: string | null;
  id: string;
  lmp_date: string | null;
  owner_id: string;
  timezone: string;
};
type ExperienceRow = {
  compassionate_mode_enabled: boolean;
  effective_ended_at: string | null;
  lifecycle_status: string;
  postpartum_mode_enabled: boolean;
  pregnancy_id: string;
  status_before_archive: string | null;
  status_changed_at: string;
};
type AppointmentRow = {
  id: string;
  location: string | null;
  owner_id: string;
  pregnancy_id: string;
  provider_id: string | null;
  starts_at: string;
  status: string;
  timezone: string;
  title: string;
};
type ProviderRow = { id: string; name: string; owner_id: string };
type JournalRow = {
  resurface_allowed: boolean;
  archived_at: string | null;
  body: string;
  entry_at: string;
  id: string;
  owner_id: string;
  pregnancy_id: string;
  title: string | null;
};
type SupportRequestRow = {
  due_at: string | null;
  id: string;
  owner_id: string;
  pregnancy_id: string;
  requested_at: string;
  status: string;
  title: string;
};
type HomeModulePreferenceRow = {
  cadence: string;
  dismissed_until: string | null;
  module_key: string;
  owner_id: string;
  visibility: string;
};
type WeekRow = { id: string; week_number: number };
type ArticleRow = {
  content_kind: string;
  current_version_id: string | null;
  id: string;
  pregnancy_week_id: string | null;
  published_at: string | null;
  status: string;
  summary: string | null;
  title: string;
};
type VersionRow = {
  article_id: string;
  body_markdown: string;
  id: string;
  published_at: string | null;
  version_number: number;
};
type ReviewRow = {
  content_version_id: string | null;
  credentials_snapshot: string;
  reviewed_at: string | null;
  reviewer_name: string;
  status: string;
  valid_until: string | null;
};
type VersionSourceRow = { content_source_id: string; content_version_id: string };
type SourceRow = {
  accessed_at: string | null;
  id: string;
  jurisdiction_code: string | null;
  publisher: string | null;
  source_url: string;
  title: string;
};

type TodayJourneyDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      get_current_pregnancy_experience: {
        Args: Record<string, never>;
        Returns: ExperienceRow[];
      };
    };
    Tables: {
      appointments: Table<AppointmentRow>;
      clinical_reviews: Table<ReviewRow>;
      content_articles: Table<ArticleRow>;
      content_sources: Table<SourceRow>;
      content_version_sources: Table<VersionSourceRow>;
      content_versions: Table<VersionRow>;
      journal_entries: Table<JournalRow>;
      home_module_preferences: Table<HomeModulePreferenceRow>;
      pregnancies: Table<PregnancyRow>;
      pregnancy_weeks: Table<WeekRow>;
      providers: Table<ProviderRow>;
      support_requests: Table<SupportRequestRow>;
    };
    Views: Record<string, never>;
  };
};

const client = supabase as unknown as SupabaseClient<TodayJourneyDatabase>;

function dateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function assertDueDateSource(value: string): DueDateSource | "unknown" {
  if (
    value === "unknown" ||
    value === "clinician" ||
    value === "ivf" ||
    value === "lmp" ||
    value === "manual" ||
    value === "ultrasound"
  ) {
    return value;
  }
  throw new Error("Pregnancy has an unsupported due-date source.");
}

function assertLifecycleStatus(value: string): PregnancyLifecycleStatus {
  if (pregnancyLifecycleStatuses.some((status) => status === value))
    return value as PregnancyLifecycleStatus;
  throw new Error("Pregnancy has an unsupported lifecycle status.");
}

async function getPregnancy(ownerId: string): Promise<PregnancyRecord | null> {
  const experienceResult = await client.rpc("get_current_pregnancy_experience");
  if (experienceResult.error) throw experienceResult.error;
  const experience = experienceResult.data[0];
  if (!experience) return null;
  const result = await client
    .from("pregnancies")
    .select(
      "id,owner_id,lmp_date,estimated_due_date,due_date_source,clinician_confirmed_at,timezone,ended_at,created_at",
    )
    .eq("owner_id", ownerId)
    .eq("id", experience.pregnancy_id)
    .maybeSingle();
  if (result.error) throw result.error;
  const data = result.data;
  if (!data) return null;
  return {
    clinicianConfirmedAt: data.clinician_confirmed_at,
    dueDateSource: assertDueDateSource(data.due_date_source),
    endedAt: experience.effective_ended_at,
    estimatedDueDate: data.estimated_due_date,
    id: data.id,
    lmpDate: data.lmp_date,
    compassionateMode: experience.compassionate_mode_enabled,
    lifecycleStatus: assertLifecycleStatus(experience.lifecycle_status),
    postpartumMode: experience.postpartum_mode_enabled,
    statusBeforeArchive: experience.status_before_archive
      ? assertLifecycleStatus(experience.status_before_archive)
      : null,
    timezone: data.timezone,
  };
}

function deriveDating(pregnancy: PregnancyRecord, now: Date) {
  const clinicianConfirmed = pregnancy.clinicianConfirmedAt !== null;
  return derivePregnancyDating({
    clinicianDueDate: clinicianConfirmed ? pregnancy.estimatedDueDate : null,
    endedAt: pregnancy.endedAt,
    estimatedDueDate: clinicianConfirmed ? null : pregnancy.estimatedDueDate,
    lmpDate: pregnancy.lmpDate,
    now,
    timezone: pregnancy.timezone,
  });
}

async function getNextAppointment(
  ownerId: string,
  pregnancyId: string,
  now: Date,
): Promise<AppointmentSummary | null> {
  const { data, error } = await client
    .from("appointments")
    .select(
      "id,owner_id,pregnancy_id,provider_id,title,status,starts_at,timezone,location",
    )
    .eq("owner_id", ownerId)
    .eq("pregnancy_id", pregnancyId)
    .eq("status", "scheduled")
    .gte("starts_at", now.toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  let providerName: string | null = null;
  if (data.provider_id) {
    const providerResult = await client
      .from("providers")
      .select("id,owner_id,name")
      .eq("owner_id", ownerId)
      .eq("id", data.provider_id)
      .maybeSingle();
    if (providerResult.error) throw providerResult.error;
    providerName = providerResult.data?.name ?? null;
  }
  return {
    id: data.id,
    location: data.location,
    providerName,
    startsAt: data.starts_at,
    timezone: data.timezone,
    title: data.title,
  };
}

async function getRecentMemory(
  ownerId: string,
  pregnancyId: string,
): Promise<MemorySummary | null> {
  const { data, error } = await client
    .from("journal_entries")
    .select("id,owner_id,pregnancy_id,title,body,entry_at,archived_at")
    .eq("owner_id", ownerId)
    .eq("pregnancy_id", pregnancyId)
    .eq("resurface_allowed", true)
    .is("archived_at", null)
    .order("entry_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { body: data.body, entryAt: data.entry_at, id: data.id, title: data.title };
}

async function getFocusSupportRequest(
  ownerId: string,
  pregnancyId: string,
): Promise<SupportRequestSummary | null> {
  const { data, error } = await client
    .from("support_requests")
    .select("id,owner_id,pregnancy_id,title,status,requested_at,due_at")
    .eq("owner_id", ownerId)
    .eq("pregnancy_id", pregnancyId)
    .in("status", ["accepted", "open"])
    .order("requested_at", { ascending: false })
    .limit(10);
  if (error) throw error;

  const candidate = data.slice().sort((left, right) => {
    if (left.status !== right.status) return left.status === "accepted" ? -1 : 1;
    if (left.due_at && right.due_at) {
      return Date.parse(left.due_at) - Date.parse(right.due_at);
    }
    if (left.due_at) return -1;
    if (right.due_at) return 1;
    return Date.parse(right.requested_at) - Date.parse(left.requested_at);
  })[0];
  if (!candidate || (candidate.status !== "accepted" && candidate.status !== "open"))
    return null;
  return {
    dueAt: candidate.due_at,
    id: candidate.id,
    status: candidate.status,
    title: candidate.title,
  };
}

const homeModuleKeys = new Set<HomeModuleKey>([
  "appointment",
  "check_in",
  "health_context",
  "memory",
  "plans",
  "weekly_content",
]);

async function getHiddenModules(
  ownerId: string,
  today: string,
): Promise<HomeModuleKey[]> {
  const { data, error } = await client
    .from("home_module_preferences")
    .select("owner_id,module_key,visibility,dismissed_until")
    .eq("owner_id", ownerId);
  if (error) throw error;
  return data.flatMap((preference) => {
    if (!homeModuleKeys.has(preference.module_key as HomeModuleKey)) return [];
    const isHidden =
      preference.visibility === "hidden" ||
      (preference.dismissed_until !== null && preference.dismissed_until >= today);
    return isHidden ? [preference.module_key as HomeModuleKey] : [];
  });
}

async function getReviewedContent(now: Date): Promise<ReviewedWeekContent[]> {
  if (!getClientEnv().EXPO_PUBLIC_REVIEWED_CONTENT_ENABLED) return [];

  const [weekResult, articleResult] = await Promise.all([
    client.from("pregnancy_weeks").select("id,week_number").order("week_number"),
    client
      .from("content_articles")
      .select(
        "id,pregnancy_week_id,title,summary,content_kind,status,published_at,current_version_id",
      )
      .eq("status", "published")
      .not("pregnancy_week_id", "is", null),
  ]);
  if (weekResult.error) throw weekResult.error;
  if (articleResult.error) throw articleResult.error;

  const articles = articleResult.data.filter(
    (article): article is ArticleRow & { current_version_id: string } =>
      article.current_version_id !== null,
  );
  if (articles.length === 0) return [];
  const versionIds = articles.map((article) => article.current_version_id);
  const [versionResult, reviewResult, linkResult] = await Promise.all([
    client
      .from("content_versions")
      .select("id,article_id,version_number,body_markdown,published_at")
      .in("id", versionIds),
    client
      .from("clinical_reviews")
      .select(
        "content_version_id,reviewer_name,credentials_snapshot,status,reviewed_at,valid_until",
      )
      .in("content_version_id", versionIds)
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false }),
    client
      .from("content_version_sources")
      .select("content_version_id,content_source_id")
      .in("content_version_id", versionIds),
  ]);
  if (versionResult.error) throw versionResult.error;
  if (reviewResult.error) throw reviewResult.error;
  if (linkResult.error) throw linkResult.error;

  const sourceIds = [...new Set(linkResult.data.map((link) => link.content_source_id))];
  const sourceResult = sourceIds.length
    ? await client
        .from("content_sources")
        .select("id,title,publisher,source_url,accessed_at,jurisdiction_code")
        .in("id", sourceIds)
    : { data: [] as SourceRow[], error: null };
  if (sourceResult.error) throw sourceResult.error;

  const weekById = new Map(weekResult.data.map((week) => [week.id, week.week_number]));
  const versionById = new Map(
    versionResult.data.map((version) => [version.id, version]),
  );
  const sourceById = new Map(sourceResult.data.map((source) => [source.id, source]));

  return articles.flatMap((article) => {
    const version = versionById.get(article.current_version_id);
    const week = article.pregnancy_week_id
      ? weekById.get(article.pregnancy_week_id)
      : undefined;
    const review = reviewResult.data.find(
      (candidate) => candidate.content_version_id === article.current_version_id,
    );
    if (!version?.published_at || week === undefined || !review?.reviewed_at) return [];
    const sources: ContentSource[] = linkResult.data
      .filter((link) => link.content_version_id === version.id)
      .flatMap((link) => {
        const source = sourceById.get(link.content_source_id);
        return source
          ? [
              {
                accessedAt: source.accessed_at,
                jurisdiction: source.jurisdiction_code,
                publisher: source.publisher,
                title: source.title,
                url: source.source_url,
              },
            ]
          : [];
      });
    const candidate: EditorialCandidate = {
      articleId: article.id,
      articleStatus: article.status,
      body: plainTextFromMarkdown(version.body_markdown),
      contentKind: article.content_kind as ReviewedWeekContent["contentKind"],
      publishedAt: version.published_at,
      reviewedAt: review.reviewed_at,
      reviewerCredentials: review.credentials_snapshot,
      reviewerName: review.reviewer_name,
      reviewStatus: review.status,
      reviewValidUntil: review.valid_until,
      sources,
      summary: article.summary,
      title: article.title,
      version: version.version_number,
      week,
    };
    return isReviewedContentAllowed(
      candidate,
      now,
      getClientEnv().EXPO_PUBLIC_REVIEWED_CONTENT_ENABLED,
    )
      ? [candidate]
      : [];
  });
}

export const todayJourneyRepository = {
  async dismissModuleForToday(
    ownerId: string,
    moduleKey: HomeModuleKey,
    timezone: string,
    date = new Date(),
  ): Promise<void> {
    const dismissedUntil = dateInTimezone(date, timezone);
    const { error } = await client.from("home_module_preferences").upsert(
      {
        cadence: "manual",
        dismissed_until: dismissedUntil,
        module_key: moduleKey,
        owner_id: ownerId,
        visibility: "shown",
      },
      { onConflict: "owner_id,module_key" },
    );
    if (error) throw error;
  },

  async getJourney(ownerId: string, now = new Date()): Promise<JourneyData | null> {
    const pregnancy = await getPregnancy(ownerId);
    if (!pregnancy) return null;
    const dating = deriveDating(pregnancy, now);
    const preferences = await homePreferencesRepository.get(ownerId);
    const experience = applyHomePreferences(
      pregnancyExperience({
        compassionateMode: pregnancy.compassionateMode,
        postpartumMode: pregnancy.postpartumMode,
        status: pregnancy.lifecycleStatus,
      }),
      preferences,
    );
    const weeks = experience.showWeeklyContent ? await getReviewedContent(now) : [];
    return {
      currentWeek: contentWeek(dating),
      dating,
      dueDateSource: pregnancy.dueDateSource,
      experience,
      pregnancy,
      pregnancyId: pregnancy.id,
      weeks,
    };
  },

  async getToday(ownerId: string, now = new Date()): Promise<TodayData | null> {
    const pregnancy = await getPregnancy(ownerId);
    if (!pregnancy) return null;
    const dating = deriveDating(pregnancy, now);
    const homePreferences = await homePreferencesRepository.get(ownerId);
    const experience = applyHomePreferences(
      pregnancyExperience({
        compassionateMode: pregnancy.compassionateMode,
        postpartumMode: pregnancy.postpartumMode,
        status: pregnancy.lifecycleStatus,
      }),
      homePreferences,
    );
    const [appointment, memory, reviewedContent, supportRequest, hiddenModules] =
      await Promise.all([
        getNextAppointment(ownerId, pregnancy.id, now),
        getRecentMemory(ownerId, pregnancy.id),
        experience.showWeeklyContent ? getReviewedContent(now) : Promise.resolve([]),
        getFocusSupportRequest(ownerId, pregnancy.id),
        getHiddenModules(ownerId, dateInTimezone(now, pregnancy.timezone)),
      ]);
    const week = contentWeek(dating);
    return {
      appointment,
      content: reviewedContent.find((item) => item.week === week) ?? null,
      dating,
      dueDateSource: pregnancy.dueDateSource,
      experience,
      hiddenModules,
      homePreferences,
      memory,
      pregnancy,
      pregnancyId: pregnancy.id,
      supportRequest,
    };
  },
};

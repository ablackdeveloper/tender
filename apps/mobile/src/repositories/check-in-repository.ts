import type { SupabaseClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";

import type {
  CheckInContext,
  CheckInSyncResult,
  SelectionOption,
  UrgentGuidance,
} from "@/features/check-in/types";
import {
  checkInDraftSchema,
  emptyCheckInValues,
  type CheckInDraft,
  type CheckInValues,
} from "@/schemas/check-in";
import { supabase } from "@/services/supabase/client";

type Json =
  boolean | null | number | string | Json[] | { [key: string]: Json | undefined };
type Table<Row> = {
  Insert: Partial<Row>;
  Relationships: [];
  Row: Row;
  Update: Partial<Row>;
};
type PregnancyRow = {
  created_at: string;
  ended_at: string | null;
  id: string;
  owner_id: string;
};
type CheckInRow = {
  checkin_date: string;
  completed_at: string | null;
  id: string;
  note: string | null;
  overall_feeling: string | null;
  owner_id: string;
  pregnancy_id: string;
  updated_at: string;
};
type CatalogRow = {
  display_name: string;
  id: string;
  is_active: boolean;
  slug: string;
  sort_order: number;
};
type EmotionLinkRow = { checkin_id: string; emotion_id: string; owner_id: string };
type SymptomLinkRow = {
  checkin_id: string;
  duration_code: string | null;
  interference_level: number | null;
  owner_id: string;
  severity: number | null;
  symptom_id: string;
};
type WellnessRow = {
  checkin_id: string | null;
  observation_type: string;
  owner_id: string;
  text_value: string | null;
};
type ProviderRow = {
  is_primary: boolean;
  owner_id: string;
  phone: string | null;
  pregnancy_id: string;
};
type RuleRow = { flag_slug: string; urgent_guidance_id: string };
type GuidanceRow = {
  body_markdown: string;
  care_team_action_label: string | null;
  emergency_action_label: string | null;
  emergency_action_uri: string | null;
  id: string;
  title: string;
};

type CheckInDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      sync_daily_checkin: {
        Args: {
          p_base_updated_at: string | null;
          p_checkin_date: string;
          p_client_mutation_id: string;
          p_complete: boolean;
          p_payload: Json;
          p_pregnancy_id: string;
        };
        Returns: Json;
      };
    };
    Tables: {
      checkin_emotions: Table<EmotionLinkRow>;
      checkin_symptoms: Table<SymptomLinkRow>;
      daily_checkins: Table<CheckInRow>;
      emotions: Table<CatalogRow>;
      pregnancies: Table<PregnancyRow>;
      providers: Table<ProviderRow>;
      symptoms: Table<CatalogRow>;
      urgent_guidance: Table<GuidanceRow>;
      urgent_guidance_rules: Table<RuleRow>;
      wellness_observations: Table<WellnessRow>;
    };
    Views: Record<string, never>;
  };
};

const client = supabase as unknown as SupabaseClient<CheckInDatabase>;
const severityFromNumber = { 1: "mild", 2: "moderate", 3: "severe" } as const;
const durationValues = new Set(["today", "few_days", "week_or_more"]);
const interferenceFromNumber = {
  1: "not_interfering",
  2: "somewhat",
  3: "significant",
} as const;

function catalog(rows: CatalogRow[]): SelectionOption[] {
  return rows.map((row) => ({
    displayName: row.display_name,
    id: row.id,
    slug: row.slug,
  }));
}

function severityNumber(
  value: CheckInValues["symptoms"][number]["severity"],
): number | null {
  return value === "mild"
    ? 1
    : value === "moderate"
      ? 2
      : value === "severe"
        ? 3
        : null;
}

function interferenceNumber(
  value: CheckInValues["symptoms"][number]["interference"],
): number | null {
  return value === "not_interfering"
    ? 1
    : value === "somewhat"
      ? 2
      : value === "significant"
        ? 3
        : null;
}

function payload(values: CheckInValues): Json {
  return {
    emotionSlugs: values.emotionSlugs,
    note: values.note,
    overallFeeling: values.overallFeeling,
    symptoms: values.symptoms.map((symptom) => ({
      duration_code: symptom.duration,
      interference_level: interferenceNumber(symptom.interference),
      severity: severityNumber(symptom.severity),
      slug: symptom.slug,
    })),
    wellness: Object.entries(values.wellness).flatMap(
      ([observation_type, text_value]) =>
        text_value ? [{ observation_type, text_value }] : [],
    ),
  };
}

async function getPregnancy(ownerId: string): Promise<string | null> {
  const { data, error } = await client
    .from("pregnancies")
    .select("id,owner_id,ended_at,created_at")
    .eq("owner_id", ownerId)
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function getServerDraft(
  ownerId: string,
  pregnancyId: string,
  checkinDate: string,
  emotions: SelectionOption[],
  symptoms: SelectionOption[],
): Promise<CheckInDraft | null> {
  const result = await client
    .from("daily_checkins")
    .select(
      "id,pregnancy_id,owner_id,checkin_date,overall_feeling,note,updated_at,completed_at",
    )
    .eq("owner_id", ownerId)
    .eq("pregnancy_id", pregnancyId)
    .eq("checkin_date", checkinDate)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;
  const checkin = result.data;
  const [emotionResult, symptomResult, wellnessResult] = await Promise.all([
    client
      .from("checkin_emotions")
      .select("owner_id,checkin_id,emotion_id")
      .eq("owner_id", ownerId)
      .eq("checkin_id", checkin.id),
    client
      .from("checkin_symptoms")
      .select(
        "owner_id,checkin_id,symptom_id,severity,duration_code,interference_level",
      )
      .eq("owner_id", ownerId)
      .eq("checkin_id", checkin.id),
    client
      .from("wellness_observations")
      .select("owner_id,checkin_id,observation_type,text_value")
      .eq("owner_id", ownerId)
      .eq("checkin_id", checkin.id),
  ]);
  if (emotionResult.error) throw emotionResult.error;
  if (symptomResult.error) throw symptomResult.error;
  if (wellnessResult.error) throw wellnessResult.error;
  const emotionById = new Map(emotions.map((item) => [item.id, item.slug]));
  const symptomById = new Map(symptoms.map((item) => [item.id, item.slug]));
  const wellness = { ...emptyCheckInValues.wellness };
  for (const item of wellnessResult.data) {
    if (
      (item.observation_type === "sleep" ||
        item.observation_type === "movement" ||
        item.observation_type === "eating" ||
        item.observation_type === "hydration") &&
      item.text_value
    ) {
      Object.assign(wellness, { [item.observation_type]: item.text_value });
    }
  }
  return checkInDraftSchema.parse({
    baseServerUpdatedAt: checkin.updated_at,
    checkinDate,
    completedAt: checkin.completed_at,
    completionRequestedAt: checkin.completed_at,
    mutationId: Crypto.randomUUID(),
    pregnancyId,
    status: "synced",
    updatedAt: checkin.updated_at,
    values: {
      emotionSlugs: emotionResult.data.flatMap((item) => {
        const slug = emotionById.get(item.emotion_id);
        return slug ? [slug] : [];
      }),
      note: checkin.note ?? "",
      overallFeeling: checkin.overall_feeling,
      symptoms: symptomResult.data.flatMap((item) => {
        const slug = symptomById.get(item.symptom_id);
        if (!slug) return [];
        return [
          {
            duration: durationValues.has(item.duration_code ?? "")
              ? item.duration_code
              : null,
            interference:
              interferenceFromNumber[
                item.interference_level as keyof typeof interferenceFromNumber
              ] ?? null,
            severity:
              severityFromNumber[item.severity as keyof typeof severityFromNumber] ??
              null,
            slug,
          },
        ];
      }),
      wellness,
    },
    version: 1,
  });
}

function parseSyncResult(value: Json): CheckInSyncResult {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Check-in sync returned an invalid response.");
  }
  const record = value as Record<string, Json | undefined>;
  if (record.status !== "applied" && record.status !== "conflict") {
    throw new Error("Check-in sync returned an unsupported status.");
  }
  if (typeof record.checkin_id !== "string" || typeof record.updated_at !== "string") {
    throw new Error("Check-in sync response is incomplete.");
  }
  return {
    checkinId: record.checkin_id,
    completedAt: typeof record.completed_at === "string" ? record.completed_at : null,
    status: record.status,
    updatedAt: record.updated_at,
  };
}

export const checkInRepository = {
  async getContext(
    ownerId: string,
    checkinDate: string,
  ): Promise<CheckInContext | null> {
    const pregnancyId = await getPregnancy(ownerId);
    if (!pregnancyId) return null;
    const [emotionResult, symptomResult, providerResult] = await Promise.all([
      client
        .from("emotions")
        .select("id,slug,display_name,sort_order,is_active")
        .eq("is_active", true)
        .order("sort_order"),
      client
        .from("symptoms")
        .select("id,slug,display_name,sort_order,is_active")
        .eq("is_active", true)
        .order("sort_order"),
      client
        .from("providers")
        .select("owner_id,pregnancy_id,phone,is_primary")
        .eq("owner_id", ownerId)
        .eq("pregnancy_id", pregnancyId)
        .eq("is_primary", true)
        .limit(1)
        .maybeSingle(),
    ]);
    if (emotionResult.error) throw emotionResult.error;
    if (symptomResult.error) throw symptomResult.error;
    if (providerResult.error) throw providerResult.error;
    const emotionOptions = catalog(emotionResult.data);
    const symptomOptions = catalog(symptomResult.data);
    return {
      careTeamPhone: providerResult.data?.phone ?? null,
      emotionOptions,
      pregnancyId,
      serverDraft: await getServerDraft(
        ownerId,
        pregnancyId,
        checkinDate,
        emotionOptions,
        symptomOptions,
      ),
      symptomOptions,
    };
  },

  async getUrgentGuidance(selectedFlags: string[]): Promise<UrgentGuidance[]> {
    if (selectedFlags.length === 0) return [];
    const ruleResult = await client
      .from("urgent_guidance_rules")
      .select("flag_slug,urgent_guidance_id")
      .in("flag_slug", selectedFlags);
    if (ruleResult.error) throw ruleResult.error;
    const guidanceIds = [
      ...new Set(ruleResult.data.map((rule) => rule.urgent_guidance_id)),
    ];
    if (guidanceIds.length === 0) return [];
    const guidanceResult = await client
      .from("urgent_guidance")
      .select(
        "id,title,body_markdown,care_team_action_label,emergency_action_label,emergency_action_uri",
      )
      .in("id", guidanceIds)
      .order("title");
    if (guidanceResult.error) throw guidanceResult.error;
    return guidanceResult.data.flatMap((guidance) =>
      guidance.care_team_action_label &&
      guidance.emergency_action_label &&
      guidance.emergency_action_uri &&
      !/not clinically approved|synthetic fixture/iu.test(
        `${guidance.title} ${guidance.body_markdown}`,
      )
        ? [
            {
              body: guidance.body_markdown,
              careTeamActionLabel: guidance.care_team_action_label,
              emergencyActionLabel: guidance.emergency_action_label,
              emergencyActionUri: guidance.emergency_action_uri,
              id: guidance.id,
              title: guidance.title,
            },
          ]
        : [],
    );
  },

  async sync(draft: CheckInDraft, complete: boolean): Promise<CheckInSyncResult> {
    const parsed = checkInDraftSchema.parse(draft);
    const { data, error } = await client.rpc("sync_daily_checkin", {
      p_base_updated_at: parsed.baseServerUpdatedAt,
      p_checkin_date: parsed.checkinDate,
      p_client_mutation_id: parsed.mutationId,
      p_complete: complete,
      p_payload: payload(parsed.values),
      p_pregnancy_id: parsed.pregnancyId,
    });
    if (error) throw error;
    return parseSyncResult(data);
  },
};

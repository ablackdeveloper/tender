import type { PregnancyLifecycleStatus } from "@tender/domain";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";

import type { SupportResource } from "@/features/pregnancy-lifecycle/types";
import { supabase } from "@/services/supabase/client";

type ResourceRow = {
  action_label: string;
  action_uri: string;
  description: string;
  id: string;
  resource_kind: "general" | "loss" | "postpartum";
  title: string;
};
type Table<Row> = {
  Insert: Partial<Row>;
  Relationships: [];
  Row: Row;
  Update: Partial<Row>;
};
type LifecycleDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      get_current_pregnancy_id: { Args: Record<string, never>; Returns: string | null };
      transition_pregnancy_status: {
        Args: {
          p_compassionate_mode: boolean | null;
          p_postpartum_mode: boolean | null;
          p_pregnancy_id: string;
          p_to_status: string;
        };
        Returns: undefined;
      };
    };
    Tables: {
      support_resources: Table<ResourceRow>;
      pregnancies: Table<{
        id: string;
        owner_id: string;
        estimated_due_date: string | null;
        due_date_source: string;
        lmp_date: string | null;
        clinician_confirmed_at: string | null;
        timezone: string;
      }>;
    };
    Views: Record<string, never>;
  };
};
const client = supabase as unknown as SupabaseClient<LifecycleDatabase>;

export const pregnancyLifecycleRepository = {
  async createUndated(ownerId: string): Promise<void> {
    const current = await client.rpc("get_current_pregnancy_id");
    if (current.error) throw current.error;
    if (current.data) return;
    const result = await client.from("pregnancies").insert({
      id: Crypto.randomUUID(),
      owner_id: ownerId,
      estimated_due_date: null,
      due_date_source: "unknown",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    });
    if (result.error) throw result.error;
  },
  async updateDueDate(
    ownerId: string,
    pregnancyId: string,
    date: string | null,
  ): Promise<void> {
    const result = await client
      .from("pregnancies")
      .update({
        estimated_due_date: date,
        due_date_source: date ? "manual" : "unknown",
        clinician_confirmed_at: null,
        lmp_date: null,
      })
      .eq("id", pregnancyId)
      .eq("owner_id", ownerId)
      .select("id")
      .single();
    if (result.error) throw result.error;
  },
  async transition(input: {
    compassionateMode: boolean;
    postpartumMode: boolean;
    pregnancyId: string;
    status: PregnancyLifecycleStatus;
  }): Promise<void> {
    const result = await client.rpc("transition_pregnancy_status", {
      p_compassionate_mode: input.compassionateMode,
      p_postpartum_mode: input.postpartumMode,
      p_pregnancy_id: input.pregnancyId,
      p_to_status: input.status,
    });
    if (result.error) throw result.error;
  },
  async supportResources(
    locale: string,
    kinds: SupportResource["kind"][],
  ): Promise<SupportResource[]> {
    const languages = [
      ...new Set([locale, locale.split("-")[0] ?? locale, "en-US", "en"]),
    ];
    const result = await client
      .from("support_resources")
      .select("id,resource_kind,title,description,action_label,action_uri")
      .in("locale", languages)
      .in("resource_kind", kinds)
      .order("priority");
    if (result.error) throw result.error;
    return result.data.map((row) => ({
      actionLabel: row.action_label,
      actionUri: row.action_uri,
      description: row.description,
      id: row.id,
      kind: row.resource_kind,
      title: row.title,
    }));
  },
};

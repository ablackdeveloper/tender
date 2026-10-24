import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationPreferences } from "@/features/notifications/types";
import { supabase } from "@/services/supabase/client";

type Row = {
  appointment_reminders_enabled: boolean;
  medication_as_recorded_enabled: boolean;
  weekly_update_enabled: boolean;
  photo_enabled: boolean;
  partner_request_enabled: boolean;
  revealing_content_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
};
type Database = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      notification_preferences: {
        Insert: Partial<Row> & { owner_id: string };
        Relationships: [];
        Row: Row & { owner_id: string };
        Update: Partial<Row>;
      };
    };
    Views: Record<string, never>;
  };
};
const client = supabase as unknown as SupabaseClient<Database>;

const defaults: NotificationPreferences = {
  appointment: false,
  medicationAsRecorded: false,
  weeklyUpdate: false,
  photo: false,
  partnerRequest: false,
  revealingContent: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  timezone: "UTC",
};

function map(row: Row): NotificationPreferences {
  return {
    appointment: row.appointment_reminders_enabled,
    medicationAsRecorded: row.medication_as_recorded_enabled,
    weeklyUpdate: row.weekly_update_enabled,
    photo: row.photo_enabled,
    partnerRequest: row.partner_request_enabled,
    revealingContent: row.revealing_content_enabled,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    timezone: row.timezone,
  };
}

export const notificationPreferencesRepository = {
  async get(ownerId: string): Promise<NotificationPreferences> {
    const result = await client
      .from("notification_preferences")
      .select(
        "appointment_reminders_enabled,medication_as_recorded_enabled,weekly_update_enabled,photo_enabled,partner_request_enabled,revealing_content_enabled,quiet_hours_start,quiet_hours_end,timezone",
      )
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data ? map(result.data) : defaults;
  },
  async save(ownerId: string, value: NotificationPreferences): Promise<void> {
    const result = await client.from("notification_preferences").upsert(
      {
        appointment_reminders_enabled: value.appointment,
        medication_as_recorded_enabled: value.medicationAsRecorded,
        owner_id: ownerId,
        partner_request_enabled: value.partnerRequest,
        photo_enabled: value.photo,
        quiet_hours_end: value.quietHoursEnd,
        quiet_hours_start: value.quietHoursStart,
        revealing_content_enabled: value.revealingContent,
        timezone: value.timezone,
        weekly_update_enabled: value.weeklyUpdate,
      },
      { onConflict: "owner_id" },
    );
    if (result.error) throw result.error;
  },
};

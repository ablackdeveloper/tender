import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase/client";
import {
  defaultHomePreferences,
  homePreferencesSchema,
  type HomePreferences,
} from "@/features/today-journey/home-preferences";

type Row = {
  owner_id: string;
  home_focus: string;
  show_weekly_content: boolean;
  show_due_date: boolean;
  show_progress_counts: boolean;
  show_size_comparisons: boolean;
};
type Database = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      user_preferences: {
        Row: Row;
        Insert: Partial<Row>;
        Update: Partial<Row>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
  };
};
const client = supabase as unknown as SupabaseClient<Database>;
export const homePreferencesRepository = {
  async get(ownerId: string): Promise<HomePreferences> {
    const { data, error } = await client
      .from("user_preferences")
      .select(
        "home_focus,show_weekly_content,show_due_date,show_progress_counts,show_size_comparisons",
      )
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    return data
      ? homePreferencesSchema.parse({
          focus: data.home_focus,
          showWeeklyContent: data.show_weekly_content,
          showDueDate: data.show_due_date,
          showProgressCounts: data.show_progress_counts,
          showSizeComparisons: data.show_size_comparisons,
        })
      : { ...defaultHomePreferences };
  },
  async save(ownerId: string, input: HomePreferences): Promise<void> {
    const value = homePreferencesSchema.parse(input);
    const { error } = await client.from("user_preferences").upsert(
      {
        owner_id: ownerId,
        home_focus: value.focus,
        show_weekly_content: value.showWeeklyContent,
        show_due_date: value.showDueDate,
        show_progress_counts: value.showProgressCounts,
        show_size_comparisons: value.showSizeComparisons,
      },
      { onConflict: "owner_id" },
    );
    if (error) throw error;
  },
  async setInitialFocus(
    ownerId: string,
    focus: HomePreferences["focus"],
  ): Promise<void> {
    const value = homePreferencesSchema.shape.focus.parse(focus);
    const { error } = await client
      .from("user_preferences")
      .upsert({ owner_id: ownerId, home_focus: value }, { onConflict: "owner_id" });
    if (error) throw error;
  },
};

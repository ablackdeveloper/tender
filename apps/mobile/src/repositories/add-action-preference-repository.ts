import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/services/supabase/client";

export type AddActionKey = "appointment_question" | "check_in" | "meal" | "memory";

type PreferenceRow = {
  default_add_action: string | null;
  owner_id: string;
};
type Table<Row> = {
  Insert: Partial<Row>;
  Relationships: [];
  Row: Row;
  Update: Partial<Row>;
};
type PreferenceDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: { user_preferences: Table<PreferenceRow> };
    Views: Record<string, never>;
  };
};

const client = supabase as unknown as SupabaseClient<PreferenceDatabase>;
const addActionKeys = new Set<AddActionKey>([
  "appointment_question",
  "check_in",
  "meal",
  "memory",
]);

export const addActionPreferenceRepository = {
  async get(ownerId: string): Promise<AddActionKey | null> {
    const { data, error } = await client
      .from("user_preferences")
      .select("owner_id,default_add_action")
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw error;
    const value = data?.default_add_action;
    return value && addActionKeys.has(value as AddActionKey)
      ? (value as AddActionKey)
      : null;
  },

  async set(ownerId: string, action: AddActionKey | null): Promise<void> {
    const { error } = await client
      .from("user_preferences")
      .update({ default_add_action: action })
      .eq("owner_id", ownerId);
    if (error) throw error;
  },
};

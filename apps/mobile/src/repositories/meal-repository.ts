import type { SupabaseClient } from "@supabase/supabase-js";

import type { Meal, MealMedia } from "@/features/meals/types";
import type { MealDraft, MealFilter } from "@/schemas/meal";
import { supabase } from "@/services/supabase/client";

type Json =
  boolean | null | number | string | Json[] | { [key: string]: Json | undefined };
type Table<Row> = {
  Insert: Partial<Row>;
  Relationships: [];
  Row: Row;
  Update: Partial<Row>;
};
type MealRow = {
  appetite_response: string | null;
  enjoyment: string | null;
  id: string;
  meal_type: string | null;
  nausea_after: string | null;
  nausea_before: string | null;
  notes: string | null;
  occurred_at: string;
  owner_id: string;
  pregnancy_id: string;
  updated_at: string;
  would_eat_again: boolean | null;
};
type ItemRow = { id: string; item_name: string; meal_id: string; owner_id: string };
type MediaRow = {
  id: string;
  meal_id: string | null;
  mime_type: string;
  upload_status: string;
  deleted_at: string | null;
};
type Database = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      save_meal_log: {
        Args: {
          p_appetite_response: string | null;
          p_enjoyment: string | null;
          p_expected_updated_at: string | null;
          p_free_text: string | null;
          p_ingredients: string[];
          p_meal_id: string;
          p_meal_type: string | null;
          p_mutation_id: string;
          p_nausea_after: string | null;
          p_nausea_before: string | null;
          p_occurred_at: string | null;
          p_pregnancy_id: string;
          p_would_eat_again: boolean | null;
        };
        Returns: Json;
      };
    };
    Tables: {
      meal_items: Table<ItemRow>;
      meals: Table<MealRow>;
      media_assets: Table<MediaRow>;
    };
    Views: Record<string, never>;
  };
};
const client = supabase as unknown as SupabaseClient<Database>;

function mediaStatus(value: string): MealMedia["status"] {
  return value === "ready" || value === "failed" ? value : "pending";
}

function value<T extends string>(raw: string | null): T | null {
  return raw as T | null;
}

export const mealRepository = {
  async list(pregnancyId: string, filter: MealFilter): Promise<Meal[]> {
    let query = client
      .from("meals")
      .select(
        "id,pregnancy_id,owner_id,occurred_at,meal_type,notes,appetite_response,nausea_before,nausea_after,enjoyment,would_eat_again,updated_at",
      )
      .eq("pregnancy_id", pregnancyId);
    if (filter.mealType) query = query.eq("meal_type", filter.mealType);
    if (filter.appetiteResponse)
      query = query.eq("appetite_response", filter.appetiteResponse);
    if (filter.wouldEatAgain !== null)
      query = query.eq("would_eat_again", filter.wouldEatAgain);
    const { data, error } = await query
      .order("occurred_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const ids = data.map((meal) => meal.id);
    const [itemsResult, mediaResult] = ids.length
      ? await Promise.all([
          client
            .from("meal_items")
            .select("id,meal_id,owner_id,item_name")
            .in("meal_id", ids),
          client
            .from("media_assets")
            .select("id,meal_id,mime_type,upload_status,deleted_at")
            .in("meal_id", ids)
            .is("deleted_at", null),
        ])
      : [
          { data: [] as ItemRow[], error: null },
          { data: [] as MediaRow[], error: null },
        ];
    if (itemsResult.error) throw itemsResult.error;
    if (mediaResult.error) throw mediaResult.error;
    return data.map((meal) => ({
      appetiteResponse: value(meal.appetite_response),
      enjoyment: value(meal.enjoyment),
      freeText: meal.notes ?? "",
      id: meal.id,
      ingredients: itemsResult.data
        .filter((item) => item.meal_id === meal.id)
        .map((item) => item.item_name),
      mealType: value(meal.meal_type),
      media: mediaResult.data
        .filter((asset) => asset.meal_id === meal.id)
        .map((asset) => ({
          id: asset.id,
          mimeType: asset.mime_type,
          status: mediaStatus(asset.upload_status),
        })),
      nauseaAfter: value(meal.nausea_after),
      nauseaBefore: value(meal.nausea_before),
      occurredAt: meal.occurred_at,
      pregnancyId: meal.pregnancy_id,
      updatedAt: meal.updated_at,
      wouldEatAgain: meal.would_eat_again,
    })) as Meal[];
  },
  async save(
    draft: MealDraft,
  ): Promise<{ status: "conflict" | "saved"; updatedAt: string }> {
    const { values } = draft;
    const { data, error } = await client.rpc("save_meal_log", {
      p_appetite_response: values.appetiteResponse,
      p_enjoyment: values.enjoyment,
      p_expected_updated_at: draft.baseServerUpdatedAt,
      p_free_text: values.freeText.trim() || null,
      p_ingredients: values.ingredients,
      p_meal_id: draft.mealId,
      p_meal_type: values.mealType,
      p_mutation_id: draft.mutationId,
      p_nausea_after: values.nauseaAfter,
      p_nausea_before: values.nauseaBefore,
      p_occurred_at: values.occurredAt,
      p_pregnancy_id: draft.pregnancyId,
      p_would_eat_again: values.wouldEatAgain,
    });
    if (error) throw error;
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      (data.status !== "saved" && data.status !== "conflict") ||
      typeof data.updated_at !== "string"
    )
      throw new Error("Invalid meal save response.");
    return { status: data.status, updatedAt: data.updated_at };
  },
};

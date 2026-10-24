import type { SupabaseClient } from "@supabase/supabase-js";

import type { JournalEntry, JournalMedia, JournalTag } from "@/features/journal/types";
import { permanentlyDeleteJournalEntry } from "@/features/journal/media-workflow";
import {
  journalSaveInputSchema,
  type JournalDraft,
  type JournalSaveInput,
  type MediaUploadJob,
} from "@/schemas/journal";
import { supabase } from "@/services/supabase/client";

type Json =
  boolean | null | number | string | Json[] | { [key: string]: Json | undefined };
type Table<Row> = {
  Insert: Partial<Row>;
  Relationships: [];
  Row: Row;
  Update: Partial<Row>;
};
type EntryRow = {
  archived_at: string | null;
  body: string;
  entry_at: string;
  id: string;
  is_pinned: boolean;
  owner_id: string;
  pregnancy_id: string;
  privacy_level: string;
  resurface_allowed: boolean;
  search_vector: unknown;
  title: string | null;
  updated_at: string;
};
type TagRow = { id: string; name: string; owner_id: string };
type TagLinkRow = { journal_entry_id: string; owner_id: string; tag_id: string };
type MediaRow = {
  byte_size: number;
  deleted_at: string | null;
  id: string;
  journal_entry_id: string | null;
  meal_id: string | null;
  media_kind: string;
  mime_type: string;
  owner_id: string;
  pregnancy_id: string;
  storage_bucket: string;
  storage_path: string;
  upload_error_code: string | null;
  upload_status: string;
};
type PregnancyRow = {
  created_at: string;
  ended_at: string | null;
  id: string;
  owner_id: string;
  updated_at: string;
};
type JournalDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      get_current_pregnancy_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      save_journal_entry_v2: {
        Args: {
          p_body: string;
          p_entry_at: string;
          p_entry_id: string;
          p_expected_updated_at: string | null;
          p_is_pinned: boolean;
          p_pregnancy_id: string;
          p_privacy_level: string;
          p_resurface_allowed: boolean;
          p_tag_ids: string[];
          p_title: string;
        };
        Returns: Json;
      };
      save_weekly_memory_capsule: {
        Args: {
          p_entry_ids: string[];
          p_pregnancy_id: string;
          p_title: string;
          p_week_start: string;
        };
        Returns: string;
      };
    };
    Tables: {
      journal_entries: Table<EntryRow>;
      journal_entry_tags: Table<TagLinkRow>;
      media_assets: Table<MediaRow>;
      pregnancies: Table<PregnancyRow>;
      tags: Table<TagRow>;
    };
    Views: Record<string, never>;
  };
};

const client = supabase as unknown as SupabaseClient<JournalDatabase>;

function mediaStatus(value: string): JournalMedia["status"] {
  return value === "ready" || value === "failed" || value === "deleted"
    ? value
    : "pending";
}

function assemble(
  rows: EntryRow[],
  tags: TagRow[],
  links: TagLinkRow[],
  media: MediaRow[],
): JournalEntry[] {
  const tagsById = new Map(tags.map((tag) => [tag.id, { id: tag.id, name: tag.name }]));
  return rows.map((row) => ({
    body: row.body,
    entryAt: row.entry_at,
    id: row.id,
    isFavorite: row.is_pinned,
    media: media
      .filter((asset) => asset.journal_entry_id === row.id && asset.deleted_at === null)
      .map((asset) => ({
        id: asset.id,
        kind: asset.media_kind === "voice" ? "voice" : "image",
        mimeType: asset.mime_type,
        status: mediaStatus(asset.upload_status),
      })),
    pregnancyId: row.pregnancy_id,
    privacy: row.privacy_level === "shared" ? "shared" : "private",
    resurfaceAllowed: row.resurface_allowed,
    tags: links
      .filter((link) => link.journal_entry_id === row.id)
      .flatMap((link) => tagsById.get(link.tag_id) ?? []),
    title: row.title ?? "",
    updatedAt: row.updated_at,
  }));
}

async function related(entries: EntryRow[]) {
  if (entries.length === 0)
    return { links: [] as TagLinkRow[], media: [] as MediaRow[], tags: [] as TagRow[] };
  const ids = entries.map((entry) => entry.id);
  const [linkResult, mediaResult] = await Promise.all([
    client
      .from("journal_entry_tags")
      .select("journal_entry_id,owner_id,tag_id")
      .in("journal_entry_id", ids),
    client
      .from("media_assets")
      .select(
        "id,pregnancy_id,owner_id,journal_entry_id,meal_id,storage_bucket,storage_path,mime_type,byte_size,media_kind,upload_status,upload_error_code,deleted_at",
      )
      .in("journal_entry_id", ids)
      .is("deleted_at", null),
  ]);
  if (linkResult.error) throw linkResult.error;
  if (mediaResult.error) throw mediaResult.error;
  const tagIds = [...new Set(linkResult.data.map((link) => link.tag_id))];
  const tagResult = tagIds.length
    ? await client.from("tags").select("id,owner_id,name").in("id", tagIds)
    : { data: [] as TagRow[], error: null };
  if (tagResult.error) throw tagResult.error;
  return { links: linkResult.data, media: mediaResult.data, tags: tagResult.data };
}

export const journalRepository = {
  async createTag(ownerId: string, name: string): Promise<JournalTag> {
    const normalized = name.trim();
    const { data, error } = await client
      .from("tags")
      .insert({ name: normalized, owner_id: ownerId })
      .select("id,owner_id,name")
      .single();
    if (error) throw error;
    return { id: data.id, name: data.name };
  },

  async deleteEntry(ownerId: string, entryId: string): Promise<void> {
    const { data: assets, error: assetError } = await client
      .from("media_assets")
      .select(
        "id,pregnancy_id,owner_id,journal_entry_id,meal_id,storage_bucket,storage_path,mime_type,byte_size,media_kind,upload_status,upload_error_code,deleted_at",
      )
      .eq("owner_id", ownerId)
      .eq("journal_entry_id", entryId)
      .is("deleted_at", null);
    if (assetError) throw assetError;
    await permanentlyDeleteJournalEntry({
      deleteEntryRow: async () => {
        const { error } = await client
          .from("journal_entries")
          .delete()
          .eq("owner_id", ownerId)
          .eq("id", entryId);
        if (error) throw error;
      },
      deleteMediaRow: async (assetId) => {
        const { error } = await client
          .from("media_assets")
          .delete()
          .eq("owner_id", ownerId)
          .eq("id", assetId);
        if (error) throw error;
      },
      media: assets.map((asset) => ({
        id: asset.id,
        objectPath: asset.storage_path,
        ready: asset.upload_status === "ready",
      })),
      removePrivateObject: async (path) => {
        const { error } = await supabase.storage.from("tender-media").remove([path]);
        if (error) throw error;
      },
    });
  },

  async deleteMedia(ownerId: string, assetId: string): Promise<void> {
    const { data: asset, error: fetchError } = await client
      .from("media_assets")
      .select(
        "id,pregnancy_id,owner_id,journal_entry_id,meal_id,storage_bucket,storage_path,mime_type,byte_size,media_kind,upload_status,upload_error_code,deleted_at",
      )
      .eq("owner_id", ownerId)
      .eq("id", assetId)
      .single();
    if (fetchError) throw fetchError;
    if (asset.upload_status === "ready") {
      const { error: storageError } = await supabase.storage
        .from(asset.storage_bucket)
        .remove([asset.storage_path]);
      if (storageError) throw storageError;
    }
    const { error } = await client
      .from("media_assets")
      .delete()
      .eq("owner_id", ownerId)
      .eq("id", assetId);
    if (error) throw error;
  },

  async getActivePregnancy(ownerId: string): Promise<string | null> {
    if (!ownerId) return null;
    const result = await client.rpc("get_current_pregnancy_id");
    if (result.error) throw result.error;
    return result.data;
  },

  async getEntry(ownerId: string, entryId: string): Promise<JournalEntry | null> {
    const { data, error } = await client
      .from("journal_entries")
      .select(
        "id,pregnancy_id,owner_id,title,body,entry_at,is_pinned,privacy_level,resurface_allowed,updated_at,archived_at,search_vector",
      )
      .eq("owner_id", ownerId)
      .eq("id", entryId)
      .is("archived_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const relations = await related([data]);
    return (
      assemble([data], relations.tags, relations.links, relations.media)[0] ?? null
    );
  },

  async getSignedMediaUrl(assetId: string): Promise<string> {
    const { data: asset, error } = await client
      .from("media_assets")
      .select(
        "id,pregnancy_id,owner_id,journal_entry_id,meal_id,storage_bucket,storage_path,mime_type,byte_size,media_kind,upload_status,upload_error_code,deleted_at",
      )
      .eq("id", assetId)
      .eq("upload_status", "ready")
      .is("deleted_at", null)
      .single();
    if (error) throw error;
    const signed = await supabase.storage
      .from(asset.storage_bucket)
      .createSignedUrl(asset.storage_path, 60);
    if (signed.error) throw signed.error;
    return signed.data.signedUrl;
  },

  async listEntries(
    ownerId: string,
    pregnancyId: string,
    options?: {
      favoritesOnly?: boolean;
      query?: string;
      start?: string;
      end?: string;
      privacy?: string;
      tagId?: string;
    },
  ): Promise<JournalEntry[]> {
    let query = client
      .from("journal_entries")
      .select(
        "id,pregnancy_id,owner_id,title,body,entry_at,is_pinned,privacy_level,resurface_allowed,updated_at,archived_at,search_vector",
      )
      .eq("owner_id", ownerId)
      .eq("pregnancy_id", pregnancyId)
      .is("archived_at", null);
    if (options?.favoritesOnly) query = query.eq("is_pinned", true);
    if (options?.start)
      query = query.gte(
        "entry_at",
        new Date(`${options.start}T00:00:00`).toISOString(),
      );
    if (options?.end)
      query = query.lte(
        "entry_at",
        new Date(`${options.end}T23:59:59.999`).toISOString(),
      );
    if (options?.privacy) query = query.eq("privacy_level", options.privacy);
    if (options?.tagId) {
      const links = await client
        .from("journal_entry_tags")
        .select("journal_entry_id")
        .eq("owner_id", ownerId)
        .eq("tag_id", options.tagId);
      if (links.error) throw links.error;
      if (!links.data.length) return [];
      query = query.in(
        "id",
        links.data.map((link) => link.journal_entry_id),
      );
    }
    if (options?.query?.trim()) {
      query = query.textSearch("search_vector", options.query.trim(), {
        config: "simple",
        type: "websearch",
      });
    }
    const { data, error } = await query
      .order("entry_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const relations = await related(data);
    return assemble(data, relations.tags, relations.links, relations.media);
  },

  async listTags(ownerId: string): Promise<JournalTag[]> {
    const { data, error } = await client
      .from("tags")
      .select("id,owner_id,name")
      .eq("owner_id", ownerId)
      .order("name");
    if (error) throw error;
    return data.map(({ id, name }) => ({ id, name }));
  },

  async registerMedia(
    ownerId: string,
    pregnancyId: string,
    job: MediaUploadJob,
  ): Promise<void> {
    const { error } = await client.from("media_assets").upsert({
      byte_size: job.byteSize,
      deleted_at: null,
      id: job.assetId,
      journal_entry_id: job.journalEntryId,
      meal_id: job.mealId,
      media_kind: job.kind,
      mime_type: job.mimeType,
      owner_id: ownerId,
      pregnancy_id: pregnancyId,
      storage_bucket: "tender-media",
      storage_path: job.objectPath,
      upload_error_code: null,
      upload_status: "pending",
    });
    if (error) throw error;
  },

  async save(
    input: JournalSaveInput,
  ): Promise<{ status: "conflict" | "saved"; updatedAt: string }> {
    const parsed = journalSaveInputSchema.parse(input);
    const { data, error } = await client.rpc("save_journal_entry_v2", {
      p_body: parsed.body,
      p_entry_at: parsed.entryAt,
      p_entry_id: parsed.entryId,
      p_expected_updated_at: parsed.baseServerUpdatedAt,
      p_is_pinned: parsed.isFavorite,
      p_pregnancy_id: parsed.pregnancyId,
      p_privacy_level: parsed.privacy,
      p_resurface_allowed: parsed.resurfaceAllowed,
      p_tag_ids: parsed.tagIds,
      p_title: parsed.title,
    });
    if (error) throw error;
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error("Invalid journal save response.");
    const status = data.status;
    const updatedAt = data.updated_at;
    if (
      (status !== "saved" && status !== "conflict") ||
      typeof updatedAt !== "string"
    ) {
      throw new Error("Invalid journal save response.");
    }
    return { status, updatedAt };
  },

  async saveWeeklyCapsule(input: {
    entryIds: string[];
    ownerId: string;
    pregnancyId: string;
    title: string;
    weekStart: string;
  }): Promise<string> {
    if (!input.ownerId) throw new Error("Authentication required.");
    if (input.entryIds.length < 1 || input.entryIds.length > 5) {
      throw new Error("Choose between one and five memories.");
    }
    const { data, error } = await client.rpc("save_weekly_memory_capsule", {
      p_entry_ids: input.entryIds,
      p_pregnancy_id: input.pregnancyId,
      p_title: input.title,
      p_week_start: input.weekStart,
    });
    if (error) throw error;
    if (!data) throw new Error("Memory capsule was not saved.");
    return data;
  },

  async updateMediaStatus(
    ownerId: string,
    assetId: string,
    status: "failed" | "ready",
    errorCode: string | null,
  ): Promise<void> {
    const { error } = await client
      .from("media_assets")
      .update({ upload_error_code: errorCode, upload_status: status })
      .eq("owner_id", ownerId)
      .eq("id", assetId);
    if (error) throw error;
  },
};

export function entryToDraft(entry: JournalEntry): JournalDraft {
  return {
    baseServerUpdatedAt: entry.updatedAt,
    body: entry.body,
    entryAt: entry.entryAt,
    entryId: entry.id,
    isFavorite: entry.isFavorite,
    media: [],
    pregnancyId: entry.pregnancyId,
    privacy: entry.privacy,
    resurfaceAllowed: entry.resurfaceAllowed,
    status: "saved",
    tagIds: entry.tags.map((tag) => tag.id),
    title: entry.title,
    updatedAt: entry.updatedAt,
    version: 1,
  };
}

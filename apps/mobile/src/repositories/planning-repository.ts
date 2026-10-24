import type { SupabaseClient } from "@supabase/supabase-js";

import type { PlanningContext } from "@/features/planning/types";
import { supabase } from "@/services/supabase/client";

type Row = Record<string, unknown>;
type Table = { Insert: Row; Relationships: []; Row: Row; Update: Row };
type PlanningDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      create_planning_list: {
        Args: {
          p_project_id: string;
          p_pregnancy_id: string;
          p_title: string;
          p_tasks: string[];
        };
        Returns: string;
      };
    };
    Tables: { projects: Table; support_requests: Table; tasks: Table };
    Views: Record<string, never>;
  };
};
const client = supabase as unknown as SupabaseClient<PlanningDatabase>;

function required<T>(result: { data: T | null; error: unknown }): T {
  if (result.error || result.data === null)
    throw result.error ?? new Error("missing_data");
  return result.data;
}

export const planningRepository = {
  async createList(input: {
    projectId: string;
    pregnancyId: string;
    title: string;
    tasks: string[];
  }): Promise<void> {
    const { error } = await client.rpc("create_planning_list", {
      p_project_id: input.projectId,
      p_pregnancy_id: input.pregnancyId,
      p_title: input.title,
      p_tasks: input.tasks,
    });
    if (error) throw error;
  },
  async renameTask(ownerId: string, id: string, title: string): Promise<void> {
    if (!title.trim() || title.trim().length > 240)
      throw new Error("invalid_task_title");
    const { error } = await client
      .from("tasks")
      .update({ title: title.trim() })
      .eq("owner_id", ownerId)
      .eq("id", id);
    if (error) throw error;
  },
  async setTaskRemoved(ownerId: string, id: string, removed: boolean): Promise<void> {
    const { error } = await client
      .from("tasks")
      .update({ status: removed ? "cancelled" : "open", completed_at: null })
      .eq("owner_id", ownerId)
      .eq("id", id);
    if (error) throw error;
  },
  async list(pregnancyId: string): Promise<PlanningContext> {
    const [projects, support] = await Promise.all([
      client
        .from("projects")
        .select("id,title,description,status")
        .eq("pregnancy_id", pregnancyId)
        .order("created_at"),
      client
        .from("support_requests")
        .select("id,title,description,status")
        .eq("pregnancy_id", pregnancyId)
        .order("requested_at", { ascending: false }),
    ]);
    const projectRows = required(projects) as unknown as {
      id: string;
      title: string;
      description: string | null;
      status: PlanningContext["projects"][number]["status"];
    }[];
    const taskResult = projectRows.length
      ? await client
          .from("tasks")
          .select("id,project_id,title,status")
          .in(
            "project_id",
            projectRows.map((item) => item.id),
          )
          .order("position")
      : { data: [] as Row[], error: null };
    const supportRows = required(support) as unknown as {
      id: string;
      title: string;
      description: string | null;
      status: PlanningContext["supportRequests"][number]["status"];
    }[];
    const taskRows = required(taskResult) as unknown as {
      id: string;
      project_id: string;
      title: string;
      status: PlanningContext["tasks"][number]["status"];
    }[];
    return {
      projects: projectRows,
      supportRequests: supportRows,
      tasks: taskRows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        status: row.status,
        title: row.title,
      })),
    };
  },
  async addProject(ownerId: string, pregnancyId: string, title: string): Promise<void> {
    const result = await client
      .from("projects")
      .insert({ owner_id: ownerId, pregnancy_id: pregnancyId, title: title.trim() });
    if (result.error) throw result.error;
  },
  async addTask(ownerId: string, projectId: string, title: string): Promise<void> {
    const result = await client
      .from("tasks")
      .insert({ owner_id: ownerId, project_id: projectId, title: title.trim() });
    if (result.error) throw result.error;
  },
  async addSupportRequest(
    ownerId: string,
    pregnancyId: string,
    title: string,
    requestedFromUserId: string | null,
  ): Promise<void> {
    const result = await client.from("support_requests").insert({
      owner_id: ownerId,
      pregnancy_id: pregnancyId,
      requested_from_user_id: requestedFromUserId,
      title: title.trim(),
    });
    if (result.error) throw result.error;
  },
  async setTaskStatus(ownerId: string, id: string, completed: boolean): Promise<void> {
    const result = await client
      .from("tasks")
      .update({
        completed_at: completed ? new Date().toISOString() : null,
        status: completed ? "completed" : "open",
      })
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (result.error) throw result.error;
  },
  async cancelSupportRequest(ownerId: string, id: string): Promise<void> {
    const result = await client
      .from("support_requests")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (result.error) throw result.error;
  },
};

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  TogetherContext,
  TogetherHistory,
  TogetherItem,
  TogetherPermission,
} from "@/features/together/types";
import { togetherPermissions } from "@/features/together/types";
import { supabase } from "@/services/supabase/client";

type Table<Row> = {
  Insert: Partial<Row>;
  Relationships: [];
  Row: Row;
  Update: Partial<Row>;
};
type Pregnancy = { id: string; owner_id: string };
type Member = {
  id: string;
  membership_role: string;
  pregnancy_id: string;
  status: string;
  user_id: string;
};
type Invitation = {
  expires_at: string;
  id: string;
  invitation_role: string;
  invited_email: string;
  permissions: string[];
  pregnancy_id: string;
  status: string;
};
type Grant = {
  grantee_user_id: string;
  permission: string;
  pregnancy_id: string;
  revoked_at: string | null;
};
type Override = {
  allowed: boolean;
  grantee_user_id: string;
  pregnancy_id: string;
  resource_id: string;
};
type Appointment = {
  id: string;
  location: string | null;
  pregnancy_id: string;
  starts_at: string;
  title: string;
};
type AppointmentQuestion = { appointment_id: string; question: string };
type Project = { id: string; pregnancy_id: string };
type Task = {
  description: string | null;
  due_at: string | null;
  id: string;
  project_id: string;
  status: string;
  title: string;
};
type Support = {
  description: string | null;
  id: string;
  pregnancy_id: string;
  requested_at: string;
  status: string;
  title: string;
};
type Journal = {
  entry_at: string;
  id: string;
  pregnancy_id: string;
  privacy_level: string;
  title: string | null;
};
type Notification = {
  body: string;
  created_at: string;
  id: string;
  pregnancy_id: string;
  read_at: string | null;
  title: string;
};
type HistoryRow = {
  actor_user_id: string | null;
  event_type: string;
  id: string;
  occurred_at: string;
  resource_id: string | null;
  resource_type: string;
  subject_user_id: string | null;
};
type TogetherDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      get_sharing_access_history: {
        Args: { p_pregnancy_id: string };
        Returns: HistoryRow[];
      };
      mark_sharing_notification_read: {
        Args: { p_notification_id: string };
        Returns: undefined;
      };
      respond_to_support_request: {
        Args: { p_action: string; p_support_request_id: string };
        Returns: undefined;
      };
    };
    Tables: {
      appointments: Table<Appointment>;
      appointment_questions: Table<AppointmentQuestion>;
      journal_entries: Table<Journal>;
      partner_invitations: Table<Invitation>;
      pregnancies: Table<Pregnancy>;
      pregnancy_members: Table<Member>;
      projects: Table<Project>;
      sharing_grants: Table<Grant>;
      sharing_item_overrides: Table<Override>;
      support_requests: Table<Support>;
      tasks: Table<Task>;
      user_notifications: Table<Notification>;
    };
    Views: Record<string, never>;
  };
};

const client = supabase as unknown as SupabaseClient<TogetherDatabase>;
const permissionSet = new Set<string>(togetherPermissions);
function permission(value: string): TogetherPermission | null {
  return permissionSet.has(value) ? (value as TogetherPermission) : null;
}
function required<T>(result: { data: T | null; error: unknown }): T {
  if (result.error || result.data === null)
    throw result.error ?? new Error("missing_data");
  return result.data;
}

export const togetherRepository = {
  async getContext(userId: string): Promise<TogetherContext | null> {
    const pregnancyResult = await client
      .from("pregnancies")
      .select("id,owner_id")
      .limit(1)
      .maybeSingle();
    if (pregnancyResult.error) throw pregnancyResult.error;
    const pregnancy = pregnancyResult.data;
    if (!pregnancy) return null;
    const isOwner = pregnancy.owner_id === userId;
    const pregnancyId = pregnancy.id;
    const [
      members,
      invitations,
      grants,
      overrides,
      appointments,
      projects,
      supports,
      journals,
      notifications,
      history,
    ] = await Promise.all([
      client
        .from("pregnancy_members")
        .select("id,user_id,membership_role,status")
        .eq("pregnancy_id", pregnancyId),
      isOwner
        ? client
            .from("partner_invitations")
            .select("id,invited_email,invitation_role,status,expires_at,permissions")
            .eq("pregnancy_id", pregnancyId)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as Invitation[], error: null }),
      client
        .from("sharing_grants")
        .select("grantee_user_id,permission,revoked_at")
        .eq("pregnancy_id", pregnancyId)
        .is("revoked_at", null),
      isOwner
        ? client
            .from("sharing_item_overrides")
            .select("grantee_user_id,resource_id,allowed")
            .eq("pregnancy_id", pregnancyId)
        : Promise.resolve({ data: [] as Override[], error: null }),
      client
        .from("appointments")
        .select("id,title,starts_at,location")
        .eq("pregnancy_id", pregnancyId)
        .order("starts_at"),
      isOwner
        ? client
            .from("projects")
            .select("id,pregnancy_id")
            .eq("pregnancy_id", pregnancyId)
        : Promise.resolve({ data: [] as Project[], error: null }),
      client
        .from("support_requests")
        .select("id,title,description,status,requested_at")
        .eq("pregnancy_id", pregnancyId)
        .order("requested_at", { ascending: false }),
      client
        .from("journal_entries")
        .select("id,title,entry_at,privacy_level")
        .eq("pregnancy_id", pregnancyId)
        .eq("privacy_level", "shared")
        .order("entry_at", { ascending: false }),
      isOwner
        ? client
            .from("user_notifications")
            .select("id,title,body,created_at,read_at")
            .eq("pregnancy_id", pregnancyId)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] as Notification[], error: null }),
      isOwner
        ? client.rpc("get_sharing_access_history", { p_pregnancy_id: pregnancyId })
        : Promise.resolve({ data: [] as HistoryRow[], error: null }),
    ]);
    const projectIds = required(projects).map((project) => project.id);
    const appointmentIds = required(appointments).map((appointment) => appointment.id);
    const tasks = projectIds.length
      ? await client
          .from("tasks")
          .select("id,project_id,title,description,status,due_at")
          .in("project_id", projectIds)
      : isOwner
        ? { data: [] as Task[], error: null }
        : await client
            .from("tasks")
            .select("id,project_id,title,description,status,due_at");
    const questions = appointmentIds.length
      ? await client
          .from("appointment_questions")
          .select("appointment_id,question")
          .in("appointment_id", appointmentIds)
      : { data: [] as AppointmentQuestion[], error: null };
    const results = [
      members,
      invitations,
      grants,
      overrides,
      appointments,
      supports,
      journals,
      notifications,
      history,
      tasks,
      questions,
    ];
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
    const items: TogetherItem[] = [
      ...required(appointments).map((row) => ({
        date: row.starts_at,
        id: row.id,
        permission: "appointments.read" as const,
        resourceType: "appointment" as const,
        subtitle:
          [
            row.location,
            ...required(questions)
              .filter((question) => question.appointment_id === row.id)
              .map((question) => `Question: ${question.question}`),
          ]
            .filter(Boolean)
            .join(" · ") || null,
        title: row.title,
      })),
      ...required(tasks).map((row) => ({
        date: row.due_at,
        id: row.id,
        permission: "tasks.read" as const,
        resourceType: "task" as const,
        subtitle: row.status,
        title: row.title,
      })),
      ...required(supports).map((row) => ({
        date: row.requested_at,
        id: row.id,
        permission: "support_requests.read" as const,
        resourceType: "support_request" as const,
        subtitle: row.status,
        title: row.title,
      })),
      ...required(journals).map((row) => ({
        date: row.entry_at,
        id: row.id,
        permission: "journal.read" as const,
        resourceType: "journal_entry" as const,
        subtitle: "Shared journal entry",
        title: row.title || "Untitled journal entry",
      })),
    ];
    return {
      grants: required(grants)
        .filter((row) => permission(row.permission))
        .map((row) => ({
          granteeUserId: row.grantee_user_id,
          permission: row.permission,
        })),
      history: required(history).map((row): TogetherHistory => ({
        eventType: row.event_type,
        id: row.id,
        occurredAt: row.occurred_at,
        resourceType: row.resource_type,
      })),
      invitations: required(invitations).map((row) => ({
        email: row.invited_email,
        expiresAt: row.expires_at,
        id: row.id,
        permissions: row.permissions.flatMap((value) => permission(value) ?? []),
        role: row.invitation_role,
        status: row.status,
      })),
      isOwner,
      items,
      members: required(members).map((row) => ({
        id: row.id,
        role: row.membership_role,
        status: row.status,
        userId: row.user_id,
      })),
      notifications: required(notifications).map((row) => ({
        body: row.body,
        createdAt: row.created_at,
        id: row.id,
        readAt: row.read_at,
        title: row.title,
      })),
      overrides: required(overrides).map((row) => ({
        allowed: row.allowed,
        granteeUserId: row.grantee_user_id,
        resourceId: row.resource_id,
      })),
      ownerId: pregnancy.owner_id,
      pregnancyId,
    };
  },
  async markNotificationRead(notificationId: string): Promise<void> {
    const result = await client.rpc("mark_sharing_notification_read", {
      p_notification_id: notificationId,
    });
    if (result.error) throw result.error;
  },
  async respondToSupportRequest(
    supportRequestId: string,
    action: "accept" | "decline" | "resolve",
  ): Promise<void> {
    const result = await client.rpc("respond_to_support_request", {
      p_action: action,
      p_support_request_id: supportRequestId,
    });
    if (result.error) throw result.error;
  },
};

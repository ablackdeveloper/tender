export const togetherPermissions = [
  "appointments.read",
  "tasks.read",
  "support_requests.read",
  "journal.read",
] as const;

export type TogetherPermission = (typeof togetherPermissions)[number];
export type TogetherItem = {
  date: string | null;
  id: string;
  permission: TogetherPermission;
  resourceType: "appointment" | "journal_entry" | "support_request" | "task";
  subtitle: string | null;
  title: string;
};
export type TogetherMember = {
  id: string;
  role: string;
  status: string;
  userId: string;
};
export type TogetherInvitation = {
  email: string;
  expiresAt: string;
  id: string;
  permissions: TogetherPermission[];
  role: string;
  status: string;
};
export type TogetherHistory = {
  eventType: string;
  id: string;
  occurredAt: string;
  resourceType: string;
};
export type TogetherNotification = {
  body: string;
  createdAt: string;
  id: string;
  readAt: string | null;
  title: string;
};
export type TogetherContext = {
  grants: { granteeUserId: string; permission: string }[];
  history: TogetherHistory[];
  invitations: TogetherInvitation[];
  isOwner: boolean;
  items: TogetherItem[];
  members: TogetherMember[];
  notifications: TogetherNotification[];
  overrides: { allowed: boolean; granteeUserId: string; resourceId: string }[];
  ownerId: string;
  pregnancyId: string;
};

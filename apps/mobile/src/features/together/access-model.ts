import type {
  TogetherContext,
  TogetherItem,
  TogetherPermission,
} from "@/features/together/types";

export const permissionCopy: Record<
  TogetherPermission,
  { label: string; impact: string }
> = {
  "appointments.read": {
    label: "Appointments",
    impact: "Shares appointment titles, dates, locations, and prepared questions.",
  },
  "tasks.read": {
    label: "Tasks",
    impact: "Shares planning task titles, status, due dates, and descriptions.",
  },
  "support_requests.read": {
    label: "Support requests",
    impact: "Shares requests for practical support and their current status.",
  },
  "journal.read": {
    label: "Selected journal items",
    impact:
      "Shares only journal entries already marked Shared; private entries stay private.",
  },
};

export function previewPartnerItems(
  context: TogetherContext,
  granteeUserId: string,
  selectedPermissions: readonly TogetherPermission[],
): TogetherItem[] {
  const allowed = new Set(selectedPermissions);
  const denied = new Set(
    context.overrides
      .filter((item) => item.granteeUserId === granteeUserId && !item.allowed)
      .map((item) => item.resourceId),
  );
  return context.items.filter(
    (item) => allowed.has(item.permission) && !denied.has(item.id),
  );
}

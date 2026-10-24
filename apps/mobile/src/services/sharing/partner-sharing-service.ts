import type { TogetherPermission } from "@/features/together/types";
import { invitationTokenSchema, togetherInvitationSchema } from "@/schemas/together";
import { supabase } from "@/services/supabase/client";

async function invoke(body: Record<string, unknown>): Promise<void> {
  const result = await supabase.functions.invoke("partner-sharing", { body });
  if (result.error) throw result.error;
}

export const partnerSharingService = {
  accept(token: string) {
    return invoke({ action: "accept", token: invitationTokenSchema.parse(token) });
  },
  decline(token: string) {
    return invoke({ action: "decline", token: invitationTokenSchema.parse(token) });
  },
  invite(input: {
    email: string;
    permissions: TogetherPermission[];
    pregnancyId: string;
    role: "caregiver" | "partner" | "support_person";
  }) {
    return invoke({ action: "invite", ...togetherInvitationSchema.parse(input) });
  },
  revokeInvitation(invitationId: string) {
    return invoke({ action: "revokeInvitation", invitationId });
  },
  revokePartner(granteeUserId: string, pregnancyId: string) {
    return invoke({ action: "revokePartner", granteeUserId, pregnancyId });
  },
  setItemOverride(input: {
    allowed: boolean;
    granteeUserId: string;
    permission: TogetherPermission;
    pregnancyId: string;
    resourceId: string;
    resourceType: string;
  }) {
    return invoke({ action: "setItemOverride", ...input });
  },
  setPermissions(
    granteeUserId: string,
    permissions: TogetherPermission[],
    pregnancyId: string,
  ) {
    return invoke({
      action: "setPermissions",
      granteeUserId,
      permissions,
      pregnancyId,
    });
  },
};

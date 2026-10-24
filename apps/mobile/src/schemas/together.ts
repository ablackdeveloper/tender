import { z } from "zod";

import { togetherPermissions } from "@/features/together/types";

export const togetherInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  permissions: z.array(z.enum(togetherPermissions)).max(4),
  pregnancyId: z.uuid(),
  role: z.enum(["partner", "support_person", "caregiver"]),
});

export const invitationTokenSchema = z.string().min(43).max(512);

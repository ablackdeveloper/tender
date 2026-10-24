import type { CheckInDraft } from "@/schemas/check-in";

export type SelectionOption = { displayName: string; id: string; slug: string };

export type CheckInContext = {
  careTeamPhone: string | null;
  emotionOptions: SelectionOption[];
  pregnancyId: string;
  serverDraft: CheckInDraft | null;
  symptomOptions: SelectionOption[];
};

export type UrgentGuidance = {
  body: string;
  careTeamActionLabel: string;
  emergencyActionLabel: string;
  emergencyActionUri: string;
  id: string;
  title: string;
};

export type CheckInSyncResult =
  | {
      checkinId: string;
      completedAt: string | null;
      status: "applied";
      updatedAt: string;
    }
  | {
      checkinId: string;
      completedAt: string | null;
      status: "conflict";
      updatedAt: string;
    };
